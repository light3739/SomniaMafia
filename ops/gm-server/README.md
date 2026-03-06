# GM Server Ops

Automation scripts for `gm-server` workflow with SSH deploy target `mafia`.

## Quick start

1. Sync source from external gm-server project:

```bash
npm run gm:sync
```

2. Build locally in ops workdir:

```bash
npm run gm:build
```

3. Deploy to remote server via SSH alias `mafia`:

```bash
npm run gm:deploy
```

## Publish separate GitHub repo

If `gh auth login` is already done:

```bash
npm run gm:publish
```

## Full backend release (publish + deploy)

```bash
npm run gm:release
```

## Recommended push flow (for agents and maintainers)

When backend code changes:

1. `npm run gm:sync`
2. `npm run gm:build`
3. `npm run gm:publish`
4. `npm run gm:deploy`

This keeps `somnia-mafia-gm-server` repo and server deployment in sync.

Env overrides:
- `GM_SOURCE_DIR` (default `ops/gm-server/source`)
- `GM_SSH_HOST` (default `mafia`)
- `GM_SSH_USER` (default `root`)
- `GM_REMOTE_DIR` (default `/root/gm-server`)
- `GM_PM2_NAME` (default `gm-server`)
- `GH_OWNER` (default `light3739`)
- `GM_REPO_NAME` (default `somnia-mafia-gm-server`)
- `GM_REPO_VISIBILITY` (`private` or `public`, default `private`)

Required remote `.env` keys for gm-server:
- `GM_PRIVATE_KEY` (required, must not be empty/default)

Recommended remote `.env` keys:
- `AVAX_RPC_URL`, `SOMNIA_RPC_URL`
- `AVAX_DIAMOND`, `SOMNIA_DIAMOND`

## GitHub Actions deploy setup (one-time)

In repository Settings → Secrets and variables → Actions, add:

- `GM_SSH_PRIVATE_KEY`
- `GM_SSH_HOST`
- `GM_SSH_USER`
- `GM_SSH_PORT`
- `GM_REMOTE_DIR`
- `GM_PM2_NAME`

Then run workflow manually in Actions:

- `GM Deploy Manual`

## Notes

- Scripts deploy the `ops/gm-server/workdir` folder.
- `deploy-mafia.sh` keeps remote `.env` if local `.env` is absent.
- Ensure remote has `node`, `npm`, `pm2` installed.

## Where contracts are in this monorepo

- Solidity source: `contracts/SomniaMafia.sol`
- Verifier source: `Verifier_new.sol`
- Frontend contract network/address config: `contracts/config.ts`
- ABI files: `contracts/MafiaDiamondABI.json`, `contracts/MafiaPortal.json`, `contracts/IGroth16Verifier.json`
