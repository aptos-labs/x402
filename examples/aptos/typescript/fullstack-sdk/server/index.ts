import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const app = new Hono();

// Configuration from environment variables
const PORT = process.env.PORT || 3002;
const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:8080";
const RECIPIENT_ADDRESS = process.env.RECIPIENT_ADDRESS || "0x1";
const APTOS_ASSET = "0x1"; // APT metadata address
const PAYMENT_AMOUNT = "10000000"; // 0.1 APT (8 decimals)
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3002";

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
            asset: APTOS_ASSET,
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
    const paymentRequirements = {
      scheme: "exact",
      network: "aptos-testnet",
      asset: APTOS_ASSET,
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
        x402Version: 1,
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
        x402Version: 1,
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
        "🎉 Success! Coinbase x402 TypeScript client works with x402-rs facilitator on Aptos!",
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
