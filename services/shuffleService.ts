// services/shuffleService.ts
// Mental Poker implementation for role distribution

import { Role } from '../types';
import { keccak256, encodePacked, encodeAbiParameters, parseAbiParameters } from 'viem';

// Простое число для модульной арифметики (в продакшене использовать большие простые)
const PRIME = 2147483647n; // Mersenne prime 2^31 - 1

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

    // Генерация числа взаимно простого с n
    private generateCoprime(n: bigint): bigint {
        let e: bigint;
        do {
            e = BigInt(Math.floor(Math.random() * 1000000) + 2);
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
    // Возвращает числовые ID: 1=MAFIA, 2=DOCTOR, 3=DETECTIVE, 4+=CIVILIAN
    public static generateInitialDeck(playerCount: number): string[] {
        const deck: number[] = [];

        // Определяем количество мафии (примерно 1/4 игроков, минимум 1)
        const mafiaCount = Math.max(1, Math.floor(playerCount / 4));

        // Добавляем мафию
        for (let i = 0; i < mafiaCount; i++) {
            deck.push(1); // MAFIA = 1
        }

        // Добавляем доктора (если >= 4 игроков)
        if (playerCount >= 4) {
            deck.push(2); // DOCTOR = 2
        }

        // Добавляем детектива (если >= 5 игроков)
        if (playerCount >= 5) {
            deck.push(3); // DETECTIVE = 3
        }

        // Остальные — мирные жители
        while (deck.length < playerCount) {
            deck.push(4); // CIVILIAN = 4
        }

        return deck.map(n => n.toString());
    }

    // Преобразование числа роли в enum Role
    public static roleNumberToRole(num: string): Role {
        const n = parseInt(num);
        switch (n) {
            case 1: return Role.MAFIA;
            case 2: return Role.DOCTOR;
            case 3: return Role.DETECTIVE;
            case 4:
            default: return Role.CIVILIAN;
        }
    }

    // Создать хэш для commit-reveal (для ночных действий Doctor/Detective)
    // V4: Использует keccak256(abi.encode(...)) вместо encodePacked
    public static createCommitHash(
        action: number,
        target: string,
        salt: string
    ): `0x${string}` {
        return keccak256(
            encodeAbiParameters(
                parseAbiParameters('uint8, address, string'),
                [action, target as `0x${string}`, salt]
            )
        );
    }

    // Создать хэш для фиксации роли (Role Commit)
    // keccak256(abi.encode(role, salt))
    public static createRoleCommitHash(role: number, salt: string): `0x${string}` {
        return keccak256(
            encodeAbiParameters(
                parseAbiParameters('uint8, string'),
                [role, salt]
            )
        );
    }

    // V4: Создать хэш для mafia target commit-reveal
    // keccak256(abi.encode(target, salt))
    public static createMafiaTargetHash(
        target: string,
        salt: string
    ): `0x${string}` {
        return keccak256(
            encodeAbiParameters(
                parseAbiParameters('address, string'),
                [target as `0x${string}`, salt]
            )
        );
    }

    // Создать хэш для deck commit-reveal (V4)
    public static createDeckCommitHash(
        deck: string[],
        salt: string
    ): `0x${string}` {
        return keccak256(
            encodeAbiParameters(
                parseAbiParameters('string[], string'),
                [deck, salt]
            )
        );
    }

    // Генерация случайной соли
    public static generateSalt(): `0x${string}` {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return `0x${Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')}`;
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
