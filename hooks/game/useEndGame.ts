/**
 * useEndGame — ZK-proof based game ending + auto-win detection.
 *
 * Handles:
 * - endGameZK (client-driven ZK proof submission with waterfall coordination)
 * - triggerAutoWinCheck (server-driven periodic check)
 * - Prize deposit debugging
 */
import { useCallback, useRef } from 'react';
import { formatEther } from 'viem';
import { MAFIA_ABI } from '../../contracts/config';
import { generateEndGameProof } from '../../services/zkProof';
import { loadSession } from '../../services/sessionKeyService';
import { GamePhase, GameState, Role } from '../../types';
import type { GameRefs } from './useGameRefs';
import type { TransactionEngine } from './useTransactionEngine';
import type { GameDataSync } from './useGameDataSync';
import type { LogEntry } from '../../types';
import React from 'react';

interface EndGameDeps {
    refs: GameRefs;
    txEngine: TransactionEngine;
    dataSync: GameDataSync;
    gameState: GameState;
    setIsTxPending: (v: boolean) => void;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    addLog: (message: string, type?: LogEntry['type']) => void;
    isTestMode: boolean;
    currentRoomId: bigint | null;
}

export function useEndGame(deps: EndGameDeps) {
    const { refs, txEngine, dataSync, gameState, setIsTxPending, setGameState, addLog, isTestMode, currentRoomId } = deps;

    // Helper: debug deposit after endGame
    const debugDepositAfterEnd = useCallback(async (roomId: bigint, myAddr: string, label: string) => {
        const pClient = refs.publicClientRef.current;
        if (!pClient || !myAddr) return;
        try {
            const [deposit, room] = await Promise.all([
                pClient.readContract({
                    address: refs.contractAddressRef.current,
                    abi: MAFIA_ABI,
                    functionName: 'getPlayerDeposit',
                    args: [roomId, myAddr as `0x${string}`],
                }) as Promise<bigint>,
                pClient.readContract({
                    address: refs.contractAddressRef.current,
                    abi: MAFIA_ABI,
                    functionName: 'getRoom',
                    args: [roomId],
                }) as Promise<any>,
            ]);
            const depositPool = Array.isArray(room) ? room[room.length - 2] : room.depositPool;
            const depositPerPlayer = Array.isArray(room) ? room[room.length - 1] : room.depositPerPlayer;
            console.log(`[Deposit Debug] ${label}:`, {
                myDeposit: formatEther(deposit) + ' STT',
                depositPool: formatEther(depositPool) + ' STT',
                depositPerPlayer: formatEther(depositPerPlayer) + ' STT',
                canClaimRefund: deposit > 0n,
                autoRefunded: deposit === 0n,
            });
            if (deposit === 0n && label.includes('endGameZK')) {
                if (depositPerPlayer === 0n) {
                    console.log(`[Deposit Debug] ℹ️ No deposit (freeroll). Nothing to refund.`);
                } else {
                    console.log(`[Deposit Debug] ✅ Contract AUTO-REFUNDED deposit during endGameZK. No manual claimRefund needed.`);
                }
            }
        } catch (depErr) {
            console.warn(`[Deposit Debug] Failed to check deposit after ${label}:`, depErr);
        }
    }, [refs]);

    // === Helper: check on-chain phase ===
    const checkOnChainPhase = useCallback(async (roomId: bigint, pClient: any): Promise<number> => {
        try {
            const freshRoom = await pClient.readContract({
                address: refs.contractAddressRef.current,
                abi: MAFIA_ABI,
                functionName: 'getRoom',
                args: [roomId],
            }) as any;
            return Number(Array.isArray(freshRoom) ? freshRoom[3] : freshRoom.phase);
        } catch {
            return -1;
        }
    }, [refs]);

    // === endGameZK ===
    const endGameZK = useCallback(async () => {
        const roomId = refs.currentRoomIdRef.current;
        const pClient = refs.publicClientRef.current;
        const myAddr = refs.addressRef.current;
        if (!roomId || !pClient || !myAddr) return;

        // Waterfall coordination
        const activePlayers = gameState.players
            .filter(p => p.isAlive)
            .sort((a, b) => a.address.localeCompare(b.address));

        const myIndex = activePlayers.findIndex(p => p.address.toLowerCase() === myAddr.toLowerCase());
        const delayIndex = myIndex >= 0 ? myIndex : 0;
        const delayMs = delayIndex * 15000;

        if (delayMs > 0) {
            console.log(`[ZK] Designated Submitter: I am #${delayIndex + 1}. Waiting ${delayMs / 1000}s before submission...`);
            addLog(`Waiting turn to submit proof (${delayMs / 1000}s)...`, "info");
            await new Promise(resolve => setTimeout(resolve, delayMs));

            try {
                const freshRoom = await pClient.readContract({
                    address: refs.contractAddressRef.current,
                    abi: MAFIA_ABI,
                    functionName: 'getRoom',
                    args: [roomId],
                }) as any;
                const currentPhase = Number(Array.isArray(freshRoom) ? freshRoom[3] : freshRoom.phase);
                if (currentPhase === GamePhase.ENDED) {
                    console.log('[ZK] Game already ended by another player. Aborting.');
                    addLog('Game already ended by another player.', 'info');
                    return;
                }
            } catch (e) {
                console.warn('[ZK] Could not re-verify game state, proceeding anyway:', e);
            }
        }

        setIsTxPending(true);
        addLog("Verifying victory conditions...", "info");

        try {
            let mCount = 0;
            let tCount = 0;
            gameState.players.forEach(p => {
                if (p.isAlive) {
                    if (p.role === Role.MAFIA) mCount++;
                    else tCount++;
                }
            });

            console.log("[ZK] Requesting proof for Room:", roomId.toString());
            const zkData = await generateEndGameProof(roomId, mCount, tCount);
            console.log("[ZK] Proof received. Simulating transaction...");

            const args = [roomId, zkData.a, zkData.b, zkData.c, zkData.inputs] as const;

            try {
                await pClient.simulateContract({
                    address: refs.contractAddressRef.current,
                    abi: MAFIA_ABI,
                    functionName: 'endGameZK',
                    args: args as any,
                    account: myAddr,
                });
                console.log("[ZK] Simulation SUCCESS");
            } catch (simError: any) {
                console.error("[ZK] Simulation FAILED:", simError.shortMessage || simError.message);
                throw new Error("Contract rejected the proof. Check log for details.");
            }

            let useSessionKey = false;
            const session = loadSession();
            if (session && session.registeredOnChain && Date.now() < session.expiresAt && session.roomId === Number(roomId)) {
                useSessionKey = true;
                console.log(`[ZK] Using session key for endGameZK.`);
            }

            console.log(`[ZK] Sending transaction (Session: ${useSessionKey})...`);
            const hash = await txEngine.sendGameTransaction('endGameZK', args as any, useSessionKey);

            const isTownWin = Number(zkData.inputs[0]) === 1;
            const isMafiaWin = Number(zkData.inputs[1]) === 1;

            let proactiveWinner: 'MAFIA' | 'TOWN' | 'DRAW' = 'DRAW';
            if (isTownWin) proactiveWinner = 'TOWN';
            else if (isMafiaWin) proactiveWinner = 'MAFIA';

            const receipt1 = await pClient.waitForTransactionReceipt({ hash });
            if (receipt1.status === 'reverted') {
                // Check if game ended by someone else — treat as success
                const postPhase = await checkOnChainPhase(roomId, pClient);
                if (postPhase === GamePhase.ENDED) {
                    console.log('[ZK] TX reverted but game is ENDED — another player finished it. Syncing.');
                    setGameState(prev => ({ ...prev, phase: GamePhase.ENDED }));
                    await dataSync.refreshPlayersList(roomId);
                    await debugDepositAfterEnd(roomId, myAddr, 'After endGameZK (race-resolved)');
                    return;
                }
                throw new Error('endGameZK transaction reverted on-chain');
            }

            setGameState(prev => ({
                ...prev,
                phase: GamePhase.ENDED,
                winner: proactiveWinner
            }));

            await dataSync.refreshPlayersList(roomId);
            await debugDepositAfterEnd(roomId, myAddr, 'After endGameZK');
        } finally {
            setIsTxPending(false);
        }
    }, [refs, txEngine, dataSync, gameState, setIsTxPending, setGameState, addLog, debugDepositAfterEnd, checkOnChainPhase]);

    // === AUTO WIN CHECK ===
    const triggerAutoWinCheck = useCallback(async () => {
        const roomId = refs.currentRoomIdRef.current;
        const pClient = refs.publicClientRef.current;
        const myAddr = refs.addressRef.current;
        if (!roomId || !pClient) return;

        if (refs.checkWinInProgressRef.current) {
            console.log('[AutoWin] Check already in progress, skipping.');
            return;
        }
        refs.checkWinInProgressRef.current = true;

        try {
            const chainId = pClient.chain?.id || 50312;
            console.log(`[AutoWin] Checking for victory in Room #${roomId}...`);
            if (refs.autoWinLockRef.current) return;
              const response = await fetch('/api/game/check-win', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: roomId.toString(), chainId })
            });

            if (!response.ok) return;

            const data = await response.json();
            if (data.winDetected) {
                const { formatted } = data;
                const proofRoomId = formatted.inputs[2];

                if (BigInt(proofRoomId) !== BigInt(roomId)) {
                    console.warn(`[AutoWin] Room ID mismatch: Frontend=${roomId}, Proof=${proofRoomId}`);
                    return;
                }

                // Waterfall: stagger by player index (same as manual endGameZK)
                const activePlayers = gameState.players
                    .filter(p => p.isAlive)
                    .sort((a, b) => a.address.localeCompare(b.address));
                const myIndex = myAddr
                    ? activePlayers.findIndex(p => p.address.toLowerCase() === myAddr.toLowerCase())
                    : -1;
                const delayIndex = myIndex >= 0 ? myIndex : 0;
                const delayMs = delayIndex * 5000; // 5s per player (shorter than manual 15s)

                if (delayMs > 0) {
                    console.log(`[AutoWin] Waterfall: I am #${delayIndex + 1}/${activePlayers.length}. Waiting ${delayMs / 1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));

                    // Re-check phase after waiting — another player may have ended it
                    const phase = await checkOnChainPhase(roomId, pClient);
                    if (phase === GamePhase.ENDED) {
                        const lowerWf = (data.result || '').toLowerCase();
                        const wfWinner: 'MAFIA' | 'TOWN' | 'DRAW' =
                            lowerWf.includes('town') ? 'TOWN' :
                            lowerWf.includes('mafia') ? 'MAFIA' : 'TOWN';
                        console.log(`[AutoWin] Game already ended during waterfall wait. Winner: ${wfWinner}`);
                        setGameState(prev => ({ ...prev, phase: GamePhase.ENDED, winner: wfWinner }));
                        await dataSync.refreshPlayersList(roomId);
                        return;
                    }
                }

                const formattedProof = {
                    a: [BigInt(formatted.a[0]), BigInt(formatted.a[1])],
                    b: [
                        [BigInt(formatted.b[0][0]), BigInt(formatted.b[0][1])],
                        [BigInt(formatted.b[1][0]), BigInt(formatted.b[1][1])]
                    ],
                    c: [BigInt(formatted.c[0]), BigInt(formatted.c[1])],
                    inputs: formatted.inputs.map((s: string) => BigInt(s)) as [bigint, bigint, bigint, bigint, bigint, bigint]
                };

                console.log("[AutoWin ZK Debug] === endGameZK via AutoWin ===");
                console.log("[AutoWin ZK Debug] Room ID:", roomId.toString());
                console.log("[AutoWin ZK Debug] Result:", data.result);

                const args = [roomId, formattedProof.a, formattedProof.b, formattedProof.c, formattedProof.inputs] as const;

                if (refs.autoWinLockRef.current) {
                    console.log("[AutoWin] Win detected, but another transaction is pending. Retrying shortly...");
                    return;
                }
                refs.autoWinLockRef.current = true;
                setIsTxPending(true);

                let useSessionKey = false;
                const session = loadSession();
                if (session && session.registeredOnChain && Date.now() < session.expiresAt && session.roomId === Number(roomId)) {
                    useSessionKey = true;
                    console.log(`[AutoWin] Using session key for endGameZK.`);
                }

                const simulationAccount = useSessionKey ? (session!.address as `0x${string}`) : myAddr;

                try {
                    await pClient.simulateContract({
                        address: refs.contractAddressRef.current,
                        abi: MAFIA_ABI,
                        functionName: 'endGameZK',
                        args: args as any,
                        account: simulationAccount,
                        gas: BigInt(100_000_000), // twice as big to fix generic revert
                    });
                    console.log(`[AutoWin ZK Debug] Simulation SUCCESS (Session: ${useSessionKey})`);
                } catch (simErr: any) {
                    refs.autoWinLockRef.current = false;
                    // Check if game already ended (another player beat us)
                    const phase = await checkOnChainPhase(roomId, pClient);
                    if (phase === GamePhase.ENDED) {
                        const lowerSim = (data.result || '').toLowerCase();
                        const simWinner: 'MAFIA' | 'TOWN' | 'DRAW' =
                            lowerSim.includes('town') ? 'TOWN' :
                            lowerSim.includes('mafia') ? 'MAFIA' : 'TOWN';
                        console.log(`[AutoWin] Simulation failed but game already ended. Winner: ${simWinner}`);
                        setGameState(prev => ({ ...prev, phase: GamePhase.ENDED, winner: simWinner }));
                        await dataSync.refreshPlayersList(roomId);
                        return;
                    }
                    console.error("[AutoWin ZK Debug] Simulation FAILED!");
                    console.error("Reason:", simErr.reason || simErr.shortMessage || "Unknown revert");
                    throw new Error(simErr.shortMessage || simErr.message || "Simulation failed");
                }

                // Final phase re-check right before sending TX
                const preSubmitPhase = await checkOnChainPhase(roomId, pClient);
                if (preSubmitPhase === GamePhase.ENDED) {
                    const lowerSkip = (data.result || '').toLowerCase();
                    const skipWinner: 'MAFIA' | 'TOWN' | 'DRAW' =
                        lowerSkip.includes('town') ? 'TOWN' :
                        lowerSkip.includes('mafia') ? 'MAFIA' : 'TOWN';
                    console.log(`[AutoWin] Game ended between simulation and send. Skipping TX. Winner: ${skipWinner}`);
                    refs.autoWinLockRef.current = false;
                    setIsTxPending(false);
                    setGameState(prev => ({ ...prev, phase: GamePhase.ENDED, winner: skipWinner }));
                    await dataSync.refreshPlayersList(roomId);
                    return;
                }

                addLog(`Auto-Win: ${data.result} detected! Ending game...`, "success");

                try {
                    console.log(`[AutoWin] Sending endGameZK (Session: ${useSessionKey})...`);
                    const hash = await txEngine.sendGameTransaction('endGameZK', args as any, useSessionKey);

                    const receipt2 = await pClient.waitForTransactionReceipt({ hash });
                    if (receipt2.status === 'reverted') {
                        // Check if game ended by someone else — treat as success, not error
                        const postPhase = await checkOnChainPhase(roomId, pClient);
                        if (postPhase === GamePhase.ENDED) {
                            console.log('[AutoWin] TX reverted but game is ENDED — another player finished it. Syncing.');
                            setGameState(prev => ({ ...prev, phase: GamePhase.ENDED }));
                            await dataSync.refreshPlayersList(roomId);
                            await debugDepositAfterEnd(roomId, myAddr || '', 'After AutoWin (race-resolved)');
                            return;
                        }
                        throw new Error('endGameZK transaction reverted on-chain');
                    }

                    const lowerRes = (data.result || '').toLowerCase();
                    const resolvedWinner: 'MAFIA' | 'TOWN' | 'DRAW' =
                        lowerRes.includes('town') ? 'TOWN' :
                            lowerRes.includes('mafia') ? 'MAFIA' :
                                'TOWN';

                    setGameState(prev => ({
                        ...prev,
                        phase: GamePhase.ENDED,
                        winner: resolvedWinner
                    }));

                    addLog("Game ended automatically via Server ZK!", "phase");
                    await dataSync.refreshPlayersList(roomId);
                    await debugDepositAfterEnd(roomId, myAddr || '', 'After AutoWin endGameZK');
                } catch (txErr: any) {
                    console.error("[AutoWin ZK Debug] Transaction FAILED:", txErr);
                    addLog(`Auto-Win Failed: ${txErr.shortMessage || txErr.message}`, "danger");
                } finally {
                    refs.autoWinLockRef.current = false;
                    setIsTxPending(false);
                }
            } else if (data.message && data.message !== 'Game continues') {
                console.log(`[AutoWinCheck] ${data.message}`);
            }
        } catch (e) {
            console.warn("[AutoWin] Silent check failed:", e);
        } finally {
            refs.checkWinInProgressRef.current = false;
        }
    }, [refs, txEngine, dataSync, gameState, setIsTxPending, setGameState, addLog, debugDepositAfterEnd, checkOnChainPhase]);

    const triggerAutoWinCheckRef = React.useRef(triggerAutoWinCheck);
    React.useEffect(() => {
        triggerAutoWinCheckRef.current = triggerAutoWinCheck;
    }, [triggerAutoWinCheck]);

    // === POLLING ===
    React.useEffect(() => {
        if (!currentRoomId || isTestMode) return;

        console.log(`[AutoWin] Starting background win condition polling for Room #${currentRoomId}`);
        
        const iv = setInterval(() => {
            // Re-check phase inside interval
            if (
                refs.phaseRef.current >= GamePhase.DAY &&
                refs.phaseRef.current !== GamePhase.ENDED
            ) {
                triggerAutoWinCheckRef.current();
            }
        }, 10000); // Check every 10s

        return () => clearInterval(iv);
    }, [refs, isTestMode, currentRoomId]);

    return {
        endGameZK,
        triggerAutoWinCheck,
    };
}

export type EndGame = ReturnType<typeof useEndGame>;
