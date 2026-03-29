/**
 * useGameRefs — All shared mutable refs for the game system.
 *
 * These refs are used across all game hooks to avoid stale closures
 * and prevent unnecessary re-renders. They are the "backbone" of
 * the ref-first architecture inherited from the original monolith.
 */
import { useRef, useEffect, useMemo } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { useWallets } from '@privy-io/react-auth';
import { GamePhase, GameState, Player } from '../../types';
import { getDeploymentByChainId } from '../../contracts/config';

export function useGameRefs() {
    // === WALLET / CHAIN ===
    const { address, chainId, isConnected } = useAccount();
    const stableAddress = useMemo(() => address?.toLowerCase() as `0x${string}` | undefined, [address]);
    const stableChainId = useMemo(() => chainId, [chainId]);

    // Stable chain tracking (avoid flicker during wallet switch)
    const lastChainIdRef = useRef<number | null>(null);
    if (stableChainId) lastChainIdRef.current = stableChainId;

    const runtimeDeployment = useMemo(() => {
        return getDeploymentByChainId(stableChainId || lastChainIdRef.current);
    }, [stableChainId]);
    const runtimeChain = runtimeDeployment.chain;
    const runtimeContractAddress = runtimeDeployment.contracts.MafiaDiamond as `0x${string}`;

    const publicClient = usePublicClient({ chainId: runtimeChain.id });
    const { data: walletClient } = useWalletClient();
    const { wallets } = useWallets();

    // === MUTABLE REFS ===
    const addressRef = useRef<`0x${string}` | undefined>(stableAddress);
    const publicClientRef = useRef(publicClient);
    const walletClientRef = useRef<any>(null);
    const runtimeChainRef = useRef(runtimeChain);
    const walletsRef = useRef(wallets);
    const contractAddressRef = useRef<`0x${string}`>(runtimeContractAddress);

    // Game state refs
    const currentRoomIdRef = useRef<bigint | null>(null);
    const playersRef = useRef<Player[]>([]);
    const phaseRef = useRef<GamePhase>(GamePhase.LOBBY);
    const dayCountRef = useRef<number>(0);

    // User-facing refs
    const playerNameRef = useRef('');
    const lobbyNameRef = useRef('');
    const lobbyPasswordRef = useRef('');
    const avatarUrlRef = useRef<string | null>(null);

    // Crypto refs
    const eciesPrivKeyRef = useRef<CryptoKey | null>(null);
    const roleFetchedRef = useRef(false);

    // Guard refs (prevent concurrent operations)
    const autoWinLockRef = useRef(false);
    const checkWinInProgressRef = useRef(false);
    const votingFinalizedTimerRef = useRef<NodeJS.Timeout | null>(null);
    const avatarCacheRef = useRef<Record<string, string>>({});
    const lastPhaseKeyRef = useRef<string>('');

    // TX
    const pendingConfirmationsRef = useRef<Set<string>>(new Set());

    // === SYNC REFS WITH STATE ===
    useEffect(() => { addressRef.current = stableAddress; }, [stableAddress]);
    useEffect(() => { publicClientRef.current = publicClient; }, [publicClient]);
    useEffect(() => { walletClientRef.current = walletClient; }, [walletClient]);
    useEffect(() => { runtimeChainRef.current = runtimeChain; }, [runtimeChain]);
    useEffect(() => { walletsRef.current = wallets; }, [wallets]);
    useEffect(() => { contractAddressRef.current = runtimeContractAddress; }, [runtimeContractAddress]);

    return useMemo(() => ({
        // Wagmi/Privy values
        address, stableAddress, stableChainId, isConnected,
        publicClient, walletClient, wallets,
        runtimeChain, runtimeContractAddress, runtimeDeployment,

        // Mutable refs
        addressRef,
        publicClientRef,
        walletClientRef,
        runtimeChainRef,
        walletsRef,
        contractAddressRef,
        currentRoomIdRef,
        playersRef,
        phaseRef,
        dayCountRef,
        playerNameRef,
        lobbyNameRef,
        lobbyPasswordRef,
        avatarUrlRef,
        eciesPrivKeyRef,
        roleFetchedRef,
        autoWinLockRef,
        checkWinInProgressRef,
        votingFinalizedTimerRef,
        avatarCacheRef,
        lastPhaseKeyRef,
        pendingConfirmationsRef,
    }), [
        address, stableAddress, stableChainId, isConnected,
        publicClient, walletClient, wallets,
        runtimeChain, runtimeContractAddress, runtimeDeployment
    ]);
}

/** Type helper to extract return type for dependency injection */
export type GameRefs = ReturnType<typeof useGameRefs>;
