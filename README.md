# Mafia On Chain

**Submission for [Avalanche Build Games Hackathon](https://www.avax.network/)**

A fully on-chain social deduction game (Mafia / Werewolf) deployed on **Avalanche Fuji (C-Chain)**. Players connect wallets, join lobbies, get roles via a tamper-proof commit-reveal shuffle, play through Day/Night cycles with voice chat, and prove the winner using a **Zero-Knowledge proof (Groth16)** — all coordinated by smart contracts.

**Live Demo**: https://mafiaonchain.live

---

## Why Avalanche

- **Fast finality** (~1s) makes real-time game actions (voting, night kills) feel instant — critical for a turn-based game with timers
- **Low gas fees** allow per-action on-chain writes (every vote, every night commit is a tx) without breaking the UX
- **EVM compatibility** lets us use standard tooling (Hardhat, viem, wagmi) while targeting Fuji C-Chain
- Verified contracts on **Avalanche Fuji testnet** — all live gameplay runs there

---

## Deployed Contracts (Avalanche Fuji — chainId 43113)

All interactions go through the **MafiaDiamond** proxy address:

| Contract | Address | Explorer |
|---|---|---|
| **MafiaDiamond** (main entry point) | `0x3c1bd1923f8318247e2b60e41b0f280391c4e1e1` | [Verified](https://testnet.snowtrace.io/address/0x3c1bd1923f8318247e2b60e41b0f280391c4e1e1#code) |
| Groth16Verifier (ZK) | `0x32d3612009c2d30c71c19d2548822e1eecb8d165` | [Verified](https://testnet.snowtrace.io/address/0x32d3612009c2d30c71c19d2548822e1eecb8d165#code) |
| LobbyFacet | `0xb718ba5b6bccfa418f2971ea094f5b52a105c049` | [Verified](https://testnet.snowtrace.io/address/0xb718ba5b6bccfa418f2971ea094f5b52a105c049#code) |
| ShuffleFacet | `0xffa18547fde97a6d2f4df8af0ac545db9f5ae789` | [Verified](https://testnet.snowtrace.io/address/0xffa18547fde97a6d2f4df8af0ac545db9f5ae789#code) |
| VotingFacet | `0x78616f773e7d9fef5dd7c6583dc642b238033a61` | [Verified](https://testnet.snowtrace.io/address/0x78616f773e7d9fef5dd7c6583dc642b238033a61#code) |
| NightFacet | `0x72d4cfa33b2e7e6cce4a85bbd31147659f04a3be` | [Verified](https://testnet.snowtrace.io/address/0x72d4cfa33b2e7e6cce4a85bbd31147659f04a3be#code) |
| GameEndFacet | `0xca5556d70fbb02544a1418c31cbc1a032d9676d8` | [Verified](https://testnet.snowtrace.io/address/0xca5556d70fbb02544a1418c31cbc1a032d9676d8#code) |

---

## Related Repositories

| Repo | Description |
|---|---|
| [SomniaMafia](https://github.com/light3739/SomniaMafia) | This repo — Next.js frontend + API routes |
| [somnia-mafia-gm-server](https://github.com/light3739/somnia-mafia-gm-server) | Game Master backend (night phase oracle) |

---

## How It Works

### Game Flow

```
Connect Wallet → Setup Profile → Create/Join Lobby
    → Commit-Reveal Shuffle (roles assigned on-chain, tamper-proof)
    → ZK Role Reveal (Groth16 — player learns role without exposing it)
    → Day Discussion (voice chat via LiveKit)
    → Voting (on-chain, all votes recorded)
    → Night Phase (Mafia/Doctor/Detective act via GM oracle)
    → Repeat until win condition
    → ZK Endgame Proof → Prize distribution on-chain
```

### Key Technical Features

**Commit-Reveal Role Shuffle**
Every player commits a hash of a random deck, then reveals it. The contract XORs all decks to produce a tamper-proof shuffle. No single player can manipulate role assignment.

**Zero-Knowledge Role Verification (Groth16)**
Roles are verified on-chain using a Groth16 ZK proof (SnarkJS + Circom). The proof confirms role assignment without publicly revealing anyone's role. The win condition is also proven via ZK — no roles are leaked at game end.

**Session Keys**
Each player registers a derived burner wallet as a session key on-chain. All in-game transactions (votes, night actions) are signed by the session key automatically — no MetaMask popup per action.

**Game Master Oracle (Night Phase)**
Night actions (Mafia kill, Doctor heal, Detective investigate) are submitted encrypted to the GM server off-chain. The GM resolves conflicts and posts only the result (`resolveNightAsGameMaster`) on-chain — hiding who performed each action.

**Diamond Proxy Architecture (EIP-2535)**
The contract is structured as a Diamond proxy with 5 facets (Lobby, Shuffle, Voting, Night, GameEnd), allowing upgradeable and modular on-chain game logic.

**Voice Chat**
Real-time voice chat via LiveKit WebRTC — players discuss during the Day phase. TURN relay fallback for restrictive network environments.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TailwindCSS, Framer Motion |
| Blockchain | Solidity 0.8.28, Hardhat v3, Viem, Wagmi |
| ZK Proofs | SnarkJS, Circom, Groth16 |
| Voice | LiveKit WebRTC |
| Backend | Next.js API Routes, Redis |
| Infrastructure | Docker, Caddy, GitHub Actions (GHCR ready) |
| Network | Avalanche Fuji C-Chain (chainId 43113) |

---

## Running Locally

### Prerequisites

- Node.js 18+
- Redis instance (local or Upstash)
- MetaMask configured for Avalanche Fuji

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_MAFIA_ADDRESS=0x3c1bd1923f8318247e2b60e41b0f280391c4e1e1
NEXT_PUBLIC_ACTIVE_NETWORK=avalanche_fuji
NEXT_PUBLIC_GM_SERVER_URL=https://gm.mafiaonchain.live
NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.mafiaonchain.live
REDIS_URL=redis://localhost:6379
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

### Start

```bash
npm install
npm run dev
# Open http://localhost:3000
```

### Production Deploy (Docker)

```bash
npm run front:deploy   # SSH deploy to remote server
npm run gm:release     # Build + publish + deploy GM backend
```

---

## Architecture

```
Browser (Next.js)
    |
    |-- Wagmi/Viem ──────────────────> MafiaDiamond (Avalanche Fuji)
    |                                       |-- LobbyFacet
    |                                       |-- ShuffleFacet
    |                                       |-- VotingFacet
    |                                       |-- NightFacet
    |                                       └── GameEndFacet ──> Groth16Verifier
    |
    |-- LiveKit SDK ─────────────────> LiveKit Server (WebRTC voice)
    |
    └── fetch (signed EIP-191) ──────> GM Server (night phase oracle)
                                            └── resolveNightAsGameMaster() ──> Chain
```

### Anti-Race Condition: Waterfall Submission
When multiple clients simultaneously detect a win condition, they use a staggered submission schedule (sorted by wallet address, 15s delay per position) to prevent duplicate `endGameZK` transactions.

---

## Smart Contract Sources

Contract sources, deployment scripts, and Hardhat config:
https://github.com/light3739/SomniaSol
