# Aptos Full-Stack Example (Manual Implementation)

## Overview

This example demonstrates the **internals of the x402 protocol** by manually implementing every step: transaction building, BCS serialization, payload construction, verification, and settlement.

## Architecture

```
┌─────────────────────┐
│   React Frontend    │
│  - Manual tx build  │
│  - BCS serialization│
└──────────┬──────────┘
           │ 1. GET /api/protected (no payment)
           │ 2. POST /api/create-payment
           │ 3. GET /api/protected (with X-PAYMENT)
           ▼
┌─────────────────────┐
│   Hono Server       │
│  - Parse payload    │
│  - Verify manually  │
│  - Settle via API   │
└──────────┬──────────┘
           │ /verify, /settle
           ▼
┌─────────────────────┐
│  x402 Facilitator   │
│  - Verify signature │
│  - Submit to chain  │
└─────────────────────┘
           │
           ▼
┌─────────────────────┐
│  Aptos Testnet      │
└─────────────────────┘
```

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
PORT=3001
FACILITATOR_URL=http://localhost:8080
RECIPIENT_ADDRESS=0xYourAptosAddress
APTOS_ASSET=0x1::aptos_coin::AptosCoin
PAYMENT_AMOUNT=10000000  # 0.1 APT (8 decimals)
CLIENT_URL=http://localhost:5173  # Comma-separated for multiple origins
SERVER_URL=http://localhost:3001  # Used in payment requirements
```

### 3. Configure Client

Edit `client/.env`:

```env
VITE_API_URL=http://localhost:3001
```

### 4. Run the Example

You need 3 terminals:

**Terminal 1: Start Facilitator**

```bash
# Example with x402-rs
cd /path/to/x402-rs
APTOS_PRIVATE_KEY=0x<aptos-account-private-key> \
RPC_URL_APTOS_TESTNET=https://api.testnet.aptoslabs.com/v1 \
cargo run --release
```

> **Note**: `APTOS_PRIVATE_KEY` should be a funded testnet account that the facilitator uses to submit transactions and pay gas fees.

**Terminal 2: Start Server**

```bash
cd examples/aptos/typescript/fullstack-manual/server
pnpm dev
```

**Terminal 3: Start Client**

```bash
cd examples/aptos/typescript/fullstack-manual/client
pnpm dev
```

### 5. Test the Payment Flow

1. Open `http://localhost:5173` in your browser
2. Enter your Aptos testnet private key (format: `0x...`)
3. Click "Login" to initialize your account
4. Click "Pay 0.1 APT to Access Content"
5. Watch the console logs showing each step
6. View the transaction on [Aptos Explorer](https://explorer.aptoslabs.com/?network=testnet)
