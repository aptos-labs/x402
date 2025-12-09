import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import axios from "axios";
import * as dotenv from "dotenv";
import {
  Account,
  Ed25519PrivateKey,
  Aptos,
  AptosConfig,
  Network,
  AccountAddress,
} from "@aptos-labs/ts-sdk";

dotenv.config();

const app = new Hono();

// Configuration from environment variables
const PORT = process.env.PORT || 3001;
const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:8080";
const RECIPIENT_ADDRESS = process.env.RECIPIENT_ADDRESS || "0x1";
// APT type string (client will convert to metadata address for transaction building)
const APTOS_ASSET = process.env.APTOS_ASSET || "0x1::aptos_coin::AptosCoin";
const PAYMENT_AMOUNT = process.env.PAYMENT_AMOUNT || "10000000"; // 0.1 APT (8 decimals)
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";

// Enable CORS for frontend
app.use(
  "/*",
  cors({
    origin: CLIENT_URL.split(",").map((url) => url.trim()),
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-PAYMENT"],
    exposeHeaders: ["X-PAYMENT-RESPONSE"],
  }),
);

// Health check endpoint
app.get("/api/health", (c) => {
  return c.json({ status: "ok", facilitator: FACILITATOR_URL });
});

// Payment creation endpoint
app.post("/api/create-payment", async (c) => {
  try {
    const body = await c.req.json();
    const { privateKey, paymentRequirements } = body;

    if (!privateKey || !paymentRequirements) {
      return c.json(
        { error: "Missing privateKey or paymentRequirements" },
        400,
      );
    }

    console.log("Creating payment with requirements:", paymentRequirements);

    // Initialize Aptos client
    const config = new AptosConfig({ network: Network.TESTNET });
    const aptos = new Aptos(config);

    // Create account from private key
    const pkHex = privateKey.startsWith("0x")
      ? privateKey.slice(2)
      : privateKey;
    const privateKeyObj = new Ed25519PrivateKey(pkHex);
    const account = Account.fromPrivateKey({ privateKey: privateKeyObj });

    console.log("Account address:", account.accountAddress.toString());

    // Convert asset address to metadata address if needed
    let assetAddress = paymentRequirements.asset;
    if (assetAddress.includes("::")) {
      // It's a Move type string, extract just the address part
      assetAddress = assetAddress.split("::")[0];
    }

    // Build the transfer transaction
    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: "0x1::primary_fungible_store::transfer",
        typeArguments: ["0x1::fungible_asset::Metadata"],
        functionArguments: [
          assetAddress, // metadata address
          paymentRequirements.payTo,
          paymentRequirements.maxAmountRequired,
        ],
      },
    });

    console.log("Transaction built successfully");

    // Sign the transaction
    const senderAuthenticator = aptos.transaction.sign({
      signer: account,
      transaction,
    });

    console.log("Transaction signed successfully");

    // Serialize transaction and authenticator to BCS bytes
    // Note: Use rawTransaction property to get just the RawTransaction, not the SimpleTransaction wrapper
    const transactionBytes = transaction.rawTransaction.bcsToBytes();
    const authenticatorBytes = senderAuthenticator.bcsToBytes();

    // Create the Aptos payload structure
    const aptosPayload = {
      transaction: Array.from(transactionBytes),
      senderAuthenticator: Array.from(authenticatorBytes),
    };

    // Create the full payment payload
    const paymentPayload = {
      x402Version: 1,
      scheme: paymentRequirements.scheme || "exact",
      network: paymentRequirements.network || "aptos-testnet",
      payload: {
        transaction: Buffer.from(JSON.stringify(aptosPayload)).toString(
          "base64",
        ),
      },
    };

    // Base64 encode the entire payment payload
    const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString(
      "base64",
    );

    console.log("Payment header created successfully");

    return c.json({ paymentHeader });
  } catch (error: any) {
    console.error("Error creating payment:", error);
    return c.json(
      {
        error: "Failed to create payment",
        details: error.message,
      },
      500,
    );
  }
});

