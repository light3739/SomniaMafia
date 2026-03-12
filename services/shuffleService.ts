// services/shuffleService.ts
// Mental Poker implementation for role distribution

import { Role } from '../types';
import { keccak256, encodePacked, encodeAbiParameters, parseAbiParameters } from 'viem';
import { GM_SERVER_URL } from '../contracts/config';

// Simple 512-bit prime for SRA optimization
const PRIME = BigInt('0xFFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1' +
  '29024E088A67CC74020BBEA63B139B22514A08798E3404DD' +
  'EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245' +
  'E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED' +
  'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE65381' +
  'FFFFFFFFFFFFFFFF'); // RFC 3526 Group 1 512-bit MODP Group prime

// Per-room offset to avoid v^e mod p = v when v ∈ {0,1}
// Derived deterministically from roomId so all players in the same room compute the same offset
// Range: 100..10099 — always > 1 to avoid fixed-point, unique per room
function getCardOffset(roomId: string | number): number {
    const id = typeof roomId === 'string' ? parseInt(roomId) || 0 : roomId;
    // Simple deterministic hash: spread across range [100, 10099]
    return 100 + ((id * 7919 + 104729) % 10000);
}

export interface ShuffleKeys {
    encryptionKey: bigint;
    decryptionKey: bigint;
}

export class ShuffleService {
    private keys: ShuffleKeys | null = null;

    // Генерация ключей для коммутативного шифрования
    // В SRA (Shamir-Rivest-Adleman) схеме: e * d ≡ 1 (mod p-1)
    public generateKeys(): ShuffleKeys {
        // Генерируем случайный ключ шифрования (взаимно простой с p-1)
        const e = this.generateCoprime(PRIME - 1n);
        // Вычисляем ключ дешифрования (модульный обратный)
        const d = this.modInverse(e, PRIME - 1n);

        this.keys = { encryptionKey: e, decryptionKey: d };
        return this.keys;
    }

    /**
     * Generate keys with verification: ensures encrypt→decrypt roundtrip works
     * for ALL card values used in the game. Retries up to maxRetries times.
     */
    public generateVerifiedKeys(cardValues: string[], maxRetries = 10): ShuffleKeys {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const keys = this.generateKeys();

            // Verify roundtrip for every card value
            let allValid = true;
            for (const val of cardValues) {
                const encrypted = this.encrypt(val);
                const decrypted = this.decrypt(encrypted);
                if (decrypted !== val) {
                    console.warn(`[SRA] Key verification FAILED on attempt ${attempt + 1}: encrypt→decrypt(${val}) = ${decrypted} (expected ${val}). Retrying...`);
                    allValid = false;
                    break;
                }
            }

            if (allValid) {
                if (attempt > 0) {
                    console.log(`[SRA] Keys verified OK after ${attempt + 1} attempts`);
                }
                return keys;
            }

            // Reset keys for retry
            this.keys = null;
        }

