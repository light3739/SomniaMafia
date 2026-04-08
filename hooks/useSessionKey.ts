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
  loadSession,
  getSessionAccount,
} from '../services/sessionKeyService';
import { MAFIA_ABI, getDeploymentByChainId } from '../contracts/config';

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
  const { address: mainWallet, chainId } = useAccount();
  const [hasSession, setHasSession] = useState(false);
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();

  // Check session status on mount and when roomId/chain changes.
  // Poll every second until a session row appears (covers timing
  // issues with markSessionRegistered writing on a slightly later tick).
  //
  // Crucial: we read the session row directly from localStorage and
  // do NOT compare its mainWallet against useAccount().address.
  //
  // useAccount() races during /create→/waiting navigation between
  // Privy embedded and the main wallet — it can briefly return a
  // different address than the canonical signer that actually stored
  // the session row in createLobby/joinLobby. If we gate on a wallet
  // match here, the banner shows "No Session" for the entire window
  // the race lasts (sometimes permanently if the wagmi flicker
  // settles on the wrong wallet).
  //
  // The session row in localStorage IS the source of truth: it was
  // written by createLobby/joinLobby with the canonical myAddr that
  // signed the on-chain registerSessionKey call, and localStorage is
  // per-tab so we can trust any non-expired row for this roomId as
  // belonging to the current user. clearSession() runs on logout /
  // expiry, so stale rows can't outlive a real session change.
  useEffect(() => {
    if (!roomId) {
      setHasSession(false);
      setSessionAddress(null);
      setExpiresAt(null);
      return;
    }

    const checkSession = () => {
      const session = loadSession();
      const valid = !!(
        session &&
        session.roomId === roomId &&
        session.registeredOnChain &&
        Date.now() < session.expiresAt &&
        (!chainId || session.chainId === chainId)
      );
      setHasSession(valid);

      if (valid && session) {
        setSessionAddress(session.address);
        setExpiresAt(new Date(session.expiresAt));
      } else {
        setSessionAddress(null);
        setExpiresAt(null);
      }
      return valid;
    };

    // Check immediately
    const isValid = checkSession();

    // If not valid yet, poll every second until it becomes valid.
    // This handles the race where markSessionRegistered() updates
    // localStorage on a slightly later tick than this effect ran.
    if (!isValid) {
      const interval = setInterval(() => {
        const nowValid = checkSession();
        if (nowValid) {
          clearInterval(interval);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [roomId, chainId]);

  /**
   * NOTE: In V4 contract, session key is registered automatically during joinRoom.
   * This function is kept for backwards compatibility but is now a no-op.
   * The session is already active if you successfully joined a room.
   */
  const registerSession = useCallback(async (_targetRoomId: number, _fundAmount: string = '0.02') => {
    // V4: Session key is already registered during joinRoom.
    // Read directly from localStorage — see the main effect above
    // for why we don't gate on useAccount().address here.
    const session = loadSession();
    const valid = !!(
      session &&
      session.roomId === _targetRoomId &&
      session.registeredOnChain &&
      Date.now() < session.expiresAt &&
      (!chainId || session.chainId === chainId)
    );
    if (valid && session) {
      setHasSession(true);
      setSessionAddress(session.address);
      setExpiresAt(new Date(session.expiresAt));
    } else {
      setError('Session not found. Please rejoin the room.');
    }
  }, [chainId]);

  /**
   * Revoke the current session key
   */
  const revokeSession = useCallback(async () => {
    if (!mainWallet) return;

    try {
      // Runtime awareness for contract address
      const deployment = getDeploymentByChainId(chainId);
      const runtimeContract = deployment.contracts.MafiaDiamond as `0x${string}`;

      // Revoke on-chain
      await writeContractAsync({
        address: runtimeContract,
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
  }, [mainWallet, chainId, writeContractAsync]);

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
