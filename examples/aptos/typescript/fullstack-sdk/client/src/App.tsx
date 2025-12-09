import { useState } from "react";
import axios from "axios";
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
// Coinbase x402 payment header creation
import { createPaymentHeader } from "x402/client";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";

function App() {
  const [privateKeyInput, setPrivateKeyInput] = useState("");
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setError(null);
      // Create Aptos signer from private key
      const privateKey = new Ed25519PrivateKey(privateKeyInput);
      const signer = Account.fromPrivateKey({ privateKey });
      setAddress(signer.accountAddress.toString());
      console.log(
        `✅ Logged in with address: ${signer.accountAddress.toString()}`,
      );
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Failed to create signer from private key");
    }
  };

  const handlePayment = async () => {
    setLoading(true);
    setError(null);
    setContent(null);
    setTxHash(null);

    try {
      // Step 1: Get 402 response with payment requirements
      console.log("Making initial request to protected endpoint...");
      let response402;
      try {
        response402 = await axios.get(`${API_URL}/api/protected`);
      } catch (err: any) {
        if (err.response?.status === 402) {
          response402 = err.response;
        } else {
          throw err;
        }
      }

      const { accepts } = response402.data;
      const paymentRequirements = accepts[0];
      console.log("Payment requirements:", paymentRequirements);

      // Step 2: Create signer
      const privateKey = new Ed25519PrivateKey(privateKeyInput);
      const signer = Account.fromPrivateKey({ privateKey });

      // Step 3: Use Coinbase client to create payment header
      console.log("Creating payment using Coinbase x402 client...");
      const paymentHeader = await createPaymentHeader(
        signer,
        1, // x402Version
        paymentRequirements,
      );
      console.log("Payment header created successfully");

      // Step 4: Send payment
      console.log("Sending payment...");
      const successResponse = await axios.get(`${API_URL}/api/protected`, {
        headers: {
          "X-PAYMENT": paymentHeader,
        },
      });

      // Step 5: Display results
      console.log("Payment successful!");
      setContent(successResponse.data.content);
      setTxHash(successResponse.data.transaction);
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err.response?.data?.error || err.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="container">
        <h1>Aptos x402 Demo - Coinbase Client</h1>
        <p className="subtitle">
          Using Coinbase x402 TypeScript Client + x402-rs Facilitator
        </p>

        {/* Security Warning */}
        <div className="card warning-card">
          <h3>⚠️ Security Notice</h3>
          <p>
            This demo uses private key input for simplicity.{" "}
            <strong>Only use testnet keys!</strong> Never enter mainnet private
            keys or keys with real funds.
          </p>
        </div>

        {/* Login Section */}
        <div className="card">
          <h2>Account</h2>
          {!address ? (
            <div className="wallet-section">
              <p>Enter your Aptos testnet private key to get started</p>
              <div className="input-group">
                <input
                  type="password"
                  value={privateKeyInput}
                  onChange={(e) => setPrivateKeyInput(e.target.value)}
                  placeholder="0x..."
                  className="private-key-input"
                />
                <button
                  onClick={handleLogin}
                  disabled={!privateKeyInput.trim()}
                  className="btn btn-primary"
                >
                  Login
                </button>
              </div>
              {error && !address && (
                <div className="error-message">
                  <strong>Error:</strong> {error}
                </div>
              )}
              <p className="help-text">
                Need testnet APT? Visit the{" "}
                <a
                  href="https://aptoslabs.com/testnet-faucet"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Aptos Testnet Faucet
                </a>
              </p>
            </div>
          ) : (
            <div className="wallet-section">
              <div className="wallet-info">
                <p className="label">Connected Address:</p>
                <p className="address">{address}</p>
              </div>
              <button
                onClick={() => setAddress(null)}
                className="btn btn-secondary"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Payment Section */}
        {address && (
          <div className="card">
            <h2>Protected Content</h2>
            <p>Pay 0.1 APT to access the protected content</p>
            <button
              onClick={handlePayment}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? "Processing..." : "Pay 0.1 APT to Access Content"}
            </button>

            {error && (
              <div className="error-message">
                <strong>Error:</strong> {error}
              </div>
            )}

            {content && (
              <div className="success-message">
                <h3>Success!</h3>
                <p>{content}</p>
                {txHash && (
                  <p>
                    <strong>Transaction:</strong>{" "}
                    <a
                      href={`https://explorer.aptoslabs.com/txn/${txHash}?network=testnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on Explorer
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Info Section */}
        <div className="info-card">
          <h3>About this Demo</h3>
          <p>
            This demo showcases the x402 payment protocol using the{" "}
            <strong>Coinbase x402 TypeScript client</strong> with the{" "}
            <strong>x402-rs Rust facilitator</strong>.
          </p>
          <p>
            <strong>Architecture:</strong> React Frontend (Coinbase x402 Client)
            → Custom Hono Server → x402-rs Facilitator → Aptos Testnet
          </p>
          <p>
            <strong>Key Difference:</strong> This demo uses Coinbase's
            production-ready <code>createPaymentHeader()</code> function instead
            of manually building transactions, demonstrating
            cross-implementation compatibility.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
