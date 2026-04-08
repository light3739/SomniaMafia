/**
 * useRefundClaims — Pull-based refund UI for stuck push refunds.
 *
 * Companion to the contract-side PR1 DoS fix. When a push refund from an AFK
 * kick, room-abort, cancelTournament, or leaveTournament fails to reach the
 * player wallet (e.g. a contract wallet with reverting receive(), or gas <
 * 30k fallback), the contract credits the amount to
 * LibStorage.pendingRefunds[user][token] and emits RefundQueued. Without a
 * frontend path to call RefundsFacet.claimRefund(token), those funds sit
 * invisibly in the diamond forever.
 *
 * This hook:
 *  - Polls getPendingRefund(user, address(0)) on mount and every 30s
 *  - Also checks after `trigger()` is called externally (e.g. after a known
 *    refund-generating event)
 *  - Exposes `pendingNative` and a `claim()` async that goes through the
 *    main wallet (session key can't be used — RefundsFacet.claimRefund reads
 *    msg.sender directly and the refund was credited to the main wallet)
 *
 * Only tracks native STT for now — ERC20 tournament payment tokens aren't
 * used yet, but the same pattern extends trivially via a `token` parameter.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { zeroAddress, formatEther } from 'viem';
import { MAFIA_ABI } from '../../contracts/config';
import type { GameRefs } from './useGameRefs';
import type { WalletManager } from './useWalletManager';

const POLL_INTERVAL_MS = 30_000;

interface RefundDeps {
    refs: GameRefs;
    wallet: WalletManager;
    addLog: (message: string, type?: 'info' | 'success' | 'danger') => void;
}

export function useRefundClaims(deps: RefundDeps) {
    const { refs, wallet, addLog } = deps;
    const [pendingNative, setPendingNative] = useState<bigint>(0n);
    const [isClaiming, setIsClaiming] = useState(false);
    const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastNotifiedAmountRef = useRef<bigint>(0n);

    // Read getPendingRefund from the diamond. Returns 0n on any failure so the
    // UI doesn't show phantom "you have refund" badges when RPC misbehaves.
    const fetchPending = useCallback(async (): Promise<bigint> => {
        const pc = refs.publicClientRef.current;
        const addr = refs.addressRef.current;
        const contract = refs.contractAddressRef.current;
        if (!pc || !addr || !contract) return 0n;

        try {
            const amount = (await pc.readContract({
                address: contract,
                abi: MAFIA_ABI,
                functionName: 'getPendingRefund',
                args: [addr, zeroAddress],
            })) as bigint;
            return amount;
        } catch (e: any) {
            // getPendingRefund may not exist on legacy deployments or RPC may be flaky.
            // Quietly return 0 — we'd rather miss a notification than spam errors.
            console.debug('[useRefundClaims] getPendingRefund failed:', e?.shortMessage || e?.message);
            return 0n;
        }
    }, [refs]);

    // Refresh pending amount, notify once per non-zero amount increase.
    const trigger = useCallback(async () => {
        const amount = await fetchPending();
        setPendingNative(prev => {
            if (prev !== amount) {
                return amount;
            }
            return prev;
        });

        if (amount > 0n && amount !== lastNotifiedAmountRef.current) {
            lastNotifiedAmountRef.current = amount;
            toast.info(
                `You have ${formatEther(amount)} STT waiting to be claimed. Open the refund panel to withdraw.`,
                { duration: 8000, id: 'pending-refund' },
            );
            addLog?.(`Pending refund: ${formatEther(amount)} STT`, 'info');
        }
        if (amount === 0n) {
            // Reset notification cursor so a new refund later re-notifies.
            lastNotifiedAmountRef.current = 0n;
        }
    }, [fetchPending, addLog]);

    // Claim via main wallet. RefundsFacet.claimRefund uses msg.sender as the
    // pendingRefunds key, so a session-key call wouldn't find the credited
    // amount (it's keyed by main wallet). One wallet popup per claim is OK —
    // this is a one-time "rescue my stuck funds" action, not gameplay.
    const claim = useCallback(async (): Promise<boolean> => {
        if (isClaiming) return false;
        if (pendingNative === 0n) {
            toast.error('No pending refund to claim');
            return false;
        }

        setIsClaiming(true);
        const toastId = 'claim-refund';
        toast.loading(`Claiming ${formatEther(pendingNative)} STT…`, { id: toastId });
        try {
            const { client, account } = await wallet.getActiveWalletClient();
            const accountAddress = typeof account === 'string' ? account : (account as any).address;

            const hash = await client.writeContract({
                address: refs.contractAddressRef.current,
                abi: MAFIA_ABI,
                functionName: 'claimRefund',
                args: [zeroAddress],
                account: accountAddress,
                chain: refs.runtimeChainRef.current,
            });

            const pc = refs.publicClientRef.current;
            if (pc) {
                await pc.waitForTransactionReceipt({ hash });
            }

            toast.success(`Refund claimed — ${formatEther(pendingNative)} STT sent to your wallet`, {
                id: toastId,
                duration: 5000,
            });
            addLog?.(`Refund claimed: ${formatEther(pendingNative)} STT`, 'success');
            await trigger();
            return true;
        } catch (e: any) {
            const msg = e?.shortMessage || e?.message || 'Claim failed';
            toast.error(msg.slice(0, 120), { id: toastId, duration: 5000 });
            addLog?.(`Refund claim failed: ${msg}`, 'danger');
            return false;
        } finally {
            setIsClaiming(false);
        }
    }, [isClaiming, pendingNative, wallet, refs, trigger, addLog]);

    // Initial check + periodic poll. The address ref is used because wagmi's
    // useAccount hook can lag behind the canonical signer (see the ECIES
    // canonical-address fix for the full story).
    useEffect(() => {
        trigger();
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = setInterval(trigger, POLL_INTERVAL_MS);
        return () => {
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
        };
    }, [trigger]);

    return {
        pendingNative,
        isClaiming,
        claim,
        refresh: trigger,
    };
}

export type RefundClaims = ReturnType<typeof useRefundClaims>;
