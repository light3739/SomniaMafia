"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { generateEndGameProof } from '@/services/zkProof';
import { useWriteContract, usePublicClient, useSendTransaction } from 'wagmi';
import { MafiaABI } from '@/contracts/MafiaPortal';
import { MAFIA_CONTRACT_ADDRESS } from '@/contracts/config';
import { privateKeyToAccount } from 'viem/accounts';
import { formatEther, parseEther, createWalletClient, http, defineChain } from 'viem';

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

    // Load bots from localStorage on mount
    useEffect(() => {
        const savedBots = localStorage.getItem('zk_test_bots');
        if (savedBots) {
            try {
                setBots(JSON.parse(savedBots));
                addLog("Restored bot wallets from localStorage.");
            } catch (e) {
                console.error("Failed to parse saved bots", e);
            }
        }
    }, []);

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
        localStorage.setItem('zk_test_bots', JSON.stringify(newBots));
        addLog("3 Bot wallets generated and saved to localStorage!");
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

    const { sendTransactionAsync } = useSendTransaction();

    const fundBots = async () => {
        addLog("Funding bots with 0.01 STT each...");
        try {
            for (const bot of bots) {
                // Check if already funded to save time/gas
                if (parseFloat(bot.balance) > 0.005) {
                    addLog(`Bot ${bot.address.slice(0, 6)} already has funds. Skipping.`);
                    continue;
                }

                const hash = await sendTransactionAsync({
                    to: bot.address as `0x${string}`,
                    value: parseEther("0.01"),
                });
                addLog(`Sent 0.01 STT to ${bot.address.slice(0, 6)}. TX: ${hash}`);
            }
            addLog("Funding complete! Wait a moment then click Update Balances.");
        } catch (e: any) {
            addLog(`Funding Failed: ${e.message}`);
        }
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

    const botsCommitRoles = async () => {
        if (!roomId) return addLog("Enter Room ID first!");
        addLog(`Bots syncing secrets for room #${roomId}...`);

        // 0. USER SHUFFLE (If User is Player 0)
        // Since createAndJoin puts user at 0, they must shuffle first!
        try {
            addLog("Checking if User needs to shuffle...");
            // Mock deck for user
            const deck = Array.from({ length: 4 }, (_, k) => k + 1);
            const deckSalt = "user_deck_salt";
            const { keccak256, encodeAbiParameters, parseAbiParameters } = await import('viem');
            const deckStrings = deck.map(String);
            const encodedDeck = encodeAbiParameters(parseAbiParameters('string[] deck, string salt'), [deckStrings, deckSalt]);
            const deckHash = keccak256(encodedDeck);

            // Try commitDeck (might fail if not turn, but we try)
            const txDeck = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MafiaABI.abi,
                functionName: 'commitDeck',
                args: [BigInt(roomId), deckHash],
            });
            addLog("User commitDeck TX sent...");
            await publicClient?.waitForTransactionReceipt({ hash: txDeck });

            const txReveal = await writeContractAsync({
                address: MAFIA_CONTRACT_ADDRESS,
                abi: MafiaABI.abi,
                functionName: 'revealDeck',
                args: [BigInt(roomId), deckStrings, deckSalt],
            });
            addLog("User revealDeck TX sent...");
            await publicClient?.waitForTransactionReceipt({ hash: txReveal });
            addLog("User shuffle complete! Bots turn.");
        } catch (e: any) {
            console.log("User shuffle skipped:", e.message);
            addLog("User shuffle skipped (check console). Continuing bots...");
        }

        for (let i = 0; i < bots.length; i++) {
            const bot = bots[i];
            if (parseFloat(bot.balance) < 0.0001) continue;

            try {
                const botClient = createWalletClient({
                    account: privateKeyToAccount(bot.pk as `0x${string}`),
                    chain: shannon,
                    transport: http()
                });

                // Mock role & salt for testing
                // In a real game we would actually decrypt the deck
                const role = i === 0 ? 1 : 4; // First bot is Mafia, others are Civilian
                const salt = `bot_salt_${bot.address.slice(0, 8)}`;

                // 0. SHUFFLE PHASE (Commit & Reveal Deck)
                // In a real game, this is complex P2P. For bots, we just submit a dummy deck to satisfy the contract.
                // We need to generate a valid deck (1..N) and commit it.
                const deck = Array.from({ length: 4 }, (_, k) => k + 1); // [1, 2, 3, 4]
                const deckSalt = `bot_deck_salt_${bot.address.slice(0, 8)}`;
                const { ShuffleService } = await import('@/services/shuffleService');

                // Generate deck hash (using service or manually if service is complex)
                // We'll trust ShuffleService.createDeckCommitHash exists or use keccak
                // Actually, let's use a simpler approach if ShuffleService is heavy.
                // But wait, we need to match the contract's expectations.

                // Let's assume we are in SHUFFLING phase.
                addLog(`Bot ${bot.address.slice(0, 6)} committing deck...`);

                // We need to implement deck commitment logic
                // Since this is a test page, we can arguably skip "correct" shuffling if the contract allows simply committing *a* deck.
                // Contract: revealDeck checks: calculatedHash == commitHash

                // We need the commit hash:
                // bytes32 calculatedHash = keccak256(abi.encode(deck, salt));

                // To do this in JS (viem):
                const { keccak256, encodeAbiParameters, parseAbiParameters } = await import('viem');

                // Deck is string[] in contract (uint8[] represented as string?)
                // revealDeck signature: revealDeck(uint256 roomId, string[] calldata deck, string calldata salt)
                // Wait, contract view says string[]? Let's verify line 419.
                // Yes: function revealDeck(uint256 roomId, string[] calldata deck, string calldata salt)

                const deckStrings = deck.map(String);

                const encodedDeck = encodeAbiParameters(
                    parseAbiParameters('string[] deck, string salt'),
                    [deckStrings, deckSalt]
                );
                const deckHash = keccak256(encodedDeck);

                try {
                    const txDeck = await botClient.writeContract({
                        address: MAFIA_CONTRACT_ADDRESS,
                        abi: MafiaABI.abi,
                        functionName: 'commitDeck',
                        args: [BigInt(roomId), deckHash],
                    });
                    await publicClient?.waitForTransactionReceipt({ hash: txDeck });

                    addLog(`Bot ${bot.address.slice(0, 6)} revealing deck...`);
                    const txReveal = await botClient.writeContract({
                        address: MAFIA_CONTRACT_ADDRESS,
                        abi: MafiaABI.abi,
                        functionName: 'revealDeck',
                        args: [BigInt(roomId), deckStrings, deckSalt],
                    });
                    await publicClient?.waitForTransactionReceipt({ hash: txReveal });
                } catch (e: any) {
                    // If we are already past shuffling, this might revert. Ignore and try role.
                    console.log("Deck phase skipped/failed (maybe already done?):", e.message);
                }

                // 1. ROLE REVEAL PHASE
                const roleHash = ShuffleService.createRoleCommitHash(role, salt);

                try {
                    addLog(`Bot ${bot.address.slice(0, 6)} committing role...`);
                    const tx1 = await botClient.writeContract({
                        address: MAFIA_CONTRACT_ADDRESS,
                        abi: MafiaABI.abi,
                        functionName: 'commitRole',
                        args: [BigInt(roomId), roleHash],
                    });
                    await publicClient?.waitForTransactionReceipt({ hash: tx1 });
                } catch (e: any) {
                    // Ignore already committed
                }

                try {
                    addLog(`Bot ${bot.address.slice(0, 6)} confirming role...`);
                    const tx2 = await botClient.writeContract({
                        address: MAFIA_CONTRACT_ADDRESS,
                        abi: MafiaABI.abi,
                        functionName: 'confirmRole',
                        args: [BigInt(roomId)],
                    });
                    await publicClient?.waitForTransactionReceipt({ hash: tx2 });
                } catch (e: any) {
                    // Ignore
                }

                // 2. Sync with Server (so ZK check works)
                await fetch('/api/game/reveal-secret', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        roomId: roomId.toString(),
                        address: bot.address,
                        role,
                        salt
                    })
                });

                addLog(`Bot ${bot.address.slice(0, 6)} fully synced!`);
            } catch (e: any) {
                addLog(`Bot Sync Error: ${e.message}`);
            }
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
            const isTownWin = zkData.inputs[0] === 1n;
            const isMafiaWin = zkData.inputs[1] === 1n;
            addLog(`Proof generated! Outcome: ${isTownWin ? "TOWN WINS" : isMafiaWin ? "MAFIA WINS" : "UNKNOWN"}`);

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
                gas: 3000000n // Force cap gas to avoid RPC estimation errors (68M bug)
            });

            addLog(`Transaction sent: ${hash}`);
            setStatus("Confirming...");

            if (publicClient) {
                await publicClient.waitForTransactionReceipt({ hash });
                addLog(`Success! Game ended on-chain. Result: ${isTownWin ? "Town Victory" : "Mafia Victory"}`);
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
                                                <span className="font-mono text-gray-400">{bot.address.slice(0, 8)}...</span>
                                                <span className={parseFloat(bot.balance) > 0 ? "text-green-400" : "text-red-400 font-bold"}>
                                                    {bot.balance} STT
                                                </span>
                                            </div>
                                        ))}
                                        <div className="flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                <Button onClick={updateBotBalances} className="flex-1 bg-blue-900/30 text-[10px] h-8">Upd Balance</Button>
                                                <Button onClick={fundBots} className="flex-1 bg-yellow-600/50 hover:bg-yellow-500/50 text-[10px] h-8 text-yellow-200">Fund Bots (0.01)</Button>
                                            </div>
                                            <Button onClick={botsJoinRoom} className="w-full bg-green-900/30 text-[10px] h-8">Join Bots</Button>
                                            <Button onClick={botsCommitRoles} className="w-full bg-purple-900/40 text-[10px] h-8 border border-purple-500/50">Bots Reveal Roles (Commit & Sync)</Button>
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
