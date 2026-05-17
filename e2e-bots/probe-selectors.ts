/**
 * Extract function selectors from AgentRegistry implementation bytecode.
 * Pattern: PUSH4 <selector> EQ (or DUP1 PUSH4 EQ). Selector = 4 bytes.
 *
 * Cross-check against 4byte.directory off-line via known candidate names list.
 */
import { createPublicClient, http, defineChain, keccak256, toBytes, type Address } from 'viem';

const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://api.infra.testnet.somnia.network/'] } },
});

// Proxy + implementation
const TARGETS: Address[] = [
  '0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A', // proxy
  '0xC0D5aaF9C2E2f87f94AFf8B77C44891f99A1d764', // implementation
];

const client = createPublicClient({ chain: somniaTestnet, transport: http() });

// Pre-compute selectors for common candidate function signatures
const CANDIDATES = [
  // existing known-working
  'agentCount()',
  'getAllAgents()',
  // metadata variants
  'agents(uint256)',
  'getAgent(uint256)',
  'getAgentInfo(uint256)',
  'agentInfo(uint256)',
  'agentMetadata(uint256)',
  'agentURI(uint256)',
  'uri(uint256)',
  'tokenURI(uint256)',
  'name(uint256)',
  'nameOf(uint256)',
  'agentName(uint256)',
  'ownerOf(uint256)',
  'agentOf(uint256)',
  'getOwner(uint256)',
  'descriptionOf(uint256)',
  'description(uint256)',
  'pricePerCall(uint256)',
  'perAgentPrice(uint256)',
  'priceOf(uint256)',
  'metadata(uint256)',
  'getMetadata(uint256)',
  'info(uint256)',
  'getInfo(uint256)',
  'agentExists(uint256)',
  'exists(uint256)',
  'getAgentMetadata(uint256)',
  'agentData(uint256)',
  'getAgentData(uint256)',
  'agent(uint256)',
  // listing variants
  'allAgents()',
  'listAgents()',
  'agentIds()',
  // role / type
  'agentType(uint256)',
  'category(uint256)',
  'baseAgent(uint256)',
  // mgmt
  'register(string,string,uint256)',
  'registerAgent(string,string,uint256)',
  'createAgent(string,string,uint256)',
  // platform-y
  'requester()',
  'platform()',
];

function selectorOf(sig: string): string {
  return keccak256(toBytes(sig)).slice(0, 10);
}

(async () => {
  const selMap = new Map<string, string>();
  for (const sig of CANDIDATES) {
    selMap.set(selectorOf(sig), sig);
  }

  for (const addr of TARGETS) {
    console.log(`\n── ${addr} ──`);
    const code = await client.getBytecode({ address: addr });
    if (!code) { console.log('  (no code)'); continue; }
    console.log(`  bytecode length: ${code.length} chars`);

    const found: string[] = [];
    for (const [sel, sig] of selMap) {
      // strip leading 0x and search
      if (code.toLowerCase().includes(sel.slice(2).toLowerCase())) {
        found.push(`${sel}  ${sig}`);
      }
    }
    found.sort();
    for (const f of found) console.log(`  ✓ ${f}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
