/**
 * useVotingActions — Day voting phase on-chain actions.
 *
 * Handles:
 * - startVoting
 * - vote (with optimistic UI + vote map)
 * - finalizeVoting
 */
import { useCallback } from 'react';
import type { GameRefs } from './useGameRefs';
import type { TransactionEngine } from './useTransactionEngine';
import type { LogEntry } from '../../types';
import React from 'react';
import { decodeEventLog } from 'viem';
import { MAFIA_ABI } from '../../contracts/config';

interface VotingDeps {
    refs: GameRefs;
    txEngine: TransactionEngine;
    setIsTxPending: (v: boolean) => void;
    setVoteMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    addLog: (message: string, type?: LogEntry['type']) => void;
}

export function useVotingActions(deps: VotingDeps) {
    const { refs, txEngine, setIsTxPending, setVoteMap, addLog } = deps;

    const startVotingOnChain = useCallback(async () => {
        const roomId = refs.currentRoomIdRef.current;
        if (!roomId) return;
        setIsTxPending(true);
        try {
            const hash = await txEngine.sendGameTransaction('startVoting', [roomId]);
            const pClient = refs.publicClientRef.current;
            if (pClient) {
                const receipt = await pClient.waitForTransactionReceipt({ hash });
                if (receipt.status === 'reverted') throw new Error("startVoting reverted");
            }
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
        } finally {
            setIsTxPending(false);
        }
    }, [refs, txEngine, setIsTxPending, addLog]);

    const voteOnChain = useCallback(async (targetAddress: string) => {
        const roomId = refs.currentRoomIdRef.current;
        const myAddr = refs.addressRef.current;
        const players = refs.playersRef.current;
        if (!roomId || !myAddr) return;
        setIsTxPending(true);
        try {
            const hash = await txEngine.sendGameTransaction('vote', [roomId, targetAddress]);
            const targetPlayer = players.find(p => p.address.toLowerCase() === targetAddress.toLowerCase());
            const targetName = targetPlayer ? (targetPlayer.name || `Player ${players.indexOf(targetPlayer) + 1}`) : targetAddress.slice(0, 6);

            txEngine.applyOptimisticUpdate({ hasVoted: true });
            setVoteMap(prev => ({ ...prev, [myAddr.toLowerCase()]: targetAddress.toLowerCase() }));

            const pClient = refs.publicClientRef.current;
            if (pClient) {
                const receipt = await pClient.waitForTransactionReceipt({ hash });
                if (receipt.status === 'reverted') throw new Error("vote reverted");
            }
        } catch (e: any) {
            txEngine.applyOptimisticUpdate({ hasVoted: false });
            setVoteMap(prev => {
                const next = { ...prev };
                delete next[myAddr.toLowerCase()];
                return next;
            });
            addLog(e.shortMessage || e.message, "danger");
        } finally {
            setIsTxPending(false);
        }
    }, [refs, txEngine, setIsTxPending, setVoteMap, addLog]);

    const finalizeVotingOnChain = useCallback(async () => {
        const roomId = refs.currentRoomIdRef.current;
        const pClient = refs.publicClientRef.current;
        if (!roomId || !pClient) return;
        
        setIsTxPending(true);
        try {
            console.log(`[Voting API] Finalizing voting for room ${roomId}...`);
            const hash = await txEngine.sendGameTransaction('finalizeVoting', [roomId]);
            addLog("Voting finalized! Waiting for confirmation...", "success");
            const receipt = await pClient.waitForTransactionReceipt({ hash });
            addLog("Voting results confirmed on-chain.", "success");

            // Optimistic parsing of elimination result from the receipt
            for (const log of receipt.logs) {
                try {
                    const decoded = decodeEventLog({
                        abi: MAFIA_ABI,
                        data: log.data,
                        topics: log.topics,
                    });
                    if (decoded.eventName === 'PlayerEliminated') {
                        const args = decoded.args as any;
                        const player = args.player as string;
                        const reason = args.reason as string;
                        if (reason === 'forfeit' || reason === 'left') {
                            addLog(`${player.slice(0, 6)} ${reason === 'left' ? 'left the room' : 'forfeited the game'}.`, "warning");
                        } else {
                            addLog(`${player.slice(0, 6)} was eliminated.`, "danger");
                        }
                    }
                } catch (e) {
                    // Not our event or parse error, skip
                }
            }
        } catch (e: any) {
            console.error('[Finalize Voting Failed]', e);
            addLog(e.shortMessage || e.message, "danger");
            throw e;
        } finally {
            setIsTxPending(false);
        }
    }, [refs, txEngine, setIsTxPending, addLog]);

    return {
        startVotingOnChain,
        voteOnChain,
        finalizeVotingOnChain,
    };
}

export type VotingActions = ReturnType<typeof useVotingActions>;
