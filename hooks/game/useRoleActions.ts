/**
 * useRoleActions — Role commit, confirm, decrypt, sync.
 *
 * Handles:
 * - commitRole / confirmRole / commitAndConfirmRole
 * - decryptMyRoleFromGM (ECIES decryption)
 * - fetchMyRoleFromGM (poll + retry)
 * - syncSecretWithServer (for ZK proof server-side)
 * - syncRoleCommitToGM (TX hash sync)
 */
import { useCallback, useRef } from 'react';
import { privateKeyToAccount } from 'viem/accounts';
import { MAFIA_ABI, GM_SERVER_URL } from '../../contracts/config';
import { loadSession } from '../../services/sessionKeyService';
import { loadOrCreateKeypair, eciesDecrypt, type EciesEncrypted } from '../../services/eciesService';
import { buildRevealSecretMessage, buildRoleSyncMessage } from '../../services/signingSchema';
import { signRequest } from '../../services/requestSigning';
import { SignatureBuilder } from '../../services/SignatureBuilder';
import { Role, GameState, GamePhase } from '../../types';
import type { GameRefs } from './useGameRefs';
import type { WalletManager } from './useWalletManager';
import type { TransactionEngine } from './useTransactionEngine';
import type { GameDataSync } from './useGameDataSync';
import type { LogEntry } from '../../types';
import type { Player } from '../../types';
import React from 'react';

interface RoleDeps {
    refs: GameRefs;
    wallet: WalletManager;
    txEngine: TransactionEngine;
    dataSync: GameDataSync;
    myPlayer: Player | undefined;
    setIsTxPending: (v: boolean) => void;
    setGameState: React.Dispatch<React.SetStateAction<GameState>>;
    addLog: (message: string, type?: LogEntry['type']) => void;
}

