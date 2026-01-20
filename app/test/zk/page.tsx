"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { generateEndGameProof } from '@/services/zkProof';
import { useWriteContract, usePublicClient } from 'wagmi';
import { MafiaABI } from '@/contracts/MafiaPortal';
import { MAFIA_CONTRACT_ADDRESS } from '@/contracts/config';

export default function ZKTestPage() {
    const [roomId, setRoomId] = useState("1");
    const [mafiaCount, setMafiaCount] = useState("0");
    const [townCount, setTownCount] = useState("3");
    const [status, setStatus] = useState("Idle");
    const [logs, setLogs] = useState<string[]>([]);

    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    const addLog = (msg: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
        console.log(`[ZK-Test] ${msg}`);
    };

    const performOnChainAction = async (action: 'create' | 'start') => {
        setStatus(action === 'create' ? "Creating..." : "Starting...");
        try {
            if (action === 'create') {
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
            // 1. Generate Proof
            const zkData = await generateEndGameProof(
                BigInt(roomId),
                parseInt(mafiaCount),
                parseInt(townCount)
            );
            addLog("Proof generated successfully!");

            // 2. Send Transaction
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

            <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1 max-w-md space-y-6">
                    <div className="bg-[#111] p-6 rounded-2xl border border-white/10 shadow-xl">
                        <h3 className="text-sm font-bold uppercase text-gray-400 mb-4">Step 1: Setup Room</h3>
                        <div className="space-y-3">
                            <Button
                                onClick={() => performOnChainAction('create')}
                                className="w-full bg-blue-600 hover:bg-blue-500"
                            >
                                1. Create New Lobby
                            </Button>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    placeholder="Enter Room ID"
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
                            <p className="text-[10px] text-gray-500 italic">
                                * startGame moves room from LOBBY directly to DAY for testing.
                            </p>
                        </div>
                    </div>

                    <div className="bg-[#111] p-6 rounded-2xl border border-white/10 shadow-xl">
                        <h3 className="text-sm font-bold uppercase text-gray-400 mb-4">Step 2: ZK Verification</h3>
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs uppercase text-gray-500 mb-1">Mafia (0=win)</label>
                                    <input
                                        type="number"
                                        value={mafiaCount}
                                        onChange={e => setMafiaCount(e.target.value)}
                                        className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs uppercase text-gray-500 mb-1">Town</label>
                                    <input
                                        type="number"
                                        value={townCount}
                                        onChange={e => setTownCount(e.target.value)}
                                        className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white"
                                    />
                                </div>
                            </div>

                            <Button
                                onClick={runZKTest}
                                disabled={status.includes("ing")}
                                className="w-full py-4 text-lg font-bold bg-purple-600 hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/20"
                            >
                                {status === "Idle" || status === "Ready" || status === "Success!" ? "Run Full ZK Test" : status}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 lg:max-w-2xl">
                    <h3 className="text-sm font-semibold uppercase text-gray-500 mb-2">Detailed Workflow Logs</h3>
                    <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-4 h-[500px] overflow-y-auto font-mono text-xs">
                        {logs.length === 0 ? (
                            <span className="text-gray-700 italic">Ready for setup...</span>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className="mb-1 text-green-400/80">
                                    <span className="text-gray-600 mr-2">{'>'}</span>{log}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-8 p-4 bg-yellow-900/10 border border-yellow-900/30 rounded-xl max-w-md text-yellow-200/60 text-[10px]">
                <p><strong>Note:</strong> ZK end can only be triggered if <code>phase != LOBBY && phase != ENDED</code>.</p>
            </div>
        </div>
    );
}
