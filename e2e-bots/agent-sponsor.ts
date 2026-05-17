/**
 * Top-up agent wallets from a sponsor wallet. Spike-grade:
 *   - One-shot per agent (no batching).
 *   - Sequential to avoid nonce contention on a single sponsor account.
 *   - Idempotent: skip top-up when balance already covers threshold.
 *
 * For production we'd batch with viem's `sendCalls` (EIP-7702) or use a
 * multicall helper, but spike doesn't need that.
 */
import { createWalletClient, http, parseEther, type Address, type Hex, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PublicClient, WalletClient } from "viem";

export interface SponsorConfig {
  sponsorPrivateKey: Hex;
  chain: Chain;
  rpcUrl: string;
  /** Per-agent floor balance. Top up to this if below `minBalance`. */
  targetBalance?: bigint;
  /** Top up only when current balance < this. Defaults to targetBalance / 2. */
  minBalance?: bigint;
  /** Optional gas price override (gwei) — needed on Somnia (10 gwei min). */
  gasPriceGwei?: number;
}

export interface FundResult {
  agent: Address;
  before: bigint;
  funded: bigint;
  after: bigint;
  txHash: Hex | null;
}

export async function fundAgent(
  publicClient: PublicClient,
  cfg: SponsorConfig,
  agent: Address
): Promise<FundResult> {
  const target = cfg.targetBalance ?? parseEther("0.5");
  const min = cfg.minBalance ?? target / 2n;

  const before = await publicClient.getBalance({ address: agent });
  if (before >= min) {
    return { agent, before, funded: 0n, after: before, txHash: null };
  }

  const fundAmount = target - before;
  const sponsor = privateKeyToAccount(cfg.sponsorPrivateKey);
  const wallet = createWalletClient({
    account: sponsor,
    chain: cfg.chain,
    transport: http(cfg.rpcUrl),
  });

  const txHash = await wallet.sendTransaction({
    to: agent,
    value: fundAmount,
    ...(cfg.gasPriceGwei ? { gasPrice: BigInt(cfg.gasPriceGwei) * 10n ** 9n } : {}),
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  const after = await publicClient.getBalance({ address: agent });
  return { agent, before, funded: fundAmount, after, txHash };
}

export async function fundAgents(
  publicClient: PublicClient,
  cfg: SponsorConfig,
  agents: Address[]
): Promise<FundResult[]> {
  const results: FundResult[] = [];
  for (const a of agents) {
    results.push(await fundAgent(publicClient, cfg, a));
  }
  return results;
}
