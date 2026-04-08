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
import { createNewSession, markSessionRegistered } from '../../services/sessionKeyService';
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

            const { sessionAddress, privateKey: sessionPrivKey } = createNewSession(account as `0x${string}`, newRoomId, targetChain.id);
            const sessionAccount = privateKeyToAccount(sessionPrivKey);
            const pubKeyHex = sessionAccount.publicKey;

            const eciesKp = await loadOrCreateKeypair(newRoomId.toString(), account);
            refs.eciesPrivKeyRef.current = eciesKp.privateKey;

            let tournamentPasswordHash = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
            if (params.password) {
                tournamentPasswordHash = keccak256(stringToHex(params.password));
            }

            const isNative = params.paymentToken === '0x0000000000000000000000000000000000000000';
            const buyInUnits = parseEther(params.buyIn);
            const initialPrizeUnits = parseEther(params.initialPrize);
            const sessionFeeUnits = wallet.LOBBY_FUNDING_VALUE;

            let value = wallet.LOBBY_FUNDING_VALUE;
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
                markSessionRegistered();
                const logs = parseEventLogs({ abi: MAFIA_ABI, eventName: 'RoomCreated', logs: receipt.logs });
                if (logs.length > 0) {
                    const roomId = (logs[0] as any).args.roomId;
                    localStorage.setItem('currentRoomId', roomId.toString());
                    sessionStorage.setItem('currentRoomId', roomId.toString());
                    setCurrentRoomId(roomId);
                    addLog(`Tournament and Room #${roomId} created!`, 'success');

                    try {
                        // ECIES pubkey registration is handled by WaitingRoom on mount.
                        // Only do password sync here (if needed).
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
    };
}

export type Tournaments = ReturnType<typeof useTournaments>;
