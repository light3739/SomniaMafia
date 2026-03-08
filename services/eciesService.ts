// services/eciesService.ts
// ECIES (Elliptic Curve Integrated Encryption Scheme)
// Curve: P-256 (secp256r1) | KDF: ECDH X-coord | Cipher: AES-256-GCM
//
// Purpose: GM encrypts each player's role with THEIR public key.
// Only the player who holds the matching private key can decrypt.
// Replaces the plaintext SRA key publication on-chain.

export interface EciesEncrypted {
  /** 65-byte uncompressed P-256 point (hex, no 0x prefix) — GM's ephemeral pubkey */
  ephemeralPubkey: string;
  /** 12-byte AES-GCM IV (hex) */
  iv: string;
  /** Ciphertext + 16-byte GCM auth tag concatenated (hex) */
  ciphertext: string;
}

const STORAGE_PREFIX = 'ecies_kp_';

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const arr = new Uint8Array(h.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return arr;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Load persisted keypair for this room+player, or generate + persist a new one.
 */
export async function loadOrCreateKeypair(
  roomId: string,
  address: string
): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  const stored = localStorage.getItem(`${STORAGE_PREFIX}${roomId}_${address.toLowerCase()}`);
  if (stored) {
    try {
      const { pub, priv } = JSON.parse(stored);
      const [publicKey, privateKey] = await Promise.all([
        crypto.subtle.importKey('jwk', pub, { name: 'ECDH', namedCurve: 'P-256' }, true, []),
        crypto.subtle.importKey('jwk', priv, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']),
      ]);
      return { publicKey, privateKey };
    } catch {
      // Corrupted entry — regenerate below
    }
  }
  return generateAndSaveKeypair(roomId, address);
}

async function generateAndSaveKeypair(
  roomId: string,
  address: string
): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  const keypair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const [pubJwk, privJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', keypair.publicKey),
    crypto.subtle.exportKey('jwk', keypair.privateKey),
  ]);
  localStorage.setItem(
    `${STORAGE_PREFIX}${roomId}_${address.toLowerCase()}`,
    JSON.stringify({ pub: pubJwk, priv: privJwk })
  );
  return keypair;
}

/**
 * Export public key as 65-byte uncompressed point hex string (no 0x prefix).
 * This is what gets sent to the GM server.
 */
export async function exportPublicKeyHex(publicKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', publicKey);
  return bytesToHex(new Uint8Array(raw));
}

/**
 * Decrypt an ECIES payload from the GM using our private key.
 * The GM used our public key as the recipient when encrypting.
 */
export async function eciesDecrypt(
  encrypted: EciesEncrypted,
  privateKey: CryptoKey
): Promise<string> {
  // 1. Reconstruct GM's ephemeral public key
  const ephemeralPubkeyBytes = hexToBytes(encrypted.ephemeralPubkey).buffer as ArrayBuffer;
  const ephemeralPubkey = await crypto.subtle.importKey(
    'raw',
    ephemeralPubkeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // 2. ECDH: shared secret = X coordinate of the shared point (32 bytes)
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: ephemeralPubkey },
    privateKey,
    256
  );

  // 3. Use shared secret directly as AES-256 key
  const aesKey = await crypto.subtle.importKey(
    'raw',
    sharedBits,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // 4. AES-256-GCM decrypt (ciphertext includes 16-byte authTag at the end)
  const iv = hexToBytes(encrypted.iv).buffer as ArrayBuffer;
  const ciphertext = hexToBytes(encrypted.ciphertext).buffer as ArrayBuffer;

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}
