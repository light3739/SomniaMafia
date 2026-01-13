/**
 * Session Key Service
 * 
 * Manages temporary session keys for gasless game actions.
 * Player signs once to create a session key, then all game actions
 * are signed automatically without wallet popups.
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http, type Account, type WalletClient } from 'viem';

// Somnia testnet chain config
const somniaChain = {
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://dream-rpc.somnia.network'] },
  },
} as const;

interface StoredSession {
  privateKey: `0x${string}`;
  address: `0x${string}`;
  mainWallet: `0x${string}`;
  roomId: number;
  expiresAt: number;
  registeredOnChain: boolean;
}

const STORAGE_KEY = 'somnia_mafia_session';

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
      clearSession();
      return null;
    }
    
    return session;
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
 * Check if we have a valid session for a specific room
 */
export function hasValidSession(roomId: number, mainWallet: string): boolean {
  const session = loadSession();
  if (!session) return false;
  
  return (
    session.roomId === roomId &&
    session.mainWallet.toLowerCase() === mainWallet.toLowerCase() &&
    session.registeredOnChain &&
    Date.now() < session.expiresAt
  );
}

/**
 * Create a wallet client using the session key
 */
export function createSessionWalletClient(): WalletClient | null {
  const session = loadSession();
  if (!session || !session.registeredOnChain) return null;
  
  const account = privateKeyToAccount(session.privateKey);
  
  return createWalletClient({
    account,
    chain: somniaChain,
    transport: http(),
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
  durationMs: number = 4 * 60 * 60 * 1000 // 4 hours default
): { sessionAddress: `0x${string}`; privateKey: `0x${string}` } {
  const { privateKey, address } = generateSessionKey();
  
  const session: StoredSession = {
    privateKey,
    address,
    mainWallet,
    roomId,
    expiresAt: Date.now() + durationMs,
    registeredOnChain: false,
  };
  
  storeSession(session);
  
  return { sessionAddress: address, privateKey };
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
