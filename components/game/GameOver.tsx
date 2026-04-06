// components/game/GameOver.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useGameContext } from '../../contexts/GameContext';
import { usePublicClient, useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { MAFIA_ABI } from '../../contracts/config';

import { Role, GamePhase } from '../../types';
import { Button } from '../ui/Button';
import { useSoundEffects } from '../ui/SoundEffects';
import { Trophy, Skull, Users, Shield, Search, Home, RotateCcw, Eye, Coins } from 'lucide-react';
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

const RoleBgColors: Record<Role, string> = {
    [Role.MAFIA]: 'bg-[#8B0000]/50',
    [Role.DOCTOR]: 'bg-[#0D9488]/50',
    [Role.DETECTIVE]: 'bg-[#B45309]/50',
    [Role.CIVILIAN]: 'bg-[#6B5A4A]/50',
    [Role.UNKNOWN]: 'bg-gray-900/50'
};

type Winner = 'MAFIA' | 'TOWN' | 'DRAW';

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
    const router = useRouter();
    // Winner state is managed by useEndGame hook
    const [refundClaimed, setRefundClaimed] = useState(false);
    const [refundAutomatic, setRefundAutomatic] = useState(false);
    const [depositAmount, setDepositAmount] = useState<string>('0');
    const [prizesClaimed, setPrizesClaimed] = useState(false);
    const [showPrizePopup, setShowPrizePopup] = useState(false);
    const [prizeDistributionFailed, setPrizeDistributionFailed] = useState(false);
    const [prizePayouts, setPrizePayouts] = useState<{ winner: string; amount: bigint }[]>([]);
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

            // Find PrizeDistributed events on-chain (works for all clients, not just the one that submitted tx)
            if (currentRoomId && publicClient) {
                (async () => {
                    try {
                        // Search recent blocks for PrizeDistributed events for this room
                        const currentBlock = await publicClient.getBlockNumber();
                        const fromBlock = currentBlock > 5000n ? currentBlock - 5000n : 0n;

                        const logs = await publicClient.getLogs({
                            address: runtimeContractAddress,
                            event: {
                                type: 'event',
                                name: 'PrizeDistributed',
                                inputs: [
                                    { type: 'uint256', name: 'roomId', indexed: true },
                                    { type: 'address', name: 'winner', indexed: true },
                                    { type: 'uint128', name: 'amount', indexed: false },
                                ],
                            },
                            args: { roomId: currentRoomId },
                            fromBlock,
                            toBlock: 'latest',
                        });

                        if (logs.length > 0) {
                            const payouts = logs.map((l: any) => ({
                                winner: l.args.winner as string,
                                amount: BigInt(l.args.amount),
                            }));
                            setPrizePayouts(payouts);
                            setPrizeTxHash(logs[0].transactionHash);
                        }
                    } catch (e) {
                        console.warn('[GameOver] Failed to fetch PrizeDistributed events:', e);
                    }
                })();
            }
        }
    }, [prizesClaimed, currentRoomId, publicClient, runtimeContractAddress]);

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

    // Музыка победы
    useEffect(() => {
        if (hasPlayedSound.current || !winner) return;

        if (winner === 'MAFIA') {
            playMafiaWin();
            hasPlayedSound.current = true;
        } else if (winner === 'TOWN') {
            playTownWin();
            hasPlayedSound.current = true;
        }

        // Остановка при размонтировании (на всякий случай)
        return () => stopVictoryMusic();
    }, [winner, playMafiaWin, playTownWin, stopVictoryMusic]);

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

    if (!winner) {
        return (
            <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full mb-6"
                />
                <h1 className="text-3xl font-bold text-white mb-2">Game Over!</h1>
                <p className="text-slate-400">Finalizing result and revealing roles...</p>
            </div>
        );
    }

    const config = winnerConfig[winner];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="fixed inset-0 z-[100] flex flex-col items-center p-8 bg-[#050505] pointer-events-auto overflow-y-auto overflow-x-hidden custom-scrollbar h-[100dvh] w-screen"
        >
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

            <div className="w-full flex-1 flex flex-col items-center justify-center py-20 my-auto">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", duration: 0.8 }}
                    className="max-w-2xl w-full my-auto"
                >
                    {/* Winner Banner */}
                    <motion.div
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className={`text-center p-8 rounded-md mb-8 bg-[#0A0A0A] shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/5`}
                    >
                        <motion.div
                            initial={{ rotate: -180, scale: 0 }}
                            animate={{ rotate: 0, scale: 1 }}
                            transition={{ delay: 0.4, type: "spring" }}
                            className="mb-4"
                        >
                            <Trophy className={`w-20 h-20 mx-auto ${config.trophy}`} />
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className={`text-4xl md:text-5xl font-['Cinzel'] mb-2 ${config.color}`}
                        >
                            {config.title}
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            className="text-white/60"
                        >
                            {config.description}
                        </motion.p>

                        {/* Personal result */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1 }}
                            className={`mt-6 flex flex-col items-center justify-center gap-0 ${didIWin ? 'text-green-400' : 'text-gray-400'}`}
                        >
                            {didIWin ? (
                                <span className="font-medium">You Won!</span>
                            ) : (
                                <span className="font-medium">You Lost</span>
                            )}
                            <span className="text-white/40">as {myRole}</span>
                        </motion.div>
                    </motion.div>

                    {/* All Players Reveal */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.2 }}
                        className="bg-[#0A0A0A] rounded-md border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] p-6 mb-6"
                    >
                        <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="flex items-center gap-2">
                                <h3 className="text-white/50 text-sm uppercase tracking-wider">All Roles Revealed</h3>
                                {!revealTimedOut && gameState.players.some(p => p.role === Role.UNKNOWN) && <span className="text-xs text-white/30">(loading...)</span>}
                            </div>
                            {/* Manual refresh — useful when GM was slow to cache roles */}
                            <button
                                onClick={async () => {
                                    await Promise.all([
                                        fetchOnChainRoles(),
                                        fetchGMRoles(),
                                    ]);
                                }}
                                className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
                                title="Refresh roles"
                            >
                                <Eye className="w-3 h-3" />
                                Refresh
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {gameState.players.map((player, index) => {
                                const isMe = player.address.toLowerCase() === myPlayer?.address.toLowerCase();
                                const isDead = !player.isAlive;
                                // Roles are synced into gameState.players by useEndGame hook
                                const role = player.role;
                                const roleKnown = role !== Role.UNKNOWN;
                                const isOnChain = roleKnown;

                                return (
                                    <motion.div
                                        key={player.address}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 1.4 + index * 0.1 }}
                                        className={`
                                        p-3 rounded-xl border
                                        ${isDead
                                                ? 'bg-gray-900/50 border-gray-800 opacity-60'
                                                : isMe
                                                    ? 'bg-[#916A47]/20 border-[#916A47]/40'
                                                    : 'bg-white/5 border-white/10'
                                            }
                                    `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`relative w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border border-white/10 ${roleKnown ? RoleBgColors[role] : 'bg-gray-800/50'}`}>
                                                {player.avatarUrl ? (
                                                    <Image
                                                        src={player.avatarUrl}
                                                        alt={player.name}
                                                        fill
                                                        sizes="40px"
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        {roleKnown
                                                            ? RoleIcons[role]
                                                            : <Users className="w-5 h-5 text-white/20 animate-pulse" />
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-medium truncate ${isMe ? 'text-[#916A47]' : 'text-white'}`}>
                                                    {player.name} {isMe && '(You)'}
                                                </p>
                                                <div className="flex items-center gap-1">
                                                    {roleKnown ? (
                                                        <>
                                                            <p className={`text-xs font-semibold ${RoleColors[role]}`}>{role}</p>
                                                            {isOnChain && <span className="text-[10px] text-white/40">✓</span>}
                                                        </>
                                                    ) : revealTimedOut ? (
                                                        <p className="text-xs text-white/30">Unknown</p>
                                                    ) : (
                                                        <p className="text-xs text-white/20 animate-pulse">revealing...</p>
                                                    )}
                                                </div>
                                            </div>
                                            {isDead && (
                                                <Skull className="w-4 h-4 text-[#8B0000]/50" />
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>




                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 2 }}
                        className="flex flex-col gap-4 w-full"
                    >
                        {/* Tournament: Fallback distribute button (only if auto-distribute failed) */}
                        {gameState.isTournament && prizeDistributionFailed && !prizesClaimed && (
                            <Button
                                onClick={async () => {
                                    if (currentRoomId) {
                                        await distributePrizesOnChain(currentRoomId);
                                    }
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

                        <div className="flex gap-4">
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
                    </motion.div>

                </motion.div>
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
                                        className="text-[11px] font-['Montserrat'] text-white/30 hover:text-[#C5A059] transition-colors mb-4 flex items-center gap-1.5"
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
