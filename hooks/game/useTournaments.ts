/**
 * useTournaments — Tournament on-chain actions.
 *
 * Handles:
 * - createTournament
 * - joinTournament
 * - createTournamentAndRoom (atomic)
 * - distributePrizes
 * - cancelTournament
 */
import { useCallback } from 'react';
import { parseEther, formatEther, parseEventLogs, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { MAFIA_ABI, GM_SERVER_URL } from '../../contracts/config';
import { generateKeyPair, stringToHex } from '../../services/cryptoUtils';
import { createNewSession, storeSession, markSessionRegistered } from '../../services/sessionKeyService';
import { loadOrCreateKeypair } from '../../services/eciesService';
import * as GM from '../../services/gmService';
import { checkAfkCooldown, formatCooldown } from '../../services/cooldownCheck';
import { toast } from 'sonner';
import type { GameRefs } from './useGameRefs';
import type { WalletManager } from './useWalletManager';
import type { TransactionEngine } from './useTransactionEngine';
import { GamePhase, type LogEntry } from '../../types';
import React from 'react';

interface TournamentDeps {
    refs: GameRefs;
    wallet: WalletManager;
    txEngine: TransactionEngine;
    setKeys: (keys: CryptoKeyPair | null) => void;
    setCurrentRoomId: (id: bigint | null) => void;
    setIsTxPending: (v: boolean) => void;
    setIsTxConfirming: (v: boolean) => void;
    addLog: (message: string, type?: LogEntry['type']) => void;
}

export function useTournaments(deps: TournamentDeps) {
    const { refs, wallet, txEngine, setKeys, setCurrentRoomId, setIsTxPending, setIsTxConfirming, addLog } = deps;

    const createTournamentOnChain = useCallback(async (params: {
        name: string; buyIn: string; maxPlayers: number; playersPerTable: number;
        password?: string; paymentToken: `0x${string}`; initialPrize: string; nonce?: number;
    }): Promise<bigint | null> => {
        const pClient = refs.publicClientRef.current;
        const targetChain = refs.runtimeChainRef.current;
        if (!pClient || !targetChain) return null;
        try {
            setIsTxPending(true);
            const { client, account } = await wallet.getActiveWalletClient();

            // AFK cooldown preflight
            const callerAddr = (typeof account === 'string' ? account : (account as any)?.address) as `0x${string}` | undefined;
            if (callerAddr) {
                const cooldown = await checkAfkCooldown(pClient as any, refs.contractAddressRef.current, callerAddr.toLowerCase() as `0x${string}`);
                if (cooldown.blocked) {
                    toast.error(`AFK cooldown active. Try again in ${formatCooldown(cooldown.remaining)}.`, { duration: 6000 });
                    addLog(`Cannot create tournament: AFK cooldown ${formatCooldown(cooldown.remaining)}`, 'danger');
                    setIsTxPending(false);
                    return null;
                }
            }

            let passwordHash = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
            if (params.password) {
                passwordHash = keccak256(stringToHex(params.password));
            }

            const isNative = params.paymentToken === '0x0000000000000000000000000000000000000000';
            const buyInUnits = parseEther(params.buyIn);
            const initialPrizeUnits = parseEther(params.initialPrize);
            const sessionFeeUnits = wallet.LOBBY_FUNDING_VALUE;
            const value = isNative ? initialPrizeUnits : 0n;

            const gasConfig = await txEngine.getSmartGasConfig({
                functionName: 'createTournament',
                args: [params.name, buyInUnits, params.maxPlayers, params.playersPerTable, passwordHash, params.paymentToken, initialPrizeUnits, sessionFeeUnits],
                account, value, nonce: params.nonce
            });

            const hash = await client.writeContract({
                address: refs.contractAddressRef.current,
                abi: MAFIA_ABI,
                functionName: 'createTournament',
                args: [params.name, buyInUnits, params.maxPlayers, params.playersPerTable, passwordHash, params.paymentToken, initialPrizeUnits, sessionFeeUnits],
                account, value, chain: targetChain, ...gasConfig
            });

            addLog(`Tournament ${params.name} created!`, 'success');
            setIsTxConfirming(true);
            const receipt = await pClient.waitForTransactionReceipt({ hash });
            setIsTxConfirming(false);

            if (receipt) {
                const logs = parseEventLogs({ abi: MAFIA_ABI, eventName: 'TournamentCreated', logs: receipt.logs });
                if (logs.length > 0) return (logs[0] as any).args.tournamentId;
            }
            return null;
        } catch (error) {
            console.error('Failed to create tournament:', error);
            const msg = (error as any).message || 'Unknown error';
            addLog(`Creation failed: ${msg.slice(0, 60)}...`, 'danger');
            return null;
        } finally {
            setIsTxPending(false);
        }
    }, [refs, wallet, txEngine, setIsTxPending, setIsTxConfirming, addLog]);

    const joinTournamentOnChain = useCallback(async (tournamentId: bigint, password?: string, amount?: string, nonce?: number): Promise<boolean> => {
        const pClient = refs.publicClientRef.current;
        const targetChain = refs.runtimeChainRef.current;
        if (!pClient || !targetChain) return false;
        try {
            setIsTxPending(true);
            const { client, account } = await wallet.getActiveWalletClient();

            // AFK cooldown preflight
            const callerAddr = (typeof account === 'string' ? account : (account as any)?.address) as `0x${string}` | undefined;
            if (callerAddr) {
                const cooldown = await checkAfkCooldown(pClient as any, refs.contractAddressRef.current, callerAddr.toLowerCase() as `0x${string}`);
                if (cooldown.blocked) {
                    toast.error(`AFK cooldown active. Try again in ${formatCooldown(cooldown.remaining)}.`, { duration: 6000 });
                    addLog(`Cannot join tournament: AFK cooldown ${formatCooldown(cooldown.remaining)}`, 'danger');
                    setIsTxPending(false);
                    return false;
                }
            }

            const tournamentData = await pClient.readContract({
                address: refs.contractAddressRef.current,
                abi: MAFIA_ABI,
                functionName: 'getTournament',
                args: [tournamentId],
            }) as any;

            const buyIn = BigInt(tournamentData.buyIn || 0);
            const sessionFee = BigInt(tournamentData.sessionFee || 0);
            const isNative = tournamentData.paymentToken === '0x0000000000000000000000000000000000000000';
            const value = sessionFee + (isNative ? buyIn : 0n);

            console.log(`[JoinTournament] ID:${tournamentId} Value:${formatEther(value)} (BuyIn:${formatEther(buyIn)} Fee:${formatEther(sessionFee)})`);

            const gasConfig = await txEngine.getSmartGasConfig({
                functionName: 'joinTournament',
                args: [tournamentId, password || ""],
                account, value, nonce
            });

            const hash = await client.writeContract({
                address: refs.contractAddressRef.current,
                abi: MAFIA_ABI,
                functionName: 'joinTournament',
                args: [tournamentId, password || ""],
                account, value, chain: targetChain, ...gasConfig
            });

            addLog(`Joined tournament #${tournamentId}`, 'success');
            setIsTxConfirming(true);
            await pClient.waitForTransactionReceipt({ hash });
            setIsTxConfirming(false);
            return true;
        } catch (error) {
            console.error('Failed to join tournament:', error);
            const msg = (error as any).message || 'Unknown error';
            addLog(`Join failed: ${msg.slice(0, 60)}...`, 'danger');
            return false;
        } finally {
            setIsTxPending(false);
        }
    }, [refs, wallet, txEngine, setIsTxPending, setIsTxConfirming, addLog]);

    const createTournamentAndRoomOnChain = useCallback(async (params: {
        name: string; buyIn: string; maxPlayers: number; playersPerTable: number;
        password?: string; paymentToken: `0x${string}`; initialPrize: string;
        roomName: string; nickname: string; isPrivate: boolean; joinPassword?: string;
    }): Promise<boolean> => {
        const pClient = refs.publicClientRef.current;
        const targetChain = refs.runtimeChainRef.current;
        if (!pClient || !targetChain) return false;
        try {
            setIsTxPending(true);
            const { client, account } = await wallet.getActiveWalletClient();

            // AFK cooldown preflight
            const callerAddr = (typeof account === 'string' ? account : (account as any)?.address) as `0x${string}` | undefined;
            if (callerAddr) {
                const cooldown = await checkAfkCooldown(pClient as any, refs.contractAddressRef.current, callerAddr.toLowerCase() as `0x${string}`);
                if (cooldown.blocked) {
                    toast.error(`AFK cooldown active. Try again in ${formatCooldown(cooldown.remaining)}.`, { duration: 6000 });
                    addLog(`Cannot create tournament: AFK cooldown ${formatCooldown(cooldown.remaining)}`, 'danger');
                    setIsTxPending(false);
                    return false;
                }
            }

            const nextId = await pClient.readContract({
                address: refs.contractAddressRef.current,
                abi: MAFIA_ABI,
                functionName: 'nextRoomId',
            }) as bigint;
            const newRoomId = Number(nextId) + 1;

            const keyPair = await generateKeyPair();
            setKeys(keyPair);

            // Defer storeSession until we know the real on-chain roomId so the
            // localStorage row is keyed by the actual id (not the optimistic
            // newRoomId). Without this, GM.setRoomPassword below would fall
            // through to walletClient.signMessage because the session's roomId
            // wouldn't match the real one — and on Privy embedded that mounts
            // their buggy confirmation modal that throws React error #300.
            const { sessionAddress, privateKey: sessionPrivKey, session: newSessionObj } = createNewSession(account as `0x${string}`, newRoomId, targetChain.id, undefined, true);
            const sessionAccount = privateKeyToAccount(sessionPrivKey);
            const pubKeyHex = sessionAccount.publicKey;

            // ECIES keypair is created AFTER we know the real on-chain roomId
            // (parsed from the receipt below), so the localStorage entry is
            // keyed by the actual id rather than the optimistic newRoomId.

            let tournamentPasswordHash = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
            if (params.password) {
                tournamentPasswordHash = keccak256(stringToHex(params.password));
            }

            const isNative = params.paymentToken === '0x0000000000000000000000000000000000000000';
            const buyInUnits = parseEther(params.buyIn);
            const initialPrizeUnits = parseEther(params.initialPrize);
            const sessionFeeUnits = wallet.LOBBY_FUNDING_VALUE;

            // Fetch on-chain entry fee (non-refundable platform fee deducted inside createAndJoinRoomInternal)
            let entryFee = 0n;
            try {
                entryFee = await pClient.readContract({
                    address: refs.contractAddressRef.current,
                    abi: MAFIA_ABI,
                    functionName: 'getEntryFee',
                }) as bigint;
            } catch { /* entryFee stays 0 if getter unavailable */ }

            let value = wallet.LOBBY_FUNDING_VALUE + entryFee;
            if (isNative) {
                value += buyInUnits + initialPrizeUnits;
            }

            console.log(`[CreateTournamentAndRoom] Total Value: ${formatEther(value)} ${targetChain.nativeCurrency.symbol}`);

            const fnArgs = [
                params.name, buyInUnits, params.maxPlayers, params.playersPerTable,
                tournamentPasswordHash, params.paymentToken, initialPrizeUnits, sessionFeeUnits,
                params.roomName, params.nickname, pubKeyHex as any,
                sessionAddress as `0x${string}`, params.isPrivate, params.joinPassword || ""
            ];

            const gasConfig = await txEngine.getSmartGasConfig({
                functionName: 'createTournamentAndRoom',
                args: fnArgs,
                account, value,
            });

            const hash = await client.writeContract({
                address: refs.contractAddressRef.current,
                abi: MAFIA_ABI,
                functionName: 'createTournamentAndRoom',
                args: fnArgs,
                account, value, chain: targetChain, ...gasConfig
            });

            addLog(`Atomic creation initiated!`, 'info');
            setIsTxConfirming(true);
            const receipt = await pClient.waitForTransactionReceipt({ hash });
            setIsTxConfirming(false);

            if (receipt && receipt.status === 'success') {
                const logs = parseEventLogs({ abi: MAFIA_ABI, eventName: 'RoomCreated', logs: receipt.logs });
                if (logs.length > 0) {
                    const roomId = (logs[0] as any).args.roomId;
                    localStorage.setItem('currentRoomId', roomId.toString());
                    sessionStorage.setItem('currentRoomId', roomId.toString());

                    // Activate session under the canonical roomId. Must happen
                    // BEFORE the GM.setRoomPassword call below — that call uses
                    // signRequest which only picks up the session if its
                    // roomId matches. Otherwise it falls back to walletClient
                    // signMessage and (on Privy embedded) mounts the buggy
                    // confirmation modal that throws React error #300.
                    newSessionObj.roomId = Number(roomId);
                    newSessionObj.registeredOnChain = true;
                    storeSession(newSessionObj);
                    markSessionRegistered();

                    // Create ECIES keypair under the canonical roomId now that
                    // we know it. See createLobbyOnChain for the rationale on
                    // why we do this here rather than in WaitingRoom.
                    try {
                        const eciesKp = await loadOrCreateKeypair(roomId.toString(), account);
                        refs.eciesPrivKeyRef.current = eciesKp.privateKey;
                    } catch (e) {
                        console.warn('[CreateTournament] Failed to create ECIES keypair:', e);
                    }

                    setCurrentRoomId(roomId);
                    addLog(`Tournament and Room #${roomId} created!`, 'success');

                    // Register ECIES pubkey with GM. Fire-and-forget — signRequest
                    // uses the session key (no wallet popup). Done here so the
                    // canonical signer + walletClient is what GM sees, avoiding
                    // the wagmi/Privy race in WaitingRoom.
                    GM.registerEciesPubkey(roomId.toString(), account, client, targetChain.id)
                        .then(() => console.log('[CreateTournament] ECIES pubkey registered with GM ✅'))
                        .catch(e => console.warn('[CreateTournament] ECIES register failed (WaitingRoom may retry):', e));

                    try {
                        // Password sync (if needed).
                        const results = await Promise.allSettled([
                            params.isPrivate && params.joinPassword
                                ? GM.setRoomPassword({
                                    roomId: roomId.toString(),
                                    address: account,
                                    password: params.joinPassword,
                                    walletClient: client,
                                    chainId: targetChain.id
                                })
                                : Promise.resolve()
                        ]);

                        const failed = results.filter(r => r.status === 'rejected');
                        if (failed.length > 0) {
                            console.warn('[AtomicSync] Some GM sync steps failed:', failed);
                        }
                    } catch (syncErr: any) {
                        console.error('[AtomicSync] GM synchronization failed:', syncErr);
                    }

                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Failed atomic creation:', error);
            const msg = (error as any).message || 'Unknown error';
            addLog(`Atomic creation failed: ${msg.slice(0, 60)}...`, 'danger');
            return false;
        } finally {
            setIsTxPending(false);
        }
    }, [refs, wallet, txEngine, setKeys, setCurrentRoomId, setIsTxPending, setIsTxConfirming, addLog]);

    const distributePrizesOnChain = useCallback(async (roomId: bigint) => {
        const pClient = refs.publicClientRef.current;
        const targetChain = refs.runtimeChainRef.current;
        if (!pClient || !targetChain) return;
        try {
            // Pre-check: verify room is in ENDED phase on-chain before attempting distribution
            const roomData = await pClient.readContract({
                address: refs.contractAddressRef.current,
                abi: MAFIA_ABI,
                functionName: 'getRoom',
                args: [roomId],
            }) as any;
            const onChainPhase = Number(Array.isArray(roomData) ? roomData[3] : roomData.phase);
            if (onChainPhase !== GamePhase.ENDED) {
                addLog(`Cannot distribute prizes yet — game not finalized on-chain (phase: ${onChainPhase}). Wait for endGameZK to confirm.`, 'danger');
                return;
            }

            // Ask GM to reveal roles on-chain first (required for correct prize distribution)
            try {
                const chainId = targetChain.id || 50312;
                const revealRes = await fetch(`${GM_SERVER_URL}/reveal-roles/${roomId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chainId }),
                });
                const revealData = await revealRes.json();
                if (revealRes.ok) {
                    addLog('Roles revealed on-chain by GM', 'success');
                } else {
                    console.warn('[distributePrizes] Role reveal failed (may already be done):', revealData.error);
                }
            } catch (revealErr) {
                console.warn('[distributePrizes] Role reveal request failed (continuing):', revealErr);
            }

            setIsTxPending(true);
            const { client, account } = await wallet.getActiveWalletClient();
            const gasConfig = await txEngine.getSmartGasConfig({ functionName: 'distributeMafiaPrizes', args: [roomId], account });

            const hash = await client.writeContract({
                address: refs.contractAddressRef.current,
                abi: MAFIA_ABI,
                functionName: 'distributeMafiaPrizes',
                args: [roomId],
                account, chain: targetChain, ...gasConfig
            });

            addLog(`Prizes distributed for room #${roomId}`, 'success');
            setIsTxConfirming(true);
            await pClient.waitForTransactionReceipt({ hash });
            setIsTxConfirming(false);

            // Store tx hash for GameOver popup
            localStorage.setItem(`prize_tx_${roomId}`, hash);
        } catch (error) {
            console.error('Failed to distribute prizes:', error);
            const msg = (error as any).message || 'Unknown error';
            addLog(`Distribution failed: ${msg.slice(0, 60)}...`, 'danger');
        } finally {
            setIsTxPending(false);
        }
    }, [refs, wallet, txEngine, setIsTxPending, setIsTxConfirming, addLog]);

    /**
     * Leave a tournament you joined but never bound to a room. Dangling
     * participants (those who called joinTournament but never joined any of
     * the tournament's rooms) can exit through this path and recover their
     * buyIn + sessionFee gas reserve.
     *
     * Must be called from the main wallet: contract's leaveTournament uses
     * `msg.sender` to index the participant mapping, and a session key would
     * not match the main-wallet-keyed pendingRefunds (if the push refund fails
     * and gets queued).
     *
     * Not currently reachable through the standard UI — atomic
     * createTournamentAndRoomOnChain + joinTournamentAndRoom(...) paths always
     * bind to a room. This hook exists so power users who got dangling via
     * direct contract interaction can still unwind, and so any future
     * standalone-join UI has a companion exit path ready.
     */
    const leaveTournamentOnChain = useCallback(async (tournamentId: bigint): Promise<boolean> => {
        const pClient = refs.publicClientRef.current;
        const targetChain = refs.runtimeChainRef.current;
        if (!pClient || !targetChain) return false;
        try {
            setIsTxPending(true);
            const { client, account } = await wallet.getActiveWalletClient();
            const gasConfig = await txEngine.getSmartGasConfig({
                functionName: 'leaveTournament',
                args: [tournamentId],
                account,
            });

            const hash = await client.writeContract({
                address: refs.contractAddressRef.current,
                abi: MAFIA_ABI,
                functionName: 'leaveTournament',
                args: [tournamentId],
                account,
                chain: targetChain,
                ...gasConfig,
            });

            setIsTxConfirming(true);
            const receipt = await pClient.waitForTransactionReceipt({ hash });
            setIsTxConfirming(false);

            if (receipt.status === 'reverted') {
                addLog(`Leave tournament #${tournamentId} reverted`, 'danger');
                return false;
            }

            addLog(`Left tournament #${tournamentId} — refund issued`, 'success');
            return true;
        } catch (error: any) {
            console.error('Failed to leave tournament:', error);
            const msg = error?.shortMessage || error?.message || 'Unknown error';
            addLog(`Leave tournament failed: ${msg.slice(0, 80)}`, 'danger');
            return false;
        } finally {
            setIsTxPending(false);
        }
    }, [refs, wallet, txEngine, setIsTxPending, setIsTxConfirming, addLog]);

    const cancelTournamentOnChain = useCallback(async (tournamentId: bigint) => {
        const pClient = refs.publicClientRef.current;
        const targetChain = refs.runtimeChainRef.current;
        if (!pClient || !targetChain) return;
        try {
            setIsTxPending(true);
            const { client, account } = await wallet.getActiveWalletClient();
            const gasConfig = await txEngine.getSmartGasConfig({ functionName: 'cancelTournament', args: [tournamentId], account });

            const hash = await client.writeContract({
                address: refs.contractAddressRef.current,
                abi: MAFIA_ABI,
                functionName: 'cancelTournament',
                args: [tournamentId],
                account, chain: targetChain, ...gasConfig
            });

            addLog(`Tournament #${tournamentId} cancelled & refunded`, 'info');
            setIsTxConfirming(true);
            await pClient.waitForTransactionReceipt({ hash });
            setIsTxConfirming(false);
        } catch (error) {
            console.error('Failed to cancel tournament:', error);
            const msg = (error as any).message || 'Unknown error';
            addLog(`Cancellation failed: ${msg.slice(0, 60)}...`, 'danger');
        } finally {
            setIsTxPending(false);
        }
    }, [refs, wallet, txEngine, setIsTxPending, setIsTxConfirming, addLog]);

    return {
        createTournamentOnChain,
        joinTournamentOnChain,
        createTournamentAndRoomOnChain,
        distributePrizesOnChain,
        cancelTournamentOnChain,
        leaveTournamentOnChain,
    };
}

export type Tournaments = ReturnType<typeof useTournaments>;
