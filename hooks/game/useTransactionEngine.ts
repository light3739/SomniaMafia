/**
 * useTransactionEngine — Core transaction infrastructure.
 *
 * Handles:
 * - Smart gas estimation (EIP-1559 + fallback)
 * - Session key vs main wallet transaction routing
 * - TX queue to serialize session key nonces
 * - Nonce retry logic
 * - Optimistic UI updates
 * - Background receipt confirmation
 */
import { useCallback, useRef } from 'react';
import { parseEther, formatEther } from 'viem';
import { toast } from 'sonner';
import { loadSession } from '../../services/sessionKeyService';
import { MAFIA_ABI } from '../../contracts/config';
import { GamePhase } from '../../types';
import type { GameRefs } from './useGameRefs';
import type { WalletManager } from './useWalletManager';
import type { GameState, LogEntry } from '../../types';
import React from 'react';

// Phases during which transaction toasts are silenced — they distract during
// active play. Lobby/shuffle/reveal/end keep the feedback so users still see
// confirm prompts before and after a match.
const IN_GAME_PHASES = new Set<GamePhase>([
    GamePhase.DAY,
    GamePhase.VOTING,
    GamePhase.NIGHT,
]);

interface TxEngineDeps {
    refs: GameRefs;
    wallet: WalletManager;
    isTestMode: boolean;
    setIsTxPending: (v: boolean) => void;
    setIsTxConfirming: (v: boolean) => void;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    addLog: (message: string, type?: LogEntry['type']) => void;
    refreshPlayersList: (roomId: bigint) => Promise<any>;
}

