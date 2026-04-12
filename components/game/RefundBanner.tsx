"use client";

/**
 * RefundBanner — Small global banner shown when the player has a pending
 * pull-refund credit in LibStorage.pendingRefunds.
 *
 * Only renders when the amount is non-zero. Styled to match the noir theme
 * of the rest of the UI, positioned as a fixed top-center ribbon that can
 * coexist with overlays. Tapping the Claim button triggers the main-wallet
 * claimRefund tx.
 */

import React from 'react';
import { formatEther } from 'viem';
import { Loader2, Coins } from 'lucide-react';
import { useGameContext } from '../../contexts/GameContext';

export const RefundBanner: React.FC = () => {
    const { pendingRefundNative, isClaimingRefund, claimRefund, currencySymbol } = useGameContext();

    if (pendingRefundNative === 0n) return null;

    return (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[80] max-w-[92vw]">
            <div className="flex items-center gap-3 rounded-full bg-[#0A0A0A] border border-[#916A47]/50 shadow-[0_5px_20px_rgba(0,0,0,0.85)] px-4 py-2 font-['Montserrat']">
                <Coins className="w-4 h-4 text-[#D4A97A] shrink-0" aria-hidden="true" />
                <div className="text-xs sm:text-sm text-[#E5D5B7] whitespace-nowrap">
                    Stuck refund:{' '}
                    <span className="text-[#D4A97A] font-semibold">
                        {formatEther(pendingRefundNative)} {currencySymbol || 'SOMI'}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        if (!isClaimingRefund) void claimRefund();
                    }}
                    disabled={isClaimingRefund}
                    className="ml-1 shrink-0 inline-flex items-center gap-1 rounded-full bg-[#1A130A] border border-[#916A47]/60 hover:border-[#916A47] hover:bg-[#2A1E10] disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-3 py-1 text-xs text-[#E5D5B7]"
                    aria-label="Claim pending refund"
                >
                    {isClaimingRefund ? (
                        <>
                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                            Claiming…
                        </>
                    ) : (
                        'Claim'
                    )}
                </button>
            </div>
        </div>
    );
};
