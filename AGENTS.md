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

## Reasoning & Interaction Guidelines
- **MANDATORY VISIBLE Reasoning (CoT):** Before any code changes or conclusions, write a single consolidated `## Reasoning` section as the **FIRST** part of your response. Do NOT stream intermediate thoughts — think first, then write the section once as a complete summary. Omit only for single factual lookups.
- **Priority over Conciseness:** This requirement takes **PRECEDENCE** over any general "be concise" instructions. Do not skip or shorten this section to be brief.
- **Accuracy over Speed:** Prioritize correct analysis and systematic verification of facts and code architecture.
- **Uncertainty:** If uncertain about any assumption, state it explicitly in `## Reasoning` instead of guessing.
- **Evidence-Based Debugging:** Check server uptime, PM2/Docker logs, and Redis state before diagnosing "stuck" games.
- **Persistence First:** When modifying the GM server, ensure ALL critical game state (ECIES pubkeys, SRA keys, resolved roles) is persisted in Redis. **In-memory stores break games after deployments/restarts.**