// components/game/GameOver.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useGameContext } from '../../contexts/GameContext';
import { usePublicClient, useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { MAFIA_ABI } from '../../contracts/config';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';

import { Role, GamePhase } from '../../types';
import { Button } from '../ui/Button';
import { useSoundEffects } from '../ui/SoundEffects';
import { Trophy, Skull, Users, Shield, Search, Home, RotateCcw, Eye, Coins, Share2 } from 'lucide-react';
import { MicButton } from './MicButton';

const RoleIcons: Record<Role, React.ReactNode> = {
    [Role.MAFIA]: <Skull className="w-5 h-5 text-[#8B0000]" />,
    [Role.DOCTOR]: <Shield className="w-5 h-5 text-[#0D9488]" />,
    [Role.DETECTIVE]: <Search className="w-5 h-5 text-[#B45309]" />,
    [Role.CIVILIAN]: <Users className="w-5 h-5 text-[#6B5A4A]" />,
    [Role.UNKNOWN]: <Users className="w-5 h-5 text-gray-500" />
};

const RoleColors: Record<Role, string> = {
    [Role.MAFIA]: 'text-[#8B0000]',
    [Role.DOCTOR]: 'text-[#0D9488]',
    [Role.DETECTIVE]: 'text-[#B45309]',
    [Role.CIVILIAN]: 'text-[#6B5A4A]',
    [Role.UNKNOWN]: 'text-gray-500'
};

// Brighter inline-style variants used where readability over the dark
// vignette matters (verdict text, role badge under winner avatars).
// Civilian gets a lifted bronze instead of the muted #6B5A4A so it stays
// legible in Montserrat at 10–11px.
const RoleAccent: Record<Role, string> = {
    [Role.MAFIA]: '#B33A3A',
    [Role.DOCTOR]: '#14B8A6',
    [Role.DETECTIVE]: '#D17A3F',
    [Role.CIVILIAN]: '#C49A6C',
    [Role.UNKNOWN]: '#9CA3AF',
};

// Hard cap on display nicknames so the endgame cards stay aligned regardless
// of name length (CSS truncate is a fallback; this guarantees the share PNG
// also gets a clean cut even if html2canvas mishandles text-overflow).
const truncateName = (name: string, max: number): string =>
    name.length > max ? name.slice(0, max - 1) + '…' : name;

type Winner = 'MAFIA' | 'TOWN' | 'DRAW' | 'ABORTED';

export const GameOver: React.FC = React.memo(() => {
    const { gameState, myPlayer, currentRoomId, isTestMode, isTxPending, runtimeContractAddress, currencySymbol, distributePrizesOnChain, runtimeChain, fetchOnChainRoles, fetchGMRoles } = useGameContext();

    // Local reveal timeout — shows "Unknown" instead of "revealing..." after 30s
    const [revealTimedOut, setRevealTimedOut] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setRevealTimedOut(true), 30000);
        return () => clearTimeout(t);
    }, []);
    const publicClient = usePublicClient();
    const { address } = useAccount();

    // Note: session-wallet gas drain is already handled by runEndGameCleanup
    // in useEndGame.ts ([SessionDrain] log) — no duplicate sweep needed here.
    const router = useRouter();
    // Winner state is managed by useEndGame hook
    const [refundClaimed, setRefundClaimed] = useState(false);
    const [refundAutomatic, setRefundAutomatic] = useState(false);
    const [depositAmount, setDepositAmount] = useState<string>('0');
    const [prizesClaimed, setPrizesClaimed] = useState(false);
    const [showPrizePopup, setShowPrizePopup] = useState(false);
    const [prizeDistributionFailed, setPrizeDistributionFailed] = useState(false);
    const [prizeTxHash, setPrizeTxHash] = useState<string | null>(null);
    const prevPrizesClaimedRef = useRef(false);
    const { playTownWin, playMafiaWin, stopVictoryMusic } = useSoundEffects();
    const hasPlayedSound = useRef(false);
    const playersRef = useRef(gameState.players);
    useEffect(() => { playersRef.current = gameState.players; }, [gameState.players]);
    const [winner, setWinner] = useState<Winner | null>((gameState.winner as Winner) || null);

    // Sync local winner state when gameState.winner changes
    useEffect(() => {
        if (gameState.winner) {
            setWinner(gameState.winner as Winner);
        }
    }, [gameState.winner]);

    // Winner fallback logic moved to useEndGame hook

    // revealTimedOut and role fetching now handled by useEndGame hook


    // Poll prizesClaimed status for tournaments
    useEffect(() => {
        if (!publicClient || !currentRoomId || !gameState.isTournament) return;
        if (prizesClaimed) return;

        const checkPrizes = async () => {
            try {
                const roomData = await publicClient.readContract({
                    address: runtimeContractAddress,
                    abi: MAFIA_ABI,
                    functionName: 'getRoom',
                    args: [currentRoomId],
                }) as any;
                const tournamentId = Array.isArray(roomData) ? BigInt(roomData[19] || 0) : BigInt(roomData.tournamentId || 0);
                if (tournamentId === 0n) return;

                const tData = await publicClient.readContract({
                    address: runtimeContractAddress,
                    abi: MAFIA_ABI,
                    functionName: 'getTournament',
                    args: [tournamentId],
                }) as any;
                const claimed = Array.isArray(tData) ? Boolean(tData[13]) : Boolean(tData.prizesClaimed);
                if (claimed) setPrizesClaimed(true);
            } catch (e) {
                console.warn('[GameOver] Failed to check prizesClaimed:', e);
            }
        };

        checkPrizes();
        const iv = setInterval(checkPrizes, 5000);
        return () => clearInterval(iv);
    }, [publicClient, currentRoomId, gameState.isTournament, runtimeContractAddress, prizesClaimed]);

    // Show prize popup when prizes transition from unclaimed → claimed
    useEffect(() => {
        if (prizesClaimed && !prevPrizesClaimedRef.current) {
            prevPrizesClaimedRef.current = true;
            setShowPrizePopup(true);
            setPrizeDistributionFailed(false);

            // Find distribute tx hash for explorer link (all clients)
            if (currentRoomId && publicClient) {
                const storedHash = localStorage.getItem(`prize_tx_${currentRoomId}`);
                if (storedHash) {
                    setPrizeTxHash(storedHash);
                } else {
                    // Search on-chain logs in small chunks (Somnia RPC limit ~1000 blocks)
                    (async () => {
                        try {
                            const { parseAbiItem } = await import('viem');
                            const prizeEvent = parseAbiItem('event PrizeDistributed(uint256 indexed roomId, address indexed winner, uint128 amount)');
                            const currentBlock = await publicClient.getBlockNumber();

                            for (let offset = 0n; offset < 30000n; offset += 900n) {
                                const to = currentBlock - offset;
                                const from = to > 900n ? to - 900n : 0n;
                                if (to <= 0n) break;

                                const logs = await publicClient.getLogs({
                                    address: runtimeContractAddress,
                                    event: prizeEvent,
                                    args: { roomId: currentRoomId },
                                    fromBlock: from,
                                    toBlock: to,
                                });

                                if (logs.length > 0) {
                                    const hash = logs[0].transactionHash;
                                    setPrizeTxHash(hash);
                                    // Cache so other useEffect cycles find it instantly
                                    localStorage.setItem(`prize_tx_${currentRoomId}`, hash);
                                    break;
                                }
                            }
                        } catch (e) {
                            console.warn('[GameOver] Prize tx search failed:', e);
                        }
                    })();
                }
            }
        }
    }, [prizesClaimed, currentRoomId, publicClient, runtimeContractAddress]);

    // Calculate payouts reactively from game state — recalculates as roles/prizePool load in
    // Use buyIn * playersCount as the pool since on-chain prizePool resets to 0 after distribution
    const prizePayouts = React.useMemo(() => {
        if (!prizesClaimed || !winner) return [];

        const mafiaWon = winner === 'MAFIA';
        const players = gameState.players;

        // prizePool is 0 after distribution, so reconstruct from buyIn
        const pool = (gameState.buyIn && gameState.buyIn > 0n)
            ? gameState.buyIn * BigInt(players.length)
            : gameState.prizePool || 0n;

        if (pool <= 0n || players.length === 0) return [];

        const fee = pool / 10n;
        const distributable = pool - fee;

        let totalShares = 0n;
        const shares: { address: string; multiplier: bigint }[] = [];

        for (const p of players) {
            const isMafia = p.role === Role.MAFIA;
            const isWinnerPlayer = mafiaWon ? isMafia : (!isMafia && p.role !== Role.UNKNOWN);
            if (isWinnerPlayer) {
                const m = p.isAlive ? 2n : 1n;
                shares.push({ address: p.address, multiplier: m });
                totalShares += m;
            }
        }

        if (totalShares === 0n) return [];

        const perShare = distributable / totalShares;
        return shares.map(s => ({
            winner: s.address,
            amount: perShare * s.multiplier,
        }));
    }, [prizesClaimed, winner, gameState.players, gameState.prizePool]);

    // Fallback: if tournament prizes not claimed after 20s, show manual button
    useEffect(() => {
        if (!gameState.isTournament || prizesClaimed) return;
        const t = setTimeout(() => {
            if (!prizesClaimed) setPrizeDistributionFailed(true);
        }, 20000);
        return () => clearTimeout(t);
    }, [gameState.isTournament, prizesClaimed]);

    // Check player deposit amount
    useEffect(() => {
        if (!publicClient || !currentRoomId || !address) return;

        const checkDeposit = async () => {
            try {
                const [deposit, room, defaultDeposit] = await Promise.all([
                    publicClient.readContract({
                        address: runtimeContractAddress,
                        abi: MAFIA_ABI,
                        functionName: 'getPlayerDeposit',
                        args: [currentRoomId, address],
                    }) as Promise<bigint>,
                    publicClient.readContract({
                        address: runtimeContractAddress,
                        abi: MAFIA_ABI,
                        functionName: 'getRoom',
                        args: [currentRoomId],
                    }) as Promise<any>,
                    publicClient.readContract({
                        address: runtimeContractAddress,
                        abi: MAFIA_ABI,
                        functionName: 'getDefaultDeposit',
                    }) as Promise<bigint>,
                ]);

                const depositPool = Array.isArray(room) ? room[room.length - 2] : room.depositPool;
                const depositPerPlayer = Array.isArray(room) ? room[room.length - 1] : room.depositPerPlayer;

                console.log(`[Deposit Debug] GameOver screen:`, {
                    roomId: currentRoomId.toString(),
                    myDeposit: formatEther(deposit) + ' ' + currencySymbol,
                    depositPool: formatEther(depositPool) + ' ' + currencySymbol,
                    depositPerPlayer: formatEther(depositPerPlayer) + ' ' + currencySymbol,
                    defaultDeposit: formatEther(defaultDeposit) + ' ' + currencySymbol,
                    canClaimRefund: deposit > 0n,
                    alreadyRefunded: deposit === 0n,
                });

                setDepositAmount(formatEther(deposit));
                if (deposit === 0n) {
                    console.log(`[Deposit Debug] Deposit is 0 at GameOver mount — contract auto-refunded during endGame.`, {
                        roomId: currentRoomId.toString(),
                        depositPool: formatEther(depositPool) + ' ' + currencySymbol,
                        depositPerPlayer: formatEther(depositPerPlayer) + ' ' + currencySymbol,
                    });
                    setRefundClaimed(true);
                    setRefundAutomatic(true);
                } else {
                    console.log(`[Deposit Debug] Deposit still held — manual claimRefund needed.`);
                }
            } catch (e) {
                console.warn('[GameOver] Failed to check deposit:', e);
            }
        };

        checkDeposit();
    }, [publicClient, currentRoomId, address]);



    // Role reveal logic is now in useEndGame hook — GameOver reads from context

    // Музыка победы — играет синхронно с появлением title (через 600ms после mount)
    useEffect(() => {
        if (hasPlayedSound.current || !winner) return;
        const t = setTimeout(() => {
            if (winner === 'MAFIA') playMafiaWin();
            else if (winner === 'TOWN') playTownWin();
            hasPlayedSound.current = true;
        }, 600);
        return () => clearTimeout(t);
    }, [winner, playMafiaWin, playTownWin]);

    // Cleanup victory music on unmount
    useEffect(() => () => stopVictoryMusic(), [stopVictoryMusic]);

    const myRole = myPlayer?.role || Role.UNKNOWN;

    const didIWin =
        (winner === 'MAFIA' && myRole === Role.MAFIA) ||
        (winner === 'TOWN' && (myRole === Role.CIVILIAN || myRole === Role.DOCTOR || myRole === Role.DETECTIVE));

    const winnerConfig = React.useMemo(() => ({
        'MAFIA': {
            title: 'Mafia Wins!',
            description: 'The mafia has taken control of the town...',
            color: 'text-[#8B0000]',
            bg: 'from-[#8B0000]/25 to-[#0A0705]/80 border-[#8B0000]/30',
            trophy: 'text-[#8B0000]'
        },
        'TOWN': {
            title: 'Town Wins!',
            description: 'Justice prevails! All evil has been eliminated.',
            color: 'text-[#916A47]',
            bg: 'from-[#916A47]/20 to-[#0A0705]/80 border-[#916A47]/30',
            trophy: 'text-[#916A47]'
        },
        'DRAW': {
            title: 'Draw!',
            description: 'No one survived...',
            color: 'text-gray-400',
            bg: 'from-gray-950/50 to-gray-900/30 border-gray-500/30',
            trophy: 'text-gray-500'
        },
        'ABORTED': {
            title: 'Game Aborted',
            description: 'The game was cancelled before the first round. Every player has been refunded in full — deposit and buy-in are already back on your wallet.',
            color: 'text-[#C49A6C]',
            bg: 'from-[#C49A6C]/15 to-[#0A0705]/80 border-[#C49A6C]/30',
            trophy: 'text-[#C49A6C]'
        }
    }), []);

    const handlePlayAgain = useCallback(() => {
        stopVictoryMusic();
        sessionStorage.removeItem('currentRoomId');
        localStorage.removeItem('currentRoomId');
        router.push('/setup');
    }, [stopVictoryMusic, router]);

    const handleHome = useCallback(() => {
        stopVictoryMusic();
        sessionStorage.removeItem('currentRoomId');
        localStorage.removeItem('currentRoomId');
        router.push('/');
    }, [stopVictoryMusic, router]);

    // ─── Cinematic reveal sequencing ──────────────────────────────────────
    const [revealStage, setRevealStage] = useState<'curtain' | 'title' | 'winners' | 'losers' | 'actions'>('curtain');
    useEffect(() => {
        if (!winner) return;
        const t1 = setTimeout(() => setRevealStage('title'), 600);
        const t2 = setTimeout(() => setRevealStage('winners'), 1800);
        const t3 = setTimeout(() => setRevealStage('losers'), 3200);
        const t4 = setTimeout(() => setRevealStage('actions'), 4400);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }, [winner]);

    // ─── Share / Screenshot ──────────────────────────────────────────────
    const shareCardRef = useRef<HTMLDivElement>(null);
    const [isSharing, setIsSharing] = useState(false);

    const generateImage = useCallback(async (): Promise<Blob | null> => {
        if (!shareCardRef.current) return null;
        try {
            const dataUrl = await toPng(shareCardRef.current, {
                cacheBust: true,
                pixelRatio: 2,
                backgroundColor: '#050505',
            });
            const res = await fetch(dataUrl);
            return await res.blob();
        } catch (e) {
            console.error('[GameOver] Screenshot generation failed:', e);
            return null;
        }
    }, []);

    const handleShare = useCallback(async () => {
        setIsSharing(true);
        try {
            const blob = await generateImage();
            if (!blob) {
                toast.error('Failed to generate screenshot');
                return;
            }
            const file = new File([blob], `mafia-onchain-${Date.now()}.png`, { type: 'image/png' });
            const shareText = winner === 'MAFIA'
                ? `🔪 The Mafia has won on Mafia OnChain! I played as ${myRole}.`
                : winner === 'TOWN'
                    ? `⚖️ Justice prevails on Mafia OnChain! I played as ${myRole}.`
                    : `🎲 What a game on Mafia OnChain!`;

            // Try Web Share API with file
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Mafia OnChain',
                    text: shareText,
                });
                return;
            }

            // Fallback: download the image
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `mafia-onchain-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('Screenshot downloaded');
        } catch (e: any) {
            if (e?.name !== 'AbortError') {
                console.error('[GameOver] Share failed:', e);
                toast.error('Share failed');
            }
        } finally {
            setIsSharing(false);
        }
    }, [generateImage, winner, myRole]);

    if (!winner) {
        // Quiet placeholder while the chain settles & roles reveal — the endgame
        // screen takes over the moment a winner is known. No big "Game Over!" splash.
        return (
            <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center pointer-events-auto">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
                    className="w-9 h-9 border-2 border-[#916A47]/60 border-t-transparent rounded-full"
                />
            </div>
        );
    }

    // ─── Pre-DAY abort screen ────────────────────────────────────────────
    // The game was cancelled before reaching DAY. Nobody got a role, nobody
    // died, nobody won. LibGame.abortPreGame has already refunded every
    // player (deposit + buy-in + freeroll sponsor prize to organizer). Skip
    // the winners/losers cinematic entirely and show a calm refund screen.
    if (winner === 'ABORTED') {
        const abortConfig = winnerConfig.ABORTED;
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="fixed inset-0 z-[100] bg-black pointer-events-auto flex flex-col items-center justify-center px-6"
            >
                <div
                    className="fixed inset-0 pointer-events-none"
                    style={{
                        background: `radial-gradient(ellipse at center, #C49A6C22 0%, rgba(0,0,0,0.95) 55%, #000 100%)`,
                    }}
                />
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                    className="relative max-w-xl text-center"
                >
                    <h1
                        className="font-['Cinzel'] uppercase font-bold mb-6"
                        style={{
                            fontSize: 'clamp(2.25rem, 6vw, 4rem)',
                            color: '#C49A6C',
                            letterSpacing: '0.2em',
                            textShadow: '0 0 22px #C49A6C99, 0 0 50px #C49A6C55',
                        }}
                    >
                        {abortConfig.title}
                    </h1>
                    <p className="text-white/80 text-[15px] md:text-[17px] leading-relaxed mb-10 font-['Montserrat']">
                        {abortConfig.description}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={handlePlayAgain}
                            className="h-12 px-8 rounded-md text-[13px] uppercase tracking-[0.14em] font-bold transition-all active:scale-[0.98] cursor-pointer"
                            style={{
                                border: '1px solid #C49A6C',
                                color: '#0A0A0A',
                                backgroundColor: '#C49A6C',
                                boxShadow: '0 6px 18px rgba(196,154,108,0.18)',
                            }}
                        >
                            Play Again
                        </button>
                        <button
                            onClick={handleHome}
                            className="h-12 px-8 rounded-md border border-white/15 text-white/75 text-[13px] uppercase tracking-[0.12em] font-semibold hover:border-white/30 hover:text-white hover:bg-white/[0.04] transition-all active:scale-[0.98] cursor-pointer"
                        >
                            Home
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        );
    }

    const config = winnerConfig[winner];

    const accentColor = winner === 'MAFIA' ? '#8B0000' : winner === 'TOWN' ? '#C49A6C' : '#9ca3af';
    const winners = gameState.players.filter(p => {
        if (winner === 'MAFIA') return p.role === Role.MAFIA;
        if (winner === 'TOWN') return p.role !== Role.MAFIA && p.role !== Role.UNKNOWN;
        return p.isAlive;
    });
    // Everyone who isn't a winner shows up as defeated — including UNKNOWN roles,
    // so the full player roster is always visible in the endgame screen.
    const winnerAddrs = new Set(winners.map(w => w.address.toLowerCase()));
    const losers = gameState.players.filter(p => !winnerAddrs.has(p.address.toLowerCase()));

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-[100] bg-black pointer-events-auto overflow-y-auto overflow-x-hidden custom-scrollbar h-[100dvh] w-screen"
        >
            {/* Atmospheric background — radial vignette */}
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    background: `radial-gradient(ellipse at center, ${accentColor}22 0%, rgba(0,0,0,0.95) 55%, #000 100%)`,
                }}
            />

            {/* Animated light pulse from center (calmer than before) */}
            <motion.div
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full"
                initial={{ width: 0, height: 0, opacity: 0 }}
                animate={{ width: '700px', height: '700px', opacity: [0, 0.1, 0.06] }}
                transition={{ delay: 0.4, duration: 2.5, ease: 'easeOut' }}
                style={{ filter: 'blur(160px)', backgroundColor: accentColor }}
            />

            {/* Post-game Global Voice Chat */}
            {currentRoomId && myPlayer && (
                <div className="fixed top-6 right-6 z-[110] flex items-center gap-3 bg-black/50 backdrop-blur-md px-4 py-2 border border-white/10 rounded-full shadow-lg">
                    <span className="text-white/60 text-xs font-medium uppercase tracking-wider">Post-Game Chat</span>
                    <MicButton
                        roomId={`${currentRoomId.toString()}-postgame`}
                        userName={myPlayer.name}
                        isMyTurn={true}
                        freeTalk={true}
                    />
                </div>
            )}

            <div className="relative w-full min-h-[100dvh] flex flex-col items-center justify-center py-12 px-4 md:px-8">
                {/* === SHAREABLE CARD === */}
                {/* Background color is intentionally not set here; html-to-image
                    applies its own backgroundColor when generating the screenshot,
                    so the on-screen card stays transparent over the cinematic bg. */}
                <div
                    ref={shareCardRef}
                    className="relative w-full max-w-4xl flex flex-col items-center py-10 px-6"
                >
                    {/* Massive title with glow */}
                    <AnimatePresence>
                        {revealStage !== 'curtain' && (
                            <motion.h1
                                key="title"
                                initial={{ opacity: 0, scale: 1.4, y: 40, filter: 'blur(20px)' }}
                                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                                className="font-['Cinzel'] uppercase font-bold text-center"
                                style={{
                                    fontSize: 'clamp(2.5rem, 7vw, 5rem)',
                                    color: accentColor,
                                    letterSpacing: '0.2em',
                                    textShadow: `0 0 22px ${accentColor}99, 0 0 50px ${accentColor}55, 0 4px 20px rgba(0,0,0,0.85)`,
                                    lineHeight: 1.1,
                                }}
                            >
                                {config.title.replace('!', '')}
                            </motion.h1>
                        )}
                    </AnimatePresence>

                    {/* Subtitle / description */}
                    <AnimatePresence>
                        {(revealStage === 'winners' || revealStage === 'losers' || revealStage === 'actions') && (
                            <motion.p
                                key="desc"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6 }}
                                className="text-white/50 text-sm md:text-base text-center mt-3 italic font-['Montserrat'] tracking-wide max-w-md"
                            >
                                {config.description}
                            </motion.p>
                        )}
                    </AnimatePresence>

                    {/* Decorative ornament */}
                    {revealStage !== 'curtain' && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: '220px', opacity: 1 }}
                            transition={{ delay: 0.6, duration: 0.8 }}
                            className="h-px my-8"
                            style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
                        />
                    )}

                    {/* === WINNERS — emerge from shadows === */}
                    <AnimatePresence>
                        {(revealStage === 'winners' || revealStage === 'losers' || revealStage === 'actions') && winners.length > 0 && (
                            <motion.div
                                key="winners"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.4 }}
                                className="w-full mb-2"
                            >
                                <p
                                    className="text-center text-xs md:text-sm uppercase tracking-[0.5em] mb-8 font-['Cinzel'] font-bold"
                                    style={{
                                        color: '#fff',
                                        opacity: 0.85,
                                        textShadow: `0 0 14px ${accentColor}66, 0 2px 8px rgba(0,0,0,0.85)`,
                                    }}
                                >
                                    {winner === 'MAFIA'
                                        ? (winners.length === 1 ? '— The Mafia —' : '— The Family —')
                                        : winner === 'TOWN' ? '— The Family —' : '— Survivors —'}
                                </p>
                                <div className="flex flex-wrap items-end justify-center gap-4 md:gap-6">
                                    {winners.map((player, index) => {
                                        const isMe = player.address.toLowerCase() === myPlayer?.address.toLowerCase();
                                        const role = player.role;
                                        const roleBadgeColor = RoleAccent[role] ?? '#C49A6C';
                                        return (
                                            <motion.div
                                                key={player.address}
                                                initial={{ opacity: 0, y: 40, filter: 'blur(20px) brightness(0.1)' }}
                                                animate={{ opacity: 1, y: 0, filter: 'blur(0px) brightness(1)' }}
                                                transition={{ delay: 0.2 + index * 0.3, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                                                className="flex flex-col items-center w-[120px] md:w-[132px] shrink-0"
                                            >
                                                <div className="relative">
                                                    {/* Glow halo — unified team accent */}
                                                    <div
                                                        className="absolute inset-0 rounded-full blur-3xl"
                                                        style={{ backgroundColor: accentColor, opacity: 0.28, transform: 'scale(1.25)' }}
                                                    />
                                                    {/* Avatar — border in unified team accent */}
                                                    <div
                                                        className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2"
                                                        style={{
                                                            borderColor: accentColor,
                                                            boxShadow: `0 0 18px ${accentColor}99, inset 0 0 16px rgba(0,0,0,0.55)`,
                                                        }}
                                                    >
                                                        {player.avatarUrl ? (
                                                            <Image src={player.avatarUrl} alt={player.name} fill sizes="96px" className="object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full bg-[#19130D] flex items-center justify-center">
                                                                {RoleIcons[role] || <Users className="w-8 h-8 text-white/50" />}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Trophy — only for survivors, unified team accent, lifted higher with breathing room */}
                                                    {player.isAlive && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 8, scale: 0 }}
                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                            transition={{ delay: 0.2 + index * 0.3 + 0.7, type: 'spring', stiffness: 200 }}
                                                            className="absolute -top-7 left-1/2 -translate-x-1/2"
                                                        >
                                                            <Trophy className="w-6 h-6" style={{ color: accentColor, filter: `drop-shadow(0 0 12px ${accentColor})` }} />
                                                        </motion.div>
                                                    )}
                                                </div>

                                                {/* Name — unified team accent shadow. "you" marker is a
                                                    coloured dot BEFORE the name so it never gets eaten by
                                                    the truncate ellipsis on long nicknames. */}
                                                <p
                                                    className="mt-4 font-['Cinzel'] font-bold uppercase tracking-wider text-base md:text-lg text-center w-full truncate"
                                                    style={{
                                                        color: '#fff',
                                                        textShadow: `0 0 10px ${accentColor}99, 0 2px 8px rgba(0,0,0,0.85)`,
                                                    }}
                                                    title={player.name}
                                                >
                                                    {isMe && <span className="mr-1.5" style={{ color: accentColor }}>●</span>}
                                                    {truncateName(player.name, 13)}
                                                </p>
                                                {/* Role badge — kept per-role colour, Montserrat for document feel */}
                                                <p
                                                    className="text-[10px] uppercase tracking-[0.25em] mt-1 font-['Montserrat'] font-bold"
                                                    style={{ color: roleBadgeColor }}
                                                >
                                                    {role}
                                                </p>
                                                {!player.isAlive && (
                                                    <span className="text-[9px] text-white/30 mt-0.5 italic font-['Montserrat']">posthumous</span>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* === LOSERS — dim, grayscale, small === */}
                    <AnimatePresence>
                        {(revealStage === 'losers' || revealStage === 'actions') && losers.length > 0 && (
                            <motion.div
                                key="losers"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8 }}
                                className="w-full mt-12"
                            >
                                <p
                                    className="text-center text-xs md:text-sm uppercase tracking-[0.5em] mb-6 font-['Cinzel'] font-bold"
                                    style={{
                                        color: '#fff',
                                        opacity: 0.7,
                                        textShadow: '0 0 12px rgba(139,0,0,0.45), 0 2px 6px rgba(0,0,0,0.85)',
                                    }}
                                >
                                    — Defeated —
                                </p>
                                <div className="flex flex-wrap items-start justify-center gap-4 md:gap-5">
                                    {losers.map((player, index) => {
                                        const role = player.role;
                                        const isMe = player.address.toLowerCase() === myPlayer?.address.toLowerCase();
                                        const isAlive = player.isAlive;
                                        const roleBadgeColor = RoleAccent[role] ?? '#9CA3AF';
                                        return (
                                            <motion.div
                                                key={player.address}
                                                initial={{ opacity: 0, scale: 0.85, y: 10 }}
                                                animate={{ opacity: isAlive ? 1 : 0.88, scale: 1, y: 0 }}
                                                transition={{ delay: 0.1 + index * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                                                className="flex flex-col items-center w-[100px] shrink-0"
                                            >
                                                <div className="relative">
                                                    {/* Avatar — grayscale ONLY on the picture container so the role
                                                        badge below can stay coloured. Skull badge sits in the bottom
                                                        corner so the player's face is still readable. */}
                                                    <div
                                                        className={`relative w-16 h-16 md:w-[72px] md:h-[72px] rounded-full overflow-hidden bg-[#0A0606] ${!isAlive ? 'grayscale contrast-110' : ''}`}
                                                        style={{
                                                            border: '1px solid rgba(139,0,0,0.55)',
                                                            boxShadow: '0 0 14px rgba(139,0,0,0.25), inset 0 0 22px rgba(0,0,0,0.75)',
                                                        }}
                                                    >
                                                        {player.avatarUrl ? (
                                                            <Image src={player.avatarUrl} alt={player.name} fill sizes="72px" className={`object-cover ${isAlive ? '' : 'opacity-65'}`} />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                {RoleIcons[role] || <Users className="w-6 h-6 text-white/40" />}
                                                            </div>
                                                        )}
                                                        {/* Permanent dark wash so they read as "fallen" */}
                                                        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/5 to-black/70 pointer-events-none" />
                                                    </div>

                                                    {/* Skull death badge — bottom-right corner, doesn't cover the face */}
                                                    {!isAlive && (
                                                        <div
                                                            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center bg-[#0a0606]"
                                                            style={{
                                                                border: '1px solid rgba(139,0,0,0.7)',
                                                                boxShadow: '0 0 10px rgba(139,0,0,0.5)',
                                                            }}
                                                        >
                                                            <Skull className="w-3.5 h-3.5 text-[#8B0000]" />
                                                        </div>
                                                    )}
                                                </div>
                                                <p
                                                    className="text-[11px] mt-2 font-['Cinzel'] font-bold uppercase tracking-[0.15em] truncate w-full text-center"
                                                    style={{
                                                        color: '#fff',
                                                        opacity: isAlive ? 0.85 : 0.7,
                                                        textShadow: '0 2px 6px rgba(0,0,0,0.85)',
                                                    }}
                                                    title={player.name}
                                                >
                                                    {isMe && <span className="mr-1" style={{ color: '#C49A6C' }}>●</span>}
                                                    {truncateName(player.name, 11)}
                                                </p>
                                                <p
                                                    className="text-[9px] uppercase tracking-[0.2em] mt-0.5 font-['Montserrat'] font-bold"
                                                    style={{ color: roleBadgeColor, opacity: isAlive ? 0.95 : 0.75 }}
                                                >
                                                    {role}
                                                </p>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* === Personal verdict === */}
                    <AnimatePresence>
                        {revealStage === 'actions' && (
                            <motion.div
                                key="verdict"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.7 }}
                                className="mt-14 text-center"
                            >
                                <p
                                    className="text-xs md:text-sm uppercase tracking-[0.5em] font-['Cinzel'] font-bold mb-3"
                                    style={{
                                        color: '#fff',
                                        opacity: 0.78,
                                        textShadow: '0 2px 6px rgba(0,0,0,0.85)',
                                    }}
                                >
                                    — Your Verdict —
                                </p>
                                <p
                                    className={`text-3xl md:text-5xl font-['Cinzel'] uppercase tracking-[0.25em] font-bold ${didIWin ? 'text-[#4caf82]' : 'text-white/55'}`}
                                    style={didIWin
                                        ? { textShadow: '0 0 30px rgba(76,175,130,0.85), 0 0 60px rgba(76,175,130,0.5), 0 0 120px rgba(76,175,130,0.25)' }
                                        : { textShadow: '0 2px 12px rgba(0,0,0,0.9)' }}
                                >
                                    {didIWin ? 'Victory' : 'Defeated'}
                                </p>
                                <p
                                    className="text-sm md:text-base mt-3 font-['Montserrat'] tracking-[0.35em] uppercase font-bold"
                                    style={{
                                        color: '#fff',
                                        opacity: 0.7,
                                        textShadow: '0 2px 6px rgba(0,0,0,0.85)',
                                    }}
                                >
                                    as{' '}
                                    <span
                                        style={{
                                            color: RoleAccent[myRole] ?? accentColor,
                                            opacity: 1,
                                            textShadow: `0 0 16px ${(RoleAccent[myRole] ?? accentColor)}aa, 0 0 32px ${(RoleAccent[myRole] ?? accentColor)}55`,
                                        }}
                                    >
                                        {myRole}
                                    </span>
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                </div>

                {/* === ACTION BUTTONS — outside shareable === */}
                <AnimatePresence>
                    {revealStage === 'actions' && (
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                            className="w-full max-w-2xl mt-10 flex flex-col gap-3"
                        >
                            {/* Tournament: Fallback distribute */}
                            {gameState.isTournament && prizeDistributionFailed && !prizesClaimed && (
                                <Button
                                    onClick={async () => {
                                        if (currentRoomId) { await distributePrizesOnChain(currentRoomId); }
                                    }}
                                    isLoading={isTxPending}
                                    className="w-full h-[60px] text-lg bg-[#916A47] hover:bg-[#A87B51] text-[#050505] font-bold border border-[#C5A059]/30 transition-colors shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                                >
                                    <Trophy className="w-5 h-5 mr-2" />
                                    Distribute Prize Pool
                                </Button>
                            )}

                            {/* Tournament: Confirmed distribution badge */}
                            {gameState.isTournament && prizesClaimed && (
                                <button
                                    onClick={() => setShowPrizePopup(true)}
                                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-[#4caf82]/8 border border-[#4caf82]/25 hover:bg-[#4caf82]/15 hover:border-[#4caf82]/40 transition-all cursor-pointer"
                                >
                                    <Coins className="w-4 h-4 text-[#4caf82]" />
                                    <span className="text-[#4caf82] text-sm font-['Montserrat'] font-bold uppercase tracking-wider">
                                        Prizes Distributed
                                    </span>
                                </button>
                            )}

                            <div className="flex gap-3">
                                <Button
                                    onClick={handlePlayAgain}
                                    className="flex-1 h-[60px] text-lg !text-white"
                                >
                                    <RotateCcw className="w-5 h-5 mr-2" />
                                    Play Again
                                </Button>
                                <Button
                                    onClick={handleHome}
                                    variant="outline-gold"
                                    className="flex-1 h-[60px] text-lg hover:bg-[#916A47] hover:border-[#916A47] hover:text-white"
                                >
                                    <Home className="w-5 h-5 mr-2" />
                                    Home
                                </Button>
                            </div>

                            {/* Share — quiet ghost link, no longer competing with Play Again */}
                            <button
                                onClick={handleShare}
                                disabled={isSharing}
                                className="mt-1 mx-auto flex items-center gap-2 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-white/35 hover:text-white/70 transition-colors disabled:opacity-50 disabled:cursor-wait font-['Cinzel']"
                            >
                                <Share2 className="w-3 h-3" />
                                {isSharing ? 'Generating...' : 'Share Result'}
                            </button>

                            {/* Refresh roles (if some are still unknown) */}
                            {!revealTimedOut && gameState.players.some(p => p.role === Role.UNKNOWN) && (
                                <button
                                    onClick={async () => { await Promise.all([fetchOnChainRoles(), fetchGMRoles()]); }}
                                    className="flex items-center justify-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors mt-1"
                                    title="Refresh roles"
                                >
                                    <Eye className="w-3 h-3" />
                                    Some roles still loading — refresh
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            {/* Prize Distribution Popup */}
            <AnimatePresence>
                {showPrizePopup && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
                        onClick={() => setShowPrizePopup(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.94, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 12 }}
                            transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-[420px] max-w-[90vw] bg-[#0D0D0D] border border-[#C5A059]/25 rounded-xl overflow-hidden"
                            style={{
                                boxShadow: '0 0 60px rgba(197,160,89,0.08), 0 20px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.03)',
                            }}
                        >
                            {/* Top accent line */}
                            <div className="h-[1px] w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.33), transparent)' }} />

                            <div className="p-6 flex flex-col items-center text-center">
                                {/* Trophy icon */}
                                <motion.div
                                    initial={{ rotate: -180, scale: 0 }}
                                    animate={{ rotate: 0, scale: 1 }}
                                    transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                                    className="w-14 h-14 rounded-full bg-[#C5A059]/10 border border-[#C5A059]/30 flex items-center justify-center mb-4"
                                >
                                    <Coins className="w-7 h-7 text-[#C5A059]" />
                                </motion.div>

                                {/* Title */}
                                <h3 className="text-[#C5A059] text-[12px] font-['Montserrat'] font-bold uppercase tracking-[0.15em] mb-2">
                                    Prizes Distributed
                                </h3>

                                {/* Payouts list */}
                                {prizePayouts.length > 0 ? (
                                    <div className="w-full mb-4 max-h-[200px] overflow-y-auto custom-scrollbar">
                                        <div className="flex flex-col gap-1.5">
                                            {prizePayouts.map((p, i) => {
                                                const name = gameState.players.find(
                                                    pl => pl.address.toLowerCase() === p.winner.toLowerCase()
                                                )?.name || `${p.winner.slice(0, 6)}...${p.winner.slice(-4)}`;
                                                const isMe = p.winner.toLowerCase() === myPlayer?.address.toLowerCase();
                                                return (
                                                    <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg ${isMe ? 'bg-[#C5A059]/10 border border-[#C5A059]/20' : 'bg-white/[0.02]'}`}>
                                                        <span className={`text-[12px] font-['Montserrat'] font-medium ${isMe ? 'text-[#C5A059]' : 'text-white/70'}`}>
                                                            {name} {isMe && '(You)'}
                                                        </span>
                                                        <span className={`text-[12px] font-['Montserrat'] font-bold tabular-nums ${isMe ? 'text-[#C5A059]' : 'text-white/50'}`}>
                                                            +{parseFloat(formatEther(p.amount)).toFixed(4)} {currencySymbol}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-white/60 text-[13px] font-['Montserrat'] leading-relaxed mb-4">
                                        The prize pool has been distributed to the winning team.
                                    </p>
                                )}

                                {/* Explorer link */}
                                {prizeTxHash && (
                                    <a
                                        href={`${runtimeChain.blockExplorers?.default?.url || 'https://shannon-explorer.somnia.network'}/tx/${prizeTxHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] font-['Montserrat'] text-white/50 hover:text-[#C5A059] transition-colors mb-4 flex items-center gap-1.5"
                                    >
                                        <span>View transaction</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                    </a>
                                )}

                                {/* Close button */}
                                <button
                                    onClick={() => setShowPrizePopup(false)}
                                    className="w-full h-10 rounded-lg text-[11px] font-['Montserrat'] font-bold uppercase tracking-[0.1em] transition-all cursor-pointer"
                                    style={{
                                        border: '1px solid rgba(197,160,89,0.33)',
                                        color: '#C5A059',
                                        backgroundColor: 'rgba(197,160,89,0.05)',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(197,160,89,0.6)';
                                        e.currentTarget.style.backgroundColor = 'rgba(197,160,89,0.12)';
                                        e.currentTarget.style.boxShadow = '0 0 18px rgba(197,160,89,0.12)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(197,160,89,0.33)';
                                        e.currentTarget.style.backgroundColor = 'rgba(197,160,89,0.05)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    Continue
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
});

GameOver.displayName = 'GameOver';
