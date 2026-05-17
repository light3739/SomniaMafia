/**
 * Probe Somnia AgentRegistry on testnet to discover the numeric agentId
 * for the LLM Inference base agent.
 *
 * Strategy: docs don't publish the agentId — must read it from chain.
 *   1. Try several common read-fn ABIs against AgentRegistry.
 *   2. Scan recent logs for AgentRegistered-style events.
 *   3. Print everything; we eyeball the LLM one and copy the ID.
 *
 * Run:  npx tsx probe-registry.ts
 */
import {
  createPublicClient,
  http,
  defineChain,
  parseAbi,
  decodeEventLog,
  type Address,
  type Log,
} from 'viem';

const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://api.infra.testnet.somnia.network/'] } },
});

const AGENT_REGISTRY: Address = '0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A';
const AGENT_REQUESTER: Address = '0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776';

const client = createPublicClient({
  chain: somniaTestnet,
  transport: http(),
});

// ─── Probe 1: try common view function signatures ─────────────
const CANDIDATE_READ_FNS = [
  'function agentCount() view returns (uint256)',
  'function totalAgents() view returns (uint256)',
  'function count() view returns (uint256)',
  'function nextAgentId() view returns (uint256)',
  'function getAllAgents() view returns (uint256[])',
];

async function probeReads() {
  console.log('\n──── Probe 1: read fns on AgentRegistry ────');
  for (const sig of CANDIDATE_READ_FNS) {
    const fnName = sig.match(/function (\w+)/)![1];
    try {
      const result = await client.readContract({
        address: AGENT_REGISTRY,
        abi: parseAbi([sig]),
        functionName: fnName,
      });
      console.log(`  ✓ ${fnName}() = ${JSON.stringify(result, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v
      )}`);
    } catch (e: any) {
      console.log(`  ✗ ${fnName}() — ${e.shortMessage || e.message?.slice(0, 80)}`);
    }
  }
}

// ─── Probe 2: dump first N agent IDs by index ─────────────────
const GET_AGENT_BY_ID_VARIANTS = [
  'function agents(uint256) view returns (address agent, string name, string description, address owner, uint256 createdAt)',
  'function getAgent(uint256) view returns (address agent, string name, string description, uint256 perAgentPrice)',
  'function getAgentInfo(uint256) view returns (tuple(address agent, string name, string description) info)',
  'function agentById(uint256) view returns (address, string, string)',
];

async function probeAgentByIndex() {
  console.log('\n──── Probe 2: getAgent(1..20) ────');
  for (let id = 1n; id <= 20n; id++) {
    let found = false;
    for (const sig of GET_AGENT_BY_ID_VARIANTS) {
      const fnName = sig.match(/function (\w+)/)![1];
      try {
        const result: any = await client.readContract({
          address: AGENT_REGISTRY,
          abi: parseAbi([sig]),
          functionName: fnName,
          args: [id],
        });
        // Some ABIs return zero-init for missing IDs; require a non-zero address
        const first = Array.isArray(result) ? result[0] : result?.agent;
        if (typeof first === 'string' && first !== '0x0000000000000000000000000000000000000000') {
          console.log(`  ✓ id=${id} via ${fnName}: ${JSON.stringify(result, (_, v) =>
            typeof v === 'bigint' ? v.toString() : v
          )}`);
          found = true;
          break;
        }
      } catch {
        // silent — try next variant
      }
    }
    if (!found) {
      // bail early after a stretch of empty slots
      if (id > 5n) break;
    }
  }
}

// ─── Probe 3: scan logs from AgentRegistry ────────────────────
async function probeLogs() {
  console.log('\n──── Probe 3: dump logs (last ~50k blocks) ────');
  const latest = await client.getBlockNumber();
  const fromBlock = latest > 50_000n ? latest - 50_000n : 0n;
  console.log(`  scanning ${fromBlock}..${latest}`);

  const logs = await client.getLogs({
    address: AGENT_REGISTRY,
    fromBlock,
    toBlock: latest,
  }).catch((e) => {
    console.log(`  ✗ getLogs failed: ${e.shortMessage || e.message}`);
    return [] as Log[];
  });

  console.log(`  got ${logs.length} log(s)`);

  // Topic0 dump → frequency
  const topicCounts = new Map<string, number>();
  for (const log of logs) {
    const t0 = log.topics[0] ?? '0x';
    topicCounts.set(t0, (topicCounts.get(t0) ?? 0) + 1);
  }
  console.log('  topic0 frequencies:');
  for (const [t, n] of [...topicCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${t}  × ${n}`);
  }

  // Try to decode with guessed AgentRegistered event signatures
  const CANDIDATE_EVENTS = parseAbi([
    'event AgentRegistered(uint256 indexed agentId, address indexed agent, string name)',
    'event AgentRegistered(uint256 indexed agentId, address agent, string name, string description)',
    'event AgentCreated(uint256 indexed agentId, address indexed owner, string name)',
    'event Registered(uint256 indexed id, address agent, string name)',
  ]);

  console.log('  decoded events (best effort):');
  for (const log of logs.slice(0, 20)) {
    for (const eventAbi of CANDIDATE_EVENTS) {
      try {
        const decoded = decodeEventLog({
          abi: [eventAbi as any],
          topics: log.topics,
          data: log.data,
        });
        console.log(`    block ${log.blockNumber}: ${decoded.eventName}`,
          JSON.stringify(decoded.args, (_, v) => typeof v === 'bigint' ? v.toString() : v));
        break;
      } catch { /* try next */ }
    }
  }
}

// ─── Probe 4: dump AgentRequester logs too ────────────────────
async function probeRequesterLogs() {
  console.log('\n──── Probe 4: AgentRequester logs (last 10k blocks) ────');
  const latest = await client.getBlockNumber();
  const fromBlock = latest > 10_000n ? latest - 10_000n : 0n;

  const logs = await client.getLogs({
    address: AGENT_REQUESTER,
    fromBlock,
    toBlock: latest,
  }).catch((e) => {
    console.log(`  ✗ getLogs failed: ${e.shortMessage || e.message}`);
    return [] as Log[];
  });

  console.log(`  got ${logs.length} log(s)`);

  // RequestCreated has agentId indexed → topics[2]
  // event RequestCreated(uint256 indexed requestId, uint256 indexed agentId, ...)
  const agentIdHist = new Map<string, number>();
  for (const log of logs) {
    if (log.topics.length >= 3) {
      const agentIdHex = log.topics[2];
      if (agentIdHex) {
        const id = BigInt(agentIdHex).toString();
        agentIdHist.set(id, (agentIdHist.get(id) ?? 0) + 1);
      }
    }
  }
  console.log('  topic2 (likely agentId) histogram:');
  for (const [id, n] of [...agentIdHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`    agentId=${id}  × ${n}`);
  }
}

(async () => {
  console.log(`Somnia testnet 50312`);
  console.log(`  AgentRegistry : ${AGENT_REGISTRY}`);
  console.log(`  AgentRequester: ${AGENT_REQUESTER}`);

  await probeReads();
  await probeAgentByIndex();
  await probeLogs();
  await probeRequesterLogs();
})().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
