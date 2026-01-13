/**
 * useSessionTransaction Hook
 * 
 * Helper hook for sending transactions with session key support.
 * 
 * SIMPLIFIED APPROACH:
 * - Session key is registered on-chain (one signature)
 * - All game actions check if caller is session key and map to main wallet
 * - Session key needs some gas (can be funded by main wallet)
 * - Transactions are sent directly from session key address
 */

import { useCallback, useMemo } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { createWalletClient, http, type Abi, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { 
  hasValidSession, 
  loadSession,
} from '../services/sessionKeyService';

// Somnia testnet chain config
const somniaChain = {
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://dream-rpc.somnia.network'] },
  },
} as const;

interface TransactionConfig {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args: any[];
}

interface UseSessionTransactionReturn {
  /**
   * Send a transaction using session key if available, otherwise use main wallet
   * Returns the transaction hash
   */
  sendTransaction: (
    config: TransactionConfig,
    writeContractAsync: (config: any) => Promise<`0x${string}`>
  ) => Promise<`0x${string}`>;
  
  /**
   * Check if we should use session key for a room
   */
  hasActiveSession: (roomId: number) => boolean;
  
  /**
   * Get session wallet client if available
   */
  sessionWalletClient: ReturnType<typeof createWalletClient> | null;
}

export function useSessionTransaction(): UseSessionTransactionReturn {
  const { address: mainWallet } = useAccount();
  const publicClient = usePublicClient();

  /**
   * Create session wallet client from stored session
   */
  const sessionWalletClient = useMemo(() => {
    const session = loadSession();
    if (!session || !session.registeredOnChain || Date.now() >= session.expiresAt) {
      return null;
    }
    
    const account = privateKeyToAccount(session.privateKey);
    return createWalletClient({
      account,
      chain: somniaChain,
      transport: http(),
    });
  }, []);

  /**
   * Check if we have a valid session for the current room
   */
  const hasActiveSession = useCallback((roomId: number): boolean => {
    if (!mainWallet) return false;
    return hasValidSession(roomId, mainWallet);
  }, [mainWallet]);

  /**
   * Send transaction with session key or main wallet
   */
  const sendTransaction = useCallback(async (
    config: TransactionConfig,
    writeContractAsync: (config: any) => Promise<`0x${string}`>
  ): Promise<`0x${string}`> => {
    if (!mainWallet) {
      throw new Error('Wallet not connected');
    }

    const session = loadSession();
    const useSession = session && 
                       session.registeredOnChain && 
                       Date.now() < session.expiresAt &&
                       sessionWalletClient;

    if (useSession && sessionWalletClient) {
      // Use session key - automatic signing, no popup!
      try {
        const hash = await sessionWalletClient.writeContract({
          address: config.address,
          abi: config.abi,
          functionName: config.functionName,
          args: config.args,
        });
        return hash;
      } catch (err) {
        console.error('Session transaction failed, falling back to main wallet:', err);
        // Fall back to main wallet
        return writeContractAsync(config);
      }
    } else {
      // Use main wallet (requires user confirmation)
      return writeContractAsync(config);
    }
  }, [mainWallet, sessionWalletClient]);

  return {
    sendTransaction,
    hasActiveSession,
    sessionWalletClient,
  };
}
