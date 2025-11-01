/**
 * Aptos wallet and signer utilities for x402 protocol
 *
 * This module provides types and helper functions for working with Aptos accounts
 * in the x402 payment protocol.
 */

import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { Network } from "../../types/shared/network";

/**
 * Aptos account type from the SDK
 */
export type AptosAccount = Account;

/**
 * Type alias for Aptos signer
 */
export type AptosSigner = Account;

/**
 * Type guard to check if an object is an Aptos signer
 *
 * @param obj - The object to check
 * @returns True if the object is an Aptos signer
 */
export function isAptosSigner(obj: any): obj is AptosSigner {
  return (
    obj &&
    typeof obj === "object" &&
    "accountAddress" in obj &&
    typeof obj.accountAddress === "object" &&
    typeof obj.accountAddress.toString === "function" &&
    "signTransaction" in obj &&
    typeof obj.signTransaction === "function"
  );
}

/**
 * Creates an Aptos signer from a private key
 *
 * @param privateKey - The private key as a hex string (with or without 0x prefix)
 * @returns An Aptos signer instance
 */
export async function createSignerFromPrivateKey(privateKey: string): Promise<AptosSigner> {
  // Normalize the private key (remove 0x prefix if present)
  const normalizedKey = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;

  // Create Ed25519 private key from hex string
  const privateKeyBytes = new Ed25519PrivateKey(normalizedKey);

  // Create and return Account
  return Account.fromPrivateKey({ privateKey: privateKeyBytes });
}

/**
 * Gets the Aptos RPC URL for the given network
 *
 * @param network - The network identifier
 * @returns The RPC URL for the network
 */
export function getAptosRpcUrl(network: Network): string {
  switch (network) {
    case "aptos-mainnet":
      return "https://fullnode.mainnet.aptoslabs.com/v1";
    case "aptos-testnet":
      return "https://fullnode.testnet.aptoslabs.com/v1";
    case "aptos-devnet":
      return "https://fullnode.devnet.aptoslabs.com/v1";
    default:
      throw new Error(`Unsupported Aptos network: ${network}`);
  }
}

/**
 * Aptos connected client type (for consistency with EVM/SVM patterns)
 * This represents a read-only connection to the Aptos network
 */
export interface AptosConnectedClient {
  network: Network;
  rpcUrl: string;
}

/**
 * Creates an Aptos connected client for the given network
 * This is a read-only client used for verification (no signing capabilities)
 *
 * @param network - The network to connect to
 * @returns An Aptos connected client instance
 */
export function createAptosConnectedClient(network: Network): AptosConnectedClient {
  return {
    network,
    rpcUrl: getAptosRpcUrl(network),
  };
}
