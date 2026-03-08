/**
 * test_ecies_unit.mjs
 *
 * ECIES encrypt/decrypt compatibility test.
 * GM encrypts with Node.js `crypto` — browser decrypts with `crypto.subtle`.
 * Both use: P-256 (prime256v1) + ECDH X-coord shared secret + AES-256-GCM.
 *
 * Run: node scripts/test_ecies_unit.mjs
 */
import { createECDH, createCipheriv, randomBytes } from 'node:crypto';
import { subtle } from 'node:crypto';

// ─── GM-side (mirrors ops/gm-server/source/src/ecies.ts) ─────────────────────
function gmEncrypt(playerPubkeyHex, message) {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const ephemeralPubkey = ecdh.getPublicKey('hex', 'uncompressed');
  const sharedSecret = ecdh.computeSecret(Buffer.from(playerPubkeyHex, 'hex'));
  const aesKey = sharedSecret.slice(0, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(message, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ephemeralPubkey,
    iv: iv.toString('hex'),
    ciphertext: Buffer.concat([encrypted, authTag]).toString('hex'),
  };
}

// ─── Browser-side (mirrors services/eciesService.ts) ─────────────────────────
function hexToBytes(hex) {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const arr = new Uint8Array(h.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return arr;
}

async function browserDecrypt(encrypted, privateKey) {
  const ephemeralPubkey = await subtle.importKey(
    'raw',
    hexToBytes(encrypted.ephemeralPubkey).buffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const sharedBits = await subtle.deriveBits(
    { name: 'ECDH', public: ephemeralPubkey },
    privateKey,
    256
  );
  const aesKey = await subtle.importKey('raw', sharedBits, { name: 'AES-GCM' }, false, ['decrypt']);
  const iv = hexToBytes(encrypted.iv).buffer;
  const ciphertext = hexToBytes(encrypted.ciphertext).buffer;
  const plaintext = await subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
  return new TextDecoder().decode(plaintext);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function ok(label) { console.log(`  ✅ ${label}`); passed++; }
function fail(label, err) { console.error(`  ❌ ${label}: ${err}`); failed++; }

async function assert(label, fn) {
  try {
    await fn();
    ok(label);
  } catch (e) {
    fail(label, e.message);
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────
console.log('\n═══ ECIES Unit Tests ═══\n');

// Test 1: Generate browser keypair, export pubkey, GM encrypts, browser decrypts
console.log('1. Basic roundtrip — all 5 roles:');
const roles = ['MAFIA', 'DOCTOR', 'DETECTIVE', 'CIVILIAN', 'UNKNOWN'];
for (const role of roles) {
  await assert(`  roundtrip: "${role}"`, async () => {
    // Browser generates keypair
    const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const pubRaw = await subtle.exportKey('raw', kp.publicKey);
    const pubHex = Buffer.from(pubRaw).toString('hex');

    // GM encrypts
    const enc = gmEncrypt(pubHex, role);

    // Browser decrypts
    const decrypted = await browserDecrypt(enc, kp.privateKey);

    if (decrypted !== role) throw new Error(`got "${decrypted}", expected "${role}"`);
  });
}

// Test 2: Two different players get different ciphertexts (different ephemeral keys each time)
console.log('\n2. Each encrypt produces unique ciphertext (ephemeral):');
await assert('same message encrypted twice → different ciphertexts', async () => {
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pubRaw = await subtle.exportKey('raw', kp.publicKey);
  const pubHex = Buffer.from(pubRaw).toString('hex');
  const enc1 = gmEncrypt(pubHex, 'MAFIA');
  const enc2 = gmEncrypt(pubHex, 'MAFIA');
  if (enc1.ciphertext === enc2.ciphertext) throw new Error('ciphertexts are identical — ephemeral key NOT random!');
  if (enc1.ephemeralPubkey === enc2.ephemeralPubkey) throw new Error('ephemeral pubkeys are identical — ephemeral key NOT random!');
});

// Test 3: Different player keys → can't cross-decrypt
console.log('\n3. Cross-player decryption impossible:');
await assert('player B cannot decrypt message encrypted for player A', async () => {
  const kpA = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const kpB = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pubA = Buffer.from(await subtle.exportKey('raw', kpA.publicKey)).toString('hex');
  const enc = gmEncrypt(pubA, 'MAFIA');
  try {
    await browserDecrypt(enc, kpB.privateKey);
    throw new Error('Decryption succeeded with wrong key!');
  } catch (e) {
    if (e.message === 'Decryption succeeded with wrong key!') throw e;
    // expected: AES-GCM auth tag mismatch → OperationError
  }
});

// Test 4: Tampered ciphertext → decrypt must fail (integrity protection)
console.log('\n4. Ciphertext integrity (GCM auth tag):');
await assert('tampered ciphertext throws', async () => {
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pubHex = Buffer.from(await subtle.exportKey('raw', kp.publicKey)).toString('hex');
  const enc = gmEncrypt(pubHex, 'MAFIA');
  // Flip a byte in the middle of the ciphertext
  const ct = enc.ciphertext;
  const mid = Math.floor(ct.length / 2);
  const flipped = ct.slice(0, mid) + (ct[mid] === 'f' ? '0' : 'f') + ct.slice(mid + 1);
  try {
    await browserDecrypt({ ...enc, ciphertext: flipped }, kp.privateKey);
    throw new Error('Tampered ciphertext was accepted!');
  } catch (e) {
    if (e.message === 'Tampered ciphertext was accepted!') throw e;
  }
});

// Test 5: Public key format validation (65 bytes, starts with 04)
console.log('\n5. Public key format:');
await assert('exported pubkey is 65 bytes uncompressed (starts with 04)', async () => {
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pubRaw = await subtle.exportKey('raw', kp.publicKey);
  const pubHex = Buffer.from(pubRaw).toString('hex');
  if (pubHex.length !== 130) throw new Error(`Expected 130 hex chars, got ${pubHex.length}`);
  if (!pubHex.startsWith('04')) throw new Error(`Expected uncompressed point (04 prefix), got ${pubHex.slice(0, 2)}`);
  // Also check GM validation regex
  const validFormat = /^04[0-9a-fA-F]{128}$/.test(pubHex);
  if (!validFormat) throw new Error('Fails GM pubkey regex validation');
});

// Test 6: Long message (e.g. role + mafia teammates JSON)
console.log('\n6. Longer payload (role + metadata JSON):');
await assert('encrypt/decrypt larger JSON payload', async () => {
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pubHex = Buffer.from(await subtle.exportKey('raw', kp.publicKey)).toString('hex');
  const payload = JSON.stringify({ role: 'MAFIA', teammates: ['0xABCD...', '0x1234...'], roomId: 42 });
  const enc = gmEncrypt(pubHex, payload);
  const dec = await browserDecrypt(enc, kp.privateKey);
  if (dec !== payload) throw new Error(`JSON mismatch`);
  const parsed = JSON.parse(dec);
  if (parsed.role !== 'MAFIA') throw new Error('Role mismatch in JSON');
  if (parsed.teammates.length !== 2) throw new Error('Teammates mismatch');
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n─── Result: ${passed} passed, ${failed} failed ───\n`);
if (failed > 0) process.exit(1);
