/**
 * useSessionKey Hook
 * 
 * React hook for managing session keys in the Mafia game.
 * In V4 contract, session keys are registered automatically during joinRoom.
 * This hook checks session status and allows revoking.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { 
  clearSession, 
  hasValidSession,
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

  const { writeContractAsync } = useWriteContract();

  // Check session status on mount and when roomId/wallet changes
  // Poll every second until session is valid (covers timing issues with markSessionRegistered)
  useEffect(() => {
    if (!roomId || !mainWallet) {
      setHasSession(false);
      setSessionAddress(null);
      setExpiresAt(null);
      return;
    }

    const checkSession = () => {
      const valid = hasValidSession(roomId, mainWallet);
      setHasSession(valid);
      
      if (valid) {
        const info = getSessionInfo();
        if (info) {
          setSessionAddress(info.address);
          setExpiresAt(info.expiresAt);
        }
      }
      return valid;
    };

    // Check immediately
    const isValid = checkSession();

    // If not valid yet, poll every second until it becomes valid
    // This handles the race condition where markSessionRegistered() updates localStorage
    // but the useEffect deps [roomId, mainWallet] haven't changed to trigger a re-check
    if (!isValid) {
      const interval = setInterval(() => {
        const nowValid = checkSession();
        if (nowValid) {
          clearInterval(interval);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [roomId, mainWallet]);

  /**
   * NOTE: In V4 contract, session key is registered automatically during joinRoom.
   * This function is kept for backwards compatibility but is now a no-op.
   * The session is already active if you successfully joined a room.
   */
  const registerSession = useCallback(async (_targetRoomId: number, _fundAmount: string = '0.02') => {
    // V4: Session key is already registered during joinRoom
    // Just check if we have a valid session
    if (!mainWallet) {
      setError('Wallet not connected');
      return;
    }

    const valid = hasValidSession(_targetRoomId, mainWallet);
    if (valid) {
      setHasSession(true);
      const info = getSessionInfo();
      if (info) {
        setSessionAddress(info.address);
        setExpiresAt(info.expiresAt);
      }
    } else {
      setError('Session not found. Please rejoin the room.');
    }
  }, [mainWallet]);

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
