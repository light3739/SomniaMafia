/**
 * Integration test: verify frontend WebSocket RPC config works with Somnia.
 *
 * Simulates the same transport config used in app/providers.tsx:
 *   fallback([webSocket(...), http(...)])
 *
 * Run: npx tsx scripts/test-ws-transport.ts
 */
import { createPublicClient, webSocket, http, fallback } from 'viem';
import { SOMNIA_TESTNET } from '../contracts/config';
import { MAFIA_ABI } from '../contracts/config';

const DIAMOND = '0x0406a14729b0c77c187ac5229c8c2317589e73c0' as const;

let passed = 0;
let failed = 0;
function ok(name: string) { passed++; console.log(`  ✅ ${name}`); }
function fail(name: string, err: any) { failed++; console.log(`  ❌ ${name}: ${err?.message || err}`); }

async function main() {
  console.log('\n=== Frontend WebSocket Transport Tests ===\n');

  const wsUrls = SOMNIA_TESTNET.rpcUrls.default.webSocket || [];
  const httpUrls = SOMNIA_TESTNET.rpcUrls.default.http;
  console.log(`Chain: ${SOMNIA_TESTNET.name} (${SOMNIA_TESTNET.id})`);
  console.log(`WS URLs: ${wsUrls.join(', ') || 'NONE'}`);
  console.log(`HTTP URLs: ${httpUrls.join(', ')}\n`);

  if (wsUrls.length === 0) {
    fail('Config check', 'No WebSocket URLs in SOMNIA_TESTNET.rpcUrls.default.webSocket');
    process.exit(1);
  }
  ok(`WebSocket URL configured: ${wsUrls[0]}`);

  // Test: same transport config as providers.tsx
  console.log('\nTest: Wagmi-style fallback transport');
  const client = createPublicClient({
    chain: SOMNIA_TESTNET,
    transport: fallback([
      ...wsUrls.map((url: string) =>
        webSocket(url, { reconnect: { delay: 2_000, attempts: 10 }, keepAlive: { interval: 25_000 } })
      ),
      ...httpUrls.map((url: string) => http(url)),
    ]),
  });

  try {
    const block = await client.getBlockNumber();
    ok(`getBlockNumber: ${block}`);
  } catch (e) { fail('getBlockNumber', e); }

  try {
    const room = await client.readContract({
      address: DIAMOND,
      abi: MAFIA_ABI,
      functionName: 'getRoom',
      args: [1n],
    });
    ok(`readContract (getRoom): phase=${(room as any).phase}`);
  } catch (e) { fail('readContract', e); }

  // Test watchContractEvent
  console.log('\nTest: watchContractEvent via WS transport');
  try {
    let eventCount = 0;
    const unwatch = client.watchContractEvent({
      address: DIAMOND,
      abi: MAFIA_ABI,
      eventName: 'PlayerJoined',
      onLogs: (logs) => { eventCount += logs.length; },
    });
    await new Promise(r => setTimeout(r, 3000));
    unwatch();
    ok(`watchContractEvent created and cleaned up (${eventCount} events in 3s)`);
  } catch (e) { fail('watchContractEvent', e); }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
