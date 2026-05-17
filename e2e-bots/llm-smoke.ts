/**
 * Somnia LLM Inference smoke test.
 *
 * Goal: prove the on-chain LLM primitive responds from our env. Calls
 * AgentRequester.createRequest with an `inferString` payload, waits for
 * LLMResultStore.ResultReady event, prints the response.
 *
 * Prereq:
 *   1. Deploy LLMResultStore on testnet:
 *        cd SomniaSol
 *        PRIVATE_KEY=0x... npx hardhat run scripts/deploy-llm-store.ts \
 *            --network somnia_testnet
 *      Writes ../SomniaSol/llm-store-50312.json
 *
 *   2. Sponsor wallet (PRIVATE_KEY) needs ~0.5 STT on testnet (0.24 per call
 *      deposit + gas).
 *
 * Run:
 *   cd SomniaMafia/e2e-bots
 *   PRIVATE_KEY=0x... npx tsx llm-smoke.ts
 *   # optional: LLM_PROMPT="..." SYSTEM="..." LLM_AGENT_ID=...
 *   # (Avoid plain PROMPT — on Windows the shell may inject $P$G.)
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  fallback,
  parseEther,
  encodeAbiParameters,
  encodeFunctionData,
  decodeEventLog,
  parseAbi,
  parseAbiParameters,
  toFunctionSelector,
  defineChain,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Config ──────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const SOMNIA_DIR = join(__dirname, "..", "..", "SomniaSol");

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

const AGENT_REQUESTER: Address = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";
const LLM_INFERENCE_AGENT_ID = BigInt(
  process.env.LLM_AGENT_ID ?? "12847293847561029384"
);
const PROMPT = process.env.LLM_PROMPT ?? "Write a short haiku about Solidity.";
const SYSTEM = process.env.SYSTEM ?? "";
const CHAIN_OF_THOUGHT = process.env.COT === "1";

// ─── ABIs ────────────────────────────────────────────────────
const AGENT_REQUESTER_ABI = parseAbi([
  "function createRequest(uint256 agentId, address callbackAddress, bytes4 callbackSelector, bytes payload) payable returns (uint256)",
  "function getRequestDeposit() view returns (uint256)",
  "event RequestCreated(uint256 indexed requestId, uint256 indexed agentId, uint256 perAgentBudget, bytes payload, address[] subcommittee)",
  "event RequestFinalized(uint256 indexed requestId, uint8 status)",
]);

const STORE_ABI = parseAbi([
  "function results(uint256) view returns (bool ready, uint8 status, string text)",
  "event ResultReady(uint256 indexed requestId, uint8 status, string text)",
  "event ResultFailed(uint256 indexed requestId, uint8 status)",
]);

// inferString(string prompt, string system, bool chainOfThought, string[] allowedValues)
const INFER_STRING_SELECTOR = toFunctionSelector(
  "inferString(string,string,bool,string[])"
) as Hex;

// callback selector — must match LLMResultStore.handleResponse exactly.
// Full Request struct copied from docs so the selector hashes correctly.
const HANDLE_RESPONSE_SIG =
  "handleResponse(uint256,(address,bytes,uint8,uint256,uint256,uint256)[],uint8,(uint256,address,address,bytes4,address[],(address,bytes,uint8,uint256,uint256,uint256)[],uint256,uint256,uint256,uint256,uint256,uint8,uint8,uint256,uint256))";
const HANDLE_RESPONSE_SELECTOR = toFunctionSelector(HANDLE_RESPONSE_SIG) as Hex;

// ─── Setup ───────────────────────────────────────────────────
function loadStoreAddress(): Address {
  const file = join(SOMNIA_DIR, `llm-store-${somniaTestnet.id}.json`);
  try {
    const json = JSON.parse(readFileSync(file, "utf8"));
    if (!json.llmResultStore) throw new Error("missing llmResultStore");
    return json.llmResultStore as Address;
  } catch (e: any) {
    throw new Error(
      `Could not read ${file}. Run deploy-llm-store.ts first.\n→ ${e.message}`
    );
  }
}

function pk(): Hex {
  const k = process.env.PRIVATE_KEY;
  if (!k) throw new Error("PRIVATE_KEY env var required (sponsor wallet on testnet)");
  return (k.startsWith("0x") ? k : `0x${k}`) as Hex;
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  const storeAddress = loadStoreAddress();
  const sponsor = privateKeyToAccount(pk());

  const publicClient = createPublicClient({
    chain: somniaTestnet,
    transport: fallback([
      webSocket(somniaTestnet.rpcUrls.default.webSocket![0], { keepAlive: { interval: 25_000 } }),
      http(somniaTestnet.rpcUrls.default.http[0]),
    ]),
  });
  const walletClient = createWalletClient({
    account: sponsor,
    chain: somniaTestnet,
    transport: http(somniaTestnet.rpcUrls.default.http[0]),
  });

  console.log("=== Somnia LLM Inference smoke ===");
  console.log(`Sponsor : ${sponsor.address}`);
  console.log(`Store   : ${storeAddress}`);
  console.log(`Platform: ${AGENT_REQUESTER}`);
  console.log(`AgentID : ${LLM_INFERENCE_AGENT_ID}`);
  console.log(`Prompt  : ${JSON.stringify(PROMPT)}`);
  console.log(`System  : ${JSON.stringify(SYSTEM)}`);
  console.log(`CoT     : ${CHAIN_OF_THOUGHT}\n`);

  const balance = await publicClient.getBalance({ address: sponsor.address });
  console.log(`Balance : ${(Number(balance) / 1e18).toFixed(4)} STT`);
  if (balance < parseEther("0.3")) {
    console.warn("⚠️  Balance below 0.3 STT — call may fail at deposit check.");
  }

  // ── 1. Build inferString payload ─────────────────────────
  // payload = selector(inferString) || abi.encode(prompt, system, cot, allowedValues)
  const argsEncoded = encodeAbiParameters(
    parseAbiParameters("string, string, bool, string[]"),
    [PROMPT, SYSTEM, CHAIN_OF_THOUGHT, []]
  );
  const payload = (INFER_STRING_SELECTOR + argsEncoded.slice(2)) as Hex;
  console.log(`Payload (${payload.length} chars): ${payload.slice(0, 80)}…`);
  console.log(`Callback selector: ${HANDLE_RESPONSE_SELECTOR}`);

  // ── 2. Deposit calc ──────────────────────────────────────
  // Per docs: floor (0.01 × 3 = 0.03) + reward (0.07 × 3 = 0.21) = 0.24 STT.
  // Use getRequestDeposit() for the floor; add agent reward manually.
  const reserve = await publicClient.readContract({
    address: AGENT_REQUESTER,
    abi: AGENT_REQUESTER_ABI,
    functionName: "getRequestDeposit",
  });
  const reward = parseEther("0.07") * 3n;
  const deposit = reserve + reward;
  console.log(`Deposit : reserve=${reserve} + reward=${reward} = ${deposit} wei (~${(Number(deposit) / 1e18).toFixed(4)} STT)`);

  // ── 3. createRequest ─────────────────────────────────────
  const txHash = await walletClient.writeContract({
    address: AGENT_REQUESTER,
    abi: AGENT_REQUESTER_ABI,
    functionName: "createRequest",
    args: [LLM_INFERENCE_AGENT_ID, storeAddress, HANDLE_RESPONSE_SELECTOR, payload],
    value: deposit,
  });
  console.log(`\nTx sent : ${txHash}`);
  console.log(`Explorer: https://shannon-explorer.somnia.network/tx/${txHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error(`createRequest reverted in block ${receipt.blockNumber}`);
  }

  // Parse RequestCreated to extract requestId
  let requestId: bigint | undefined;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== AGENT_REQUESTER.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: AGENT_REQUESTER_ABI, topics: log.topics, data: log.data });
      if (decoded.eventName === "RequestCreated") {
        requestId = decoded.args.requestId as bigint;
        console.log(`RequestCreated: id=${requestId}, agentId=${decoded.args.agentId}`);
        console.log(`Subcommittee: ${(decoded.args.subcommittee as Address[]).join(", ")}`);
        break;
      }
    } catch { /* skip non-matching */ }
  }
  if (!requestId) throw new Error("RequestCreated event not found in receipt");

  // ── 4. Wait for ResultReady / RequestFinalized ──────────
  console.log(`\nWaiting for ResultReady event on store ${storeAddress}…`);
  const start = Date.now();
  const timeoutMs = Number(process.env.WAIT_MS ?? 180_000); // 3 min default

  await new Promise<void>((resolve, reject) => {
    const unwatch = publicClient.watchContractEvent({
      address: storeAddress,
      abi: STORE_ABI,
      eventName: "ResultReady",
      args: { requestId },
      onLogs: (logs) => {
        for (const log of logs) {
          const { status, text } = log.args as { status: number; text: string };
          const elapsed = ((Date.now() - start) / 1000).toFixed(1);
          console.log(`\n✅ ResultReady after ${elapsed}s`);
          console.log(`   status: ${status}`);
          console.log(`   text  : ${JSON.stringify(text)}`);
          unwatch();
          resolve();
        }
      },
      onError: reject,
    });

    setTimeout(() => {
      unwatch();
      reject(new Error(`Timeout after ${timeoutMs}ms waiting for ResultReady`));
    }, timeoutMs);
  });

  // Also fetch via storage for sanity
  const stored = await publicClient.readContract({
    address: storeAddress,
    abi: STORE_ABI,
    functionName: "results",
    args: [requestId],
  });
  console.log(`\nStored (read): ready=${stored[0]}, status=${stored[1]}, text=${JSON.stringify(stored[2])}`);
}

main().catch((e) => { console.error("\n❌", e); process.exit(1); });