export function useTransactionEngine(deps: TxEngineDeps) {
    const { refs, wallet, isTestMode, setIsTxPending, setIsTxConfirming, setGameState, addLog, refreshPlayersList } = deps;

    // Phase-gated wrappers for sonner toasts. During active gameplay we keep
    // the cursor/UI clean — errors still go to the game log via addLog so the
    // player can scroll back if needed.
    const isInActiveGame = () => IN_GAME_PHASES.has(refs.phaseRef.current);
    const txToast = {
        loading: (msg: string, opts?: any) => { if (!isInActiveGame()) toast.loading(msg, opts); },
        success: (msg: string, opts?: any) => { if (!isInActiveGame()) toast.success(msg, opts); },
        error:   (msg: string, opts?: any) => { if (!isInActiveGame()) toast.error(msg, opts); },
        warning: (msg: string, opts?: any) => { if (!isInActiveGame()) toast.warning(msg, opts); },
    };

    // === TX QUEUE: Serialize session key transactions ===
    const txQueueRef = useRef<Promise<any>>(Promise.resolve());
    const enqueueTx = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
        const result = txQueueRef.current.then(fn, fn);
        txQueueRef.current = result.catch(() => { });
        return result;
    }, []);

    // === SMART GAS CONFIG ===
    const getSmartGasConfig = useCallback(async (params: {
        functionName: string;
        args: any[];
        account: `0x${string}`;
        value?: bigint;
        nonce?: number;
    }) => {
        const { functionName, args, account, value, nonce } = params;
        const pClient = refs.publicClientRef.current;
        const targetChain = refs.runtimeChainRef.current;
        if (!pClient) throw new Error("PublicClient missing");

        const isSomnia = Number(targetChain.id) === 50312 || Number(targetChain.id) === 5031;

        // 1. Fetch Fee Data
        let feeConfig: any = {};
        let currentGasPrice = isSomnia ? 6_000_000_000n : 30_000_000_000n;

        try {
            const feeData = await pClient.estimateFeesPerGas();
            if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                feeConfig = {
                    maxFeePerGas: (feeData.maxFeePerGas * 130n) / 100n,
                    maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas * 130n) / 100n,
                    type: 2 as any
                };
                currentGasPrice = feeData.maxFeePerGas;
            } else {
                const price = await pClient.getGasPrice();
                if (price > 0n) currentGasPrice = price;
                feeConfig = {
                    gasPrice: (currentGasPrice * 130n) / 100n,
                    type: 0 as any
                };
            }
        } catch (e) {
            console.warn('[Gas] Fee fetch failed, using fallback:', e);
            feeConfig = { gasPrice: (currentGasPrice * 130n) / 100n, type: 0 as any };
        }

        // 2. Known Gas Limits
        const KNOWN_LIMITS: Record<string, bigint> = {
            commitDeck: 1_500_000n,
            commitAndConfirmRole: 1_000_000n,
            commitNightAction: 1_000_000n,
            revealNightAction: 2_000_000n,
            vote: 1_500_000n,
            startVoting: 4_000_000n,
            finalizeVoting: 8_000_000n,
            forcePhaseTimeout: 8_000_000n,
            createTournamentAndRoom: 15_000_000n,
            createTournament: 6_000_000n,
            joinTournament: 1_500_000n,
            distributeMafiaPrizes: 12_000_000n,
            cancelTournament: 2_000_000n,
            endGameZK: 75_000_000n, // Groth16 bn256Pairing precompile costs ~69M gas on Somnia
        };

        const knownLimit = KNOWN_LIMITS[functionName];

        // 3. Estimate Gas
        let calculatedGas = 1_000_000n;
        try {
            const gasEstimate = await pClient.estimateContractGas({
                address: refs.contractAddressRef.current,
                abi: MAFIA_ABI,
                functionName: functionName as any,
                args: args as any,
                account,
                value,
                nonce
            } as any);

            const heavyOps = ['createTournamentAndRoom', 'finalizeVoting', 'endGameZK', 'distributeMafiaPrizes', 'createTournament'];
            const bufferMultiplier = isSomnia && heavyOps.includes(functionName) ? 200n : 150n;
            calculatedGas = (gasEstimate * bufferMultiplier) / 100n;

            if (knownLimit && calculatedGas < knownLimit) {
                calculatedGas = knownLimit;
            }
        } catch (e: any) {
            const errMsg = e?.message || e?.toString() || '';
            const isContractRevert = errMsg.includes('reverted') || errMsg.includes('revert') ||
                errMsg.includes('execution reverted') || errMsg.includes('Error:');

            if (isContractRevert) {
                console.error(`[Gas] Contract revert during estimation for ${functionName}`, e);
                throw e;
            }

            console.warn(`[Gas] Estimation failed for ${functionName}, using fallback:`, e?.message || e);
            calculatedGas = knownLimit || (isSomnia ? 28_000_000n : 10_000_000n);
        }

        // 4. Safety Cap (higher for ZK proof verification which needs expensive bn256 pairing)
        const safetyCap = functionName === 'endGameZK' ? 160_000_000n : 29_000_000n;
        if (calculatedGas > safetyCap) calculatedGas = safetyCap;

        return { gas: calculatedGas, ...feeConfig };
    }, [refs]);

    // === SEND GAME TRANSACTION ===
    const sendGameTransaction = useCallback(async (
        functionName: string,
        args: any[],
        useSessionKeyParam: boolean = true
    ): Promise<`0x${string}`> => {
        const txStartTime = performance.now();
        const session = loadSession();
        const roomId = refs.currentRoomIdRef.current;

        let canUseSession = useSessionKeyParam &&
            session &&
            session.registeredOnChain &&
            Date.now() < session.expiresAt &&
            roomId !== null &&
            session.roomId === Number(roomId);

        // Balance check for heavy TXs — tiered thresholds per function
        const HEAVY_TX_MIN_BALANCE: Record<string, bigint> = {
            endGameZK: parseEther('0.85'),
            createTournamentAndRoom: parseEther('0.30'),
            distributeMafiaPrizes: parseEther('0.25'),
            finalizeVoting: parseEther('0.15'),
            forcePhaseTimeout: parseEther('0.15'),
            startVoting: parseEther('0.08'),
        };
        const minBalance = HEAVY_TX_MIN_BALANCE[functionName];
        if (canUseSession && session && refs.publicClientRef.current && minBalance) {
            try {
                const sessionBalance = await refs.publicClientRef.current.getBalance({
                    address: session.address as `0x${string}`
                });
                if (sessionBalance < minBalance) {
                    console.warn(`[Session TX] Session key balance low for ${functionName}: ${formatEther(sessionBalance)} < ${formatEther(minBalance)}. Falling back to main wallet.`);
                    txToast.warning('Session key low on gas — confirming with your wallet', { duration: 4000 });
                    canUseSession = false;
                }
            } catch (balErr) {
                console.warn('[Session TX] Failed to check balance:', balErr);
            }
        }

        // Test mode simulation
        if (isTestMode && ['commitNightAction', 'revealNightAction', 'commitRole'].includes(functionName)) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`;
        }

        const sessionClient = wallet.getSessionWalletClient();
        const { client: activeWalletClient, account: activeAccount } = await wallet.getActiveWalletClient();
        const accountToUse = (canUseSession && sessionClient) ? sessionClient.account!.address : activeAccount;

        const gasConfig = await getSmartGasConfig({
            functionName,
            args,
            account: accountToUse,
        });

        const calculatedGas = gasConfig.gas;

        // === SESSION KEY PATH ===
        if (canUseSession && sessionClient) {
            console.log(`[Session TX] Sending ${functionName} with gas ${calculatedGas}...`);
            txToast.loading(`Submitting ${functionName}...`, { id: `tx-${functionName}` });

            const attemptSend = async (retryCount: number = 0): Promise<`0x${string}`> => {
                const MAX_NONCE_RETRIES = 3;
                try {
                    const sendStart = performance.now();
                    const hash = await sessionClient.writeContract({
                        address: refs.contractAddressRef.current,
                        abi: MAFIA_ABI as any,
                        functionName: functionName as any,
                        args: args as any,
                        account: sessionClient.account!,
                        chain: refs.runtimeChainRef.current,
                        ...gasConfig
                    });
                    const sendTime = Math.round(performance.now() - sendStart);
                    const totalTime = Math.round(performance.now() - txStartTime);
                    console.log(`[Session TX] ✅ ${functionName} sent! Hash: ${hash} (send: ${sendTime}ms, total: ${totalTime}ms)`);
                    txToast.success(`${functionName} submitted`, { id: `tx-${functionName}`, duration: 3000 });
                    return hash;
                } catch (err: any) {
                    const errMsg = err.message || '';
                    if (err.message?.includes('reverted') || err.message?.includes('failed') || err.code === -32000) {
                        const revertMsg = err.shortMessage || err.message || "Unknown revert";
                        console.warn(`[Session TX] Contract revert: ${revertMsg}`, err);
                        txToast.error(`Transaction failed: ${revertMsg.slice(0, 80)}`, { id: `tx-${functionName}`, duration: 5000 });

                        if (canUseSession && session) {
                            try {
                                const pClient = refs.publicClientRef.current;
                                if (pClient) {
                                    const sessionData = await pClient.readContract({
                                        address: refs.contractAddressRef.current,
                                        abi: MAFIA_ABI,
                                        functionName: 'sessionKeys',
                                        args: [session.mainWallet as `0x${string}`],
                                    }).catch(() => null) as any;

                                    const onChainAddr = sessionData ? (Array.isArray(sessionData) ? sessionData[0] : sessionData.sessionAddress) : "0x0";

                                    if (String(onChainAddr).toLowerCase() !== session.address.toLowerCase()) {
                                        console.error("[Revert Diagnosis] CRITICAL: Session key is NOT registered or mismatched!");
                                    }
                                }
                            } catch (diagErr) {
                                console.warn("[Revert Diagnosis] State check failed:", diagErr);
                            }
                        }
                    }
                    if (retryCount < MAX_NONCE_RETRIES && (errMsg.includes('nonce too low') || errMsg.includes('Nonce provided') || errMsg.includes('underpriced'))) {
                        console.warn(`[Session TX] Nonce issue for ${functionName}. Retrying ${retryCount + 1}...`);
                        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                        return attemptSend(retryCount + 1);
                    }
                    console.error('[Session TX] Failed:', err.message || err);
                    txToast.error(`Transaction failed: ${(err.message || 'Unknown error').slice(0, 80)}`, { id: `tx-${functionName}`, duration: 5000 });
                    throw err;
                }
            };

            return enqueueTx(() => attemptSend(0));
        } else {
            // === MAIN WALLET PATH ===
            const totalTime = Math.round(performance.now() - txStartTime);
            console.log(`[Main Wallet TX] ${functionName} - requires signature | Gas: ${calculatedGas} (prep took ${totalTime}ms)`);
            txToast.loading(`Confirm ${functionName} in wallet...`, { id: `tx-${functionName}` });
            try {
                const hash = await activeWalletClient.writeContract({
                    address: refs.contractAddressRef.current,
                    abi: MAFIA_ABI,
                    functionName: functionName as any,
                    args: args as any,
                    account: activeAccount,
                    chain: refs.runtimeChainRef.current,
                    ...gasConfig
                });
                txToast.success(`${functionName} submitted`, { id: `tx-${functionName}`, duration: 3000 });
                return hash;
            } catch (err: any) {
                const msg = err?.shortMessage || err?.message || 'Transaction rejected';
                txToast.error(msg.slice(0, 120), { id: `tx-${functionName}`, duration: 5000 });
                throw err;
            }
        }
    }, [refs, wallet, isTestMode, getSmartGasConfig, enqueueTx]);

    // === BACKGROUND CONFIRMATION ===
    const confirmInBackground = useCallback((
        hash: `0x${string}`,
        functionName: string,
        onReverted?: () => void
    ) => {
        refs.pendingConfirmationsRef.current.add(hash);
        setIsTxConfirming(true);
        (async () => {
            try {
                const receipt = await refs.publicClientRef.current?.waitForTransactionReceipt({ hash });
                if (receipt?.status === 'reverted') {
                    console.error(`[Optimistic] ❌ ${functionName} REVERTED! Rolling back...`);
                    addLog(`${functionName} reverted on-chain. Reverting...`, 'danger');
                    txToast.error(`${functionName} reverted on-chain`, { duration: 5000 });
                    onReverted?.();
                } else {
                    console.log(`[Optimistic] ✅ ${functionName} confirmed (block ${receipt?.blockNumber})`);
                }
                const roomId = refs.currentRoomIdRef.current;
                if (roomId) { await refreshPlayersList(roomId); }
            } catch (err) {
                console.error(`[Optimistic] Receipt check failed for ${functionName}:`, err);
                onReverted?.();
                const roomId = refs.currentRoomIdRef.current;
                if (roomId) { await refreshPlayersList(roomId); }
            } finally {
                refs.pendingConfirmationsRef.current.delete(hash);
                if (refs.pendingConfirmationsRef.current.size === 0) { setIsTxConfirming(false); }
            }
        })();
    }, [refs, setIsTxConfirming, addLog, refreshPlayersList]);

    // === OPTIMISTIC UPDATE ===
    const applyOptimisticUpdate = useCallback((updates: Partial<{
        hasVoted: boolean;
        hasDeckCommitted: boolean;
        hasNightCommitted: boolean;
        hasNightRevealed: boolean;
        hasConfirmedRole: boolean;
    }>) => {
        if (!refs.addressRef.current) return;
        setGameState(prev => ({
            ...prev,
            players: prev.players.map(p =>
                p.address.toLowerCase() === refs.addressRef.current!.toLowerCase()
                    ? { ...p, ...updates }
                    : p
            )
        }));
    }, [refs, setGameState]);

    return {
        sendGameTransaction,
        getSmartGasConfig,
        confirmInBackground,
        applyOptimisticUpdate,
    };
}

export type TransactionEngine = ReturnType<typeof useTransactionEngine>;
