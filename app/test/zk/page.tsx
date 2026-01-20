"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { generateEndGameProof } from '@/services/zkProof';
import { useWriteContract, usePublicClient } from 'wagmi';
import { MafiaABI } from '@/contracts/MafiaPortal';
import { MAFIA_CONTRACT_ADDRESS } from '@/contracts/config';
import { privateKeyToAccount } from 'viem/accounts';
import { formatEther, createWalletClient, http, defineChain } from 'viem';

const shannon = defineChain({
    id: 50312,
    name: 'Somnia Testnet',
    nativeCurrency: { name: 'Somnia Test Token', symbol: 'STT', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://dream-rpc.somnia.network'] },
    },
});

export default function ZKTestPage() {
    const [roomId, setRoomId] = useState("1");
    const [mafiaCount, setMafiaCount] = useState("0");
    const [townCount, setTownCount] = useState("4");
    const [status, setStatus] = useState("Idle");
    const [logs, setLogs] = useState<string[]>([]);
    const [bots, setBots] = useState<{ address: string, pk: string, balance: string }[]>([]);

    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    const addLog = (msg: string) => {
        setLogs(prev => [`> ${new Date().toLocaleTimeString()}: ${msg}`, ...prev]);
    };

    // Bot logic
    const generateBots = () => {
        const newBots = [];
        for (let i = 0; i < 3; i++) {
            // Very simple PK generation for testing only
            const pk = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
            const account = privateKeyToAccount(pk);
            newBots.push({ address: account.address, pk, balance: "0" });
        }
        setBots(newBots);
        addLog("3 Bot wallets generated! Send ~0.001 STT to each to allow them to join.");
    };

    const updateBotBalances = async () => {
        if (!publicClient) return;
        const updated = await Promise.all(bots.map(async (bot) => {
            const bal = await publicClient.getBalance({ address: bot.address as `0x${string}` });
            return { ...bot, balance: formatEther(bal) };
        }));
        setBots(updated);
        addLog("Bot balances updated.");
    };

    const botsJoinRoom = async () => {
        if (!roomId) return addLog("Enter Room ID first!");
        addLog(`Bots joining room #${roomId}...`);

        for (const bot of bots) {
            if (parseFloat(bot.balance) < 0.0001) {
                addLog(`Bot ${bot.address.slice(0, 6)} has NO GAS! Skip.`);
                continue;
            }

            try {
                const botClient = createWalletClient({
                    account: privateKeyToAccount(bot.pk as `0x${string}`),
                    chain: shannon,
                    transport: http()
                });

                const hash = await botClient.writeContract({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MafiaABI.abi,
                    functionName: 'joinRoom',
                    args: [BigInt(roomId), "BotPlayer", "0x00" as `0x${string}`, "0x0000000000000000000000000000000000000000" as `0x${string}`],
                    value: BigInt(0)
                });
                addLog(`Bot ${bot.address.slice(0, 6)} joined! TX: ${hash}`);
            } catch (e: any) {
                addLog(`Bot Join Error: ${e.message}`);
            }
        }
    };

    const performOnChainAction = async (type: 'create' | 'start') => {
        setStatus("Pending...");
        try {
            if (type === 'create') {
                const hash = await writeContractAsync({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MafiaABI.abi,
                    functionName: 'createAndJoin',
                    args: ["ZK-Test-Lobby", 4, "TestPlayer", "0x00" as `0x${string}`, "0x0000000000000000000000000000000000000000" as `0x${string}`],
                    value: BigInt(0)
                });
                addLog(`Lobby created! TX: ${hash}`);
                if (publicClient) {
                    await publicClient.waitForTransactionReceipt({ hash });
                    addLog("Room created. Scanning for your new ID...");
                }
            } else {
                const hash = await writeContractAsync({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MafiaABI.abi,
                    functionName: 'startGame',
                    args: [BigInt(roomId)],
                });
                addLog(`Game started (Phase shifted)! TX: ${hash}`);
                setStatus("Ready");
            }
        } catch (e: any) {
            addLog(`Error: ${e.message}`);
            setStatus("Failed");
        }
    };

    const runZKTest = async () => {
        setStatus("Generating...");
        addLog(`Starting test for Room #${roomId}, Mafia: ${mafiaCount}, Town: ${townCount}`);

        try {
            const zkData = await generateEndGameProof(
                BigInt(roomId),
                parseInt(mafiaCount),
                parseInt(townCount)
            );
            addLog("Proof generated successfully!");

            setStatus("Sending TX...");
            addLog("Sending endGameZK transaction...");

            const hash = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MafiaABI.abi,
                functionName: 'endGameZK',
                args: [
                    BigInt(roomId),
                    zkData.a,
                    zkData.b,
                    zkData.c,
                    zkData.inputs
                ],
            });

            addLog(`Transaction sent: ${hash}`);
            setStatus("Confirming...");

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
                addLog("Transaction confirmed! Game should be ENDED.");
                setStatus("Success!");
            }
        } catch (e: any) {
            console.error(e);
            addLog(`Error: ${e.message}`);
            setStatus("Failed");
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-8 font-sans">
            <h1 className="text-3xl font-bold mb-4 text-purple-400">ZK Proof Test Zone</h1>
            <p className="text-gray-400 mb-8 max-w-2xl">
                Use this page to "fake" a full game by filling a room with local bots, starting it, and then verifying the ZK end-condition.
            </p>

            <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1 max-w-md space-y-6">
                    {/* Setup Section */}
                    <div className="bg-[#111] p-6 rounded-2xl border border-white/10 shadow-xl">
                        <h3 className="text-sm font-bold uppercase text-gray-400 mb-4">Step 1: Setup Room</h3>
                        <div className="space-y-3">
                            <Button
                                onClick={() => performOnChainAction('create')}
                                className="w-full bg-blue-600 hover:bg-blue-500"
                            >
                                1. Create New Lobby (4 max)
                            </Button>

                            <div className="pt-4 border-t border-white/5 space-y-3">
                                <h4 className="text-xs font-bold text-orange-500 uppercase">Step 1.5: Fill with Bots</h4>
                                {bots.length === 0 ? (
                                    <Button onClick={generateBots} className="w-full bg-gray-800 text-xs">
                                        Generate 3 Local Bot Wallets
                                    </Button>
                                ) : (
                                    <div className="space-y-2">
                                        {bots.map((bot, i) => (
                                            <div key={i} className="flex justify-between items-center text-[10px] bg-white/5 p-2 rounded">
                                                <span className="font-mono text-gray-400">{bot.address}</span>
                                                <span className={parseFloat(bot.balance) > 0 ? "text-green-400" : "text-red-400 font-bold"}>
                                                    {bot.balance} STT
                                                </span>
                                            </div>
                                        ))}
                                        <div className="flex gap-2">
                                            <Button onClick={updateBotBalances} className="flex-1 bg-blue-900/30 text-[10px] h-8">Update Balances</Button>
                                            <Button onClick={botsJoinRoom} className="flex-1 bg-purple-900/30 text-[10px] h-8">Join Bots</Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-white/5">
                                <input
                                    type="number"
                                    placeholder="Room ID"
                                    value={roomId}
                                    onChange={e => setRoomId(e.target.value)}
                                    className="flex-1 bg-black border border-white/10 rounded px-3 py-2 text-white"
                                />
                                <Button
                                    onClick={() => performOnChainAction('start')}
                                    className="bg-green-600 hover:bg-green-500 text-xs px-2"
                                >
                                    2. Start Game
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* ZK Section */}
                    <div className="bg-[#111] p-6 rounded-2xl border border-white/10 shadow-xl">
                        <h3 className="text-sm font-bold uppercase text-gray-400 mb-4">Step 2: ZK Verification</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-gray-500 font-bold uppercase">Mafia</label>
                                    <input
                                        type="number"
                                        value={mafiaCount}
                                        onChange={e => setMafiaCount(e.target.value)}
                                        className="w-full bg-black border border-white/10 rounded px-3 py-2"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-gray-500 font-bold uppercase">Town</label>
                                    <input
                                        type="number"
                                        value={townCount}
                                        onChange={e => setTownCount(e.target.value)}
                                        className="w-full bg-black border border-white/10 rounded px-3 py-2"
                                    />
                                </div>
                            </div>

                            <Button
                                onClick={runZKTest}
                                className="w-full bg-purple-600 hover:bg-purple-500 py-6 text-lg font-black tracking-widest active:scale-95 transition-all"
                            >
                                RUN TEST 🚀
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Logs Section */}
                <div className="flex-1">
                    <div className="bg-[#0a0a0a] rounded-2xl border border-white/5 h-full flex flex-col shadow-2xl overflow-hidden min-h-[400px]">
                        <div className="bg-white/5 px-6 py-3 flex justify-between items-center border-b border-white/5">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Logs</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${status === 'Success!' ? 'bg-green-500/20 text-green-400' :
                                    status === 'Failed' ? 'bg-red-500/20 text-red-400' :
                                        'bg-blue-500/20 text-blue-400'
                                }`}>{status}</span>
                        </div>
                        <div className="flex-1 p-6 font-mono text-[11px] overflow-y-auto space-y-1 scrollbar-hide">
                            {logs.map((log, i) => (
                                <div key={i} className={
                                    log.includes("Error") ? "text-red-400" :
                                        log.includes("Success") ? "text-green-400 font-bold" :
                                            log.includes("Lobby created") ? "text-blue-400" :
                                                log.includes("Game started") ? "text-green-400" :
                                                    "text-gray-300"
                                }>
                                    {log}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
