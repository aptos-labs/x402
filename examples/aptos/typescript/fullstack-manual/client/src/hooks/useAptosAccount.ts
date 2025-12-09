import { useState } from "react";
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

/**
 * Hook for managing Aptos account via private key
 * Provides simple state management for login/logout with private key
 */
export function useAptosAccount() {
  const [privateKey, setPrivateKey] = useState<string>("");
  const [account, setAccount] = useState<Account | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (pk: string) => {
    setIsLoading(true);
    try {
      setError(null);

      // Validate private key format
      if (!pk.startsWith("0x")) {
        throw new Error("Private key must start with 0x");
      }

      // Remove 0x prefix and create private key
      const pkHex = pk.startsWith("0x") ? pk.slice(2) : pk;
      const privateKey = new Ed25519PrivateKey(pkHex);

      // Create account from private key
      const account = Account.fromPrivateKey({ privateKey });

      // Get address
      const accountAddress = account.accountAddress.toString();

      setAccount(account);
      setAddress(accountAddress);
      setPrivateKey(pk);

      console.log(`✅ Logged in with address: ${accountAddress}`);
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Failed to create account from private key");
      setAccount(null);
      setAddress(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setPrivateKey("");
    setAccount(null);
    setAddress(null);
    setError(null);
    console.log("Logged out");
  };

  return {
    privateKey,
    account,
    address,
    error,
    isLoading,
    isConnected: !!account,
    login,
    logout,
  };
}
