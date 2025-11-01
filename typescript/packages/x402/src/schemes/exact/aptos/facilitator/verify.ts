import {
  VerifyResponse,
  PaymentPayload,
  PaymentRequirements,
  ExactAptosPayload,
} from "../../../../types/verify";
import { X402Config } from "../../../../types/config";
import { AptosConnectedClient, getAptosRpcUrl } from "../../../../shared/aptos/wallet";
import { Aptos, AptosConfig, Network as AptosNetwork } from "@aptos-labs/ts-sdk";
import { deserializeAptosPayment } from "./utils";

/**
 * Verify the payment payload against the payment requirements for Aptos.
 *
 * This function verifies that an Aptos x402 payment transaction is valid by:
 * 1. Deserializing the BCS-encoded transaction
 * 2. Verifying the transaction calls the correct transfer function
 * 3. Validating the payment amount matches requirements
 * 4. Checking the recipient address is correct
 * 5. Simulating the transaction to ensure it will succeed
 *
 * Note: Unlike SVM, Aptos verification does NOT require a signer.
 * The transaction is already fully signed by the client, so we only need
 * a read-only connection to verify and simulate it.
 *
 * @param client - The Aptos connected client (read-only)
 * @param payload - The payment payload to verify
 * @param paymentRequirements - The payment requirements to verify against
 * @param config - Optional configuration for X402 operations (e.g., custom RPC URLs)
 * @returns A VerifyResponse indicating if the payment is valid
 */
export async function verify(
  client: AptosConnectedClient,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<VerifyResponse> {
  try {
    const aptosPayload = payload.payload as ExactAptosPayload;

    // Map network to Aptos SDK network
    const aptosNetwork =
      paymentRequirements.network === "aptos-mainnet"
        ? AptosNetwork.MAINNET
        : paymentRequirements.network === "aptos-testnet"
          ? AptosNetwork.TESTNET
          : AptosNetwork.DEVNET;

    // Create Aptos SDK instance
    const rpcUrl = config?.aptosConfig?.rpcUrl || getAptosRpcUrl(paymentRequirements.network);
    const aptosConfig = new AptosConfig({
      network: aptosNetwork,
      fullnode: rpcUrl,
    });
    const aptos = new Aptos(aptosConfig);

    // Deserialize the transaction and authenticator
    const { transaction, senderAuthenticator } = deserializeAptosPayment(aptosPayload.transaction);

    // Extract sender address and payload
    const senderAddress = transaction.rawTransaction.sender.toString();
    const txnPayload = transaction.rawTransaction.payload;

    // Check that it's an entry function payload
    if (!("entryFunction" in txnPayload)) {
      console.log("Missing 'entryFunction' in payload");
      return {
        isValid: false,
        invalidReason: "invalid_payment",
        payer: senderAddress,
      };
    }

    // Extract the entry function details
    const entryFunc = (txnPayload as any).entryFunction;

    // Verify the function is the correct transfer function
    const moduleName = entryFunc.module_name?.name?.identifier || "";
    const functionName = entryFunc.function_name?.identifier || "";

    // Construct the full function identifier: 0x<address>::<module>::<function>
    const addressData = entryFunc.module_name?.address?.data;
    let addressHex = "1"; // Default to 0x1
    if (addressData && Array.isArray(addressData)) {
      const hexStr = Buffer.from(addressData).toString("hex");
      // Remove leading zeros but keep at least one digit
      addressHex = hexStr.replace(/^0+/, "") || "1";
    }
    const fullFunctionName = `0x${addressHex}::${moduleName}::${functionName}`;

    console.log("Function name:", fullFunctionName);
    if (fullFunctionName !== "0x1::aptos_account::transfer") {
      console.log("Invalid function. Expected: 0x1::aptos_account::transfer");
      return {
        isValid: false,
        invalidReason: "invalid_payment",
        payer: senderAddress,
      };
    }

    // Extract and verify arguments
    const args = entryFunc.args || [];
    console.log("Arguments count:", args.length);
    if (args.length !== 2) {
      console.log("Invalid arguments length");
      return {
        isValid: false,
        invalidReason: "invalid_payment",
        payer: senderAddress,
      };
    }

    // Parse recipient address from byte array
    const recipientBytes = args[0]?.value?.value;
    let recipientAddress = "";
    if (recipientBytes && typeof recipientBytes === "object") {
      const bytes = Array.isArray(recipientBytes) ? recipientBytes : Object.values(recipientBytes);
      const hexStr = Buffer.from(bytes as number[]).toString("hex");
      // Remove leading zeros but keep at least one digit
      const cleanHex = hexStr.replace(/^0+/, "") || "0";
      recipientAddress = "0x" + cleanHex;
    }

    console.log("Recipient:", recipientAddress, "Expected:", paymentRequirements.payTo);

    // Normalize both addresses for comparison (remove leading zeros)
    const normalizeAddress = (addr: string) => {
      const hex = addr.replace(/^0x/, "");
      const cleaned = hex.replace(/^0+/, "") || "0";
      return "0x" + cleaned;
    };

    if (normalizeAddress(recipientAddress) !== normalizeAddress(paymentRequirements.payTo)) {
      console.log("Invalid recipient");
      return {
        isValid: false,
        invalidReason: "invalid_payment",
        payer: senderAddress,
      };
    }

    // Parse amount from byte array (little-endian u64)
    const amountBytes = args[1]?.value?.value;
    let amount = "";
    if (amountBytes && typeof amountBytes === "object") {
      const bytes = Array.isArray(amountBytes) ? amountBytes : Object.values(amountBytes);
      // Read as little-endian u64
      let value = 0n;
      for (let i = 0; i < Math.min(8, bytes.length); i++) {
        value |= BigInt(bytes[i]) << BigInt(i * 8);
      }
      amount = value.toString();
    }

    console.log("Amount:", amount, "Expected:", paymentRequirements.maxAmountRequired);
    if (amount !== paymentRequirements.maxAmountRequired) {
      console.log("Invalid amount");
      return {
        isValid: false,
        invalidReason: "invalid_payment",
        payer: senderAddress,
      };
    }

    // Simulate the transaction to ensure it will succeed
    console.log("Simulating transaction...");
    try {
      const simulationResult = await aptos.transaction.simulate.simple({
        signerPublicKey: (senderAuthenticator as any).public_key,
        transaction,
      });

      console.log("Simulation results:", simulationResult.length, "responses");

      // Check if any simulation failed
      for (const result of simulationResult) {
        if (!result.success) {
          console.log("Simulation failed with vm_status:", result.vm_status);
          return {
            isValid: false,
            invalidReason: "invalid_payment",
            payer: senderAddress,
          };
        }
      }

      console.log("Simulation succeeded");
    } catch (error) {
      console.error("Simulation error:", error);
      return {
        isValid: false,
        invalidReason: "invalid_payment",
        payer: senderAddress,
      };
    }

    // All checks passed
    return {
      isValid: true,
      payer: senderAddress,
    };
  } catch (error) {
    console.error("Verify error:", error);
    return {
      isValid: false,
      invalidReason: "unexpected_verify_error",
      payer: undefined,
    };
  }
}
