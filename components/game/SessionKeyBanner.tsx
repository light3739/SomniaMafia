/**
 * SessionKeyBanner Component
 * 
 * Shows session key status and allows player to register/revoke session keys.
 * Collapsible banner displayed in the bottom-left corner of the game screen.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Shield, Clock, Loader2, X, Fuel, Wallet, ChevronUp, ChevronDown } from 'lucide-react';
import { useSessionKey } from '../../hooks/useSessionKey';
import { useSendTransaction, usePublicClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Button } from '../ui/Button';

interface SessionKeyBannerProps {
  roomId: number;
  className?: string;
}

// Минимальный баланс для игры (примерно 50 транзакций)
const MIN_SESSION_BALANCE = parseEther('0.01');
const FUND_AMOUNT = parseEther('0.02'); // 0.02 STT

export const SessionKeyBanner = React.memo(({
  roomId,
  className = ''
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

  const publicClient = usePublicClient();
  const { sendTransactionAsync, isPending: isFunding } = useSendTransaction();

  const [sessionBalance, setSessionBalance] = useState<bigint>(0n);
  const [isLowBalance, setIsLowBalance] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch session key balance
  useEffect(() => {
    if (!sessionAddress || !publicClient) return;

    const fetchBalance = async () => {
      try {
        const balance = await publicClient.getBalance({
          address: sessionAddress as `0x${string}`
        });
        setSessionBalance(balance);
        setIsLowBalance(balance < MIN_SESSION_BALANCE);
      } catch (e) {
        console.error('Failed to fetch session balance:', e);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [sessionAddress, publicClient]);

  const handleFundSession = async () => {
    if (!sessionAddress) return;

    try {
      await sendTransactionAsync({
        to: sessionAddress as `0x${string}`,
        value: FUND_AMOUNT,
      });
    } catch (e) {
      console.error('Failed to fund session:', e);
    }
  };

  const formatTimeLeft = (date: Date | null): string => {
    if (!date) return '';
    const ms = date.getTime() - Date.now();
    if (ms <= 0) return 'Expired';

    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const shortenAddress = (addr: string): string => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatBalance = (balance: bigint): string => {
    const eth = formatEther(balance);
    return parseFloat(eth).toFixed(4);
  };

  // Determine status color
  const getStatusColor = () => {
    if (!hasSession) return 'yellow';
    if (isLowBalance) return 'orange';
    return 'green';
  };

  const statusColor = getStatusColor();
  const colorClasses = {
    yellow: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      iconBg: 'bg-yellow-500/20',
      text: 'text-yellow-400',
      pulse: 'bg-yellow-400'
    },
    orange: {
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      iconBg: 'bg-orange-500/20',
      text: 'text-orange-400',
      pulse: 'bg-orange-400'
    },
    green: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      iconBg: 'bg-green-500/20',
      text: 'text-green-400',
      pulse: 'bg-green-400'
    }
  };

  const colors = colorClasses[statusColor];

  // Collapsed view - small pill
  if (!isExpanded) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsExpanded(true)}
        className={`flex items-center gap-2 px-3 py-2 rounded-full border backdrop-blur-xl cursor-pointer transition-all ${colors.bg} ${colors.border} ${className}`}
      >
        <div className="relative">
          {hasSession ? (
            isLowBalance ? (
              <Fuel className={`w-4 h-4 ${colors.text}`} />
            ) : (
              <Shield className={`w-4 h-4 ${colors.text}`} />
            )
          ) : (
            <Key className={`w-4 h-4 ${colors.text}`} />
          )}
          {/* Status pulse indicator */}
          <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${colors.pulse} animate-pulse`} />
        </div>
        <span className={`text-xs font-medium ${colors.text}`}>
          {hasSession ? (isLowBalance ? 'Low Gas' : formatTimeLeft(expiresAt)) : 'No Key'}
        </span>
        <ChevronUp className="w-3 h-3 text-white/40" />
      </motion.button>
    );
  }

  // Expanded view - full panel
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className={`rounded-xl border backdrop-blur-xl ${colors.bg} ${colors.border} ${className}`}
      >
        {/* Header with collapse button */}
        <div
          className="flex items-center justify-between p-3 cursor-pointer"
          onClick={() => setIsExpanded(false)}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${colors.iconBg}`}>
              {hasSession ? (
                isLowBalance ? (
                  <Fuel className={`w-4 h-4 ${colors.text}`} />
                ) : (
                  <Shield className={`w-4 h-4 ${colors.text}`} />
                )
              ) : (
                <Key className={`w-4 h-4 ${colors.text}`} />
              )}
            </div>

            <div>
              {hasSession ? (
                <>
                  <p className={`text-sm font-medium ${colors.text}`}>
                    {isLowBalance ? 'Low Gas Balance' : 'Session Key Active'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <span>{shortenAddress(sessionAddress || '')}</span>
                    <span>•</span>
                    <Wallet className="w-3 h-3" />
                    <span className={isLowBalance ? 'text-orange-400' : ''}>
                      {formatBalance(sessionBalance)} STT
                    </span>
                    <span>•</span>
                    <Clock className="w-3 h-3" />
                    <span>{formatTimeLeft(expiresAt)}</span>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-yellow-400">
                    No Session Key
                  </p>
                  <p className="text-xs text-white/60">
                    You'll need to approve each action
                  </p>
                </>
              )}
            </div>
          </div>

          <ChevronDown className="w-4 h-4 text-white/40 hover:text-white/60 transition-colors" />
        </div>

        {/* Actions */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2">
            {hasSession ? (
              <>
                {/* Fund button when low balance */}
                {isLowBalance && (
                  <Button
                    variant="secondary"
                    onClick={(e) => { e.stopPropagation(); handleFundSession(); }}
                    disabled={isFunding}
                    className="bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/30 text-sm px-3 py-1.5 flex-1"
                  >
                    {isFunding ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Fuel className="w-4 h-4 mr-1" />
                        +0.02 STT
                      </>
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); revokeSession(); }}
                  className="text-white/60 hover:text-red-400 text-sm px-3 py-1.5"
                >
                  <X className="w-4 h-4 mr-1" />
                  Revoke
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                onClick={(e) => { e.stopPropagation(); registerSession(roomId); }}
                disabled={isRegistering}
                className="bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/30 text-sm px-3 py-1.5 w-full"
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Activating...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Enable Auto-Sign
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-3 pb-3">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-red-400"
            >
              {error}
            </motion.p>
          </div>
        )}

        {/* Info when not active */}
        {!hasSession && !isRegistering && (
          <div className="px-3 pb-3 pt-0">
            <div className="pt-3 border-t border-yellow-500/20">
              <p className="text-xs text-white/50">
                💡 <strong>Session Keys</strong> let you play without signing every action.
                One signature = no popups for 4 hours.
              </p>
            </div>
          </div>
        )}

        {/* Low balance warning */}
        {hasSession && isLowBalance && (
          <div className="px-3 pb-3 pt-0">
            <div className="pt-3 border-t border-orange-500/20">
              <p className="text-xs text-orange-400">
                ⛽ Session key needs gas. Click "+0.02 STT" to fund it.
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
});