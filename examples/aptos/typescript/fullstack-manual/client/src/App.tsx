import { useState } from "react";
import { useAptosAccount } from "./hooks/useAptosAccount";
import axios from "axios";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function App() {
  const {
    address,
    isConnected,
    login,
    logout,
    error: accountError,
    isLoading: accountLoading,
  } = useAptosAccount();
  const [privateKeyInput, setPrivateKeyInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!privateKeyInput.trim()) {
      return;
    }
    await login(privateKeyInput);
  };

  const handlePayment = async () => {
    setLoading(true);
    setError(null);
    setContent(null);
    setTxHash(null);

    try {
      // Step 1: Make initial request (will receive 402)
      console.log("Making initial request to protected endpoint...");
      let response;

      try {
        response = await axios.get(`${API_URL}/api/protected`);
      } catch (err: any) {
        if (err.response?.status === 402) {
          response = err.response;
        } else {
          throw err;
        }
      }

      if (response.status !== 402) {
        throw new Error("Expected 402 Payment Required response");
      }

      // Step 2: Extract payment requirements
      const { accepts } = response.data;
      const paymentRequirements = accepts[0];

      console.log("Payment requirements:", paymentRequirements);

      if (!privateKeyInput.trim()) {
        throw new Error("Not logged in");
      }

      // Step 3: Call Node.js server to create payment
      console.log("Creating payment via Node.js service...");
      const paymentResponse = await axios.post(
        `${API_URL}/api/create-payment`,
        {
          privateKey: privateKeyInput,
          paymentRequirements,
        },
      );

      const { paymentHeader } = paymentResponse.data;
      console.log("Payment header created successfully");

      // Step 4: Retry request with payment
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
        <h1>Aptos x402 Payment Demo</h1>
        <p className="subtitle">Private Key Authentication for Testnet</p>

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
          {!isConnected ? (
            <div className="wallet-section">
              <p>Enter your Aptos testnet private key to get started</p>
              <div className="input-group">
                <input
                  type="password"
                  value={privateKeyInput}
                  onChange={(e) => setPrivateKeyInput(e.target.value)}
                  placeholder="0x..."
                  className="private-key-input"
                  disabled={accountLoading}
                />
                <button
                  onClick={handleLogin}
                  disabled={!privateKeyInput.trim() || accountLoading}
                  className="btn btn-primary"
                >
                  {accountLoading ? "Connecting..." : "Login"}
                </button>
              </div>
              {accountError && (
                <div className="error-message">
                  <strong>Error:</strong> {accountError}
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
              <button onClick={logout} className="btn btn-secondary">
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Payment Section */}
        {isConnected && (
          <div className="card">
            <h2>Protected Content</h2>
            <p>Pay 0.1 APT to access the protected content</p>
            <button
              onClick={handlePayment}
              disabled={loading || !isConnected}
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
            This demo showcases the x402 payment protocol on Aptos testnet using
            private key authentication.
          </p>
          <p>
            <strong>Architecture:</strong> React Frontend → Hono Server (Payment
            + Proxy) → x402-rs Facilitator → Aptos Testnet
          </p>
          <p>
            <strong>Note:</strong> This demo uses the Aptos TypeScript SDK on
            the Node.js server to generate payment payloads that are compatible
            with the x402-rs facilitator.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