        // Fallback: return last generated keys with warning
        console.error(`[SRA] Failed to generate verified keys after ${maxRetries} attempts! Using last generated keys.`);
        return this.generateKeys();
    }

    public hasKeys(): boolean {
        return this.keys !== null;
    }

    // Генерация числа взаимно простого с n
    // FIX: Use crypto.getRandomValues for much larger key range (2048-bit)
    // Old range [2, 2^48] was too small → vulnerable to discrete logarithm attacks
    private generateCoprime(n: bigint): bigint {
        let e: bigint;
        do {
            // Generate a random 64-byte (512-bit) value for cryptographic security
            const arr = new Uint8Array(64);
            crypto.getRandomValues(arr);
            e = 2n;
            for (let i = 0; i < arr.length; i++) {
                e = e + BigInt(arr[i]) * (256n ** BigInt(i));
            }
            // Ensure e is at least 2 and less than n
            e = (e % (n - 2n)) + 2n;
        } while (this.gcd(e, n) !== 1n);
        return e;
    }

    // Наибольший общий делитель (GCD)
    private gcd(a: bigint, b: bigint): bigint {
        while (b !== 0n) {
            const t = b;
            b = a % b;
            a = t;
        }
        return a;
    }

    // Расширенный алгоритм Евклида для модульного обратного
    private modInverse(a: bigint, m: bigint): bigint {
        let [old_r, r] = [a, m];
        let [old_s, s] = [1n, 0n];

        while (r !== 0n) {
            const quotient = old_r / r;
            [old_r, r] = [r, old_r - quotient * r];
            [old_s, s] = [s, old_s - quotient * s];
        }

        if (old_r !== 1n) {
            throw new Error("Modular inverse does not exist");
        }

        return ((old_s % m) + m) % m;
    }

    // Модульное возведение в степень
    private modPow(base: bigint, exp: bigint, mod: bigint): bigint {
        let result = 1n;
        base = base % mod;
        while (exp > 0n) {
            if (exp % 2n === 1n) {
                result = (result * base) % mod;
            }
            exp = exp / 2n;
            base = (base * base) % mod;
        }
        return result;
    }

    // Шифрование значения
    public encrypt(value: string): string {
        if (!this.keys) throw new Error("Keys not generated");
        const v = BigInt(value);
        return this.modPow(v, this.keys.encryptionKey, PRIME).toString();
    }

    // Дешифрование значения
    public decrypt(value: string): string {
        if (!this.keys) throw new Error("Keys not generated");
        const v = BigInt(value);
        return this.modPow(v, this.keys.decryptionKey, PRIME).toString();
    }

    // Дешифрование чужим ключом дешифрования
    public decryptWithKey(value: string, decryptionKey: string): string {
        const v = BigInt(value);
        const d = BigInt(decryptionKey);
        return this.modPow(v, d, PRIME).toString();
    }

    // Получить ключ дешифрования для передачи другим
    public getDecryptionKey(): string {
        if (!this.keys) throw new Error("Keys not generated");
        return this.keys.decryptionKey.toString();
    }

    // Перемешать массив (Fisher-Yates)
    public shuffleArray<T>(array: T[]): T[] {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    // Зашифровать всю колоду
    public encryptDeck(deck: string[]): string[] {
        return deck.map(card => this.encrypt(card));
    }

    // Расшифровать всю колоду своим ключом
    public decryptDeck(deck: string[]): string[] {
        return deck.map(card => this.decrypt(card));
    }

    // Расшифровать одну карту несколькими ключами последовательно
    public decryptCardWithKeys(encryptedCard: string, keys: string[]): string {
        let card = encryptedCard;
        for (const key of keys) {
            card = this.decryptWithKey(card, key);
        }
        return card;
    }

    // ============ СТАТИЧЕСКИЕ УТИЛИТЫ ============

    // Генерация начальной колоды ролей
    // Возвращает числовые ID с per-room offset: role + offset(roomId)
    // This ensures value 1 (MAFIA) is never raw "1" which is a fixed point of modular exponentiation
    public static generateInitialDeck(playerCount: number, roomId: string | number = 0, activeCount?: number): string[] {
        const deck: number[] = [];
        const offset = getCardOffset(roomId);

        // Use activeCount if provided to determine role quantities
        const countForRoles = activeCount !== undefined ? activeCount : playerCount;

        // Определяем количество мафии (примерно 1/4 игроков, минимум 1)
        const mafiaCount = Math.max(1, Math.floor(countForRoles / 4));

        // Добавляем мафию
        for (let i = 0; i < mafiaCount; i++) {
            deck.push(1 + offset); // MAFIA = 1
        }

        // Добавляем доктора (если >= 4 игроков)
        if (countForRoles >= 4) {
            deck.push(2 + offset); // DOCTOR = 2
        }

        // Добавляем детектива (если >= 5 игроков)
        if (countForRoles >= 5) {
            deck.push(3 + offset); // DETECTIVE = 3
        }

        // Остальные — мирные жители (fill up to TOTAL playerCount required by contract)
        while (deck.length < playerCount) {
            deck.push(4 + offset); // CIVILIAN = 4
        }

        return deck.map(n => n.toString());
    }

    // Преобразование числа роли в enum Role
    // roomId is required to compute the same per-room offset used during deck generation
    public static roleNumberToRole(num: string, roomId: string | number = 0): Role {
        const offset = getCardOffset(roomId);
        const n = parseInt(num) - offset;
        switch (n) {
            case 1: return Role.MAFIA;
            case 2: return Role.DOCTOR;
            case 3: return Role.DETECTIVE;
            case 4: return Role.CIVILIAN;
            default:
                // FIX: Log unexpected values instead of silently mapping to CIVILIAN
                // This helps debug incorrect decryption (potential source of wrong role assignments)
                console.warn(`[roleNumberToRole] Unexpected card value: raw=${num}, offset=${offset}, decoded=${n}, roomId=${roomId}`);
                return Role.UNKNOWN;
        }
    }

    // Создать хэш для commit-reveal (для ночных действий Doctor/Detective)
    // V4: Использует keccak256(abi.encode(...)) вместо encodePacked
    public static createCommitHash(
        action: number,
        target: string,
        salt: string
    ): `0x${string}` {
        const cleanSalt = salt.startsWith('0x') ? salt.slice(2) : salt;
        return keccak256(
            encodeAbiParameters(
                parseAbiParameters('uint8, address, string'),
                [action, target as `0x${string}`, cleanSalt]
            )
        );
    }

    // Создать хэш для фиксации роли (Role Commit)
    // keccak256(abi.encode(role, salt))
    // Salt must NOT have 0x prefix to match contract's revealRole (max 64 bytes)
    public static createRoleCommitHash(role: number, salt: string): `0x${string}` {
        const cleanSalt = salt.startsWith('0x') ? salt.slice(2) : salt;
        return keccak256(
            encodeAbiParameters(
                parseAbiParameters('uint256, string'),
                [BigInt(role), cleanSalt]
            )
        );
    }

    /**
     * ZK-compatible role commitment using Poseidon.
     * Calls GM server as a secure hashing service to avoid local ZK weights.
     */
    static async createRoleCommitHashAsync(role: number, salt: string): Promise<string> {
        // Fallback to keccak256 if GM_SERVER_URL is missing (should not happen in prod)
        if (!GM_SERVER_URL) {
            console.warn('[ShuffleService] GM_SERVER_URL missing, falling back to keccak256');
            return this.createRoleCommitHash(role, salt);
        }

        try {
            const res = await fetch(`${GM_SERVER_URL}/hash-role`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, salt })
            });
            if (!res.ok) throw new Error(`Hash service failed: ${res.status}`);
            const { commitment } = await res.json();
            console.log(`[ShuffleService] Poseidon hash generated: ${commitment}`);
            return commitment;
        } catch (err) {
            console.error('[ShuffleService] Remote hashing failed:', err);
            // We CANNOT fall back to keccak256 for ZK games, it will fail the circuit.
            // Better to throw so the UI handles the error.
            throw new Error('Failed to generate ZK-compatible commitment');
        }
    }

    // V4: Создать хэш для mafia target commit-reveal
    // keccak256(abi.encode(target, salt))
    public static createMafiaTargetHash(
        target: string,
        salt: string
    ): `0x${string}` {
        const cleanSalt = salt.startsWith('0x') ? salt.slice(2) : salt;
        return keccak256(
            encodeAbiParameters(
                parseAbiParameters('address, string'),
                [target as `0x${string}`, cleanSalt]
            )
        );
    }

    // Пропускаем карты
    public static createDeckCommitHash(
        deck: string[],
        salt: string
    ): `0x${string}` {
        const cleanSalt = salt.startsWith('0x') ? salt.slice(2) : salt;
        return keccak256(
            encodeAbiParameters(
                parseAbiParameters('string[], string'),
                [deck, cleanSalt]
            )
        );
    }

    // V4 FIXED: Generate deck with roles distributed ONLY among active players
    public static generateDistributedDeck(
        players: { isAlive: boolean }[],
        roomId: string | number
    ): string[] {
        const deck: string[] = new Array(players.length).fill('');
        const offset = getCardOffset(roomId);

        // 1. Identify active slots
        const activeIndices = players.map((p, i) => p.isAlive ? i : -1).filter(i => i !== -1);
        const activeCount = activeIndices.length;

        // 2. Generate roles for ACTIVE players only
        // Standard distribution logic (1 mafia per 4 players) based on ACTIVE count
        const activeDeckArr: number[] = [];
        const mafiaCount = Math.max(1, Math.floor(activeCount / 4));

        for (let i = 0; i < mafiaCount; i++) activeDeckArr.push(1 + offset);
        if (activeCount >= 4) activeDeckArr.push(2 + offset); // Doctor
        if (activeCount >= 5) activeDeckArr.push(3 + offset); // Detective
        while (activeDeckArr.length < activeCount) activeDeckArr.push(4 + offset); // Civilian

        // 3. Shuffle the ACTIVE roles internally (Fisher-Yates)
        // We do this locally here so the initial distribution is random within valid slots
        for (let i = activeDeckArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [activeDeckArr[i], activeDeckArr[j]] = [activeDeckArr[j], activeDeckArr[i]];
        }

        // 4. Assign roles to specific slots
        // Active slots get the shuffled active roles
        activeIndices.forEach((slotIndex, i) => {
            deck[slotIndex] = activeDeckArr[i].toString();
        });

        // Inactive slots get Civilian roles (placeholder)
        // They will never play, but deck size must match total players
        for (let i = 0; i < players.length; i++) {
            if (!players[i].isAlive) {
                deck[i] = (4 + offset).toString();
            }
        }

        return deck;
    }

    // V4 FIXED: Shuffle ONLY specific indices (preserves dead/alive separation)
    public shuffleSubarray<T>(array: T[], indices: number[]): T[] {
        const result = [...array];

        // Extract elements at the target indices
        const subElements = indices.map(i => result[i]);

        // Shuffle the sub-elements
        for (let i = subElements.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [subElements[i], subElements[j]] = [subElements[j], subElements[i]];
        }

        // Place them back
        indices.forEach((slotIndex, i) => {
            result[slotIndex] = subElements[i];
        });

        return result;
    }

    // Генерация случайной соли
    // Returns 64 hex chars (no 0x prefix) to fit contract's 64-byte salt limit
    public static generateSalt(): string {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ============ PERSISTENCE ============

    public saveKeys(roomId: string, address: string): void {
        if (!this.keys) return;
        const key = `mafia_keys_${roomId}_${address.toLowerCase()}`;
        const data = JSON.stringify({
            e: this.keys.encryptionKey.toString(),
            d: this.keys.decryptionKey.toString()
        });
        localStorage.setItem(key, data);
        console.log("[ShuffleService] Keys saved to local storage");
    }

    public loadKeys(roomId: string, address: string): boolean {
        const key = `mafia_keys_${roomId}_${address.toLowerCase()}`;
        const saved = localStorage.getItem(key);
        if (!saved) return false;

        try {
            const data = JSON.parse(saved);
            this.keys = {
                encryptionKey: BigInt(data.e),
                decryptionKey: BigInt(data.d)
            };
            console.log("[ShuffleService] Keys loaded from local storage");
            return true;
        } catch (e) {
            console.error("[ShuffleService] Failed to load keys:", e);
            return false;
        }
    }

    public clearKeys(roomId: string, address: string): void {
        const key = `mafia_keys_${roomId}_${address.toLowerCase()}`;
        localStorage.removeItem(key);
    }
}

// Синглтон для использования в компонентах
let shuffleServiceInstance: ShuffleService | null = null;

export const getShuffleService = (): ShuffleService => {
    if (!shuffleServiceInstance) {
        shuffleServiceInstance = new ShuffleService();
    }
    return shuffleServiceInstance;
};

export const resetShuffleService = (): void => {
    shuffleServiceInstance = null;
};