// Protected content endpoint
app.get("/api/protected", async (c) => {
  const paymentHeader = c.req.header("X-PAYMENT");

  // If no payment header, return 402 Payment Required
  if (!paymentHeader) {
    console.log("No payment header found, returning 402");

    return c.json(
      {
        x402Version: 1,
        accepts: [
          {
            scheme: "exact",
            network: "aptos-testnet",
            asset: "0x1::aptos_coin::AptosCoin", // Client needs Move type string
            payTo: RECIPIENT_ADDRESS,
            maxAmountRequired: PAYMENT_AMOUNT,
            resource: `${SERVER_URL}/api/protected`,
            description: "Access to protected content",
            mimeType: "application/json",
            maxTimeoutSeconds: 60,
          },
        ],
      },
      402,
    );
  }

  try {
    // Decode the payment header
    console.log("Payment header received, decoding...");
    const paymentPayload = JSON.parse(atob(paymentHeader));

    console.log("Payment payload:", JSON.stringify(paymentPayload, null, 2));

    // Prepare payment requirements for facilitator
    // Note: x402-rs expects asset as hex address (0x1), not Move type string
    const paymentRequirements = {
      scheme: "exact",
      network: "aptos-testnet",
      asset: "0x1", // APT coin metadata address (not the Move type string)
      payTo: RECIPIENT_ADDRESS,
      maxAmountRequired: PAYMENT_AMOUNT,
      resource: `${SERVER_URL}/api/protected`,
      description: "Access to protected content",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
    };

    // Step 1: Verify payment with facilitator
    console.log("Verifying payment with facilitator...");
    const verifyResponse = await axios.post(
      `${FACILITATOR_URL}/verify`,
      {
        x402Version: 1, // Top level, not inside paymentRequirements
        paymentPayload,
        paymentRequirements,
      },
      {
        headers: { "Content-Type": "application/json" },
      },
    );

    console.log("Verify response:", verifyResponse.data);

    if (!verifyResponse.data.isValid) {
      console.log("Payment verification failed");
      return c.json({ error: "Invalid payment" }, 402);
    }

    console.log("Payment verified successfully");

    // Step 2: Settle payment with facilitator (submit to blockchain)
    console.log("Settling payment with facilitator...");
    const settleResponse = await axios.post(
      `${FACILITATOR_URL}/settle`,
      {
        x402Version: 1, // Top level, not inside paymentRequirements
        paymentPayload,
        paymentRequirements,
      },
      {
        headers: { "Content-Type": "application/json" },
      },
    );

    console.log("Settle response:", settleResponse.data);

    if (!settleResponse.data.success) {
      console.log("Payment settlement failed");
      return c.json({ error: "Payment settlement failed" }, 500);
    }

    console.log("Payment settled successfully");

    // Return protected content with transaction details
    return c.json({
      content:
        "🎉 Congratulations! You have successfully accessed the protected content using x402 payment protocol on Aptos!",
      transaction: settleResponse.data.transaction,
      payer: settleResponse.data.payer,
      network: "aptos-testnet",
    });
  } catch (error: any) {
    console.error(
      "Error processing payment:",
      error.response?.data || error.message,
    );

    return c.json(
      {
        error: "Payment processing failed",
        details: error.response?.data || error.message,
      },
      500,
    );
  }
});

// Start server
console.log(`Server starting on port ${PORT}...`);
console.log(`Facilitator URL: ${FACILITATOR_URL}`);
console.log(`Recipient Address: ${RECIPIENT_ADDRESS}`);
console.log(
  `Payment Amount: ${PAYMENT_AMOUNT} (${Number(PAYMENT_AMOUNT) / 100000000} APT)`,
);

serve(
  {
    fetch: app.fetch,
    port: Number(PORT),
  },
  (info) => {
    console.log(`✓ Server running at http://localhost:${info.port}`);
  },
);
