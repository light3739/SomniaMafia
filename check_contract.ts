
import { createPublicClient, http } from 'viem';
import { somniaChain, MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from './contracts/config';

const USER_ADDRESS = '0x0e0442Bda5bF288669a63f5a0687AF5309A8ac19';

async function main() {
    const client = createPublicClient({
        chain: somniaChain,
        transport: http()
    });

    console.log("=== ДИАГНОСТИКА ДЛЯ", USER_ADDRESS, "===\n");

    // 1. Проверяем сессию пользователя
    try {
        const session = await client.readContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI as any,
            functionName: 'sessionKeys',
            args: [USER_ADDRESS]
        }) as any;

        console.log("1. СЕССИЯ ПОЛЬЗОВАТЕЛЯ:");
        console.log("   Session Address:", session[0]);
        console.log("   Expires At:", session[1]);
        console.log("   Room ID:", session[2]?.toString());
        console.log("   Is Active:", session[3]);

        if (session[3] === true) {
            console.log("   ⚠️  АКТИВНАЯ СЕССИЯ СУЩЕСТВУЕТ!");
            console.log("   Это может быть причиной SessionAlreadyRegistered\n");
        }
    } catch (e: any) {
        console.error("   Ошибка чтения сессии:", e.message);
    }

    // 2. Проверяем все комнаты на участие пользователя
    console.log("\n2. ПРОВЕРКА УЧАСТИЯ В КОМНАТАХ:");

    const nextId = await client.readContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI as any,
        functionName: 'nextRoomId',
    }) as bigint;

    for (let roomId = 1n; roomId < nextId; roomId++) {
        try {
            const room = await client.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MAFIA_ABI as any,
                functionName: 'rooms',
                args: [roomId]
            }) as any;

            const playersCount = Number(room[5]);
            const roomName = room[2];
            const host = room[1];

            // Проверяем каждого игрока
            for (let i = 0; i < playersCount; i++) {
                const player = await client.readContract({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MAFIA_ABI as any,
                    functionName: 'roomPlayers',
                    args: [roomId, BigInt(i)]
                }) as any;

                if (player[0].toLowerCase() === USER_ADDRESS.toLowerCase()) {
                    console.log(`   ⚠️  НАЙДЕН В КОМНАТЕ ${roomId}!`);
                    console.log(`      Имя комнаты: ${roomName}`);
                    console.log(`      Хост: ${host}`);
                    console.log(`      Это может быть причиной AlreadyJoined\n`);
                }
            }
        } catch (e: any) {
            // Игнорируем ошибки чтения
        }
    }

    console.log("\n3. ПРОВЕРКА ТРЕБОВАНИЙ КОНТРАКТА:");

    // Проверяем константы контракта
    try {
        const sessionDuration = await client.readContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI as any,
            functionName: 'SESSION_DURATION',
        });
        console.log("   SESSION_DURATION:", sessionDuration);
    } catch (e) { }

    try {
        const maxArray = await client.readContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI as any,
            functionName: 'MAX_ARRAY_SIZE',
        });
        console.log("   MAX_ARRAY_SIZE:", maxArray);
    } catch (e) { }

    console.log("\n=== ДИАГНОСТИКА ЗАВЕРШЕНА ===");
}

main();
