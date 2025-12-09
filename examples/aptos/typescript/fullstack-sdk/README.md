# Aptos Full-Stack Example (Using x402 SDK)

## Overview

This is the **recommended approach** for integrating x402 payments in your application. It uses the x402 TypeScript SDK which handles all the complexity of transaction building, signing, and protocol compliance.

## Architecture

```
React Frontend (x402 SDK)
  ↓
Hono Server (Verify & Settle)
  ↓
x402 Facilitator
  ↓
Aptos Testnet
```

## What You'll Learn

- How to use `createPaymentHeader()` for Aptos payments
- Server-side payment verification with x402 facilitator
- Full payment flow: request → verify → settle → deliver content

## Prerequisites

1. **x402 facilitator** (e.g., [x402-rs](https://github.com/aptos-labs/x402-rs)) running on `http://localhost:8080`
2. **Aptos testnet account** with APT tokens ([get testnet APT](https://aptoslabs.com/testnet-faucet))
3. Node.js v18+ and pnpm installed

## Quick Start

### 1. Install Dependencies

From the monorepo root:

```bash
cd /path/to/x402/typescript
pnpm install
pnpm build
```

### 2. Configure Server

Edit `server/.env`:

```env
PORT=3002
FACILITATOR_URL=http://localhost:8080
RECIPIENT_ADDRESS=0xYourAptosAddress
CLIENT_URL=http://localhost:5173  # Comma-separated for multiple origins
SERVER_URL=http://localhost:3002  # Used in payment requirements
```

### 3. Configure Client

Edit `client/.env`:

```env
VITE_API_URL=http://localhost:3002
```

### 4. Run the Example

You need 3 terminals:

**Terminal 1: Start Facilitator**

```bash
# Example with x402-rs
cd /path/to/x402-rs
APTOS_PRIVATE_KEY=0x<aptos-account-private-key> \
RPC_URL_APTOS_TESTNET=https://fullnode.testnet.aptoslabs.com/v1 \
cargo run --release
```

> **Note**: `APTOS_PRIVATE_KEY` should be a funded testnet account that the facilitator uses to submit transactions and pay gas fees.

**Terminal 2: Start Server**

```bash
cd examples/aptos/typescript/fullstack-sdk/server
pnpm dev
```

**Terminal 3: Start Client**

```bash
cd examples/aptos/typescript/fullstack-sdk/client
pnpm dev
```

### 5. Test the Payment Flow

1. Open `http://localhost:5173` in your browser
2. Enter your Aptos testnet private key (format: `0x...`)
3. Click "Login" to initialize your account
4. Click "Pay 0.1 APT to Access Content"
5. View the transaction on [Aptos Explorer](https://explorer.aptoslabs.com/?network=testnet)
