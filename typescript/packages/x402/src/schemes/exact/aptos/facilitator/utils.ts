import {
  Deserializer,
  SimpleTransaction,
  AccountAuthenticator,
  AnyRawTransaction,
} from "@aptos-labs/ts-sdk";

/**
 * Deserialize an Aptos transaction and authenticator from the payment payload.
 *
 * @param transactionBase64 - The base64 encoded transaction payload
 * @returns The deserialized transaction and authenticator
 */
export function deserializeAptosPayment(transactionBase64: string): {
  transaction: AnyRawTransaction;
  senderAuthenticator: AccountAuthenticator;
} {
  // Decode the base64 payload
  const decoded = Buffer.from(transactionBase64, "base64").toString("utf8");
  const parsed = JSON.parse(decoded);

  // Deserialize the transaction bytes
  const transactionBytes = Uint8Array.from(parsed.transaction);
  const transaction = SimpleTransaction.deserialize(new Deserializer(transactionBytes));

  // Deserialize the authenticator bytes
  const authBytes = Uint8Array.from(parsed.senderAuthenticator);
  const senderAuthenticator = AccountAuthenticator.deserialize(new Deserializer(authBytes));

  return { transaction, senderAuthenticator };
}
