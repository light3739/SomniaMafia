/**
 * test_ecies_gm_api.mjs
 *
 * Integration tests against the LIVE GM test server.
 * Tests all three ECIES routes:
 *   POST /register-pubkey  — stores player's P-256 pubkey (no auth)
 *   POST /submit-sra-key   — stores SRA decryption key (requires ECDSA sig)
 *   GET  /my-role/:roomId  — returns ECIES-encrypted role (requires ECDSA sig)
 *
 * Uses a throwaway test wallet — never use a real wallet private key here.
 * Viem is used for signing (same lib as frontend).
 *
 * Run: node scripts/test_ecies_gm_api.mjs
 */
import { subtle } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';

// ─── Config ───────────────────────────────────────────────────────────────────
const GM_URL = process.env.GM_URL ?? 'https://gm-test.mafiaonchain.live';

// Throwaway test wallet — never used on mainnet, no funds
const TEST_PRIVATE_KEY = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const account = privateKeyToAccount(TEST_PRIVATE_KEY);
const PLAYER_ADDRESS = account.address; // deterministic from private key

// Use a clearly fake roomId that won't exist on-chain
const TEST_ROOM_ID = '999999';

console.log(`\n═══ GM API Integration Tests ═══`);
console.log(`GM: ${GM_URL}`);
console.log(`Player: ${PLAYER_ADDRESS}\n`);

// ─── Browser-side helpers (mirrors eciesService.ts) ───────────────────────────
function hexToBytes(hex) {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const arr = new Uint8Array(h.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return arr;
}

async function generateKeypair() {
  return subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
}

async function exportPubkeyHex(publicKey) {
  const raw = await subtle.exportKey('raw', publicKey);
  return Buffer.from(raw).toString('hex');
}

async function eciesDecrypt(encrypted, privateKey) {
  const ephemeralPubkey = await subtle.importKey(
    'raw',
    hexToBytes(encrypted.ephemeralPubkey).buffer,
    { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  const sharedBits = await subtle.deriveBits({ name: 'ECDH', public: ephemeralPubkey }, privateKey, 256);
  const aesKey = await subtle.importKey('raw', sharedBits, { name: 'AES-GCM' }, false, ['decrypt']);
  const plaintext = await subtle.decrypt(
    { name: 'AES-GCM', iv: hexToBytes(encrypted.iv).buffer },
    aesKey,
    hexToBytes(encrypted.ciphertext).buffer
  );
  return new TextDecoder().decode(plaintext);
}

// ─── Signing helper (legacy format: plain text message) ───────────────────────
async function sign(message) {
  return account.signMessage({ message });
}

// ─── Test runner ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
async function test(label, fn) {
  try {
    await fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${label}: ${e.message}`);
    failed++;
  }
}

function expect(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// ── Health check ──────────────────────────────────────────────────────────────
console.log('0. Health check:');
await test('GET /health → ok', async () => {
  const r = await fetch(`${GM_URL}/health`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (j.status !== 'ok') throw new Error(`status=${j.status}`);
});

// ── POST /register-pubkey ─────────────────────────────────────────────────────
console.log('\n1. POST /register-pubkey:');
let keypair;
let pubkeyHex;

await test('400 when missing fields', async () => {
  const r = await fetch(`${GM_URL}/register-pubkey`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: TEST_ROOM_ID }),
  });
  expect(r.status, 400, 'status');
  const j = await r.json();
  if (!j.error) throw new Error('No error field in response');
});

await test('400 on bad pubkey format (too short)', async () => {
  const r = await fetch(`${GM_URL}/register-pubkey`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: TEST_ROOM_ID, playerAddress: PLAYER_ADDRESS, pubkey: 'deadbeef' }),
  });
  expect(r.status, 400, 'status');
});

await test('400 on pubkey without 04 prefix (compressed key)', async () => {
  // 65 bytes but starts with 02 (compressed) — should fail
  const fakePub = '02' + 'ab'.repeat(32) + 'cd'.repeat(32); // 66 total = 132 chars
  const r = await fetch(`${GM_URL}/register-pubkey`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: TEST_ROOM_ID, playerAddress: PLAYER_ADDRESS, pubkey: fakePub }),
  });
  expect(r.status, 400, 'status');
});

await test('200 with valid P-256 pubkey', async () => {
  keypair = await generateKeypair();
  pubkeyHex = await exportPubkeyHex(keypair.publicKey);
  const r = await fetch(`${GM_URL}/register-pubkey`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: TEST_ROOM_ID, playerAddress: PLAYER_ADDRESS, pubkey: pubkeyHex }),
  });
  expect(r.status, 200, 'status');
  const j = await r.json();
  if (j.ok !== true) throw new Error(`ok=${j.ok}`);
});

await test('re-registration succeeds (idempotent)', async () => {
  const r = await fetch(`${GM_URL}/register-pubkey`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: TEST_ROOM_ID, playerAddress: PLAYER_ADDRESS, pubkey: pubkeyHex }),
  });
  expect(r.status, 200, 'status');
});

// ── POST /submit-sra-key ──────────────────────────────────────────────────────
console.log('\n2. POST /submit-sra-key:');

// A realistic SRA key (large bigint, coprime with PRIME-1)
const TEST_SRA_KEY = '123456789012345';

await test('400 when missing fields', async () => {
  const r = await fetch(`${GM_URL}/submit-sra-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: TEST_ROOM_ID }),
  });
  expect(r.status, 400, 'status');
});

