/**
 * useEndGame — ZK-proof based game ending + auto-win detection + role reveal.
 *
 * Handles:
 * - endGameZK (client-driven ZK proof submission with waterfall coordination)
 * - triggerAutoWinCheck (server-driven periodic check)
 * - Prize deposit debugging
 * - Role reveal (on-chain + GM server) after game ends
 * - Auto-distribute prizes + session wallet drain
 */
import { useCallback, useRef, useState, useEffect } from 'react';
import { formatEther, pad, toHex } from 'viem';
import { MAFIA_ABI, GM_SERVER_URL } from '../../contracts/config';
import { generateEndGameProof } from '../../services/zkProof';
import { loadSession, loadSessionForDrain } from '../../services/sessionKeyService';
import { GamePhase, GameState, Role } from '../../types';
import type { GameRefs } from './useGameRefs';
import type { TransactionEngine } from './useTransactionEngine';
import type { GameDataSync } from './useGameDataSync';
import type { LogEntry } from '../../types';
import { gmWs } from '../../services/gmWebSocket';
import { parseWinCondition } from '../../services/winConditionParser';
import React from 'react';

// Convert contract Role enum (0-4) to frontend Role
const contractRoleToRole = (contractRole: number): Role => {
    switch (contractRole) {
        case 1: return Role.MAFIA;
        case 2: return Role.DOCTOR;
        case 3: return Role.DETECTIVE;
        case 4: return Role.CIVILIAN;
        default: return Role.UNKNOWN;
    }
};

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

    // === ROLE REVEAL STATE ===
    const [revealedRoles, setRevealedRoles] = useState<Map<string, Role>>(new Map());
    const [onChainRoles, setOnChainRoles] = useState<Map<string, Role>>(new Map());
    const [isRevealingRoles, setIsRevealingRoles] = useState(false);
    const [revealTimedOut, setRevealTimedOut] = useState(false);
    const onChainRolesRef = React.useRef<Map<string, Role>>(new Map());
    const revealedRolesRef = React.useRef<Map<string, Role>>(new Map());
    const isRevealingRef = React.useRef(false);
    const playersRef = React.useRef(gameState.players);
    const roomIdRef = React.useRef<bigint | null>(currentRoomId);
    const pollIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
    const roleRevealStartedRef = React.useRef(false);

    React.useEffect(() => { playersRef.current = gameState.players; }, [gameState.players]);
    React.useEffect(() => { revealedRolesRef.current = revealedRoles; }, [revealedRoles]);
    React.useEffect(() => { if (currentRoomId) roomIdRef.current = currentRoomId; }, [currentRoomId]);

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
                myDeposit: formatEther(deposit) + ' SOMI',
                depositPool: formatEther(depositPool) + ' SOMI',
                depositPerPlayer: formatEther(depositPerPlayer) + ' SOMI',
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
                        const wfWinner = parseWinCondition(data.result, refs.playersRef.current);
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
                        const simWinner = parseWinCondition(data.result, refs.playersRef.current);
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
                    const skipWinner = parseWinCondition(data.result, refs.playersRef.current);
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

    // === AUTO-DISTRIBUTE PRIZES + AUTO-DRAIN SESSION WALLET ON GAME END ===
    const endGameCleanupDoneRef = React.useRef(false);

    React.useEffect(() => {
        if (gameState.phase !== GamePhase.ENDED || endGameCleanupDoneRef.current) return;
        if (!refs.publicClientRef.current || !refs.addressRef.current) return;

        const runEndGameCleanup = async () => {
            const pClient = refs.publicClientRef.current!;
            const session = loadSession();
            const chain = refs.runtimeChainRef.current;

            // --- Step 1: Auto-distribute tournament prizes ---
            if (gameState.isTournament && currentRoomId) {
                try {
                    // Check if prizes already claimed via getTournament
                    const roomData = await pClient.readContract({
                        address: refs.contractAddressRef.current,
                        abi: MAFIA_ABI,
                        functionName: 'getRoom',
                        args: [currentRoomId],
                    }) as any;
                    const tournamentId = Array.isArray(roomData) ? BigInt(roomData[19] || 0) : BigInt(roomData.tournamentId || 0);

                    let alreadyClaimed = false;
                    if (tournamentId > 0n) {
                        const tData = await pClient.readContract({
                            address: refs.contractAddressRef.current,
                            abi: MAFIA_ABI,
                            functionName: 'getTournament',
                            args: [tournamentId],
                        }) as any;
                        alreadyClaimed = Array.isArray(tData) ? Boolean(tData[13]) : Boolean(tData.prizesClaimed);
                    }

                    if (alreadyClaimed) {
                        console.log('[AutoDistribute] Prizes already claimed');
                    } else {
                        // Waterfall: only the first alive player (sorted by address) attempts distribution.
                        // All others just wait for prizesClaimed to flip on-chain.
                        const myAddr = refs.addressRef.current!.toLowerCase();
                        const alivePlayers = gameState.players
                            .filter(p => p.isAlive)
                            .sort((a, b) => a.address.localeCompare(b.address));
                        const myIndex = alivePlayers.findIndex(p => p.address.toLowerCase() === myAddr);
                        const isFirstInWaterfall = myIndex === 0;

                        if (!isFirstInWaterfall) {
                            console.log(`[AutoDistribute] Not first in waterfall (position ${myIndex + 1}/${alivePlayers.length}), skipping — will poll for prizesClaimed`);
                        } else {
                            // Step 1a: Ask GM to reveal roles on-chain (no session key needed — GM uses its own key)
                            try {
                                const chainId = chain.id || 50312;
                                console.log('[AutoDistribute] Requesting GM to reveal roles on-chain...');
                                const revealRes = await fetch(`${GM_SERVER_URL}/reveal-roles/${currentRoomId}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ chainId }),
                                });
                                const revealData = await revealRes.json();
                                if (revealRes.ok) {
                                    console.log('[AutoDistribute] Roles revealed on-chain:', revealData.hash);
                                } else {
                                    console.warn('[AutoDistribute] Role reveal failed (may already be done):', revealData.error);
                                }
                            } catch (revealErr: unknown) {
                                console.warn('[AutoDistribute] Role reveal request failed (continuing anyway):', revealErr);
                            }

                            // Step 1b: Distribute prizes (requires session key)
                            if (session?.registeredOnChain && session.privateKey) {
                                // Re-check if already claimed (reveal might have triggered another player's distribute)
                                if (tournamentId > 0n) {
                                    const tDataCheck = await pClient.readContract({
                                        address: refs.contractAddressRef.current,
                                        abi: MAFIA_ABI,
                                        functionName: 'getTournament',
                                        args: [tournamentId],
                                    }) as any;
                                    const claimedNow = Array.isArray(tDataCheck) ? Boolean(tDataCheck[13]) : Boolean(tDataCheck.prizesClaimed);
                                    if (claimedNow) {
                                        console.log('[AutoDistribute] Prizes claimed while revealing roles');
                                        throw new Error('ALREADY_CLAIMED');
                                    }
                                }

                                console.log('[AutoDistribute] Submitting distributeMafiaPrizes via session key...');
                                const { createWalletClient, http: viemHttp } = await import('viem');
                                const { privateKeyToAccount } = await import('viem/accounts');
                                const account = privateKeyToAccount(session.privateKey as `0x${string}`);

                                const sessionClient = createWalletClient({
                                    account, chain,
                                    transport: viemHttp(chain.rpcUrls.default.http[0]),
                                });

                                const hash = await sessionClient.writeContract({
                                    address: refs.contractAddressRef.current,
                                    abi: MAFIA_ABI,
                                    functionName: 'distributeMafiaPrizes',
                                    args: [currentRoomId],
                                    account,
                                    chain,
                                });

                                await pClient.waitForTransactionReceipt({ hash });
                                console.log('[AutoDistribute] Prizes distributed successfully!');
                                addLog('Prizes distributed automatically', 'success');

                                // Store tx hash for GameOver popup (all clients can read)
                                if (currentRoomId) {
                                    localStorage.setItem(`prize_tx_${currentRoomId}`, hash);
                                }
                            }
                        }
                    }
                } catch (e: any) {
                    const msg = e.shortMessage || e.message || '';
                    if (msg.includes('AlreadyClaimed')) {
                        console.log('[AutoDistribute] Prizes already claimed (race)');
                    } else {
                        console.warn('[AutoDistribute] Failed:', msg);
                        // Manual button in GameOver is the fallback
                    }
                }
            }

            // --- Step 1.5: For non-tournament games, still call reveal-roles so GM
            //     can record roles on-chain and report gas costs (reportRoomGasCost).
            //     Only the first player in waterfall does this.
            if (!gameState.isTournament && currentRoomId) {
                const myAddr = refs.addressRef.current!.toLowerCase();
                const alivePlayers = gameState.players
                    .filter(p => p.isAlive)
                    .sort((a, b) => a.address.localeCompare(b.address));
                const isFirst = alivePlayers.length > 0 && alivePlayers[0].address.toLowerCase() === myAddr;

                if (isFirst) {
                    try {
                        const chainId = chain.id || 50312;
                        console.log('[AutoReveal] Requesting GM to reveal roles + report gas cost...');
                        await fetch(`${GM_SERVER_URL}/reveal-roles/${currentRoomId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chainId }),
                        });
                    } catch (e) {
                        console.warn('[AutoReveal] Failed (non-blocking):', e);
                    }
                }
            }

            // --- Step 2: Drain session wallet via drainSessionGas (GM share deducted, rest refunded) ---
            // Use loadSessionForDrain which ignores expiry — the contract's drainSessionGas
            // only checks sessionToMain mapping, NOT session expiry.
            try {
                const drainSession = loadSessionForDrain();
                if (!drainSession?.privateKey || !drainSession.address) {
                    console.log('[SessionDrain] No session key available, skipping drain');
                    return;
                }

                const bal = await pClient.getBalance({ address: drainSession.address as `0x${string}` });
                if (bal === 0n) {
                    console.log('[SessionDrain] Session wallet already empty');
                    return;
                }

                // Wait for GM to report gas costs so drainSessionGas deducts the correct share.
                // GM server reports on GameEnded event (LogListener) — poll until it lands.
                console.log('[SessionDrain] Waiting for GM gas cost report...');
                for (let i = 0; i < 5; i++) {
                    try {
                        const gmCost = await pClient.readContract({
                            address: refs.contractAddressRef.current,
                            abi: MAFIA_ABI,
                            functionName: 'getGmGasCost',
                            args: [currentRoomId!],
                        }) as bigint;
                        if (gmCost > 0n) {
                            console.log(`[SessionDrain] GM gas cost reported: ${gmCost} wei`);
                            break;
                        }
                    } catch { /* getter may not exist on old deployment */ }
                    if (i < 4) await new Promise(r => setTimeout(r, 1500));
                }

                const { createWalletClient, http: viemHttp } = await import('viem');
                const { privateKeyToAccount } = await import('viem/accounts');
                const account = privateKeyToAccount(drainSession.privateKey as `0x${string}`);

                const sessionClient = createWalletClient({
                    account, chain,
                    transport: viemHttp(chain.rpcUrls.default.http[0]),
                });

                // Estimate gas for the actual drainSessionGas call
                const { encodeFunctionData } = await import('viem');
                const calldata = encodeFunctionData({
                    abi: MAFIA_ABI,
                    functionName: 'drainSessionGas',
                    args: [currentRoomId!],
                });

                // Use half the balance as a trial value for estimation
                const trialValue = bal / 2n;
                const gasEstimate = await pClient.estimateGas({
                    account: drainSession.address as `0x${string}`,
                    to: refs.contractAddressRef.current,
                    data: calldata,
                    value: trialValue,
                }).catch(() => 300000n); // fallback
                const gasPrice = await pClient.getGasPrice();
                const gasCost = gasEstimate * gasPrice * 3n; // 3x buffer for price fluctuation

                if (bal <= gasCost) {
                    console.log('[SessionDrain] Balance too low to cover drainSessionGas gas');
                    return;
                }

                const sendAmount = bal - gasCost;

                const hash = await sessionClient.writeContract({
                    address: refs.contractAddressRef.current,
                    abi: MAFIA_ABI,
                    functionName: 'drainSessionGas',
                    args: [currentRoomId!],
                    value: sendAmount,
                    account,
                    chain,
                });

                await pClient.waitForTransactionReceipt({ hash });
                console.log(`[SessionDrain] Drained ${sendAmount} wei via drainSessionGas`);
                addLog('Session gas refunded', 'success');
            } catch (e) {
                console.warn('[SessionDrain] Failed to drain session wallet:', e);
            }
        };

        endGameCleanupDoneRef.current = true;
        // Delay to let endGame settle and roles load
        const t = setTimeout(runEndGameCleanup, 3000);
        return () => clearTimeout(t);
    }, [gameState.phase, gameState.isTournament, currentRoomId, refs, addLog]);

    // === ROLE REVEAL LOGIC ===

    const allRolesKnown = useCallback(() => {
        const players = playersRef.current;
        return players.length > 0 && players.every(p => {
            const addr = p.address.toLowerCase();
            const r = onChainRolesRef.current.get(addr)
                || revealedRolesRef.current.get(addr)
                || p.role;
            return r !== Role.UNKNOWN;
        });
    }, []);

    const fetchOnChainRoles = useCallback(async () => {
        const pClient = refs.publicClientRef.current;
        const roomId = roomIdRef.current || currentRoomId;
        if (!pClient || !roomId) return;

        try {
            const players = playersRef.current;
            if (players.length === 0) return;
            const roles = new Map<string, Role>();

            const roleResults = await pClient.multicall({
                contracts: players.map(player => ({
                    address: refs.contractAddressRef.current,
                    abi: MAFIA_ABI as any,
                    functionName: 'playerRoles' as const,
                    args: [roomId, player.address],
                })),
                allowFailure: true,
            });

            for (let i = 0; i < players.length; i++) {
                const result = roleResults[i];
                if (result.status === 'success') {
                    const role = contractRoleToRole(Number(result.result));
                    if (role !== Role.UNKNOWN) {
                        roles.set(players[i].address.toLowerCase(), role);
                    }
                }
            }

            setOnChainRoles(roles);
            onChainRolesRef.current = roles;

            const merged = new Map<string, Role>();
            for (const player of players) {
                const addr = player.address.toLowerCase();
                merged.set(addr, roles.get(addr) || revealedRolesRef.current.get(addr) || player.role);
            }

            setGameState(prev => ({
                ...prev,
                players: prev.players.map(p => ({
                    ...p,
                    role: merged.get(p.address.toLowerCase()) || p.role
                }))
            }));
        } catch (e) {
            console.error("[RoleReveal] Failed to fetch on-chain roles:", e);
        }
    }, [refs, currentRoomId, setGameState]);

    const fetchGMRoles = useCallback(async () => {
        if (allRolesKnown()) return;

        const roomId = roomIdRef.current || currentRoomId
            || (() => { const s = sessionStorage.getItem('gameOver_roomId'); return s ? BigInt(s) : null; })();
        if (!roomId) return;

        try {
            const chainId = refs.runtimeChainRef.current.id;
            const res = await fetch(`/api/game/room-roles?roomId=${roomId.toString()}&chainId=${chainId}`);
            if (!res.ok) return;
            const data = await res.json();
            if (!data.roles || typeof data.roles !== 'object') return;

            const roleMap: Record<string, Role> = {
                'MAFIA': Role.MAFIA, 'DOCTOR': Role.DOCTOR,
                'DETECTIVE': Role.DETECTIVE, 'CIVILIAN': Role.CIVILIAN,
            };
            const gmRoles = new Map<string, Role>();
            for (const [addr, roleStr] of Object.entries(data.roles as Record<string, string>)) {
                const role = roleMap[roleStr];
                if (role) gmRoles.set(addr.toLowerCase(), role);
            }
            if (gmRoles.size === 0) return;

            setRevealedRoles(prev => {
                const merged = new Map(prev);
                for (const [addr, role] of gmRoles) {
                    if (!merged.has(addr) || merged.get(addr) === Role.UNKNOWN) merged.set(addr, role);
                }
                return merged;
            });

            setGameState(prev => ({
                ...prev,
                players: prev.players.map(p => {
                    const gmRole = gmRoles.get(p.address.toLowerCase());
                    if (gmRole && p.role === Role.UNKNOWN) return { ...p, role: gmRole };
                    return p;
                })
            }));
        } catch (e) {
            console.error("[RoleReveal] Failed to fetch GM roles:", e);
        }
    }, [currentRoomId, refs, setGameState, allRolesKnown]);

    // === ROLE REVEAL TRIGGER (on phase → ENDED) ===
    React.useEffect(() => {
        if (gameState.phase !== GamePhase.ENDED || roleRevealStartedRef.current) return;
        if (!refs.publicClientRef.current) return;
        roleRevealStartedRef.current = true;

        // Snapshot roomId
        const rid = currentRoomId || roomIdRef.current;
        if (rid) sessionStorage.setItem('gameOver_roomId', rid.toString());

        // Start reveal process
        const startReveal = async () => {
            if (isRevealingRef.current) return;
            isRevealingRef.current = true;
            setIsRevealingRoles(true);

            if (isTestMode) {
                const roles = new Map<string, Role>();
                playersRef.current.forEach(p => roles.set(p.address.toLowerCase(), p.role));
                setRevealedRoles(roles);
                isRevealingRef.current = false;
                setIsRevealingRoles(false);
                return;
            }

            try {
                await fetchOnChainRoles();
            } catch (e) {
                console.error("[RoleReveal] Initial reveal failed:", e);
            } finally {
                isRevealingRef.current = false;
                setIsRevealingRoles(false);
            }
        };

        // Delayed start — avoid setState during parent render
        const t0 = setTimeout(startReveal, 500);

        // GM roles with backoff
        const t1 = setTimeout(() => fetchGMRoles(), 1000);
        const t2 = setTimeout(() => fetchGMRoles(), 4000);
        const t3 = setTimeout(() => fetchGMRoles(), 10000);
        const t4 = setTimeout(() => fetchGMRoles(), 18000);

        // Reveal timeout (30s → show "Unknown")
        const tTimeout = setTimeout(() => setRevealTimedOut(true), 30000);

        // Winner reconciliation: ALWAYS scan chain logs 3s after phase→ENDED,
        // regardless of whether a proactive path already set a winner. Any
        // mismatch between the local guess and the contract's GameEnded event
        // gets corrected here — this is why different players used to see
        // different results when an AutoWin path raced the real event and
        // set winner from a stale GM response. Chain is the only truth.
        const tWinner = setTimeout(async () => {
            const pClient = refs.publicClientRef.current;
            if (!pClient || !rid) return;
            try {
                const currentBlock = await pClient.getBlockNumber();
                const chunkSize = 999n;
                const totalLookback = 2000n;
                const earliestBlock = currentBlock > totalLookback ? currentBlock - totalLookback : 0n;
                const { parseEventLogs } = await import('viem');
                const roomIdTopic = pad(toHex(rid), { size: 32 });
                let allParsed: any[] = [];
                for (let toBlock = currentBlock; toBlock > earliestBlock; ) {
                    const fromBlock = toBlock - chunkSize > earliestBlock ? toBlock - chunkSize : earliestBlock;
                    const logs = await pClient.getLogs({ address: refs.contractAddressRef.current, topics: [null, roomIdTopic], fromBlock, toBlock } as any);
                    allParsed = allParsed.concat(parseEventLogs({ abi: MAFIA_ABI as any, logs }));
                    toBlock = fromBlock - 1n;
                }
                for (let i = allParsed.length - 1; i >= 0; i--) {
                    const log = allParsed[i] as any;
                    if (log.eventName === 'GameEnded') {
                        const wc = (log.args?.winCondition as string) || '';
                        const resolved = parseWinCondition(wc, refs.playersRef.current);
                        setGameState(prev => {
                            if (prev.winner && prev.winner !== resolved) {
                                console.warn(`[WinnerReconcile] Overriding ${prev.winner} → ${resolved} (chain: "${wc}")`);
                            } else {
                                console.log(`[WinnerReconcile] Resolved: ${resolved}`);
                            }
                            return { ...prev, phase: GamePhase.ENDED, winner: resolved };
                        });
                        return;
                    }
                }
            } catch (e) {
                console.warn('[WinnerReconcile] Failed:', e);
            }
        }, 3000);

        // Subscribe to WS roles-revealed push for instant updates
        const unsubWs = gmWs.on('roles-revealed', (_data: unknown) => {
            // Roles were revealed on-chain by GM — fetch them immediately
            fetchOnChainRoles();
            fetchGMRoles();
        });

        // Polling loop: 3s always (WS roles-revealed provides instant path,
        // polling is the reliable fallback — keep it fast for role reveal)
        let pollCount = 0;
        pollIntervalRef.current = setInterval(async () => {
            pollCount++;
            if (pollCount > 100 || allRolesKnown()) {
                if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
                return;
            }
            await Promise.all([fetchOnChainRoles(), fetchGMRoles()]);
            if (allRolesKnown()) {
                if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
            }
        }, 3_000);

        return () => {
            clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
            clearTimeout(tTimeout); clearTimeout(tWinner);
            unsubWs();
            if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
        };
    }, [gameState.phase, refs, currentRoomId, isTestMode, fetchOnChainRoles, fetchGMRoles, allRolesKnown]);

    return {
        endGameZK,
        triggerAutoWinCheck,
        // Role reveal state (consumed by GameOver)
        revealedRoles,
        onChainRoles,
        isRevealingRoles,
        revealTimedOut,
        fetchOnChainRoles,
        fetchGMRoles,
    };
}

export type EndGame = ReturnType<typeof useEndGame>;
