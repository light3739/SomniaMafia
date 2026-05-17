/**
 * Agent vote spike — proves the full loop:
 *
 *   read room state → build prompt → Somnia LLM Inference (inferString)
 *   → wait for ResultReady → validate / fallback → cast vote tx
 *
 * Assumes an existing room currently in `VOTING` phase where the configured
 * wallet (VOTER_PRIVATE_KEY, defaults to PRIVATE_KEY) is a live player that
 * hasn't voted yet. No room creation here — that's separate plumbing.
 *
 * Usage:
 *   cd SomniaMafia/e2e-bots
 *   PRIVATE_KEY=0x...      \
 *   ROOM_ID=151            \
 *   DIAMOND=0x031b6746...  \   # falls back to mainnet/testnet default
 *   npx tsx agent-vote-spike.ts
 *
 * Optional env:
 *   LLM_AGENT_ID, LLM_LANGUAGE, LLM_WAIT_MS, GAS_PRICE_GWEI
 */
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeAbiParameters,
  decodeEventLog,
  fallback,
  http,
  parseAbi,
  parseAbiParameters,
  parseEther,
  parseGwei,
  toFunctionSelector,
  webSocket,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveDecision, buildVotePrompt } from "./decision-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOMNIA_DIR = join(__dirname, "..", "..", "SomniaSol");

// ─── Constants ───────────────────────────────────────────────
const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://api.infra.testnet.somnia.network/"],
      webSocket: ["wss://api.infra.testnet.somnia.network/ws"],
    },
  },
});

const DEFAULT_DIAMOND: Address = "0x031b6746155ce11c7b533935f4674f5fc4682338"; // testnet
const AGENT_REQUESTER: Address = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";

const LLM_AGENT_ID = BigInt(process.env.LLM_AGENT_ID ?? "12847293847561029384");
const LANGUAGE = process.env.LLM_LANGUAGE ?? "English";
const WAIT_MS = Number(process.env.LLM_WAIT_MS ?? 90_000);
const GAS_PRICE_GWEI = Number(process.env.GAS_PRICE_GWEI ?? 10);

// FLAGS bit for alive (matches gm-server/src/types/contract.ts)
const FLAG_ACTIVE = 0x2;
const PHASE_VOTING = 4;

// ─── ABIs ────────────────────────────────────────────────────
// getRoom return — matches SomniaSol GameRoom struct exactly (see contracts/abi.ts).
const DIAMOND_VOTE_ABI = parseAbi([
  "function getRoom(uint256) view returns ((uint64 id, address host, string name, uint8 phase, uint8 maxPlayers, uint8 playersCount, uint8 aliveCount, uint16 dayCount, uint8 currentShufflerIndex, uint32 lastActionTimestamp, uint32 phaseDeadline, uint8 confirmedCount, uint8 votedCount, uint8 committedCount, uint8 revealedCount, uint8 keysSharedCount, uint128 depositPool, uint128 depositPerPlayer, bool isPrivate, uint256 tournamentId))",
  "function getPlayers(uint256) view returns ((address wallet, string nickname, bytes publicKey, uint32 flags)[])",
  "function vote(uint256 roomId, address target)",
  "event VotingStarted(uint256 indexed roomId)",
]);

const REQUESTER_ABI = parseAbi([
  "function createRequest(uint256 agentId, address callbackAddress, bytes4 callbackSelector, bytes payload) payable returns (uint256)",
  "function getRequestDeposit() view returns (uint256)",
  "event RequestCreated(uint256 indexed requestId, uint256 indexed agentId, uint256 perAgentBudget, bytes payload, address[] subcommittee)",
]);

const STORE_ABI = parseAbi([
  "function results(uint256) view returns (bool ready, uint8 status, string text)",
  "event ResultReady(uint256 indexed requestId, uint8 status, string text)",
]);

const INFER_STRING_SELECTOR = toFunctionSelector(
  "inferString(string,string,bool,string[])"
) as Hex;

const HANDLE_RESPONSE_SIG =
  "handleResponse(uint256,(address,bytes,uint8,uint256,uint256,uint256)[],uint8,(uint256,address,address,bytes4,address[],(address,bytes,uint8,uint256,uint256,uint256)[],uint256,uint256,uint256,uint256,uint256,uint8,uint8,uint256,uint256))";
const HANDLE_RESPONSE_SELECTOR = toFunctionSelector(HANDLE_RESPONSE_SIG) as Hex;

// ─── Loaders ─────────────────────────────────────────────────
function loadStoreAddress(): Address {
  const file = join(SOMNIA_DIR, `llm-store-${somniaTestnet.id}.json`);
  const json = JSON.parse(readFileSync(file, "utf8"));
  return json.llmResultStore as Address;
}

