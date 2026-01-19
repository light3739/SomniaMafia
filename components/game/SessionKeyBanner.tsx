/**
 * SessionKeyBanner Component
 * 
 * Shows session key status and allows player to register/revoke session keys.
 * Displayed at the top of the game screen.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Shield, Clock, Loader2, X, Fuel, Wallet } from 'lucide-react';
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
      return `${hours}h ${minutes}m left`;
    }
    return `${minutes}m left`;
  };

  const shortenAddress = (addr: string): string => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatBalance = (balance: bigint): string => {
    const eth = formatEther(balance);
    return parseFloat(eth).toFixed(4);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-lg border p-3 ${className} ${hasSession
            ? isLowBalance
              ? 'bg-orange-500/10 border-orange-500/30'
              : 'bg-green-500/10 border-green-500/30'
            : 'bg-yellow-500/10 border-yellow-500/30'
          }`}
      >
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Status */}
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${hasSession
                ? isLowBalance
                  ? 'bg-orange-500/20'
                  : 'bg-green-500/20'
                : 'bg-yellow-500/20'
              }`}>
              {hasSession ? (
                isLowBalance ? (
                  <Fuel className="w-4 h-4 text-orange-400" />
                ) : (
                  <Shield className="w-4 h-4 text-green-400" />
                )
              ) : (
                <Key className="w-4 h-4 text-yellow-400" />
              )}
            </div>

            <div>
              {hasSession ? (
                <>
                  <p className={`text-sm font-medium ${isLowBalance ? 'text-orange-400' : 'text-green-400'
                    }`}>
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
                    You'll need to approve each game action
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-2">
            {hasSession ? (
              <>
                {/* Fund button when low balance */}
                {isLowBalance && (
                  <Button
                    variant="secondary"
                    onClick={handleFundSession}
                    disabled={isFunding}
                    className="bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/30 text-sm px-3 py-1"
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
                  onClick={revokeSession}
                  className="text-white/60 hover:text-red-400 text-sm px-3 py-1"
                >
                  <X className="w-4 h-4 mr-1" />
                  Revoke
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                onClick={() => registerSession(roomId)}
                disabled={isRegistering}
                className="bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/30 text-sm px-3 py-1"
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
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-xs text-red-400"
          >
            {error}
          </motion.p>
        )}

        {/* Info when not active */}
        {!hasSession && !isRegistering && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 pt-3 border-t border-yellow-500/20"
          >
            <p className="text-xs text-white/50">
              💡 <strong>Session Keys</strong> let you play without signing every action.
              One signature now = no popups for 4 hours. Your main wallet stays secure.
            </p>
          </motion.div>
        )}

        {/* Low balance warning */}
        {hasSession && isLowBalance && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 pt-3 border-t border-orange-500/20"
          >
            <p className="text-xs text-orange-400">
              ⛽ Session key needs gas to send transactions. Click "+0.02 STT" to fund it from your main wallet.
            </p>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
});