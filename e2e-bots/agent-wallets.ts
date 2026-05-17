/**
 * HD-derive agent wallets for a given room. Stateless: same (mnemonic, roomId,
 * idx) always yields the same wallet, so a re-run after a crash recovers the
 * exact same agents without storage.
 *
 * Why this scheme:
 *   - No persistence cost (no DB, no encrypted key store).
 *   - Replay-safe: if the orchestrator dies mid-game it can re-derive and
 *     keep operating from the same EOA.
 *   - Address per-room: avoids cross-room reputation leakage between games.
 *
 * Path: m/44'/60'/0'/{roomIdBucket}/{idx}
 *   - roomIdBucket = uint31 mask of roomId (BIP-32 hardened indices are
 *     uint31; we truncate. Collision risk is purely cosmetic for the spike
 *     since roomIds are small monotonic integers).
 *   - idx = 0..N-1 for N agents in the room.
 */
import { english, generateMnemonic, mnemonicToAccount } from "viem/accounts";
import type { HDAccount } from "viem";

const HARDENED_OFFSET = 0x80000000;

function roomBucket(roomId: bigint | number): number {
  // BIP-32 indices are uint31; mask off the high bit so the path stays valid.
  return Number(BigInt(roomId) & 0x7fffffffn);
}

export interface AgentWalletConfig {
  /** BIP-39 mnemonic. Required. Generate once with `generateMnemonic(english)` and store in .env as AGENT_MASTER_MNEMONIC. */
  mnemonic: string;
  /** Room ID this agent is bound to. Different rooms → different addresses. */
  roomId: bigint | number;
  /** Position of the agent within the room (0-indexed). */
  idx: number;
}

export interface AgentWallet {
  account: HDAccount;
  address: `0x${string}`;
  /** Derivation path used. Useful for logs / on-chain audit-trail. */
  path: string;
  /** Convenience: which slot this wallet fills in the room. */
  idx: number;
}

export function deriveAgentWallet(cfg: AgentWalletConfig): AgentWallet {
  const bucket = roomBucket(cfg.roomId);
  const path = `m/44'/60'/0'/${bucket}/${cfg.idx}`;
  const account = mnemonicToAccount(cfg.mnemonic, {
    accountIndex: 0,
    changeIndex: bucket,
    addressIndex: cfg.idx,
  });
  return { account, address: account.address, path, idx: cfg.idx };
}

export function deriveAgentWallets(
  mnemonic: string,
  roomId: bigint | number,
  count: number
): AgentWallet[] {
  return Array.from({ length: count }, (_, idx) =>
    deriveAgentWallet({ mnemonic, roomId, idx })
  );
}

/** Read mnemonic from env, or generate a fresh one (CLI dev convenience). */
export function loadOrGenerateMnemonic(env = "AGENT_MASTER_MNEMONIC"): string {
  const existing = process.env[env];
  if (existing && existing.trim().split(/\s+/).length >= 12) return existing.trim();
  const fresh = generateMnemonic(english);
  console.warn(
    `[agent-wallets] No ${env} in env — generated fresh:\n  ${fresh}\n` +
      `  Save this to .env to keep agent addresses stable across runs.`
  );
  return fresh;
}
