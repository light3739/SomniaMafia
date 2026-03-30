/**
 * useShuffleActions — Shuffle phase on-chain actions.
 *
 * Handles:
 * - startGame (host only)
 * - commitDeck (hash commitment)
 * - revealDeck (reveal with salt)
 * - shareKeysToAll (batch key distribution)
 */
import { useCallback } from 'react';
import { MAFIA_ABI } from '../../contracts/config';
import type { GameRefs } from './useGameRefs';
import type { TransactionEngine } from './useTransactionEngine';
import type { LogEntry } from '../../types';

interface ShuffleDeps {
    refs: GameRefs;
    txEngine: TransactionEngine;
    setIsTxPending: (v: boolean) => void;
    addLog: (message: string, type?: LogEntry['type']) => void;
}

export function useShuffleActions(deps: ShuffleDeps) {
    const { refs, txEngine, setIsTxPending, addLog } = deps;

    // === START GAME ===
    const startGameOnChain = useCallback(async () => {
        const pClient = refs.publicClientRef.current;
        const targetChain = refs.runtimeChainRef.current;
        const myAddr = refs.addressRef.current;
        const roomId = refs.currentRoomIdRef.current;

        if (!roomId || !pClient || !myAddr || !targetChain) return;
        setIsTxPending(true);
        try {
            let gasLimit = 14_500_000n;
            const { client: activeWalletClient, account: activeAccount } = await deps.txEngine.getSmartGasConfig({
                functionName: 'startGame',
                args: [roomId],
                account: myAddr as `0x${string}`,
            }).then(async gasConfig => {
                // We need the wallet client separately for startGame (uses main wallet)
                // Re-import wallet manager through refs isn't ideal, but startGame always uses main wallet
                return { client: null as any, account: myAddr as `0x${string}` };
            }).catch(() => ({ client: null as any, account: myAddr as `0x${string}` }));

            // startGame always uses main wallet, so we need to handle it specially
            // Use the sendGameTransaction with useSessionKey=false
            const hash = await txEngine.sendGameTransaction('startGame', [roomId], false);
            addLog("Starting game... Waiting for confirmation", "phase");
            
            const receipt = await pClient.waitForTransactionReceipt({ hash });
            if (receipt.status === 'reverted') throw new Error("startGame reverted");
            addLog("Game started!", "success");
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
        } finally {
            setIsTxPending(false);
        }
    }, [refs, txEngine, setIsTxPending, addLog]);

    // === COMMIT DECK ===
    const commitDeckOnChain = useCallback(async (deckHash: string): Promise<`0x${string}` | undefined> => {
        const roomId = refs.currentRoomIdRef.current;
        const pClient = refs.publicClientRef.current;
        if (!roomId || !pClient) return undefined;
        setIsTxPending(true);
        try {
            let hash: `0x${string}`;
            try {
                hash = await txEngine.sendGameTransaction('commitDeck', [roomId, deckHash]);
            } catch (e: any) {
                console.warn("[commitDeck] Session key attempt failed, retrying with main wallet...", e.shortMessage || e.message);
                hash = await txEngine.sendGameTransaction('commitDeck', [roomId, deckHash], false);
            }

            addLog("Deck hash committed! Waiting for confirmation...", "success");
            txEngine.applyOptimisticUpdate({ hasDeckCommitted: true });

            // CRITICAL: Wait for commit to be confirmed before returning
            try {
                const receipt = await pClient.waitForTransactionReceipt({ hash });
                if (receipt?.status === 'reverted') {
                    console.error(`[commitDeck] ❌ TX reverted on-chain! Block: ${receipt.blockNumber}, Hash: ${hash}`);
                    const roomData = await pClient.readContract({
                        address: refs.contractAddressRef.current,
                        abi: MAFIA_ABI,
                        functionName: 'getRoom',
                        args: [roomId],
                    }) as any;
                    console.error("[commitDeck] Current room state for diagnosis:", roomData);

                    txEngine.applyOptimisticUpdate({ hasDeckCommitted: false });
                    addLog("Commit reverted on-chain!", "danger");
                    throw new Error("commitDeck reverted");
                }
                console.log(`[commitDeck] ✅ Confirmed in block ${receipt?.blockNumber}`);
            } catch (receiptErr) {
                console.error("[commitDeck] Receipt wait failed:", receiptErr);
                txEngine.applyOptimisticUpdate({ hasDeckCommitted: false });
                throw receiptErr;
            }

            setIsTxPending(false);
            return hash;
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
            throw e;
        }
    }, [refs, txEngine, setIsTxPending, addLog]);

    // === REVEAL DECK ===
    const revealDeckOnChain = useCallback(async (deck: string[], salt: string) => {
        const roomId = refs.currentRoomIdRef.current;
        const pClient = refs.publicClientRef.current;
        if (!roomId || !pClient) return;
        const cleanSalt = salt.startsWith('0x') ? salt.slice(2) : salt;
        setIsTxPending(true);
        try {
            const hash = await txEngine.sendGameTransaction('revealDeck', [roomId, deck, cleanSalt]);
            addLog("Deck revealed! Waiting for confirmation...", "success");
            
            const receipt = await pClient.waitForTransactionReceipt({ hash });
            if (receipt.status === 'reverted') {
                console.error(`[revealDeck] ❌ TX reverted on-chain! Hash: ${hash}`);
                addLog("Reveal reverted on-chain!", "danger");
                throw new Error("revealDeck reverted");
            }
            console.log(`[revealDeck] ✅ Confirmed in block ${receipt.blockNumber}`);
            setIsTxPending(false);
            return hash;
        } catch (e: any) {
            addLog(e.shortMessage || e.message, "danger");
            setIsTxPending(false);
            throw e;
        }
    }, [refs, txEngine, setIsTxPending, addLog]);

    // === SHARE KEYS TO ALL ===
    const shareKeysToAllOnChain = useCallback(async (recipients: string[], encryptedKeys: string[]) => {
        const roomId = refs.currentRoomIdRef.current;
        if (!roomId) return;
        setIsTxPending(true);
        try {
            const hash = await txEngine.sendGameTransaction('shareKeysToAll', [
                roomId,
                recipients,
                encryptedKeys.map(k => k as `0x${string}`)
            ]);
            addLog(`Keys shared to ${recipients.length} players! Waiting for confirmation...`, "info");
            
            const pClient = refs.publicClientRef.current;
            if (pClient) {
                const receipt = await pClient.waitForTransactionReceipt({ hash });
                if (receipt.status === 'reverted') throw new Error("shareKeysToAll reverted");
            }
            addLog("Keys confirmed on-chain!", "success");
        } catch (e: any) {
            const errMsg = (e.message || '').toLowerCase() + (e.shortMessage || '').toLowerCase();
            if (errMsg.includes('alreadyshared') || errMsg.includes('keysalreadyshared')) {
                console.log("[shareKeysToAll] Keys already shared on-chain.");
                return;
            }
            addLog(e.shortMessage || e.message, "danger");
            throw e;
        } finally {
            setIsTxPending(false);
        }
    }, [refs, txEngine, setIsTxPending, addLog]);

    return {
        startGameOnChain,
        commitDeckOnChain,
        revealDeckOnChain,
        shareKeysToAllOnChain,
    };
}

export type ShuffleActions = ReturnType<typeof useShuffleActions>;