await test('400 on invalid sraKey (zero)', async () => {
  const sig = await sign(`submit-key:${TEST_ROOM_ID}:0`);
  const r = await fetch(`${GM_URL}/submit-sra-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: TEST_ROOM_ID, playerAddress: PLAYER_ADDRESS, sraKey: '0', signature: sig }),
  });
  expect(r.status, 400, 'status');
});

await test('400 on invalid sraKey (negative)', async () => {
  const sig = await sign(`submit-key:${TEST_ROOM_ID}:-5`);
  const r = await fetch(`${GM_URL}/submit-sra-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: TEST_ROOM_ID, playerAddress: PLAYER_ADDRESS, sraKey: '-5', signature: sig }),
  });
  expect(r.status, 400, 'status');
});

await test('401 when signature is wrong (different message signed)', async () => {
  const wrongSig = await sign('this is the wrong message');
  const r = await fetch(`${GM_URL}/submit-sra-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: TEST_ROOM_ID, playerAddress: PLAYER_ADDRESS, sraKey: TEST_SRA_KEY, signature: wrongSig }),
  });
  expect(r.status, 401, 'status');
});

await test('200 with valid signature (legacy format)', async () => {
  const message = `submit-key:${TEST_ROOM_ID}:${TEST_SRA_KEY}`;
  const sig = await sign(message);
  const r = await fetch(`${GM_URL}/submit-sra-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: TEST_ROOM_ID, playerAddress: PLAYER_ADDRESS, sraKey: TEST_SRA_KEY, signature: sig }),
  });
  if (r.status !== 200) {
    const j = await r.json();
    throw new Error(`HTTP ${r.status}: ${j.error}`);
  }
  const j = await r.json();
  if (j.ok !== true) throw new Error(`ok=${j.ok}`);
});

// ── GET /my-role/:roomId ──────────────────────────────────────────────────────
console.log('\n3. GET /my-role/:roomId:');

await test('400 when missing playerAddress', async () => {
  const r = await fetch(`${GM_URL}/my-role/${TEST_ROOM_ID}?signature=0x00`);
  expect(r.status, 400, 'status');
});

await test('401 when signature wrong', async () => {
  const badSig = await sign('wrong message');
  const params = new URLSearchParams({ playerAddress: PLAYER_ADDRESS, signature: badSig });
  const r = await fetch(`${GM_URL}/my-role/${TEST_ROOM_ID}?${params}`);
  expect(r.status, 401, 'status');
});

await test('404 if pubkey not registered for this address (different room)', async () => {
  const OTHER_ROOM = '888888';
  const message = `my-role:${OTHER_ROOM}:${PLAYER_ADDRESS.toLowerCase()}`;
  const sig = await sign(message);
  const params = new URLSearchParams({ playerAddress: PLAYER_ADDRESS, signature: sig });
  const r = await fetch(`${GM_URL}/my-role/${OTHER_ROOM}?${params}`);
  // Should be 404 (pubkey not registered) OR 404 (player not in room on-chain)
  if (r.status !== 404) throw new Error(`Expected 404, got ${r.status}`);
});

await test('returns 404/500/202 (not 401) after auth for registered room', async () => {
  // We've registered a pubkey and submitted an SRA key for TEST_ROOM_ID.
  // But the room doesn't exist on chain → should get 404 or 500 (not 401 auth error)
  const message = `my-role:${TEST_ROOM_ID}:${PLAYER_ADDRESS.toLowerCase()}`;
  const sig = await sign(message);
  const params = new URLSearchParams({ playerAddress: PLAYER_ADDRESS, signature: sig });
  const r = await fetch(`${GM_URL}/my-role/${TEST_ROOM_ID}?${params}`);
  if (r.status === 401) throw new Error('Got 401 — auth failed even with correct signature!');
  // Expected: 404 (player not in room), 500 (no such room on chain), or 202 (pending keys)
  if (![200, 202, 404, 500].includes(r.status)) throw new Error(`Unexpected status ${r.status}`);
});

// ── Signature format test: modern nonce+timestamp ─────────────────────────────
console.log('\n4. Modern signature format (nonce+timestamp):');

await test('submit-sra-key accepts modern nonce/timestamp signature', async () => {
  const nonce = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `submit-key:${TEST_ROOM_ID}:${TEST_SRA_KEY}:${nonce}:${timestamp}`;
  const sig = await sign(message);
  const r = await fetch(`${GM_URL}/submit-sra-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: TEST_ROOM_ID, playerAddress: PLAYER_ADDRESS,
      sraKey: TEST_SRA_KEY, signature: sig,
      signerAddress: PLAYER_ADDRESS, nonce, timestamp,
    }),
  });
  if (r.status !== 200) {
    const j = await r.json().catch(() => ({}));
    throw new Error(`HTTP ${r.status}: ${j.error ?? '?'}`);
  }
});

await test('modern sig rejected if timestamp expired (>5min ago)', async () => {
  const nonce = crypto.randomUUID();
  const expiredTs = Math.floor(Date.now() / 1000) - 400; // 400s ago
  const message = `submit-key:${TEST_ROOM_ID}:${TEST_SRA_KEY}:${nonce}:${expiredTs}`;
  const sig = await sign(message);
  const r = await fetch(`${GM_URL}/submit-sra-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: TEST_ROOM_ID, playerAddress: PLAYER_ADDRESS,
      sraKey: TEST_SRA_KEY, signature: sig,
      signerAddress: PLAYER_ADDRESS, nonce, timestamp: expiredTs,
    }),
  });
  // GM should reject expired timestamp (401)
  if (r.status === 200) throw new Error('Expired timestamp was accepted!');
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n─── Result: ${passed} passed, ${failed} failed ───\n`);
if (failed > 0) process.exit(1);
