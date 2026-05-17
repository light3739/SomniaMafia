/**
 * Reusable Somnia LLM Inference call helper.
 * Wraps the createRequest → wait-for-event → return-decoded-string flow so
 * scripts that drive a full game (run.ts, agent-vote-spike.ts) can call it
 * as a single async function.
 */
import {
  encodeAbiParameters,
  decodeEventLog,
  parseAbi,
  parseAbiParameters,
  parseEther,
  parseGwei,
  toFunctionSelector,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";

export const AGENT_REQUESTER: Address = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";
export const LLM_INFERENCE_AGENT_ID = BigInt(
  process.env.LLM_AGENT_ID ?? "12847293847561029384"
);

const REQUESTER_ABI = parseAbi([
  "function createRequest(uint256 agentId, address callbackAddress, bytes4 callbackSelector, bytes payload) payable returns (uint256)",
  "function getRequestDeposit() view returns (uint256)",
  "event RequestCreated(uint256 indexed requestId, uint256 indexed agentId, uint256 perAgentBudget, bytes payload, address[] subcommittee)",
]);

const STORE_ABI = parseAbi([
  "event ResultReady(uint256 indexed requestId, uint8 status, string text)",
]);

const INFER_STRING_SELECTOR = toFunctionSelector(
  "inferString(string,string,bool,string[])"
) as Hex;

const HANDLE_RESPONSE_SIG =
  "handleResponse(uint256,(address,bytes,uint8,uint256,uint256,uint256)[],uint8,(uint256,address,address,bytes4,address[],(address,bytes,uint8,uint256,uint256,uint256)[],uint256,uint256,uint256,uint256,uint256,uint8,uint8,uint256,uint256))";
export const HANDLE_RESPONSE_SELECTOR = toFunctionSelector(HANDLE_RESPONSE_SIG) as Hex;

export interface InferStringRequest {
  prompt: string;
  system?: string;
  chainOfThought?: boolean;
  /** Constrains LLM output to one of these values. Strongly recommended. */
  allowedValues?: string[];
}

export interface InferStringOpts {
  publicClient: PublicClient;
  walletClient: WalletClient;
  /** Deployed LLMResultStore — receives the callback. */
  storeAddress: Address;
  /** Override default 90s wait. */
  waitMs?: number;
  /** Override default gas price (gwei). */
  gasPriceGwei?: number;
  /** Override default agent ID. */
  agentId?: bigint;
}

export interface InferStringResult {
  /** LLM-generated string. `null` if status != Success or timeout. */
  text: string | null;
  status: number;
  requestId: bigint;
  /** Tx hash of createRequest (for audit trail). */
  txHash: Hex;
  /** Wall-clock seconds from tx send to ResultReady (or timeout). */
  latencySec: number;
}

/**
 * Encode inferString payload and call AgentRequester.createRequest from the
 * provided wallet client. Wait for `ResultReady` from the store; resolve with
 * the decoded text (or null on failure/timeout — caller decides fallback).
 *
 * Deposit defaults to 0.24 STT (floor + 0.07 * 3 reward).
 */
export async function inferStringOnSomnia(
  req: InferStringRequest,
  opts: InferStringOpts
): Promise<InferStringResult> {
  const { publicClient, walletClient, storeAddress } = opts;
  const waitMs = opts.waitMs ?? 90_000;
  const gasPriceGwei = opts.gasPriceGwei ?? 10;
  const agentId = opts.agentId ?? LLM_INFERENCE_AGENT_ID;

  const payload = encodeInferStringPayload({
    prompt: req.prompt,
    system: req.system ?? "",
    chainOfThought: req.chainOfThought ?? false,
    allowedValues: req.allowedValues ?? [],
  });

  const reserve = await publicClient.readContract({
    address: AGENT_REQUESTER,
    abi: REQUESTER_ABI,
    functionName: "getRequestDeposit",
  });
  const deposit = reserve + parseEther("0.07") * 3n;

  const start = Date.now();
  const txHash = await walletClient.writeContract({
    address: AGENT_REQUESTER,
    abi: REQUESTER_ABI,
    functionName: "createRequest",
    args: [agentId, storeAddress, HANDLE_RESPONSE_SELECTOR, payload],
    value: deposit,
    gasPrice: parseGwei(String(gasPriceGwei)),
  } as any);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error(`createRequest reverted (tx ${txHash})`);
  }

  let requestId: bigint | undefined;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== AGENT_REQUESTER.toLowerCase()) continue;
    try {
      const d = decodeEventLog({ abi: REQUESTER_ABI, topics: log.topics, data: log.data });
      if (d.eventName === "RequestCreated") {
        requestId = d.args.requestId as bigint;
        break;
      }
    } catch { /* skip */ }
  }
  if (!requestId) throw new Error(`RequestCreated event missing in tx ${txHash}`);

  const outcome = await new Promise<{ text: string | null; status: number }>((resolve, reject) => {
    const timer = setTimeout(() => {
      unwatch();
      resolve({ text: null, status: 0 }); // status 0 = treat as timeout/none
    }, waitMs);
    const unwatch = publicClient.watchContractEvent({
      address: storeAddress,
      abi: STORE_ABI,
      eventName: "ResultReady",
      args: { requestId },
      onLogs: (logs) => {
        for (const log of logs) {
          const { status, text } = log.args as { status: number; text: string };
          clearTimeout(timer);
          unwatch();
          resolve({ text: status === 2 ? text : null, status });
        }
      },
      onError: (e) => { clearTimeout(timer); unwatch(); reject(e); },
    });
  });

  return {
    text: outcome.text,
    status: outcome.status,
    requestId,
    txHash,
    latencySec: (Date.now() - start) / 1000,
  };
}

export function encodeInferStringPayload(args: {
  prompt: string;
  system: string;
  chainOfThought: boolean;
  allowedValues: string[];
}): Hex {
  const encoded = encodeAbiParameters(
    parseAbiParameters("string, string, bool, string[]"),
    [args.prompt, args.system, args.chainOfThought, args.allowedValues]
  );
  return (INFER_STRING_SELECTOR + encoded.slice(2)) as Hex;
}
