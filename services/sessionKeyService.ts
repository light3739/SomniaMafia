/**
 * Session Key Service
 * 
 * Manages temporary session keys for gasless game actions.
 * Player signs once to create a session key, then all game actions
 * are signed automatically without wallet popups.
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http, type Account, type WalletClient } from 'viem';
import { ACTIVE_NETWORK, NETWORKS, type SupportedNetwork } from '../contracts/config';

interface StoredSession {
  privateKey: `0x${string}`;
  address: `0x${string}`;
  mainWallet: `0x${string}`;
  roomId: number;
  chainId: number;
  expiresAt: number;
  registeredOnChain: boolean;
}

const STORAGE_KEY = 'somnia_mafia_session';

function getSessionChain() {
  return NETWORKS[ACTIVE_NETWORK];
}

/**
 * Generate a new session key pair (done client-side)
 */
export function generateSessionKey(): { privateKey: `0x${string}`; address: `0x${string}` } {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    privateKey,
    address: account.address,
  };
}

/**
 * Store session key securely in localStorage
 */
export function storeSession(session: StoredSession): void {
  // In production, consider more secure storage (encrypted, etc.)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/**
 * Load session from localStorage
 */
export function loadSession(): StoredSession | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  try {
    const session = JSON.parse(stored) as StoredSession;

    // Check if expired
    if (Date.now() > session.expiresAt) {
      // Don't clearSession() here — the private key is still needed for
      // drainSessionGas even after the session "expires" on the frontend.
      // The contract's drainSessionGas does NOT check session expiry.
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Load session ignoring expiry — used for post-game gas drain.
 * The contract's drainSessionGas only checks sessionToMain mapping,
 * NOT session expiry, so an "expired" session key can still drain.
 */
export function loadSessionForDrain(): StoredSession | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as StoredSession;
  } catch {
    return null;
  }
}

/**
 * Clear session from storage
 */
export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if we have a valid session for a specific room and chain
 */
export function hasValidSession(roomId: number, mainWallet: string, chainId?: number | null): boolean {
  const session = loadSession();
  if (!session) return false;

  const chainMatch = !chainId || session.chainId === chainId;

  return (
    session.roomId === roomId &&
    session.mainWallet.toLowerCase() === mainWallet.toLowerCase() &&
    chainMatch &&
    session.registeredOnChain &&
    Date.now() < session.expiresAt
  );
}

/**
 * Create a wallet client using the session key
 */
export function createSessionWalletClient(ignoreRegistration: boolean = false): WalletClient | null {
  const session = loadSession();
  if (!session) return null;
  if (!session.registeredOnChain && !ignoreRegistration) return null;

  const account = privateKeyToAccount(session.privateKey);
  const chain = getSessionChain();

  return createWalletClient({
    account,
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  });
}

/**
 * Get the session account for signing
 */
export function getSessionAccount(): Account | null {
  const session = loadSession();
  if (!session) return null;

  return privateKeyToAccount(session.privateKey);
}

/**
 * Get session info for display
 */
export function getSessionInfo(): {
  address: string;
  expiresAt: Date;
  roomId: number;
  isRegistered: boolean;
} | null {
  const session = loadSession();
  if (!session) return null;

  return {
    address: session.address,
    expiresAt: new Date(session.expiresAt),
    roomId: session.roomId,
    isRegistered: session.registeredOnChain,
  };
}

/**
 * Mark session as registered on-chain
 */
export function markSessionRegistered(): void {
  const session = loadSession();
  if (session) {
    session.registeredOnChain = true;
    storeSession(session);
  }
}

/**
 * Create a new session (generates key, stores it, returns address for contract registration)
 */
export function createNewSession(
  mainWallet: `0x${string}`,
  roomId: number,
  chainId: number,
  durationMs: number = 4 * 60 * 60 * 1000, // 4 hours default
  skipStore: boolean = false
): { sessionAddress: `0x${string}`; privateKey: `0x${string}`; session: StoredSession } {
  const { privateKey, address } = generateSessionKey();

  const session: StoredSession = {
    privateKey,
    address,
    mainWallet,
    roomId,
    chainId,
    expiresAt: Date.now() + durationMs,
    registeredOnChain: false,
  };

  if (!skipStore) {
    storeSession(session);
  }

  return { sessionAddress: address, privateKey, session };
}

/**
 * Hook-like function to get the best signer for a transaction
 * Returns session account if available, otherwise null (use main wallet)
 */
export function getSignerForRoom(roomId: number, mainWallet: string): Account | null {
  if (hasValidSession(roomId, mainWallet)) {
    return getSessionAccount();
  }
  return null;
}