export function useRoleActions(deps: RoleDeps) {
    const { refs, wallet, txEngine, dataSync, myPlayer, setIsTxPending, setGameState, addLog } = deps;

    // === SYNC SECRET WITH SERVER ===
    const syncInProgressRef = useRef(false);
    const lastSyncKeyRef = useRef<string>('');

    const syncSecretWithServer = useCallback(async (roomId: string, playerAddress: string, role: number, salt: string) => {
        const syncKey = `${roomId}:${playerAddress.toLowerCase()}:${role}:${salt}`;
        if (lastSyncKeyRef.current === syncKey) {
            console.log('[SyncSecret] Already synced this exact data, skipping.');
            return;
        }

        if (syncInProgressRef.current) {
            console.log('[SyncSecret] Another sync in progress, skipping.');
            return;
        }
        syncInProgressRef.current = true;

        const MAX_RETRIES = 2;
        let activeWalletClient: any = null;
        try {
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    const message = buildRevealSecretMessage({
                        roomId,
                        role,
                        salt,
                        chainId: refs.runtimeChainRef.current.id,
                    });
                    let signature: `0x${string}`;
                    let signerAddress: string = playerAddress;
                    let sessionKeyAddress: string | undefined;

                    const session = loadSession();
                    if (session && session.registeredOnChain && Date.now() < session.expiresAt &&
                        session.mainWallet.toLowerCase() === playerAddress.toLowerCase()) {
                        const sessionAccount = privateKeyToAccount(session.privateKey);
                        signature = await sessionAccount.signMessage({ message });
                        signerAddress = playerAddress;
                        sessionKeyAddress = sessionAccount.address;
                        console.log('[SyncSecret] Signed with session key (no popup)');
                    } else {
                        try {
                            if (!activeWalletClient) {
                                const walletResult = await wallet.getActiveWalletClient();
                                activeWalletClient = walletResult.client;
                            }
                            signature = await activeWalletClient.signMessage({ message });
                            console.log('[SyncSecret] Signed with main wallet');
                        } catch (walletErr) {
                            console.warn('[SyncSecret] No wallet available, skipping server sync');
                            return;
                        }
                    }

                    const { ShuffleService } = await import('../../services/shuffleService');
                    const commitment = await ShuffleService.createRoleCommitHashAsync(role, salt);

                    const res = await fetch('/api/game/reveal-secret', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            roomId,
                            address: playerAddress,
                            role,
                            salt,
                            commitment,
                            signature,
                            sessionKeyAddress,
                            chainId: refs.runtimeChainRef.current.id,
                        })
                    });
                    if (!res.ok) throw new Error(`Server responded ${res.status}`);
                    console.log(`[Status] Secret synced with server DB (attempt ${attempt}).`);
                    lastSyncKeyRef.current = syncKey;
                    try {
                        localStorage.setItem(`secret_synced_${roomId}_${playerAddress.toLowerCase()}`, 'true');
                        localStorage.removeItem(`pending_sync_${roomId}_${playerAddress.toLowerCase()}`);
                    } catch (_) { }
                    return;
                } catch (err) {
                    console.warn(`[SyncSecret] Attempt ${attempt}/${MAX_RETRIES} failed:`, err);
                    if (attempt < MAX_RETRIES) {
                        await new Promise(r => setTimeout(r, 1500 * attempt));
                    } else {
                        console.error('[SyncSecret] All retries exhausted. Secret NOT synced with server!');
                        try {
                            localStorage.setItem(`pending_sync_${roomId}_${playerAddress.toLowerCase()}`, JSON.stringify({ role, salt }));
                        } catch (_) { }
                    }
                }
            }
        } finally {
            syncInProgressRef.current = false;
        }
    }, [refs, wallet]);

    // === SYNC ROLE COMMIT TO GM ===
    const roleCommitSyncInProgressRef = useRef<Set<string>>(new Set());

    const syncRoleCommitToGM = useCallback(async (
        roomId: bigint,
        playerAddress: string,
        txHash: `0x${string}`
    ) => {
        const key = `${roomId.toString()}:${playerAddress.toLowerCase()}:${txHash.toLowerCase()}`;
        if (roleCommitSyncInProgressRef.current.has(key)) return;
        roleCommitSyncInProgressRef.current.add(key);

        const MAX_RETRIES = 2;
        let activeWalletClient: any = null;
        try {
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    if (!activeWalletClient) {
                        const walletResult = await wallet.getActiveWalletClient();
                        activeWalletClient = walletResult.client;
                    }

                    const signed = await signRequest({
                        address: playerAddress,
                        roomId: Number(roomId),
                        walletClient: activeWalletClient,
                        buildMessage: ({ nonce, timestamp }) => buildRoleSyncMessage({
                            roomId: roomId.toString(),
                            txHash,
                            nonce,
                            timestamp,
                            chainId: refs.runtimeChainRef.current.id,
                        }),
                    });

                    /* 
                    // [Obsolete] GM Server no longer exposes /role-commit-sync. Kept for reference.
                    const res = await fetch(`${GM_SERVER_URL}/role-commit-sync`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            roomId: roomId.toString(),
                            playerAddress,
                            txHash,
                            signature: signed.signature,
                            signerAddress: signed.signerAddress,
                            nonce: signed.nonce,
                            timestamp: signed.timestamp,
                            chainId: refs.runtimeChainRef.current.id.toString(),
                        }),
                    });

                    if (!res.ok) throw new Error(`GM sync failed: ${res.status}`);
                    console.log(`[RoleCommitSync] Synced tx ${txHash} to GM cache`);
                    */
                    return;
                } catch (err) {
                    if (attempt < MAX_RETRIES) {
                        await new Promise(r => setTimeout(r, 1200 * attempt));
                    }
                }
            }
        } finally {
            roleCommitSyncInProgressRef.current.delete(key);
        }
    }, [refs, wallet]);

    // === DECRYPT ROLE FROM GM (ECIES) ===
    const decryptMyRoleFromGM = useCallback(async (
        encrypted: EciesEncrypted
    ): Promise<number | null> => {
        const roomId = refs.currentRoomIdRef.current;
        const myAddr = refs.addressRef.current;
        let privKey = refs.eciesPrivKeyRef.current;

        if (!privKey && roomId && myAddr) {
            try {
                const { privateKey } = await loadOrCreateKeypair(roomId.toString(), myAddr);
                privKey = privateKey;
                refs.eciesPrivKeyRef.current = privKey;
                console.log('[ECIES] Private key restored from localStorage');
            } catch (e) {
                console.error('[ECIES] Failed to restore keypair:', e);
                return null;
            }
        }

        if (!privKey) {
            console.error('[ECIES] No private key available for decryption');
            return null;
        }

        try {
            const plaintext = await eciesDecrypt(encrypted, privKey);
            const text = plaintext.trim().toUpperCase();
            const roleStringMap: Record<string, number> = {
                'MAFIA': 1, 'DOCTOR': 2, 'DETECTIVE': 3, 'CIVILIAN': 4, 'CITIZEN': 4
            };
            const roleNum = roleStringMap[text] ?? parseInt(text, 10);

            if (isNaN(roleNum) || roleNum < 1 || roleNum > 4) {
                console.error('[ECIES] Decrypted value is not a valid role:', plaintext);
                return null;
            }
            console.log('[ECIES] Role decrypted successfully:', text, '->', roleNum);
            return roleNum;
        } catch (e: any) {
            if (e instanceof DOMException && e.name === 'OperationError') return null;
            console.error('[ECIES] Decryption failed:', e);
            return null;
        }
    }, [refs]);

    // === FETCH MY ROLE FROM GM ===
    const fetchMyRoleFromGM = useCallback(async () => {
        const roomId = refs.currentRoomIdRef.current;
        const myAddr = refs.addressRef.current;
        const targetChain = refs.runtimeChainRef.current;
        if (!myAddr || !roomId) return;
        if (refs.roleFetchedRef.current) return;
        refs.roleFetchedRef.current = true;

        const tryFetch = async (): Promise<void> => {
            try {
                const { client: activeWalletClient } = await wallet.getActiveWalletClient();
                const signed = await signRequest({
                    address: myAddr,
                    roomId: Number(roomId),
                    buildMessage: ({ nonce, timestamp }) =>
                        new SignatureBuilder('my-role', String(targetChain.id), String(roomId))
                            .withAddress(myAddr)
                            .withModern(nonce, timestamp)
                            .build(),
                });

                const params = new URLSearchParams({
                    playerAddress: myAddr,
                    signature: signed.signature,
                    signerAddress: signed.signerAddress,
                    nonce: signed.nonce,
                    timestamp: String(signed.timestamp),
                    chainId: String(targetChain.id),
                });

                const res = await fetch(
                    `${GM_SERVER_URL}/my-role/${roomId}?${params}`
                );

                if (res.status === 202) {
                    console.log('[MyRole] SRA keys not ready, will retry on WS push or 4s timeout...');
                    refs.roleFetchedRef.current = false;

                    // Subscribe to WS role-ready push for instant retry
                    const { gmWs } = await import('../../services/gmWebSocket');
                    let wsUnsub: (() => void) | null = null;
                    const timer = setTimeout(tryFetch, 4000);
                    wsUnsub = gmWs.on('role-ready', (data: unknown) => {
                        const d = data as { playerAddress?: string } | undefined;
                        if (d?.playerAddress?.toLowerCase() === myAddr.toLowerCase()) {
                            clearTimeout(timer);
                            wsUnsub?.();
                            tryFetch();
                        }
                    });
                    return;
                }

                if (!res.ok) {
                    console.error('[MyRole] GM responded', res.status);
                    refs.roleFetchedRef.current = false;
                    return;
                }

                const { encrypted } = await res.json();
                const roleNum = await decryptMyRoleFromGM(encrypted);
                if (!roleNum) {
                    refs.roleFetchedRef.current = false;
                    return;
                }

                const roleEnumMap: Record<number, Role> = {
                    1: Role.MAFIA, 2: Role.DOCTOR, 3: Role.DETECTIVE, 4: Role.CIVILIAN
                };
                const myRole = roleEnumMap[roleNum] ?? Role.UNKNOWN;

                localStorage.setItem(
                    `my_role_${roomId}_${myAddr.toLowerCase()}`,
                    myRole
                );

                setGameState(prev => ({
                    ...prev,
                    players: prev.players.map(p =>
                        p.address.toLowerCase() === myAddr.toLowerCase()
                            ? { ...p, role: myRole }
                            : p
                    ),
                }));

                addLog(`Your role: ${myRole}`, 'success');
                console.log(`[MyRole] ✅ Role set: ${myRole}`);
            } catch (e) {
                console.error('[MyRole] fetchMyRoleFromGM failed:', e);
                refs.roleFetchedRef.current = false;
            }
        };

        await tryFetch();
    }, [refs, wallet, decryptMyRoleFromGM, setGameState, addLog]);

    // === COMMIT ROLE ===
    const commitRoleOnChain = useCallback(async (role: number, salt: string) => {
        const roomId = refs.currentRoomIdRef.current;
        const myAddr = refs.addressRef.current;
        const pClient = refs.publicClientRef.current;
        if (!roomId || !pClient) return;

        const existingSalt = myAddr ? localStorage.getItem(`role_salt_${roomId}_${myAddr.toLowerCase()}`) : null;
        let saltToUse = salt;
        let shouldCommitOnChain = !existingSalt;

        if (existingSalt) {
            saltToUse = existingSalt;
            console.log("Role already committed locally, will attempt server sync.");
        }

        setIsTxPending(true);
        try {
            if (shouldCommitOnChain) {
                try {
                    const { ShuffleService } = await import('../../services/shuffleService');
                    const roleHash = await ShuffleService.createRoleCommitHashAsync(role, saltToUse);
                    const txHash = await txEngine.sendGameTransaction('commitRole', [roomId, roleHash]);
                    addLog("Role committed!", "success");
                    await pClient.waitForTransactionReceipt({ hash: txHash });
                    if (myAddr) {
                        syncRoleCommitToGM(roomId, myAddr, txHash)
                            .catch(err => console.warn('[commitRole] GM role-commit sync failed (non-blocking):', err));
                    }
                    if (myAddr) {
                        localStorage.setItem(`role_salt_${roomId}_${myAddr.toLowerCase()}`, saltToUse);
                    }
                } catch (txErr: any) {
                    if (txErr.message?.includes("AlreadyCommitted") || txErr.message?.includes("AlreadyConfirmed")) {
                        console.log("Role already on-chain, proceeding to server sync.");
                    } else {
                        throw txErr;
                    }
                }
            }

            let roleEnumStr = "";
            if (role === 1) roleEnumStr = Role.MAFIA;
            else if (role === 2) roleEnumStr = Role.DOCTOR;
            else if (role === 3) roleEnumStr = Role.DETECTIVE;
            else if (role === 4) roleEnumStr = Role.CIVILIAN;

            if (roleEnumStr && myAddr) {
                console.log(`[GameContext] Persisting role ${roleEnumStr} for ${myAddr.toLowerCase()}`);
                localStorage.setItem(`my_role_${roomId}_${myAddr.toLowerCase()}`, roleEnumStr);
            }

            if (myAddr) {
                syncSecretWithServer(roomId.toString(), myAddr, role, saltToUse)
                    .catch(err => console.warn('[commitRole] Server sync failed (non-blocking):', err));
            }

            await dataSync.refreshPlayersList(roomId);
            setIsTxPending(false);
        } catch (e: any) {
            addLog(e.shortMessage || "Role commit failed", "danger");
            setIsTxPending(false);
            throw e;
        }
    }, [refs, txEngine, dataSync, syncSecretWithServer, syncRoleCommitToGM, setIsTxPending, addLog]);

    // === CONFIRM ROLE ===
    const confirmRoleOnChain = useCallback(async () => {
        const roomId = refs.currentRoomIdRef.current;
        const pClient = refs.publicClientRef.current;
        if (!roomId || !pClient) return;
        setIsTxPending(true);
        try {
            const hash = await txEngine.sendGameTransaction('confirmRole', [roomId]);
            addLog("Confirming role on-chain...", "info");
            txEngine.applyOptimisticUpdate({ hasConfirmedRole: true });
            
            const receipt = await pClient.waitForTransactionReceipt({ hash });
            if (receipt.status === 'reverted') {
                txEngine.applyOptimisticUpdate({ hasConfirmedRole: false });
                throw new Error("confirmRole reverted");
            }
            addLog("Role confirmed.", "success");
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            txEngine.applyOptimisticUpdate({ hasConfirmedRole: false });
        } finally {
            setIsTxPending(false);
        }
    }, [refs, txEngine, setIsTxPending, addLog]);

    // === COMMIT AND CONFIRM ROLE (atomic) ===
    const commitAndConfirmRoleOnChain = useCallback(async (role: number, salt: string) => {
        const roomId = refs.currentRoomIdRef.current;
        const myAddr = refs.addressRef.current;
        const pClient = refs.publicClientRef.current;
        if (!roomId || !pClient) return;

        const savedSalt = myAddr ? localStorage.getItem(`role_salt_${roomId.toString()}_${myAddr.toLowerCase()}`) : null;
        let saltToUse = salt;

        const isConfirmedOnChain = myPlayer?.hasConfirmedRole;

        if (savedSalt) {
            saltToUse = savedSalt;
            console.log("Role already committed locally.");
        }

        let roleEnumStr = "";
        if (role === 1) roleEnumStr = Role.MAFIA;
        else if (role === 2) roleEnumStr = Role.DOCTOR;
        else if (role === 3) roleEnumStr = Role.DETECTIVE;
        else if (role === 4) roleEnumStr = Role.CIVILIAN;

        if (roleEnumStr && myAddr) {
            localStorage.setItem(`my_role_${roomId.toString()}_${myAddr.toLowerCase()}`, roleEnumStr);
        }

        setIsTxPending(true);
        try {
            if (isConfirmedOnChain) {
                console.log("Role already confirmed on-chain. Skipping transaction, syncing DB only.");
            } else if (savedSalt && !isConfirmedOnChain) {
                console.log("Found local salt but not confirmed on-chain. Attempting `confirmRole` fallback...");
                try {
                    const hash = await txEngine.sendGameTransaction('confirmRole', [roomId]);
                    addLog("Role confirmed (fallback). Waiting...", "success");
                    const receipt = await pClient.waitForTransactionReceipt({ hash });
                    if (receipt.status === 'reverted') throw new Error("Fallback confirmRole reverted");
                    txEngine.applyOptimisticUpdate({ hasConfirmedRole: true });
                } catch (err: any) {
                    console.warn("Fallback confirmRole failed — retrying full commitAndConfirmRole...", err.shortMessage || err.message);
                    try {
                        const { ShuffleService } = await import('../../services/shuffleService');
                        const roleHash = await ShuffleService.createRoleCommitHashAsync(role, savedSalt);
                        const retryHash = await txEngine.sendGameTransaction('commitAndConfirmRole', [roomId, roleHash]);
                        addLog("Role committed & confirmed (recovery). Waiting...", "success");
                        const receipt = await pClient.waitForTransactionReceipt({ hash: retryHash });
                        if (receipt.status === 'reverted') throw new Error("Recovery commit-confirm reverted");
                        txEngine.applyOptimisticUpdate({ hasConfirmedRole: true });
                    } catch (retryErr: any) {
                        console.error("Full commitAndConfirmRole retry also failed:", retryErr);
                        if (myAddr) localStorage.removeItem(`role_salt_${roomId.toString()}_${myAddr.toLowerCase()}`);
                        throw retryErr;
                    }
                }
            } else {
                // Normal flow
                try {
                    const { ShuffleService } = await import('../../services/shuffleService');
                    const roleHash = await ShuffleService.createRoleCommitHashAsync(role, saltToUse);
                    const txHash = await txEngine.sendGameTransaction('commitAndConfirmRole', [roomId, roleHash]);
                    addLog("Role committed & confirmed on-chain! Waiting...", "success");
                    const receipt = await pClient.waitForTransactionReceipt({ hash: txHash });
                    if (receipt.status === 'reverted') throw new Error("Normal commit-confirm reverted");
                    if (myAddr) localStorage.setItem(`role_salt_${roomId.toString()}_${myAddr.toLowerCase()}`, saltToUse);
                    txEngine.applyOptimisticUpdate({ hasConfirmedRole: true });
                } catch (txErr: any) {
                    const errMsg = (txErr.message || "").toLowerCase();
                    const shortMsg = (txErr.shortMessage || "").toLowerCase();

                    if (errMsg.includes("rolealreadycommitted") || shortMsg.includes("rolealreadycommitted") ||
                        errMsg.includes("alreadycommitted") || shortMsg.includes("alreadycommitted")) {

                        console.warn("Role already committed. Checking confirmation status...");

                        const flags = await pClient.readContract({
                            address: refs.contractAddressRef.current,
                            abi: MAFIA_ABI,
                            functionName: 'getPlayerFlags',
                            args: [roomId, myAddr as `0x${string}`],
                        }) as unknown as any[];

                        const isConfirmed = flags?.[1];

                        if (!isConfirmed) {
                            console.log("Role committed but NOT confirmed. Calling confirmRole...");
                            addLog("Role previously committed. Confirming now...", "info");
                            const confirmHash = await txEngine.sendGameTransaction('confirmRole', [roomId]);
                            const receipt = await pClient.waitForTransactionReceipt({ hash: confirmHash });
                            if (receipt.status === 'reverted') throw new Error("Retry confirm reverted");
                            txEngine.applyOptimisticUpdate({ hasConfirmedRole: true });
                            addLog("Role confirmed separately!", "success");
                        } else {
                            console.log("Role already confirmed on-chain.");
                        }
                    } else if (errMsg.includes("alreadyrevealed") || shortMsg.includes("alreadyrevealed") ||
                        errMsg.includes("alreadyconfirmed") || shortMsg.includes("alreadyconfirmed")) {
                        console.log("Role already confirmed on-chain.");
                    } else {
                        throw txErr;
                    }
                }
            }

            if (myAddr) {
                // Sync with server only after we are 100% sure it's on chain
                syncSecretWithServer(roomId.toString(), myAddr, role, saltToUse)
                    .catch(err => console.warn('[commitAndConfirm] Server sync failed (non-blocking):', err));
            }

        } catch (e: any) {
            console.error("Confirmation error:", e);
            const errMsg = (e.message || '').toLowerCase() + (e.shortMessage || '').toLowerCase();
            if (errMsg.includes('alreadycommitted') || errMsg.includes('alreadyconfirmed') || errMsg.includes('alreadyrevealed')) {
                console.log("[commitAndConfirmRole] Role already processed on-chain. Not re-throwing.");
                if (refs.addressRef.current) {
                    syncSecretWithServer(roomId.toString(), refs.addressRef.current, role, saltToUse)
                        .catch(_ => { });
                }
                return;
            }
            addLog(e.shortMessage || "Confirmation failed", "danger");
            throw e;
        } finally {
            setIsTxPending(false);
        }
    }, [refs, txEngine, dataSync, myPlayer, syncSecretWithServer, setIsTxPending, addLog]);

    return {
        syncSecretWithServer,
        decryptMyRoleFromGM,
        fetchMyRoleFromGM,
        commitRoleOnChain,
        confirmRoleOnChain,
        commitAndConfirmRoleOnChain,
    };
}

export type RoleActions = ReturnType<typeof useRoleActions>;
