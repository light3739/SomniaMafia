import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { useNoirDialog } from '../../contexts/NoirDialogContext';
import { useSessionKey } from '../../hooks/useSessionKey';
import { Button } from '../ui/Button';
import { BackButton } from '../ui/BackButton';
import { GamePhase } from '../../types';
import { formatEther } from 'viem';
import { Loader2, HelpCircle } from 'lucide-react';
import { useAccount, useWalletClient } from 'wagmi';
import { SessionKeyBanner } from '../game/SessionKeyBanner';
import HowToPlayModal from '../game/HowToPlayModal';
import * as GM from '../../services/gmService';
import { loadSession } from '../../services/sessionKeyService';

export const WaitingRoom: React.FC = () => {
    const {
        lobbyName,
        gameState,
        startGameOnChain,
        isTxPending,
        currentRoomId,
        myPlayer,
        refreshPlayersList,
        cancelTournamentOnChain,
        forfeitGameOnChain,
        currencySymbol,
    } = useGameContext();
    const { showConfirm } = useNoirDialog();

    const { address, chainId } = useAccount();
    const { data: walletClient } = useWalletClient();
    const roomIdNumber = currentRoomId ? Number(currentRoomId) : null;
    const {
        hasSession,
        error: sessionError
    } = useSessionKey(roomIdNumber);

    const router = useRouter();

    const mountedRef = useRef(false);
    const [eciesRegistered, setEciesRegistered] = useState(false);
    const eciesRegisteringRef = useRef(false);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Register ECIES pubkey with GM so it can encrypt our role privately.
    //
    // Three preconditions must hold to avoid an unwanted MetaMask popup:
    //  1. walletClient is ready (Privy may still be hydrating on first paint)
    //  2. A matching session key is already in localStorage — otherwise
    //     signRequest() inside registerEciesPubkey would fall back to
    //     walletClient.signMessage and trigger a wallet popup.
    //  3. We use the session's `mainWallet` as the player address, NOT wagmi's
    //     `useAccount().address`. On cold-start with a freshly-unlocked external
    //     wallet, wagmi's connector state can lag and still return the Privy
    //     embedded address while the canonical signer (the one that actually
    //     signed the createAndJoin tx and owns the session) is the external
    //     wallet. Using wagmi's stale address would make signRequest's session
    //     mainWallet comparison fail, forcing the wallet popup every time.
    //     See useLobbyActions.ts where refs.addressRef.current is explicitly
    //     overridden to the canonical signer before the session is stored.
    useEffect(() => {
        if (!currentRoomId || !chainId) return;
        if (eciesRegistered || eciesRegisteringRef.current) return;
        if (!walletClient) return;

        let cancelled = false;
        const roomId = String(currentRoomId);
        const roomIdNum = Number(currentRoomId);

        const canonicalAddress = (): `0x${string}` | null => {
            const s = loadSession();
            if (
                s &&
                s.roomId === roomIdNum &&
                Date.now() < s.expiresAt
            ) {
                return s.mainWallet.toLowerCase() as `0x${string}`;
            }
            // No matching session yet — fall back to wagmi address.
            return address ? (address.toLowerCase() as `0x${string}`) : null;
        };

        const hasMatchingSession = () => {
            const s = loadSession();
            return !!(
                s &&
                s.roomId === roomIdNum &&
                Date.now() < s.expiresAt
            );
        };

        const runRegistration = async () => {
            // Wait up to ~4s for the session to appear so we don't pop a wallet
            // signature for register-pubkey when the session is moments away.
            for (let i = 0; i < 8 && !hasMatchingSession(); i++) {
                if (cancelled) return;
                await new Promise(r => setTimeout(r, 500));
            }
            if (cancelled) return;
            if (eciesRegisteringRef.current) return;

            const playerAddr = canonicalAddress();
            if (!playerAddr) {
                console.warn('[ECIES] No canonical address resolvable — skipping register-pubkey');
                return;
            }

            eciesRegisteringRef.current = true;
            try {
                await GM.registerEciesPubkey(roomId, playerAddr, walletClient, chainId);
                if (mountedRef.current && !cancelled) setEciesRegistered(true);
                console.log('[ECIES] Public key registered with GM server');
            } catch (e) {
                console.warn('[ECIES] register-pubkey error:', e);
            } finally {
                eciesRegisteringRef.current = false;
            }
        };

        runRegistration();

        return () => { cancelled = true; };
    }, [currentRoomId, address, chainId, eciesRegistered, walletClient]);

    // 1. Авто-переход при смене фазы в блокчейне
    //    Set a flag so /game can show the countdown overlay (non-blocking)
    useEffect(() => {
        if (gameState.phase === GamePhase.SHUFFLING || gameState.phase === GamePhase.REVEAL) {
            try { sessionStorage.setItem('mafia_show_start_countdown', '1'); } catch { /* ignore */ }
            router.push('/game');
        }
    }, [gameState.phase, router]);

    // 2. Room creator (first player) can start the game
    const isRoomCreator = gameState.players[0]?.address.toLowerCase() === myPlayer?.address.toLowerCase();
    const isParticipant = gameState.players.some(p => p.address.toLowerCase() === myPlayer?.address.toLowerCase());

    // V4: Min 4 players for proper mafia game
    const minPlayers = 4;
    const canStartGame = isRoomCreator && gameState.players.length >= minPlayers;

    const handleStart = async () => {
        if (isTxPending) return;
        await startGameOnChain();
    };

    return (
        <div className="relative w-full h-[100dvh] font-['Montserrat'] flex flex-col items-center justify-center overflow-y-auto overflow-x-hidden p-4 custom-scrollbar">
            {/* Background is provided by RootLayout/DynamicBackground */}

            {/* How to Play modal + top-right trigger button */}
            <HowToPlayModal />
            <button
                onClick={() => window.dispatchEvent(new Event('open-how-to-play'))}
                className="fixed top-4 right-4 z-[100] w-11 h-11 flex items-center justify-center rounded-full bg-[#0A0A0A] border border-[#916A47]/30 hover:border-[#916A47]/60 hover:bg-[#1A130A] transition-all shadow-[0_5px_15px_rgba(0,0,0,0.8)]"
                title="How to Play"
                aria-label="How to Play"
            >
                <HelpCircle className="w-5 h-5 text-[#916A47]" />
            </button>

            {/* Sticky header — always visible at top */}
            <div className="fixed top-0 left-0 w-full z-50 px-4 pt-4 pb-2">
                <div className="max-w-[600px] mx-auto">
                    <BackButton
                        to="/setup"
                        label="Leave Lobby"
                        exitGame
                        exitContext="lobby"
                        onExitGame={async () => { await forfeitGameOnChain(); }}
                        isLoading={isTxPending}
                    />
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 w-full max-w-[600px] flex flex-col items-center gap-4 md:gap-6 py-6 md:py-10"
            >

                <div className="flex flex-col items-center text-center gap-2">

                    <h1 className="text-white text-3xl font-['Cinzel'] font-light tracking-widest uppercase">
                        {lobbyName || 'Game Lobby'}
                    </h1>

                    {currentRoomId !== null && (
                        <button
                            type="button"
                            onClick={() => {
                                try {
                                    navigator.clipboard.writeText(String(currentRoomId));
                                } catch { /* ignore — not a critical action */ }
                            }}
                            className="group inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#19130D]/60 border border-[#C49A3C]/25 hover:border-[#C49A3C]/55 hover:bg-[#19130D]/90 transition-colors"
                            title="Copy Room ID"
                        >
                            <span className="text-[#C49A3C]/70 text-[9px] uppercase tracking-[0.2em] font-bold font-['Montserrat']">
                                Room
                            </span>
                            <span className="text-[#C49A3C] text-[12px] font-bold font-mono tabular-nums">
                                #{String(currentRoomId)}
                            </span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#C49A3C]/40 group-hover:text-[#C49A3C]/80 transition-colors">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                    )}

                </div>

                {/* Prize Pool Banner — only when there's an actual pool. Use
                    explicit `> 0n` so a `0n` value can't short-circuit through
                    JSX and render as the literal text "0" (React 18 renders
                    BigInt). */}
                {(gameState.prizePool ?? 0n) > 0n && (
                    <div className="w-full bg-gradient-to-r from-[#2A1F0A]/90 to-[#19130D]/90 backdrop-blur-xl rounded-2xl px-5 py-4 border border-[#C49A3C]/25 shadow-[0_4px_20px_rgba(196,154,60,0.1)] flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[#C49A3C]/60 text-[10px] uppercase tracking-widest font-bold font-['Montserrat']">
                                {gameState.isTournament ? 'Tournament Prize Pool' : 'Prize Pool'}
                            </span>
                            {(gameState.buyIn ?? 0n) > 0n && (
                                <span className="text-white/50 text-[10px] font-mono">
                                    Buy-in: {parseFloat(formatEther(gameState.buyIn ?? 0n)).toFixed(2)} {currencySymbol}
                                </span>
                            )}
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-[#C49A3C] text-2xl md:text-3xl font-bold font-['Montserrat'] tabular-nums">
                                {parseFloat(formatEther(gameState.prizePool ?? 0n)).toFixed(2)}
                            </span>
                            <span className="text-[#C49A3C]/50 text-sm font-bold">
                                {currencySymbol}
                            </span>
                        </div>
                    </div>
                )}

                <div className="w-full bg-[rgba(15,10,5,0.85)] backdrop-blur-xl rounded-[32px] p-4 md:p-6 border border-white/5 shadow-2xl flex flex-col">
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2 h-[250px] md:h-[350px]">
                        {gameState.players.map((player, index) => {
                            const isMe = player.address.toLowerCase() === myPlayer?.address.toLowerCase();

                            return (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={player.address}
                                    className={`w-full p-3 md:p-4 rounded-2xl flex justify-between items-center border transition-all ${isMe ? 'bg-[#916A47]/10 border-[#916A47]/30' : 'bg-white/[0.02] border-white/5'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${isMe ? 'bg-[#916A47] text-black' : 'bg-white/5 text-white/40'
                                            }`}>
                                            {index + 1}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`font-medium ${isMe ? 'text-[#916A47]' : 'text-white'}`}>
                                                {player.name} {isMe && '(You)'}
                                            </span>
                                            <span className="text-[10px] font-mono text-white/50">
                                                {player.address.slice(0, 6)}...{player.address.slice(-4)}
                                            </span>
                                        </div>
                                    </div>
                                    {index === 0 && (
                                        <span className="text-[9px] bg-[#916A47]/20 text-[#916A47] px-2 py-1 rounded border border-[#916A47]/30 uppercase font-bold">
                                            Creator
                                        </span>
                                    )}
                                </motion.div>
                            );
                        })}

                        {gameState.players.length === 0 && !isTxPending && (
                            <div className="py-20 text-center text-white/50 italic">
                                Connecting to network...
                            </div>
                        )}
                    </div>

                    <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between">
                        <div className="text-white/60 text-[10px] uppercase tracking-tighter font-mono flex items-center gap-2">
                            {/* Refresh button removed per user request */}
                        </div>
                        <div className="text-white/60 text-sm">
                            Players: <span className="text-[#916A47] font-bold">{gameState.players.length}/{gameState.maxPlayers}</span>
                        </div>
                    </div>
                </div>

                {/* Session Key Management */}
                {currentRoomId !== null && (
                    <SessionKeyBanner
                        roomId={Number(currentRoomId)}
                        className="w-full"
                        defaultExpanded={true}
                    />
                )}

                {/* Room creator can start the game when enough players */}
                {canStartGame ? (
                    <div className="w-full flex flex-col gap-3">
                        <Button
                            onClick={handleStart}
                            isLoading={isTxPending}
                            disabled={isTxPending}
                            variant="primary-lobby"
                            className="w-full h-[60px] md:h-[70px] text-xl tracking-widest uppercase shadow-[0_10px_40px_rgba(145,106,71,0.2)]"
                        >
                            {isTxPending ? "Starting..." : "Start Game"}
                        </Button>

                        {gameState.isTournament && (
                            <button
                                onClick={async () => {
                                    if (gameState.tournamentId && await showConfirm("Are you sure you want to cancel this tournament? All players will be refunded.", { title: 'Cancel Tournament', variant: 'danger', confirmLabel: 'Cancel Tournament', cancelLabel: 'Keep' })) {
                                        await cancelTournamentOnChain(gameState.tournamentId);
                                    }
                                }}
                                disabled={isTxPending}
                                className="w-full py-3 text-red-500/60 hover:text-red-500 transition-colors text-xs uppercase tracking-widest font-bold"
                            >
                                Cancel Tournament
                            </button>
                        )}
                    </div>
                ) : isParticipant ? (
                    <div className="w-full p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center backdrop-blur-sm">
                        <p className="text-white/60 text-sm italic">
                            {!isRoomCreator && gameState.players.length >= minPlayers
                                ? "Waiting for Host to start the game..."
                                : `Waiting for more players (${gameState.players.length}/${minPlayers} minimum)...`}
                        </p>
                    </div>
                ) : (
                    <div className="w-full p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center backdrop-blur-sm">
                        <p className="text-white/60 text-sm italic">
                            Connecting to room...
                        </p>
                    </div>
                )}
            </motion.div>
        </div>
    );
};