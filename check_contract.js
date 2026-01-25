"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const viem_1 = require("viem");
const config_1 = require("./contracts/config");
async function main() {
    const client = (0, viem_1.createPublicClient)({
        chain: config_1.somniaChain,
        transport: (0, viem_1.http)()
    });
    console.log("Checking contract state...");
    console.log("Address:", config_1.MAFIA_CONTRACT_ADDRESS);
    try {
        const paused = await client.readContract({
            address: config_1.MAFIA_CONTRACT_ADDRESS,
            abi: config_1.MAFIA_ABI,
            functionName: 'paused',
        });
        console.log("Paused:", paused);
    }
    catch (e) {
        console.error("Failed to check paused:", e.message);
    }
    try {
        const nextId = await client.readContract({
            address: config_1.MAFIA_CONTRACT_ADDRESS,
            abi: config_1.MAFIA_ABI,
            functionName: 'nextRoomId',
        });
        console.log("Next Room ID:", nextId?.toString());
    }
    catch (e) {
        console.error("Failed to check nextRoomId:", e.message);
    }
}
main();
