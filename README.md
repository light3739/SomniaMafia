# Somnia Mafia 🕵️‍♂️

A **V4 Web3 Social Deduction Game** built on the Somnia Blockchain.
Featuring Zero-Knowledge Proofs for role verification, Session Keys for seamless UX, and a synchronized game loop.

![Banner](/public/assets/mafia_shot.png)

## Features

- **Protocol V4**: Atomic lobby creation, commit-reveal schemes for all actions.
- **ZK Endgame**: Client-side Zero-Knowledge Proof generation (Groth16) to prove win conditions without revealing sensitive data.
- **Session Keys**: Burner wallets stored in-memory/local storage allow for instant, signature-free game actions after initial approval.
- **Discussion Timer**: Synchronized server-side timer (Redis) for fair turn-based speech.
- **Role Mechanics**:
  - **Mafia**: Encrypted P2P Chat, Consensus Kills.
  - **Detective**: "Check" action to investigate roles (Server-side validation).
  - **Doctor**: "Heal" action to protect targets.

## Tech Stack

- **Frontend**: Next.js 14, TailwindCSS, Framer Motion
- **Blockchain**: Solidity, Hardhat, Viem/Wagmi
- **ZK**: SnarkJS, Circom
- **Backend**: Next.js API Routes, Redis (Upstash compatible)

## Getting Started

### Prerequisites

- Node.js 18+
- Redis (Optional, falls back to memory for dev)
- Metamask (configured for Somnia Devnet)

### Environment Variables

Copy `.env.example` to `.env.local`:

```bash
# Public (Frontend)
NEXT_PUBLIC_MAFIA_ADDRESS=0x...
NEXT_PUBLIC_ENABLE_TEST_MODE=false

# Private (Backend)
REDIS_URL=redis://... # Optional
```

### Installation

```bash
npm install
# or
yarn install
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

1. **Build**: `npm run build`
2. **Environment**: Ensure `NEXT_PUBLIC_MAFIA_ADDRESS` points to the correct deployment.
3. **ZK Circuits**: Ensure `public/mafia_outcome.wasm` and `public/mafia_outcome_0001.zkey` are present.

## Architecture Highlights

### The "Waterfall" Submission
To prevent race conditions during auto-endgame, clients coordinate submission:
- Players are sorted by address.
- Player #1 submits immediately.
- Player #2 waits 15s, etc.
- Priority is given to Session Keys if balance allows.

### Discussion API
`/api/game/discussion` manages the state of the Day phase timer, ensuring all clients see the same effective time remaining despite network latency.

## Credits
Built for the Somnia Hackathon.
