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