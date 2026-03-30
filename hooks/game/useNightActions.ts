/**
 * useNightActions — Night phase actions via GM server.
 *
 * Handles:
 * - submitNightAction (kill/heal/check) with retry
 * - skipNightAction
 * - fetchInvestigationProof
 * - getInvestigationResult
 * - forcePhaseTimeout (with GM night resolution interception)
 */
import { useCallback } from 'react';
import { GamePhase, Role } from '../../types';
import { signRequest } from '../../services/requestSigning';
import { buildNightActionMessage, buildResolveNightMessage, buildInvestigateMessage } from '../../services/signingSchema';
import * as GM from '../../services/gmService';
import type { GameRefs } from './useGameRefs';
import type { WalletManager } from './useWalletManager';
import type { TransactionEngine } from './useTransactionEngine';
import type { GameDataSync } from './useGameDataSync';
import type { LogEntry } from '../../types';

interface NightDeps {
    refs: GameRefs;
    wallet: WalletManager;
    txEngine: TransactionEngine;
    dataSync: GameDataSync;
    isTestMode: boolean;
    setIsTxPending: (v: boolean) => void;
    addLog: (message: string, type?: LogEntry['type']) => void;
}

export function useNightActions(deps: NightDeps) {
    const { refs, wallet, txEngine, dataSync, isTestMode, setIsTxPending, addLog } = deps;

    // === SUBMIT NIGHT ACTION ===
    const submitNightActionToGM = useCallback(async (
        actionType: 'kill' | 'heal' | 'check',
        targetAddress: string,
        explicitDayCount?: number
    ) => {
        const roomId = refs.currentRoomIdRef.current;
        const myAddr = refs.addressRef.current;
        const targetChain = refs.runtimeChainRef.current;
        const players = refs.playersRef.current;
        const resolvedDayCount = explicitDayCount ?? refs.dayCountRef.current;
        if (!roomId || !myAddr || !targetChain) return;

        setIsTxPending(true);
        try {
            const { client: activeWalletClient } = await wallet.getActiveWalletClient();
            console.log(`[GM API] Submitting night action: ${actionType} on ${targetAddress} by ${myAddr}`);

            const savedRole = localStorage.getItem(`my_role_${roomId}_${myAddr.toLowerCase()}`);
            const myPlayer = players.find(p => p.address.toLowerCase() === myAddr.toLowerCase());
            const myRoleStr = savedRole || myPlayer?.role;

            let myRoleNum: number | undefined;
            if (myRoleStr === Role.MAFIA) myRoleNum = 1;
            else if (myRoleStr === Role.DOCTOR) myRoleNum = 2;
            else if (myRoleStr === Role.DETECTIVE) myRoleNum = 3;
            else if (myRoleStr === Role.CIVILIAN) myRoleNum = 4;

            const savedSalt = localStorage.getItem(`role_salt_${roomId}_${myAddr.toLowerCase()}`);

            if (myRoleNum === undefined) {
                console.error(`[NightAction] Missing role data. RoleNum=${myRoleNum}, savedRole=${savedRole}`);
                addLog("Missing role. Please ensure your role is decrypted.", "danger");
                setIsTxPending(false);
                throw new Error("Missing role for night action submission");
            }

            if (!savedSalt) {
                console.warn(`[NightAction] Salt missing for ${myAddr}, proceeding anyway as GM knows our role.`);
            }

            // Retry with backoff
            let response: Response | undefined;
            let lastError = '';
            for (let attempt = 0; attempt < 3; attempt++) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 12000);
                try {
                    const signed = await signRequest({
                        address: myAddr,
                        roomId: Number(roomId),
                        walletClient: activeWalletClient,
                        buildMessage: ({ nonce, timestamp }) => buildNightActionMessage({
                            roomId: roomId.toString(),
                            actionType,
                            targetAddress,
                            dayCount: resolvedDayCount,
                            nonce,
                            timestamp,
                            chainId: targetChain.id,
                        }),
                    });

                    console.log(`[GM API] Attempt ${attempt + 1}: signature fresh, sending payload`);

                    response = await fetch('/api/game/night-action', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            roomId: roomId.toString(),
                            playerAddress: myAddr,
                            actionType,
                            targetAddress,
                            dayCount: resolvedDayCount,
                            signature: signed.signature,
                            signerAddress: signed.signerAddress,
                            role: myRoleNum,
                            salt: savedSalt,
                            nonce: signed.nonce,
                            timestamp: signed.timestamp,
                            chainId: targetChain.id,
                        }),
                        signal: controller.signal,
                    });

                    if (response.ok) break;

                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                    lastError = errorData.error || 'Failed to submit night action';

                    if (response.status !== 403 && response.status < 500) {
                        throw new Error(lastError);
                    }

                    if (attempt < 2) {
                        console.warn(`[GM API] Attempt ${attempt + 1} failed (${response.status}: ${lastError}). Retrying...`);
                        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
                    }
                } catch (e: any) {
                    lastError = e.message || 'Network error';
                    if (attempt < 2) {
                        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
                    } else {
                        throw e;
                    }
                } finally {
                    clearTimeout(timeoutId);
                }
            }

            if (!response || !response.ok) {
                throw new Error(lastError || 'Failed after multiple attempts');
            }

            txEngine.applyOptimisticUpdate({ hasNightCommitted: true });
            addLog(`Submitted ${actionType} action!`, "success");
        } catch (e: any) {
            console.error('[Night Action Failed]', e);
            addLog(e.shortMessage || e.message, "danger");
            throw e;
        } finally {
            setIsTxPending(false);
        }
    }, [refs, wallet, txEngine, setIsTxPending, addLog]);

    // === SKIP NIGHT ACTION ===
    const skipNightActionToGM = useCallback(async () => {
        const roomId = refs.currentRoomIdRef.current;
        const myAddr = refs.addressRef.current;
        const targetChain = refs.runtimeChainRef.current;
        if (!roomId || !myAddr || !targetChain) return;
        setIsTxPending(true);
        try {
            const { client: activeWalletClient } = await wallet.getActiveWalletClient();
            await GM.skipNightActionToGM({
                roomId: roomId.toString(),
                address: myAddr,
                walletClient: activeWalletClient,
                chainId: targetChain.id,
                dayCount: refs.dayCountRef.current
            });
            txEngine.applyOptimisticUpdate({ hasNightCommitted: true });
            addLog("Turn skipped.", "info");
        } catch (e: any) {
            addLog(e.message || "Skip failed", "danger");
            throw e;
        } finally {
            setIsTxPending(false);
        }
    }, [refs, wallet, txEngine, setIsTxPending, addLog]);

    // === FETCH INVESTIGATION PROOF ===
    const fetchInvestigationProofFromGM = useCallback(async (targetAddress: string) => {
        const roomId = refs.currentRoomIdRef.current;
        const myAddr = refs.addressRef.current;
        const targetChain = refs.runtimeChainRef.current;
        if (!roomId || !myAddr || !targetChain) return null;
        try {
            const { client: activeWalletClient } = await wallet.getActiveWalletClient();
            return await GM.fetchInvestigationProofFromGM({
                roomId: roomId.toString(),
                detectiveAddress: myAddr,
                targetAddress,
                walletClient: activeWalletClient,
                chainId: targetChain.id,
                dayCount: refs.dayCountRef.current
            });
        } catch (e) {
            console.error('[GM API] Failed to fetch investigation proof:', e);
            return null;
        }
    }, [refs, wallet]);

    // === GET INVESTIGATION RESULT ===
    const getInvestigationResultOnChain = useCallback(async (detective: string, target: string) => {
        const roomId = refs.currentRoomIdRef.current;
        const targetChain = refs.runtimeChainRef.current;
        if (isTestMode) {
            if (target.toLowerCase().includes('4444')) {
                return { role: Role.MAFIA, isMafia: true };
            }
            return { role: Role.CIVILIAN, isMafia: false };
        }
        if (!roomId) return { role: Role.UNKNOWN, isMafia: false };

        try {
            const { client: activeWalletClient } = await wallet.getActiveWalletClient();
            console.log(`[Investigation API] Fetching result for ${detective} -> ${target}`);

            const signed = await signRequest({
                address: detective,
                roomId: Number(roomId),
                walletClient: activeWalletClient,
                buildMessage: ({ nonce, timestamp }) => buildInvestigateMessage({
                    roomId: roomId.toString(),
                    dayCount: refs.dayCountRef.current,
                    targetAddress: target,
                    nonce,
                    timestamp,
                    chainId: targetChain.id,
                }),
            });

            console.log(`[Investigation API] Signed with ${signed.signerAddress.toLowerCase() === detective.toLowerCase() ? 'main wallet' : 'session key'}: ${signed.signerAddress}`);

            const response = await fetch('/api/game/investigate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId: roomId.toString(),
                    detectiveAddress: detective,
                    targetAddress: target,
                    dayCount: refs.dayCountRef.current,
                    signature: signed.signature,
                    signerAddress: signed.signerAddress,
                    nonce: signed.nonce,
                    timestamp: signed.timestamp,
                    chainId: targetChain.id.toString(),
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch investigation result');
            }

            const data = await response.json();
            const rawRole = Number(data.role);
            let role: Role;
            switch (rawRole) {
                case 1: role = Role.MAFIA; break;
                case 2: role = Role.DOCTOR; break;
                case 3: role = Role.DETECTIVE; break;
                case 4: role = Role.CIVILIAN; break;
                default:
                    console.warn(`[Investigation API] Unexpected raw role: ${rawRole}`);
                    role = Role.UNKNOWN;
            }

            return { role, isMafia: data.isMafia };
        } catch (e: any) {
            console.error('[Investigation API Failed]', e);
            addLog(`Investigation failed: ${e.message}`, "danger");
            return { role: Role.UNKNOWN, isMafia: false };
        }
    }, [refs, wallet, isTestMode, addLog]);

    // === FORCE PHASE TIMEOUT ===
    const forcePhaseTimeoutOnChain = useCallback(async () => {
        const roomId = refs.currentRoomIdRef.current;
        const myAddr = refs.addressRef.current;
        const targetChain = refs.runtimeChainRef.current;
        const pClient = refs.publicClientRef.current;
        if (!roomId || !pClient) return;
        setIsTxPending(true);

        try {
            // GM Server Night Resolution interception
            if (refs.phaseRef.current === GamePhase.NIGHT) {
                console.log(`[GM API] Resolving night manually...`);
                if (!myAddr) throw new Error('No wallet for signing');

                const { client: activeWalletClient } = await wallet.getActiveWalletClient();
                const signed = await signRequest({
                    address: myAddr,
                    roomId: Number(roomId),
                    walletClient: activeWalletClient,
                    buildMessage: ({ nonce, timestamp }) => buildResolveNightMessage({
                        roomId: roomId.toString(),
                        nonce,
                        timestamp,
                        chainId: targetChain.id,
                    }),
                });

                const res = await fetch('/api/game/resolve-night', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        roomId: roomId.toString(),
                        playerAddress: myAddr,
                        signature: signed.signature,
                        callerAddress: signed.signerAddress,
                        nonce: signed.nonce,
                        timestamp: signed.timestamp,
                        chainId: targetChain.id,
                    })
                });

                if (!res.ok) {
                    const err = await res.json();
                    const gmError = String(err?.error || 'GM resolve failed');

                    if (
                        gmError.includes('No night actions submitted') ||
                        gmError.includes('No valid night actions from alive players') ||
                        gmError.includes('gas required') ||
                        gmError.includes('insufficient funds') ||
                        gmError.includes('Execution reverted')
                    ) {
                        console.warn('[GM API] No actions or GM TX failed, falling back to on-chain forcePhaseTimeout');
                        addLog('GM cannot resolve night. Forcing timeout on-chain...', 'warning');

                        const fallbackHash = await txEngine.sendGameTransaction('forcePhaseTimeout', [roomId]);
                        await pClient.waitForTransactionReceipt({ hash: fallbackHash });
                        await dataSync.refreshPlayersList(roomId);
                        return;
                    }

                    if (gmError.includes('Night already resolved')) {
                        await dataSync.refreshPlayersList(roomId);
                        return;
                    }

                    throw new Error(gmError);
                }

                addLog("Night resolved by GM!", "success");
                await dataSync.refreshPlayersList(roomId);
                return;
            }

            // Normal on-chain timeout for other phases
            addLog("Forcing phase timeout on-chain...", "info");
            const hash = await txEngine.sendGameTransaction('forcePhaseTimeout', [roomId]);
            await pClient.waitForTransactionReceipt({ hash });
            addLog("Phase timeout forced on-chain!", "success");
            await dataSync.refreshPlayersList(roomId);
        } catch (e: any) {
            console.error('[Force Phase Timeout Failed]', e);
            addLog(e.shortMessage || e.message, "danger");
        } finally {
            setIsTxPending(false);
        }
    }, [refs, wallet, txEngine, dataSync, setIsTxPending, addLog]);

    return {
        submitNightActionToGM,
        skipNightActionToGM,
        fetchInvestigationProofFromGM,
        getInvestigationResultOnChain,
        forcePhaseTimeoutOnChain,
    };
}

export type NightActions = ReturnType<typeof useNightActions>;
