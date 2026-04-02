# Agent Runbook (SomniaMafia)

## GM backend: how to push and deploy

GM backend workflow is managed from this repository via scripts in `ops/gm-server`.

### Prerequisites
- `gh auth login` completed
- SSH alias `mafia` configured (or provide env overrides)

### Standard flow
1. Sync backend source into this repo snapshot:
   - `npm run gm:sync`
2. Build backend in local workdir:
   - `npm run gm:build`
3. Publish/update separate backend repository:
   - `npm run gm:publish`
4. Deploy backend to server:
   - `npm run gm:deploy`

Or run full release:
- `npm run gm:release`

### Important paths
- Source snapshot: `ops/gm-server/source`
- Build/deploy workdir: `ops/gm-server/workdir`
- Deploy script: `ops/gm-server/deploy-mafia.sh`

## Where contracts are

### Smart contract sources
- Main game contract: `contracts/SomniaMafia.sol`
- Verifier contract (also present at repo root): `Verifier_new.sol`

### Frontend contract wiring
- Network + addresses + ABI/facets mapping: `contracts/config.ts`
- ABI JSONs used by frontend:
  - `contracts/MafiaDiamondABI.json`
  - `contracts/MafiaPortal.json`
  - `contracts/IGroth16Verifier.json`

### Runtime note
- Active frontend network is controlled by `NEXT_PUBLIC_ACTIVE_NETWORK` (`somnia_testnet` or `avalanche_fuji`).

# Antigravity Thought Configuration

## General Reasoning Rules
1. **Granular, Step-by-Step Reasoning:** Before and throughout any code changes or conclusions, provide clear and detailed reasoning for your logic. You may write multiple reasoning segments as you explore the codebase, diagnose issues, and plan your approach, similar to a "live-stream" of your investigation.
2. **Clutter-Free Logic:** While your reasoning should be detailed, avoid excessive repetition. Use clear headers and emojis (like 🔍, 🛠️, 🧬) to help the user follow your train of thought.
3. **Accuracy over Speed:** Prioritize correct analysis and systematic verification of facts and code architecture.
4. **Uncertainty:** If uncertain about any assumption, state it explicitly in your reasoning instead of guessing.

## Interaction Style
- Keep responses engaging and well-structured with: headers, bullet points, and code blocks where appropriate.
- Summarize conclusions clearly after investigative steps are finished.
- Be proactive in reporting issues (e.g., server restarts, state loss).
- When debugging, look for evidence (logs, uptime, environment vars) before making assumptions.
- If uncertain about contract state or ABI details, ask explicitly instead of assuming — and document the uncertainty in your thoughts.

## Example Response Format

**User:** Why is the GameFeed empty after voting?

**Assistant:**
## Reasoning
- `showVotingResults` is true but `gameState.phase` is already NIGHT
- `todayLogs` in GameLog.tsx slices from last "Day X has begun" marker
- `refreshPlayersListDebounced` may overwrite logs before feed renders

The issue is in `GameLog.tsx` line 74 — `todayLogs` loses context when `fetchGameData` resyncs state mid-transition. Fix: persist voting result logs separately before resync.

---

## Project Context
- **Project:** On-chain Mafia game on Somnia Network
- **Stack:** React, Tailwind CSS, Framer Motion (frontend) / Solidity smart contracts (backend)
- **Style:** Terminal aesthetic UI
- **Architecture:** Frontend and smart contract are developed separately; assume contract ABIs are provided when needed.