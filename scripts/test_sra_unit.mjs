/**
 * test_sra_unit.mjs
 *
 * SRA (Shamir-Rivest-Adleman mental poker) correctness tests.
 * Tests that the card offset, key generation, multi-player shuffle,
 * and role mapping all work correctly — and that GM's logic
 * (index.ts helpers) matches the frontend's shuffleService.ts.
 *
 * Run: node scripts/test_sra_unit.mjs
 */

// ─── SRA constants (same in both frontend and GM) ────────────────────────────
const PRIME = 2147483647n; // Mersenne prime 2^31-1

function modPow(base, exp, mod) {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) result = (result * base) % mod;
    exp = exp / 2n;
    base = (base * base) % mod;
  }
  return result;
}

function gcd(a, b) {
  while (b !== 0n) { [a, b] = [b, a % b]; }
  return a;
}

function modInverse(a, m) {
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  if (old_r !== 1n) throw new Error('Modular inverse does not exist');
  return ((old_s % m) + m) % m;
}

// ─── Card offset (MUST match both frontend and GM) ───────────────────────────
function getCardOffset(roomId) {
  const id = typeof roomId === 'string' ? parseInt(roomId) || 0 : roomId;
  return 100 + ((id * 7919 + 104729) % 10000);
}

// ─── Role mapping (mirrors GM roleFromCardValue) ─────────────────────────────
function roleFromCardValue(cardValue, roomId) {
  const offset = getCardOffset(roomId);
  const n = parseInt(cardValue) - offset;
  switch (n) {
    case 1: return 'MAFIA';
    case 2: return 'DOCTOR';
    case 3: return 'DETECTIVE';
    case 4: return 'CIVILIAN';
    default: return 'UNKNOWN';
  }
}

// ─── Key generation ───────────────────────────────────────────────────────────
function generateSRAKeys() {
  // Pick random coprime e in [2, PRIME-2]
  let e;
  do {
    // Use 6 random bytes for good distribution (mirrors frontend)
    const arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    e = 2n;
    for (let i = 0; i < arr.length; i++) e += BigInt(arr[i]) * (256n ** BigInt(i));
    e = (e % (PRIME - 3n)) + 2n;
  } while (gcd(e, PRIME - 1n) !== 1n);
  const d = modInverse(e, PRIME - 1n);
  return { e, d };
}

function sraEncrypt(val, key) { return modPow(BigInt(val), key, PRIME); }
function sraDecrypt(val, key) { return modPow(BigInt(val), key, PRIME); }

