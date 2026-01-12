// services/mentalPokerService.ts

// Простое поле Галуа для учебного Mental Poker (в продакшене нужны большие простые числа)
// Используем BigInt для работы с большими числами
const PRIME = 2147483647n; // Мерсенн 2^31 - 1 (для примера, чтобы работало быстро)

export class MentalPokerService {
    private key: bigint; // Мой секретный ключ

    constructor() {
        // Генерируем случайный секретный ключ
        this.key = BigInt(Math.floor(Math.random() * 1000000)) + 1n;
    }

    // Функция возведения в степень по модулю (Modular Exponentiation)
    // base^exp % mod
    private modPow(base: bigint, exp: bigint, mod: bigint): bigint {
        let res = 1n;
        base = base % mod;
        while (exp > 0n) {
            if (exp % 2n === 1n) res = (res * base) % mod;
            exp = exp / 2n;
            base = (base * base) % mod;
        }
        return res;
    }

    // Шифрование карты: (Card ^ Key) % Prime
    public encryptCard(cardValue: number): string {
        const val = BigInt(cardValue);
        return this.modPow(val, this.key, PRIME).toString();
    }

    // Шифрование уже зашифрованной карты (Commutative)
    public encryptEncrypted(encryptedValue: string): string {
        const val = BigInt(encryptedValue);
        return this.modPow(val, this.key, PRIME).toString();
    }

    // Расшифровка (требует вычисления обратного ключа - Modular Inverse)
    // В реальном SRA тут сложнее, но для игры мы будем делать схему "Раскрытие ключей"
    // Мы просто отдадим свой ключ в конце раздачи
    public getKey(): string {
        return this.key.toString();
    }

    // Расшифровка карты чужим ключом (зная P-1)
    // Для упрощения мы будем использовать XOR-шифрование или просто передачу ключей
    // Но давайте сделаем симуляцию для MVP:

    // ГЕНЕРАЦИЯ КОЛОДЫ (только Хост)
    // 1 = Мафия, 2 = Доктор, 3 = Детектив, 4+ = Мирные
    public static generateDeck(playerCount: number): number[] {
        const deck = [1, 2, 3]; // Спецроли
        for (let i = 3; i < playerCount; i++) {
            deck.push(4 + i); // Уникальные ID мирных жителей
        }
        // Перемешиваем (Фишер-Йетс)
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }
}