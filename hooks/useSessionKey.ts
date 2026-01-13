/**
 * useSessionKey Hook
 * 
 * React hook for managing session keys in the Mafia game.
 * Handles creation, registration, and automatic signing of game transactions.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { 
  createNewSession, 
  loadSession, 
  clearSession, 
  hasValidSession,
  markSessionRegistered,
  getSessionInfo,
  getSessionAccount,
} from '../services/sessionKeyService';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '../contracts/config';

interface UseSessionKeyReturn {
  // State
  hasSession: boolean;
  sessionAddress: string | null;
  expiresAt: Date | null;
  isRegistering: boolean;
  error: string | null;
  
  // Actions
  registerSession: (roomId: number) => Promise<void>;
  revokeSession: () => Promise<void>;
  
  // For signing transactions with session key
  getSessionSigner: () => ReturnType<typeof getSessionAccount>;
}

export function useSessionKey(roomId: number | null): UseSessionKeyReturn {
  const { address: mainWallet } = useAccount();
  const [hasSession, setHasSession] = useState(false);
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync } = useWriteContract();
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: pendingTxHash });

  // Check session status on mount and when roomId/wallet changes
  useEffect(() => {
    if (!roomId || !mainWallet) {
      setHasSession(false);
      setSessionAddress(null);
      setExpiresAt(null);
      return;
    }

    const valid = hasValidSession(roomId, mainWallet);
    setHasSession(valid);
    
    if (valid) {
      const info = getSessionInfo();
      if (info) {
        setSessionAddress(info.address);
        setExpiresAt(info.expiresAt);
      }
    }
  }, [roomId, mainWallet]);

  // Mark as registered when tx confirms
  useEffect(() => {
    if (txConfirmed && pendingTxHash) {
      markSessionRegistered();
      setHasSession(true);
      setIsRegistering(false);
      setPendingTxHash(undefined);
      
      const info = getSessionInfo();
      if (info) {
        setSessionAddress(info.address);
        setExpiresAt(info.expiresAt);
      }
    }
  }, [txConfirmed, pendingTxHash]);

  /**
   * Register a new session key on-chain AND fund it with gas
   * This is the ONE transaction the user signs with their main wallet
   * @param targetRoomId - The room ID to register for
   * @param fundAmount - Amount of STT to send for gas (default: 0.02)
   */
  const registerSession = useCallback(async (targetRoomId: number, fundAmount: string = '0.02') => {
    if (!mainWallet) {
      setError('Wallet not connected');
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      // 1. Generate session key locally
      const { sessionAddress: newSessionAddr } = createNewSession(
        mainWallet,
        targetRoomId
      );

      // 2. Register on-chain AND fund in one transaction
      const hash = await writeContractAsync({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'registerSessionKey',
        args: [newSessionAddr, BigInt(targetRoomId)],
        value: parseEther(fundAmount), // Send STT for gas
      });

      setPendingTxHash(hash);
      setSessionAddress(newSessionAddr);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register session');
      setIsRegistering(false);
      clearSession();
    }
  }, [mainWallet, writeContractAsync]);

  /**
   * Revoke the current session key
   */
  const revokeSession = useCallback(async () => {
    if (!mainWallet) return;

    try {
      // Revoke on-chain
      await writeContractAsync({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'revokeSessionKey',
        args: [],
      });

      // Clear local storage
      clearSession();
      setHasSession(false);
      setSessionAddress(null);
      setExpiresAt(null);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke session');
    }
  }, [mainWallet, writeContractAsync]);

  /**
   * Get the session account for signing
   */
  const getSessionSigner = useCallback(() => {
    if (!hasSession) return null;
    return getSessionAccount();
  }, [hasSession]);

  return {
    hasSession,
    sessionAddress,
    expiresAt,
    isRegistering,
    error,
    registerSession,
    revokeSession,
    getSessionSigner,
  };
}
