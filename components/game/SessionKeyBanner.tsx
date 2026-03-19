/**
 * SessionKeyBanner Component
 *
 * Shows session key status and allows player to register/revoke session keys.
 * Collapsible banner displayed in the bottom-left corner of the game screen.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Shield, Clock, Loader2, X, Fuel, Wallet, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { useSessionKey } from '../../hooks/useSessionKey';
import { useSendTransaction, usePublicClient, useAccount } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Button } from '../ui/Button';
import { createSessionWalletClient, loadSession } from '../../services/sessionKeyService';

interface SessionKeyBannerProps {
  roomId: number;
  className?: string;
  defaultExpanded?: boolean;
}

const MIN_SESSION_BALANCE = parseEther('0.01');
const FUND_AMOUNT = parseEther('0.02');

export const SessionKeyBanner = React.memo(({
  roomId,
  className = '',
  defaultExpanded = false
}: SessionKeyBannerProps) => {
  const {
    hasSession,
    sessionAddress,
    expiresAt,
    isRegistering,
    error,
    registerSession,
    revokeSession,
  } = useSessionKey(roomId);
  const { address: mainWalletAddress } = useAccount();

  const publicClient = usePublicClient({ chainId: 50312 }); // Default to Somnia for balance check if not specified, but better use context if possible
  const { sendTransactionAsync, isPending: isFunding } = useSendTransaction();

  const [sessionBalance, setSessionBalance] = useState<bigint>(0n);
  const [isLowBalance, setIsLowBalance] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isSweeping, setIsSweeping] = useState(false);

  useEffect(() => {
    if (!sessionAddress || !publicClient) return;
    const fetchBalance = async () => {
      try {
        const balance = await publicClient.getBalance({ address: sessionAddress as `0x${string}` });
        setSessionBalance(balance);
        setIsLowBalance(balance < MIN_SESSION_BALANCE);
      } catch (e) {
        console.error('Failed to fetch session balance:', e);
      }
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [sessionAddress, publicClient]);

  const handleFundSession = async () => {
    if (!sessionAddress) return;
    try {
      await sendTransactionAsync({ to: sessionAddress as `0x${string}`, value: FUND_AMOUNT });
    } catch (e) {
      console.error('Failed to fund session:', e);
    }
  };

  const handleSweepSessionBalance = async () => {
    if (!publicClient || !mainWalletAddress) return;
    const session = loadSession();
    if (!session || !session.registeredOnChain) return;
    const sessionClient = createSessionWalletClient();
    if (!sessionClient || !sessionClient.account) return;
    try {
      setIsSweeping(true);
      const [balance, gasPrice] = await Promise.all([
        publicClient.getBalance({ address: session.address as `0x${string}` }),
        publicClient.getGasPrice(),
      ]);
      const gasLimit = 21_000n;
      const feeReserve = gasLimit * gasPrice;
      if (balance <= feeReserve) return;
      const valueToSend = balance - feeReserve;
      const hash = await sessionClient.sendTransaction({
        account: sessionClient.account,
        to: mainWalletAddress as `0x${string}`,
        value: valueToSend,
        gas: gasLimit,
        gasPrice,
        chain: sessionClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      const updatedBalance = await publicClient.getBalance({ address: session.address as `0x${string}` });
      setSessionBalance(updatedBalance);
      setIsLowBalance(updatedBalance < MIN_SESSION_BALANCE);
    } catch (e) {
      console.error('Failed to sweep session balance:', e);
    } finally {
      setIsSweeping(false);
    }
  };

  const formatTimeLeft = (date: Date | null): string => {
    if (!date) return '';
    const ms = date.getTime() - Date.now();
    if (ms <= 0) return 'Expired';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const formatBalance = (balance: bigint) => parseFloat(formatEther(balance)).toFixed(4);

  // Colour palette — matches the game's bronze/gold noir theme
  const theme = !hasSession
    ? {
        wrap: 'bg-[#0C0A08]/95 border-white/8',
        iconWrap: 'bg-white/5 border border-white/8',
        accent: 'text-white/40',
        label: 'text-white/55',
        pulse: 'bg-white/25',
        divider: 'border-white/6',
        footerBg: 'bg-black/25',
        footerText: 'text-white/35',
        btnPrimary: 'bg-[#916A47]/12 border-[#916A47]/35 hover:bg-[#916A47]/22 text-[#C8904A]',
      }
    : isLowBalance
    ? {
        wrap: 'bg-[#1E0E07]/95 border-[#8B3A1A]/30',
        iconWrap: 'bg-[#8B3A1A]/18 border border-[#8B3A1A]/35',
        accent: 'text-[#D4724A]',
        label: 'text-[#D4724A]/80',
        pulse: 'bg-[#D4724A]',
        divider: 'border-[#8B3A1A]/25',
        footerBg: 'bg-[#8B3A1A]/08',
        footerText: 'text-[#D4724A]/60',
        btnPrimary: 'bg-[#8B3A1A]/15 border-[#8B3A1A]/40 hover:bg-[#8B3A1A]/25 text-[#D4724A]',
      }
    : {
        wrap: 'bg-[#110D07]/95 border-[#916A47]/28',
        iconWrap: 'bg-[#916A47]/18 border border-[#916A47]/32',
        accent: 'text-[#C8904A]',
        label: 'text-[#C8904A]/75',
        pulse: 'bg-[#C8904A]',
        divider: 'border-[#916A47]/20',
        footerBg: 'bg-[#916A47]/05',
        footerText: 'text-[#916A47]/55',
        btnPrimary: 'bg-[#916A47]/12 border-[#916A47]/35 hover:bg-[#916A47]/22 text-[#C8904A]',
      };

  // ── COLLAPSED PILL ──────────────────────────────────────────────────────────
  if (!isExpanded) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setIsExpanded(true)}
        className={`flex items-center gap-2.5 px-3.5 py-2 rounded-full border backdrop-blur-2xl cursor-pointer transition-all duration-200 ${theme.wrap} ${className}`}
      >
        <div className="relative">
          {hasSession
            ? isLowBalance
              ? <Fuel className={`w-3.5 h-3.5 ${theme.accent}`} />
              : <Shield className={`w-3.5 h-3.5 ${theme.accent}`} />
            : <Key className={`w-3.5 h-3.5 ${theme.accent}`} />
          }
          <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${theme.pulse} animate-pulse`} />
        </div>
        <span className={`text-[11px] font-bold tracking-widest uppercase font-['Montserrat'] ${theme.accent}`}>
          {hasSession
            ? isLowBalance ? 'Low Gas' : formatTimeLeft(expiresAt)
            : 'No Key'}
        </span>
        <ChevronUp className="w-3 h-3 text-white/25" />
      </motion.button>
    );
  }

  // ── EXPANDED PANEL ──────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`rounded-2xl border backdrop-blur-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.6)] ${theme.wrap} ${className}`}
        style={{ minWidth: 260 }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-4 pt-4 pb-3 cursor-pointer"
          onClick={() => setIsExpanded(false)}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${theme.iconWrap}`}>
              {hasSession
                ? isLowBalance
                  ? <Fuel className={`w-4 h-4 ${theme.accent}`} />
                  : <Shield className={`w-4 h-4 ${theme.accent}`} />
                : <Key className={`w-4 h-4 ${theme.accent}`} />}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className={`text-[13px] font-bold tracking-wide font-['Cinzel'] leading-none ${theme.accent}`}>
                {hasSession
                  ? isLowBalance ? 'Low Gas' : 'Session Active'
                  : 'No Session Key'}
              </p>
              {hasSession ? (
                <div className={`flex items-center gap-1.5 text-[10px] font-mono ${theme.label}`}>
                  <span>{shortenAddress(sessionAddress || '')}</span>
                  <span className="text-white/20">·</span>
                  <Wallet className="w-2.5 h-2.5" />
                  <span className={isLowBalance ? 'text-[#D4724A]' : ''}>{formatBalance(sessionBalance)} STT</span>
                  <span className="text-white/20">·</span>
                  <Clock className="w-2.5 h-2.5" />
                  <span>{formatTimeLeft(expiresAt)}</span>
                </div>
              ) : (
                <p className={`text-[10px] font-['Montserrat'] ${theme.label}`}>
                  {isRegistering ? 'Initialising...' : 'Each action requires manual sign'}
                </p>
              )}
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-white/25 hover:text-white/50 transition-colors shrink-0 ml-2" />
        </div>

        {/* ── Actions ── */}
        <div className="px-4 pb-4 flex flex-col gap-2">
          {hasSession ? (
            <div className="flex items-center gap-2">
              {isLowBalance && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleFundSession(); }}
                  disabled={isFunding}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold tracking-wide font-['Montserrat'] uppercase transition-all ${theme.btnPrimary} disabled:opacity-50`}
                >
                  {isFunding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Fuel className="w-3.5 h-3.5" />}
                  +0.02 STT
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleSweepSessionBalance(); }}
                disabled={isSweeping || !mainWalletAddress || sessionBalance <= 0n}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/8 bg-white/4 hover:bg-white/8 text-white/40 hover:text-[#C8904A] text-[11px] font-medium font-['Montserrat'] transition-all disabled:opacity-40"
              >
                {isSweeping ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Withdraw
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); revokeSession(); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-white/8 bg-white/4 hover:bg-white/8 text-white/40 hover:text-[#C94040] text-[11px] font-medium font-['Montserrat'] transition-all"
              >
                <X className="w-3 h-3" />
                Revoke
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); registerSession(roomId); }}
              disabled={isRegistering}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-[12px] font-bold tracking-widest font-['Cinzel'] uppercase transition-all ${theme.btnPrimary} disabled:opacity-50`}
            >
              {isRegistering
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Signing...</>
                : <><Key className="w-3.5 h-3.5" /> Enable Auto-Sign</>}
            </button>
          )}

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[#C94040]/10 border border-[#C94040]/20"
            >
              <AlertTriangle className="w-3 h-3 text-[#C94040] shrink-0 mt-0.5" />
              <p className="text-[10px] text-[#C94040]/90 font-medium font-['Montserrat'] leading-snug">{error}</p>
            </motion.div>
          )}
        </div>

        {/* ── Footer hint ── */}
        {!hasSession && !isRegistering && (
          <div className={`px-4 py-2.5 border-t ${theme.divider} ${theme.footerBg}`}>
            <p className={`text-[10px] font-['Montserrat'] leading-relaxed ${theme.footerText}`}>
              <span className={`font-bold ${theme.accent}`}>Session Keys</span> — one signature, no popups for 4 hours.
            </p>
          </div>
        )}
        {hasSession && isLowBalance && (
          <div className={`px-4 py-2.5 border-t ${theme.divider} ${theme.footerBg}`}>
            <p className={`text-[10px] font-['Montserrat'] leading-relaxed italic ${theme.footerText}`}>
              Session wallet is low on gas. Add funds to continue playing.
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
});