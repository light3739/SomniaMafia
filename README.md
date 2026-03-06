# Somnia Mafia 🕵️‍♂️

A **V4 Web3 Social Deduction Game** built for **Somnia Testnet** and **Avalanche Fuji**.
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
- Redis (Required in production for secure secrets/nonce storage)
- Metamask (configured for Somnia Devnet)

### Environment Variables

Copy `.env.example` to `.env.local`:

```bash
# Public (Frontend)
NEXT_PUBLIC_MAFIA_ADDRESS=0x...
NEXT_PUBLIC_ENABLE_TEST_MODE=false
NEXT_PUBLIC_ACTIVE_NETWORK=avalanche_fuji # or somnia_testnet

# Private (Backend)
REDIS_URL=redis://... # Required in production
# ALLOW_INSECURE_MEMORY_FALLBACK=true # Emergency/dev only, NOT recommended in production
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

### Frontend on own server (Docker + Redis)

This repo includes a production stack in `ops/frontend-server`.

Run deploy from local machine:

```bash
npm run front:deploy
```

Defaults:
- SSH host: `mafia`
- Remote dir: `/root/somnia-frontend`
- Frontend listens on `127.0.0.1:3000`
- App Redis listens on `127.0.0.1:6380` (container internal `redis:6379`)

Server env file:
- `ops/frontend-server/.env.production` (auto-created from `.env.production.example` on first deploy)

Important public vars:
- `NEXT_PUBLIC_GM_SERVER_URL=https://gm.mafiaonchain.live`
- `NEXT_PUBLIC_LIVEKIT_URL=https://livekit.mafiaonchain.live`

Required server vars for voice token API:
- `LIVEKIT_API_KEY` (must match key in LiveKit `livekit.yaml`)
- `LIVEKIT_API_SECRET` (must match secret in LiveKit `livekit.yaml`)

System health endpoint (sanitized env/runtime checks):
- `GET /api/health/system`
- Verifies presence of required frontend env vars and runtime dependencies
- Checks Redis ping + GM `/health` + LiveKit `/rtc/validate` reachability

### CI/CD deploy + Telegram alerts

Workflow: `.github/workflows/frontend-deploy-server.yml`

It sends Telegram notifications on:
- deploy started
- deploy success
- deploy failure

Required GitHub Secrets:
- `GM_SSH_PRIVATE_KEY`
- `GM_SSH_HOST`
- `FRONT_REMOTE_DIR` (optional, defaults to `/root/somnia-frontend`)
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

## GM Backend: Push/Deploy Runbook

Use npm scripts from this repository:

```bash
npm run gm:sync
npm run gm:build
npm run gm:publish
npm run gm:deploy
```

One-command release (publish + deploy):

```bash
npm run gm:release
```

Backend ops folder: `ops/gm-server`.

## Contracts Location

- Solidity sources:
  - `contracts/SomniaMafia.sol`
  - `Verifier_new.sol`
- Frontend network/address/ABI wiring:
  - `contracts/config.ts`
- ABI files:
  - `contracts/MafiaDiamondABI.json`
  - `contracts/MafiaPortal.json`
  - `contracts/IGroth16Verifier.json`

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
