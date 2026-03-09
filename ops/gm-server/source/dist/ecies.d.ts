export interface EciesEncrypted {
    /** 65-byte uncompressed GM ephemeral pubkey (hex) */
    ephemeralPubkey: string;
    /** 12-byte AES-GCM IV (hex) */
    iv: string;
    /** Ciphertext + 16-byte AES-GCM auth tag concatenated (hex) */
    ciphertext: string;
}
/**
 * Encrypt `message` for the player identified by `playerPubkeyHex`.
 * Only the matching private key (held by the player) can decrypt.
 *
 * @param playerPubkeyHex - 65-byte uncompressed P-256 point, hex string.
 * @param message         - Plaintext to encrypt (e.g. "MAFIA", "CIVILIAN").
 */
export declare function eciesEncrypt(playerPubkeyHex: string, message: string): EciesEncrypted;