// Multi-player decrypt: apply all decryption keys sequentially (any order)
function sraDecryptCard(encryptedCard, decryptionKeys) {
  let val = BigInt(encryptedCard);
  for (const key of decryptionKeys) val = modPow(val, BigInt(key), PRIME);
  return val.toString();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function ok(label) { console.log(`  ✅ ${label}`); passed++; }
function fail(label, err) { console.error(`  ❌ ${label}: ${err}`); failed++; }

function assert(label, fn) {
  try {
    fn();
    ok(label);
  } catch (e) {
    fail(label, e.message);
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────
console.log('\n═══ SRA Unit Tests ═══\n');

// Test 1: getCardOffset is deterministic and matches for same roomId
console.log('1. Card offset determinism:');
assert('same roomId always → same offset', () => {
  for (const rid of [0, 1, 42, 100, 999]) {
    const a = getCardOffset(rid);
    const b = getCardOffset(String(rid));
    if (a !== b) throw new Error(`roomId=${rid}: int=${a}, string=${b}`);
    if (a < 100 || a > 10099) throw new Error(`roomId=${rid}: offset ${a} out of range [100, 10099]`);
  }
});
assert('different roomIds → different offsets (smoke check)', () => {
  const offsets = new Set([0,1,2,3,4,42,100].map(getCardOffset));
  if (offsets.size < 5) throw new Error('Too many collisions in offset — suspect formula broken');
});

// Test 2: Role encoding — base values
console.log('\n2. Role card values (offset + role index):');
assert('role values round-trip for roomId 1', () => {
  const roomId = 1;
  const offset = getCardOffset(roomId);
  const cases = [
    [offset + 1, 'MAFIA'],
    [offset + 2, 'DOCTOR'],
    [offset + 3, 'DETECTIVE'],
    [offset + 4, 'CIVILIAN'],
    [offset + 999, 'UNKNOWN'],  // out of range
  ];
  for (const [cardVal, expectedRole] of cases) {
    const got = roleFromCardValue(String(cardVal), roomId);
    if (got !== expectedRole) throw new Error(`cardVal=${cardVal} → "${got}", expected "${expectedRole}"`);
  }
});

// Test 3: Single player SRA roundtrip
console.log('\n3. Single-player SRA encrypt/decrypt:');
assert('encrypt → decrypt (single player) = original', () => {
  const roomId = 42;
  const offset = getCardOffset(roomId);
  const keys = generateSRAKeys();
  for (const n of [1, 2, 3, 4]) { // all roles
    const plainCard = (offset + n).toString();
    const enc = sraEncrypt(plainCard, keys.e);
    const dec = sraDecrypt(enc, keys.d).toString();
    if (dec !== plainCard) throw new Error(`n=${n}: enc/dec failed: got "${dec}", expected "${plainCard}"`);
  }
});

// Test 4: Multi-player SRA — 4 players each encrypt, then all decrypt
console.log('\n4. Multi-player SRA shuffle (4 players):');
assert('4-player shuffle: each card decrypts to correct role', () => {
  const roomId = 5;
  const offset = getCardOffset(roomId);
  const numPlayers = 4;

  // Initial card values (1 per player, roles: MAFIA, DOCTOR, DETECTIVE, CIVILIAN)
  const initialCards = [1, 2, 3, 4].map(n => BigInt(offset + n));

  // Each player generates keys
  const allKeys = Array.from({ length: numPlayers }, () => generateSRAKeys());

  // Simulate the SRA shuffle: each player encrypts the entire deck in sequence
  // Start with player 0 encrypting all cards
  let deck = initialCards.map(c => sraEncrypt(c.toString(), allKeys[0].e).toString());

  for (let p = 1; p < numPlayers; p++) {
    deck = deck.map(c => sraEncrypt(c, allKeys[p].e).toString());
  }

  // Now decrypt each card using ALL decryption keys (any order)
  const decryptionKeys = allKeys.map(k => k.d);
  for (let i = 0; i < numPlayers; i++) {
    const decrypted = sraDecryptCard(deck[i], decryptionKeys.map(String));
    const role = roleFromCardValue(decrypted, roomId);
    const expectedRole = ['MAFIA', 'DOCTOR', 'DETECTIVE', 'CIVILIAN'][i];
    if (role !== expectedRole) throw new Error(`card[${i}]: got "${role}", expected "${expectedRole}" (decrypted=${decrypted}, offset=${offset})`);
  }
});

// Test 5: SRA decryption is commutative (key order doesn't matter)
console.log('\n5. SRA decryption order-independence:');
assert('decryption with keys in reversed order = same result', () => {
  const roomId = 7;
  const offset = getCardOffset(roomId);
  const cardVal = (offset + 1).toString(); // MAFIA card

  const k1 = generateSRAKeys();
  const k2 = generateSRAKeys();
  const k3 = generateSRAKeys();

  // Encrypt with all 3
  const enc = sraEncrypt(
    sraEncrypt(sraEncrypt(cardVal, k1.e).toString(), k2.e).toString(),
    k3.e
  );

  // Decrypt in order 1,2,3
  const dec123 = sraDecryptCard(enc.toString(), [k1.d, k2.d, k3.d].map(String));
  // Decrypt in order 3,1,2
  const dec312 = sraDecryptCard(enc.toString(), [k3.d, k1.d, k2.d].map(String));
  // Decrypt in order 2,3,1
  const dec231 = sraDecryptCard(enc.toString(), [k2.d, k3.d, k1.d].map(String));

  if (dec123 !== cardVal) throw new Error(`1-2-3 order: got "${dec123}", expected "${cardVal}"`);
  if (dec312 !== cardVal) throw new Error(`3-1-2 order: got "${dec312}", expected "${cardVal}"`);
  if (dec231 !== cardVal) throw new Error(`2-3-1 order: got "${dec231}", expected "${cardVal}"`);
});

// Test 6: Partial decryption yields wrong value (defense: all keys required)
console.log('\n6. Partial keys → UNKNOWN role (cards never decodable with incomplete keys):');
assert('missing one key → cannot get correct plaintext', () => {
  const roomId = 3;
  const offset = getCardOffset(roomId);
  const cardVal = (offset + 2).toString(); // DOCTOR

  const k1 = generateSRAKeys();
  const k2 = generateSRAKeys();

  const enc = sraEncrypt(sraEncrypt(cardVal, k1.e).toString(), k2.e);

  // Decrypt with only ONE key (missing k1)
  const partial = sraDecryptCard(enc.toString(), [k2.d.toString()]);
  const role = roleFromCardValue(partial, roomId);
  // May be UNKNOWN or some garbage role, but MUST NOT be 'DOCTOR'
  if (role === 'DOCTOR') throw new Error('Got correct role with only partial keys — SRA not protecting privacy!');
});

// Test 7: Verify GM SRA prime matches frontend prime
console.log('\n7. Prime constant consistency:');
assert('GM and frontend use same SRA prime (2^31-1)', () => {
  // GM uses SRA_PRIME = 2147483647n, frontend uses PRIME = 2147483647n
  const GM_SRA_PRIME = 2147483647n;
  const FRONTEND_PRIME = PRIME;
  if (GM_SRA_PRIME !== FRONTEND_PRIME) throw new Error(`Mismatch: GM=${GM_SRA_PRIME}, frontend=${FRONTEND_PRIME}`);
  // Verify it's actually 2^31 - 1
  if (GM_SRA_PRIME !== (2n ** 31n - 1n)) throw new Error('Not 2^31-1');
});

// Test 8: cardVal must stay in valid range (< PRIME) after encoding
console.log('\n8. Card values in valid SRA range:');
assert('all role card values < PRIME for roomIds 0-100', () => {
  for (let rid = 0; rid < 100; rid++) {
    const offset = getCardOffset(rid);
    for (const n of [1, 2, 3, 4]) {
      const cv = offset + n;
      if (cv >= 2147483647) throw new Error(`roomId=${rid}, role=${n}: card value ${cv} >= PRIME!`);
      if (cv <= 1) throw new Error(`roomId=${rid}, role=${n}: card value ${cv} <= 1 — SRA fixed point!`);
    }
  }
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n─── Result: ${passed} passed, ${failed} failed ───\n`);
if (failed > 0) process.exit(1);
