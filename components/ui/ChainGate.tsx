'use client';

import React from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { SOMNIA_TESTNET } from '../../contracts/config';
import { AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ChainGate — blocks the UI with a full-screen modal when the user
 * is connected to the wrong network. Shows a "Switch Network" button.
 */
export const ChainGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isConnected, chainId } = useAccount();
    const { switchChain, isPending } = useSwitchChain();

    const isWrongChain = isConnected && chainId !== undefined && chainId !== SOMNIA_TESTNET.id;

    return (
        <>
            {children}
            <AnimatePresence>
                {isWrongChain && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="max-w-sm w-full mx-4 bg-[#0D0D0D] border border-[#8B0000]/40 rounded-sm p-6 shadow-[0_20px_60px_rgba(0,0,0,0.9)]"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <AlertTriangle className="w-5 h-5 text-[#cc4444] shrink-0" />
                                <h3
                                    className="text-[12px] uppercase tracking-[0.15em] font-semibold text-[#cc4444]"
                                    style={{ fontFamily: 'var(--font-cinzel)' }}
                                >
                                    Wrong Network
                                </h3>
                            </div>
                            <p className="text-white/70 text-[13px] mb-6 leading-relaxed" style={{ fontFamily: 'var(--font-sans)' }}>
                                Please switch to <strong className="text-white">Somnia Testnet</strong> to continue playing.
                                You are currently connected to chain {chainId}.
                            </p>
                            <button
                                onClick={() => switchChain({ chainId: SOMNIA_TESTNET.id })}
                                disabled={isPending}
                                className="w-full py-3 rounded-sm border border-[#916A47]/50 text-[#C8904A] text-[12px] uppercase tracking-[0.12em] font-semibold transition-all hover:bg-[#916A47]/15 hover:border-[#916A47] active:scale-[0.97] disabled:opacity-50"
                                style={{ fontFamily: 'var(--font-cinzel)', backgroundColor: 'rgba(145,106,71,0.08)' }}
                            >
                                {isPending ? 'Switching...' : 'Switch to Somnia Testnet'}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
