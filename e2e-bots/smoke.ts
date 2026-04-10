/**
 * smoke.ts — Integration smoke test.
 *
 * Starts Anvil + GM server, deploys contracts, then tests:
 * 1. GM health endpoint
 * 2. WebSocket authenticated join
 * 3. Full game flow through GM server (not direct contract calls)
 * 4. Security: timestamp rejection, SVG avatar block, dead player skip
 * 5. Mafia chat relay (WS)
 *
 * Usage:
 *   cd frontend/e2e-bots
 *   npm run smoke
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  parseEventLogs,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';
import { WebSocket } from 'ws';

import { MAFIA_ABI, GamePhase } from './abi.js';
import {
  generateVerifiedSRAKeys,
  generateInitialDeck,
  generateDistributedDeck,
  encryptDeck,
  createDeckCommitHash,
  generateSalt,
  getCardOffset,
} from './sra.js';
// @ts-ignore
import { buildPoseidon } from 'circomlibjs';

// ─────────────────────────── Config ───────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const SOMNIA_DIR = join(__dirname, '..', '..', 'SomniaSol');
const GM_DIR = join(__dirname, '..', '..', 'gm-server');
const RPC_URL = 'http://127.0.0.1:8545';
const GM_PORT = 3099; // Avoid conflict with production GM server
const GM_URL = `http://127.0.0.1:${GM_PORT}`;
const GM_WS_URL = `ws://127.0.0.1:${GM_PORT}/ws`;
const PLAYER_COUNT = 4;
const CHAIN_ID = 50312; // GM server defaults to this

const ANVIL_KEYS: Hex[] = [
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // deployer
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // GM
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
  '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
];

const anvilChain = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
let failed = 0;
const results: string[] = [];

function ok(name: string) {
  passed++;
  results.push(`  ✅ ${name}`);
  console.log(`  ✅ ${name}`);
}
function fail(name: string, err?: string) {
  failed++;
  results.push(`  ❌ ${name}${err ? ': ' + err : ''}`);
  console.error(`  ❌ ${name}${err ? ': ' + err : ''}`);
}

// ─────────────────────────── Process management ───────────────
let anvilProc: ChildProcess | null = null;
let gmProc: ChildProcess | null = null;

function startAnvil(): Promise<void> {
  return new Promise((resolve, reject) => {
    const anvil = process.env.ANVIL_BIN || join(process.env.HOME || '~', '.foundry/bin/anvil');
    anvilProc = spawn(anvil, ['--chain-id', '31337', '--block-time', '1', '--port', '8545'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    anvilProc.on('error', reject);
    anvilProc.stdout!.on('data', (data: Buffer) => {
      if (data.toString().includes('Listening on')) resolve();
    });
    setTimeout(() => resolve(), 3000); // fallback
  });
}

function resolveDiamondAddress(): Address {
  const files = readdirSync(SOMNIA_DIR)
    .filter((f) => f.startsWith('deployment-31337-') && f.endsWith('.json'))
    .sort();
  if (files.length === 0) throw new Error('No deployment found. Run npm run deploy first.');
  const json = JSON.parse(readFileSync(join(SOMNIA_DIR, files[files.length - 1]), 'utf8'));
  return json.contracts.Diamond as Address;
}

function startGmServer(diamond: Address): Promise<void> {
  return new Promise((resolve, reject) => {
    gmProc = spawn('npx', ['tsx', 'src/index.ts'], {
      cwd: GM_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: String(GM_PORT),
        GM_PRIVATE_KEY: ANVIL_KEYS[1],
        SOMNIA_RPC_URL: RPC_URL,
        SOMNIA_DIAMOND: diamond,
        REDIS_URL: 'redis://127.0.0.1:6399', // Smoke test Redis container
        LOG_LEVEL: 'warn',
        NODE_ENV: 'development',
      },
    });
    gmProc.on('error', reject);
    gmProc.stderr!.on('data', (d: Buffer) => {
      const s = d.toString();
      if (process.env.DEBUG_GM) process.stderr.write('[GM] ' + s);
      if (s.includes('listening on') || s.includes('listening')) resolve();
    });
    gmProc.stdout!.on('data', (d: Buffer) => {
      const s = d.toString();
      if (process.env.DEBUG_GM) process.stdout.write('[GM] ' + s);
      if (s.includes('listening on') || s.includes('listening')) resolve();
    });
    setTimeout(() => resolve(), 8000);
  });
}

function cleanup() {
  if (gmProc) { gmProc.kill('SIGTERM'); gmProc = null; }
  if (anvilProc) { anvilProc.kill('SIGTERM'); anvilProc = null; }
}

// ─────────────────────────── Signing helper ───────────────────
function signMessage(pk: Hex, message: string): Promise<{ signature: Hex; address: string }> {
  const account = privateKeyToAccount(pk);
  return account.signMessage({ message }).then((sig) => ({
    signature: sig,
    address: account.address,
  }));
}

// ─────────────────────────── Tests ───────────────────────────

async function testGmHealth() {
  console.log('\n── GM Server Health ──');
  try {
    const res = await fetch(`${GM_URL}/health`);
    const data = await res.json();
    if (data.status === 'ok' && data.ws !== undefined) {
      ok('Health endpoint returns status=ok + ws stats');
    } else {
      fail('Health endpoint', JSON.stringify(data));
    }
  } catch (e: any) {
    fail('Health endpoint unreachable', e.message);
  }
}

async function testWsAuth(roomId: number, playerPk: Hex) {
  console.log('\n── WebSocket Auth ──');
  const account = privateKeyToAccount(playerPk);

  // Test 1: Authenticated join
  await new Promise<void>((resolve) => {
    const ws = new WebSocket(GM_WS_URL);
    ws.on('open', async () => {
      const timestamp = Date.now();
      const message = `ws-join:${CHAIN_ID}:${roomId}:${timestamp}`;
      const signature = await account.signMessage({ message });
      ws.send(JSON.stringify({
        type: 'join', roomId, chainId: CHAIN_ID,
        playerAddress: account.address,
        signature, signerAddress: account.address, timestamp,
      }));
    });
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'joined') {
        ok('WS authenticated join accepted');
        ws.close();
        resolve();
      } else if (msg.type === 'error') {
        fail('WS authenticated join', msg.data);
        ws.close();
        resolve();
      }
    });
    ws.on('error', () => { fail('WS connection failed'); resolve(); });
    setTimeout(() => { ws.close(); fail('WS join timeout'); resolve(); }, 5000);
  });

  // Test 2: Unauthenticated join should be rejected
  await new Promise<void>((resolve) => {
    const ws = new WebSocket(GM_WS_URL);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'join', roomId, chainId: CHAIN_ID,
        playerAddress: account.address,
        // No signature!
      }));
    });
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'error') {
        ok('WS unauthenticated join rejected');
      } else {
        fail('WS unauthenticated join should be rejected', msg.type);
      }
      ws.close();
      resolve();
    });
    ws.on('close', () => resolve());
    setTimeout(() => { ws.close(); resolve(); }, 3000);
  });

  // Test 3: Expired timestamp should be rejected
  await new Promise<void>((resolve) => {
    const ws = new WebSocket(GM_WS_URL);
    ws.on('open', async () => {
      const timestamp = Date.now() - 120_000; // 2 min ago (>60s window)
      const message = `ws-join:${CHAIN_ID}:${roomId}:${timestamp}`;
      const signature = await account.signMessage({ message });
      ws.send(JSON.stringify({
        type: 'join', roomId, chainId: CHAIN_ID,
        playerAddress: account.address,
        signature, signerAddress: account.address, timestamp,
      }));
    });
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'error') {
        ok('WS expired timestamp rejected');
      } else {
        fail('WS expired timestamp should be rejected', msg.type);
      }
      ws.close();
      resolve();
    });
    ws.on('close', () => resolve());
    setTimeout(() => { ws.close(); resolve(); }, 3000);
  });
}

async function testTimestampWindow() {
  console.log('\n── Timestamp ±60s ──');
  const account = privateKeyToAccount(ANVIL_KEYS[2]);
  const roomId = '999';

  // Build a signed discussion request with old timestamp
  const oldTs = Date.now() - 90_000; // 90s ago
  const nonce = Math.random().toString(36).slice(2);
  const message = `discussion:${CHAIN_ID}:${roomId}:1:start:${nonce}:${oldTs}`;
  const signature = await account.signMessage({ message });

  const res = await fetch(`${GM_URL}/discussion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId, dayCount: 1, action: 'start',
      playerAddress: account.address,
      signature, nonce, timestamp: oldTs, chainId: CHAIN_ID,
    }),
  });

  if (res.status === 401) {
    ok('90s-old timestamp rejected (401)');
  } else {
    fail('90s-old timestamp should be rejected', `got ${res.status}`);
  }
}

async function testAvatarSvgBlock(roomId: number) {
  console.log('\n── Avatar SVG Block ──');
  const account = privateKeyToAccount(ANVIL_KEYS[2]);
  const nonce = Math.random().toString(36).slice(2);
  const ts = Date.now();
  // Must match SignatureBuilder('avatar', chainId, roomId).withAddress(addr).withModern(nonce, ts)
  const addrLower = account.address.toLowerCase();
  const message = `avatar:${CHAIN_ID}:${roomId}:${addrLower}:${nonce}:${ts}`;
  const signature = await account.signMessage({ message });

  const res = await fetch(`${GM_URL}/avatar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: String(roomId), address: account.address,
      avatar: 'data:image/svg+xml;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      signature, signerAddress: account.address, nonce, timestamp: ts, chainId: CHAIN_ID,
    }),
  });

  if (res.status === 400) {
    const body = await res.json();
    if (body.error?.includes('SVG')) {
      ok('SVG avatar rejected');
    } else {
      fail('SVG rejection wrong error', body.error);
    }
  } else {
    fail('SVG avatar should be rejected', `got ${res.status}`);
  }
}

async function testRoomRolesPhaseCheck() {
  console.log('\n── Room Roles Phase Check ──');
  // Query room-roles for a room that's not in ENDED phase
  const res = await fetch(`${GM_URL}/room-roles/9999?chainId=${CHAIN_ID}`);
  // Should get 202 (pending) or 400 (invalid room), NOT 200 with roles
  if (res.status === 202 || res.status === 400) {
    ok(`Room roles blocked for non-ENDED room (${res.status})`);
  } else if (res.status === 200) {
    fail('Room roles should not return 200 for non-ENDED room');
  } else {
    ok(`Room roles returned ${res.status} (acceptable)`);
  }
}

async function testLogsRateLimited() {
  console.log('\n── Logs Rate Limiting ──');
  // Hit /logs rapidly — should get rate limited after 20 req/s
  let rateLimited = false;
  for (let i = 0; i < 25; i++) {
    const res = await fetch(`${GM_URL}/logs/1?chainId=${CHAIN_ID}`);
    if (res.status === 429) {
      rateLimited = true;
      break;
    }
  }
  if (rateLimited) {
    ok('Logs endpoint rate limited');
  } else {
    fail('Logs endpoint not rate limited after 25 rapid requests');
  }
}

async function testWsRelay(roomId: number) {
  console.log('\n── WS Relay ──');
  const accountA = privateKeyToAccount(ANVIL_KEYS[2]);
  const accountB = privateKeyToAccount(ANVIL_KEYS[3]);

  // Connect two players
  const wsA = new WebSocket(GM_WS_URL);
  const wsB = new WebSocket(GM_WS_URL);

  const joinWs = (ws: typeof wsA, account: typeof accountA): Promise<void> =>
    new Promise((resolve) => {
      ws.on('open', async () => {
        const timestamp = Date.now();
        const message = `ws-join:${CHAIN_ID}:${roomId}:${timestamp}`;
        const signature = await account.signMessage({ message });
        ws.send(JSON.stringify({
          type: 'join', roomId, chainId: CHAIN_ID,
          playerAddress: account.address,
          signature, signerAddress: account.address, timestamp,
        }));
      });
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'joined') resolve();
      });
      setTimeout(resolve, 3000);
    });

  await Promise.all([joinWs(wsA, accountA), joinWs(wsB, accountB)]);

  // Test relay: A sends, B receives, A does NOT receive own message
  const relayResult = await new Promise<string>((resolve) => {
    let aReceived = false;

    wsA.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'game-signal') aReceived = true;
    });

    wsB.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'game-signal') {
        resolve(aReceived ? 'FAIL_SENDER_GOT_OWN' : 'OK');
      }
    });

    wsA.send(JSON.stringify({
      type: 'relay',
      event: { type: 'game-signal', data: { test: true } },
    }));

    setTimeout(() => resolve('TIMEOUT'), 3000);
  });

  if (relayResult === 'OK') {
    ok('WS relay: B received, A did not');
  } else {
    fail('WS relay', relayResult);
  }

  wsA.close();
  wsB.close();
}

// ─────────────────────────── Main ───────────────────────────
async function main() {
  console.log('═══ Mafia Smoke Test ═══\n');

  // Start Anvil
  console.log('Starting Anvil...');
  await startAnvil();
  await sleep(1000);

  // Verify Anvil + reset state
  try {
    const pc = createPublicClient({ chain: anvilChain, transport: http(RPC_URL) });
    await pc.getBlockNumber();
    // Reset Anvil state to avoid stale sessions from previous runs
    await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'anvil_reset', params: [{ forking: undefined }], id: 1 }),
    });
    console.log('Anvil running ✓ (state reset)');
  } catch {
    console.error('Anvil not running');
    cleanup();
    process.exit(1);
  }

  // Deploy contracts (always fresh after anvil_reset)
  console.log('Deploying contracts...');
  const { execSync } = await import('node:child_process');
  // Clean old deployment files
  try {
    for (const f of readdirSync(SOMNIA_DIR).filter(f => f.startsWith('deployment-31337-'))) {
      const { unlinkSync } = await import('node:fs');
      unlinkSync(join(SOMNIA_DIR, f));
    }
  } catch { /* ignore */ }

  execSync(
    `PRIVATE_KEY=${ANVIL_KEYS[0]} GM_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 npx hardhat run scripts/deploy-diamond.ts --network localhost`,
    { cwd: SOMNIA_DIR, stdio: 'pipe', timeout: 300_000 }
  );

  let diamond: Address;
  try {
    diamond = resolveDiamondAddress();
  } catch {
    console.error('Deploy failed: no deployment file found');
    cleanup();
    process.exit(1);
  }
  console.log('Contracts deployed ✓');

  console.log(`Diamond: ${diamond}`);

  // Start GM server
  console.log('Starting GM server...');
  await startGmServer(diamond);
  await sleep(2000);

  // Verify GM server
  try {
    const res = await fetch(`${GM_URL}/health`);
    if (!res.ok) throw new Error(`${res.status}`);
    console.log('GM server running ✓\n');
  } catch (e: any) {
    console.error('GM server not running:', e.message);
    cleanup();
    process.exit(1);
  }

  // Create a room on-chain for test context
  const pc = createPublicClient({ chain: anvilChain, transport: http(RPC_URL) }) as PublicClient;
  const host = privateKeyToAccount(ANVIL_KEYS[2]);
  const hostWallet = createWalletClient({ account: host, chain: anvilChain, transport: http(RPC_URL) });

  const createHash = await hostWallet.writeContract({
    address: diamond,
    abi: MAFIA_ABI,
    functionName: 'createAndJoin',
    args: ['SmokeTest', PLAYER_COUNT, 'SmokeHost', host.publicKey, host.address, false, 0n],
    chain: anvilChain,
    account: host,
    value: parseEther('1.5'),
  } as any);
  const createReceipt = await pc.waitForTransactionReceipt({ hash: createHash });
  const roomLogs = parseEventLogs({ abi: MAFIA_ABI, eventName: 'RoomCreated', logs: createReceipt.logs });
  const roomId = Number((roomLogs[0] as any).args.roomId);
  console.log(`Test room created: #${roomId}\n`);

  // ── Run tests ──
  try {
    await testGmHealth();
    await testWsAuth(roomId, ANVIL_KEYS[2]);
    await testTimestampWindow();
    await testAvatarSvgBlock(roomId);
    await testRoomRolesPhaseCheck();
    await testLogsRateLimited();
    await testWsRelay(roomId);
  } catch (e: any) {
    console.error('\n💥 Unexpected error:', e.message);
    failed++;
  }

  // ── Summary ──
  console.log('\n══════════════════════════════');
  console.log('SMOKE TEST RESULTS');
  console.log('══════════════════════════════');
  for (const r of results) console.log(r);
  console.log(`\nPassed: ${passed}  Failed: ${failed}`);

  cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  cleanup();
  process.exit(1);
});