function pk(envNames: string[]): Hex {
  for (const name of envNames) {
    const raw = process.env[name];
    if (!raw) continue;
    // Strip whitespace, quotes, and any trailing non-hex chars (user .env had "ns" suffix).
    const m = raw.trim().replace(/^['"]|['"]$/g, "").match(/^(0x)?[a-fA-F0-9]{64}/);
    if (!m) throw new Error(`${name} present but not a valid 64-hex private key`);
    const hex = m[0].startsWith("0x") ? m[0] : `0x${m[0]}`;
    return hex as Hex;
  }
  throw new Error(`One of these env vars required: ${envNames.join(", ")}`);
}

// ─── Vote flow ───────────────────────────────────────────────
async function executeVote(
  publicClient: any,
  walletClient: any,
  voter: ReturnType<typeof privateKeyToAccount>,
  diamond: Address,
  store: Address,
  roomId: bigint,
): Promise<void> {
  // Re-read room so dayCount/alive list are fresh at the moment of firing.
  const room: any = await publicClient.readContract({
    address: diamond,
    abi: DIAMOND_VOTE_ABI,
    functionName: "getRoom",
    args: [roomId],
  });
  const phase = Number(room.phase);
  const dayCount = Number(room.dayCount);
  console.log(`Phase   : ${phase}  Day: ${dayCount}  Alive: ${room.aliveCount}/${room.playersCount}  VotedCnt: ${room.votedCount}`);
  if (phase !== PHASE_VOTING) {
    throw new Error(`Room ${roomId} is not in VOTING phase (got ${phase}) at fire time`);
  }

  // ── Read players, build pool ───────────────────────
  const players = await publicClient.readContract({
    address: diamond,
    abi: DIAMOND_VOTE_ABI,
    functionName: "getPlayers",
    args: [roomId],
  });
  const alive: Address[] = [];
  for (const p of players) {
    if ((Number(p.flags) & FLAG_ACTIVE) !== 0) alive.push(p.wallet);
  }
  console.log(`Alive list:`);
  for (const a of alive) console.log(`   - ${a}${a === voter.address ? "  (me)" : ""}`);

  if (!alive.find((a) => a.toLowerCase() === voter.address.toLowerCase())) {
    throw new Error("Voter is not a live player in this room");
  }

  // ── 3. Build prompt ──────────────────────────────────
  const { prompt, system, allowedValues } = buildVotePrompt({
    self: voter.address,
    alive,
    publicChat: [], // spike: no chat context; later wire in discussion store
    dayCount,
    language: LANGUAGE,
  });
  console.log(`\nPrompt:\n${prompt}\n`);
  console.log(`AllowedValues: ${allowedValues.length} addresses`);

  // ── 4. inferString payload ───────────────────────────
  const argsEncoded = encodeAbiParameters(
    parseAbiParameters("string, string, bool, string[]"),
    [prompt, system, false, allowedValues]
  );
  const payload = (INFER_STRING_SELECTOR + argsEncoded.slice(2)) as Hex;

  const reserve = await publicClient.readContract({
    address: AGENT_REQUESTER,
    abi: REQUESTER_ABI,
    functionName: "getRequestDeposit",
  });
  const deposit = reserve + parseEther("0.07") * 3n;
  console.log(`Deposit : ~${(Number(deposit) / 1e18).toFixed(4)} STT`);

  // ── 5. createRequest ─────────────────────────────────
  const reqTx = await walletClient.writeContract({
    address: AGENT_REQUESTER,
    abi: REQUESTER_ABI,
    functionName: "createRequest",
    args: [LLM_AGENT_ID, store, HANDLE_RESPONSE_SELECTOR, payload],
    value: deposit,
    gasPrice: parseGwei(String(GAS_PRICE_GWEI)),
  });
  console.log(`\ncreateRequest tx: ${reqTx}`);
  const reqReceipt = await publicClient.waitForTransactionReceipt({ hash: reqTx });
  if (reqReceipt.status !== "success") throw new Error("createRequest reverted");

  let requestId: bigint | undefined;
  for (const log of reqReceipt.logs) {
    if (log.address.toLowerCase() !== AGENT_REQUESTER.toLowerCase()) continue;
    try {
      const d = decodeEventLog({ abi: REQUESTER_ABI, topics: log.topics, data: log.data });
      if (d.eventName === "RequestCreated") {
        requestId = d.args.requestId as bigint;
        break;
      }
    } catch { /* skip */ }
  }
  if (!requestId) throw new Error("RequestCreated event not found");
  console.log(`RequestId: ${requestId}`);

  // ── 6. Wait for ResultReady ──────────────────────────
  console.log(`\nWaiting up to ${WAIT_MS}ms for ResultReady…`);
  const start = Date.now();
  const llmText = await new Promise<string | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      unwatch();
      resolve(null); // null → falls back deterministically
    }, WAIT_MS);
    const unwatch = publicClient.watchContractEvent({
      address: store,
      abi: STORE_ABI,
      eventName: "ResultReady",
      args: { requestId },
      onLogs: (logs: any[]) => {
        for (const log of logs) {
          const { status, text } = log.args as { status: number; text: string };
          clearTimeout(timer);
          unwatch();
          console.log(`✅ ResultReady after ${((Date.now() - start) / 1000).toFixed(1)}s, status=${status}`);
          resolve(status === 2 ? text : null);
        }
      },
      onError: (e: any) => { clearTimeout(timer); unwatch(); reject(e); },
    });
  });
  console.log(`LLM text: ${JSON.stringify(llmText)?.slice(0, 200)}…`);

  // ── 7. Decide + fallback ────────────────────────────
  const decision = resolveDecision(llmText, {
    self: voter.address,
    alive,
    action: "vote",
  });
  console.log(`\nDecision: ${decision.target}  (source=${decision.source})`);
  if (decision.fallbackReason) console.log(`Fallback reason: ${decision.fallbackReason}`);

  // ── 8. Cast vote ────────────────────────────────────
  const voteTx = await walletClient.writeContract({
    address: diamond,
    abi: DIAMOND_VOTE_ABI,
    functionName: "vote",
    args: [roomId, decision.target],
    gasPrice: parseGwei(String(GAS_PRICE_GWEI)),
  });
  console.log(`\nvote tx: ${voteTx}`);
  console.log(`Explorer: https://shannon-explorer.somnia.network/tx/${voteTx}`);
  const voteReceipt = await publicClient.waitForTransactionReceipt({ hash: voteTx });
  console.log(`vote receipt: ${voteReceipt.status}  in block ${voteReceipt.blockNumber}`);
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  const roomId = BigInt(process.env.ROOM_ID ?? "0");
  if (roomId === 0n) throw new Error("ROOM_ID env var required");

  const diamond = (process.env.DIAMOND ?? DEFAULT_DIAMOND) as Address;
  const store = loadStoreAddress();
  const voter = privateKeyToAccount(pk(["LLM_AGENT_PRIVATE_KEY", "VOTER_PRIVATE_KEY", "PRIVATE_KEY"]));

  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: fallback([
      webSocket(somniaTestnet.rpcUrls.default.webSocket![0], { keepAlive: { interval: 25_000 } }),
      http(somniaTestnet.rpcUrls.default.http[0]),
    ]),
  });
  const walletClient = createWalletClient({
    account: voter,
    chain: somniaTestnet,
    transport: http(somniaTestnet.rpcUrls.default.http[0]),
  });

  console.log("=== Agent vote spike ===");
  console.log(`Room    : ${roomId}`);
  console.log(`Diamond : ${diamond}`);
  console.log(`Voter   : ${voter.address}`);
  console.log(`Store   : ${store}`);
  console.log(`AgentID : ${LLM_AGENT_ID}\n`);

  // ── Decide: fire now or wait for VotingStarted? ──────
  const room: any = await publicClient.readContract({
    address: diamond,
    abi: DIAMOND_VOTE_ABI,
    functionName: "getRoom",
    args: [roomId],
  });
  const currentPhase = Number(room.phase);
  console.log(`Current phase: ${currentPhase}`);

  if (currentPhase === PHASE_VOTING) {
    console.log("Already in VOTING — firing immediately.");
    await executeVote(publicClient, walletClient, voter, diamond, store, roomId);
    return;
  }

  // Wait mode: subscribe to VotingStarted; fire on receipt.
  console.log(`Waiting for VotingStarted event on room ${roomId}…`);
  console.log("(Voting window is only ~30s — script must react fast.)");

  await new Promise<void>((resolve, reject) => {
    let fired = false;
    const unwatch = publicClient.watchContractEvent({
      address: diamond,
      abi: DIAMOND_VOTE_ABI,
      eventName: "VotingStarted",
      args: { roomId },
      onLogs: async (logs: any[]) => {
        if (fired) return;
        for (const log of logs) {
          fired = true;
          unwatch();
          console.log(`\n🟢 VotingStarted detected (block ${log.blockNumber})`);
          try {
            await executeVote(publicClient, walletClient, voter, diamond, store, roomId);
            resolve();
          } catch (e) { reject(e); }
          return;
        }
      },
      onError: (e: any) => { unwatch(); reject(e); },
    });
    // Safety timeout — 30 min default. Override with VOTING_WATCH_MS.
    const watchTimeoutMs = Number(process.env.VOTING_WATCH_MS ?? 30 * 60_000);
    setTimeout(() => {
      if (!fired) {
        unwatch();
        reject(new Error(`Timeout: no VotingStarted in ${watchTimeoutMs}ms`));
      }
    }, watchTimeoutMs);
  });
}

main().catch((e) => { console.error("\n❌", e); process.exit(1); });
