// components/game/GameOver.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
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

// Convert contract Role enum (0-4) to frontend Role
const contractRoleToRole = (contractRole: number): Role => {
    switch (contractRole) {
        case 1: return Role.MAFIA;
        case 2: return Role.DOCTOR;
        case 3: return Role.DETECTIVE;
        case 4: return Role.CIVILIAN;
        default: return Role.UNKNOWN; // 0 = NONE
    }
};

type Winner = 'MAFIA' | 'TOWN' | 'DRAW';

export const GameOver: React.FC = React.memo(() => {
    const { gameState, myPlayer, currentRoomId, setGameState, isTestMode, isTxPending, runtimeContractAddress, currencySymbol, distributePrizesOnChain, runtimeChain } = useGameContext();
    const publicClient = usePublicClient();
    const { address } = useAccount();
    const router = useRouter();
    const [revealedRoles, setRevealedRoles] = useState<Map<string, Role>>(new Map());
    const [onChainRoles, setOnChainRoles] = useState<Map<string, Role>>(new Map());
    const onChainRolesRef = useRef<Map<string, Role>>(new Map());
    const contractWinnerRef = useRef<string | null>(gameState.winner); // ← Winner priority fix

    useEffect(() => {
        contractWinnerRef.current = gameState.winner;
    }, [gameState.winner]);
    const [refundClaimed, setRefundClaimed] = useState(false);
    const [refundAutomatic, setRefundAutomatic] = useState(false);
    const [depositAmount, setDepositAmount] = useState<string>('0');
    const { playTownWin, playMafiaWin, stopVictoryMusic } = useSoundEffects();
    const hasPlayedSound = useRef(false);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [isRevealing, setIsRevealing] = useState(false);
    const isRevealingRef = useRef(false);
    const [revealTimedOut, setRevealTimedOut] = useState(false);
    const roomIdRef = useRef<bigint | null>(currentRoomId);
    const playersRef = useRef(gameState.players);
    useEffect(() => { playersRef.current = gameState.players; }, [gameState.players]);
    const [winner, setWinner] = useState<Winner | null>((gameState.winner as Winner) || null);

    // Sync local winner state when gameState.winner changes
    useEffect(() => {
        if (gameState.winner) {
            setWinner(gameState.winner as Winner);
        }
    }, [gameState.winner]);

    // FALLBACK: If winner is still null after 3s on GameOver screen,
    // scan the last 2000 blocks for a GameEnded event to extract winCondition.
    // This fires for clients who missed the event due to the phase=ENDED race in pollEvents.
    useEffect(() => {
        if (winner) return;
        if (!publicClient || !currentRoomId) return;

        const resolve = async () => {
            if (winner) return;
            try {
                const currentBlock = await publicClient.getBlockNumber();
                // Somnia RPC limits getLogs to 1000 blocks per request.
                // Scan last 2000 blocks in two 1000-block chunks (newest first).
                const chunkSize = 999n;
                const totalLookback = 2000n;
                const earliestBlock = currentBlock > totalLookback ? currentBlock - totalLookback : 0n;

                const { parseEventLogs } = await import('viem');
                let allParsed: any[] = [];

                for (let toBlock = currentBlock; toBlock > earliestBlock; ) {
                    const fromBlock = toBlock - chunkSize > earliestBlock ? toBlock - chunkSize : earliestBlock;
                    const logs = await publicClient.getLogs({
                        address: runtimeContractAddress,
                        fromBlock,
                        toBlock,
                    } as any);
                    const parsed = parseEventLogs({ abi: MAFIA_ABI as any, logs });
                    allParsed = allParsed.concat(parsed);
                    toBlock = fromBlock - 1n;
                }

                // Find the GameEnded event (last one wins in case of multiple)
                for (let i = allParsed.length - 1; i >= 0; i--) {
                    const log = allParsed[i] as any;
                    if (log.eventName === 'GameEnded') {
                        const winCondition = (log.args?.winCondition as string) || '';
                        const lower = winCondition.toLowerCase();
                        const resolved: Winner =
                            lower.includes('town') ? 'TOWN' :
                            lower.includes('mafia') ? 'MAFIA' :
                            lower.includes('draw') ? 'DRAW' :
                            'TOWN';
                        console.log(`[GameOver Fallback] Resolved winner from GameEnded log: ${resolved} ("${winCondition}")`);
                        setWinner(resolved);
                        setGameState(prev => ({
                            ...prev,
                            phase: GamePhase.ENDED,
                            winner: resolved,
                        }));
                        return;
                    }
                }
                console.warn('[GameOver Fallback] No GameEnded event found in last 2000 blocks.');
            } catch (e) {
                console.error('[GameOver Fallback] Error scanning for GameEnded:', e);
            }
        };

        const t = setTimeout(resolve, 3000);
        return () => clearTimeout(t);
    }, [winner, publicClient, currentRoomId, runtimeContractAddress, setGameState]);

    // After 30s, stop pulsing and show static "Unknown" for any unresolved roles
    useEffect(() => {
        const t = setTimeout(() => setRevealTimedOut(true), 30000);
        return () => clearTimeout(t);
    }, []);


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



    // Расшифровать все роли в конце игры
    const revealAllRoles = useCallback(async () => {
        if (!publicClient || !currentRoomId || isRevealingRef.current || !address) return;

        if (isTestMode) {
            console.log('[GameOver] Test mode role reveal');
            const roles = new Map<string, Role>();
            playersRef.current.forEach(p => {
                roles.set(p.address.toLowerCase(), p.role);
            });
            setRevealedRoles(roles);
            return;
        }

        isRevealingRef.current = true;
        setIsRevealing(true);
        try {
            await fetchOnChainRoles(new Map());
        } catch (e) {
            console.error("Failed to reveal roles:", e);
        } finally {
            isRevealingRef.current = false;
            setIsRevealing(false);
        }
    }, [publicClient, currentRoomId, address, isTestMode]); 

    // Fetch roles revealed on-chain (trustless source)
    const fetchOnChainRoles = useCallback(async (localRoles: Map<string, Role>) => {
        if (!publicClient || !currentRoomId) return;

        try {
            const players = playersRef.current;
            const roles = new Map<string, Role>();

            const roleResults = await publicClient.multicall({
                contracts: players.map(player => ({
                    address: runtimeContractAddress,
                    abi: MAFIA_ABI as any,
                    functionName: 'playerRoles' as const,
                    args: [currentRoomId, player.address],
                })),
                allowFailure: true,
            });

            for (let i = 0; i < players.length; i++) {
                const result = roleResults[i];
                if (result.status === 'success') {
                    const role = contractRoleToRole(Number(result.result));
                    if (role !== Role.UNKNOWN) {
                        roles.set(players[i].address.toLowerCase(), role);
                    }
                }
            }

            setOnChainRoles(roles);
            onChainRolesRef.current = roles;

            const merged = new Map<string, Role>();
            for (const player of players) {
                const addr = player.address.toLowerCase();
                const onChain = roles.get(addr);
                const local = localRoles.get(addr);
                merged.set(addr, onChain || local || player.role);
            }

            setGameState(prev => ({
                ...prev,
                players: prev.players.map(p => ({
                    ...p,
                    role: merged.get(p.address.toLowerCase()) || p.role
                }))
            }));
        } catch (e) {
            console.error("Failed to fetch on-chain roles:", e);
        }
    }, [publicClient, currentRoomId, setGameState]);

    // Poll for late on-chain reveals (other players may reveal after us)
    const revealedRolesRef = useRef<Map<string, Role>>(revealedRoles);
    useEffect(() => {
        revealedRolesRef.current = revealedRoles;
    }, [revealedRoles]);

    const allRolesKnown = useCallback(() => {
        const players = playersRef.current;
        return players.length > 0 && players.every(p => {
            const addr = p.address.toLowerCase();
            const r = onChainRolesRef.current.get(addr)
                || revealedRolesRef.current.get(addr)
                || p.role;
            return r !== Role.UNKNOWN;
        });
    }, []);

    const fetchGMRoles = useCallback(async () => {
        if (allRolesKnown()) return;

        const roomId = roomIdRef.current
            || currentRoomId
            || (() => {
                const s = sessionStorage.getItem('gameOver_roomId');
                return s ? BigInt(s) : null;
            })();

        if (!roomId) return;
        try {
            const res = await fetch(`/api/game/room-roles?roomId=${roomId.toString()}&chainId=${runtimeChain.id}`);
            if (!res.ok) {
                console.warn(`[GameOver] GM roles fetch failed: ${res.status}`);
                return;
            }
            const data = await res.json();
            if (!data.roles || typeof data.roles !== 'object') return;

            const roleMap: Record<string, Role> = {
                'MAFIA': Role.MAFIA, 'DOCTOR': Role.DOCTOR,
                'DETECTIVE': Role.DETECTIVE, 'CIVILIAN': Role.CIVILIAN,
            };
            const gmRoles = new Map<string, Role>();
            for (const [addr, roleStr] of Object.entries(data.roles as Record<string, string>)) {
                const role = roleMap[roleStr];
                if (role) gmRoles.set(addr.toLowerCase(), role);
            }
            if (gmRoles.size === 0) return;

            setRevealedRoles(prev => {
                const merged = new Map(prev);
                for (const [addr, role] of gmRoles) {
                    if (!merged.has(addr) || merged.get(addr) === Role.UNKNOWN) {
                        merged.set(addr, role);
                    }
                }
                return merged;
            });

            setGameState(prev => ({
                ...prev,
                players: prev.players.map(p => {
                    const gmRole = gmRoles.get(p.address.toLowerCase());
                    if (gmRole && p.role === Role.UNKNOWN) return { ...p, role: gmRole };
                    return p;
                })
            }));
        } catch (e) {
            console.error("Failed to fetch GM roles:", e);
        }
    }, [currentRoomId, setGameState, allRolesKnown]);

    // Reveal on монтирование (delayed to avoid setState-during-render)
    useEffect(() => {
        const t = setTimeout(() => revealAllRoles(), 200);
        return () => clearTimeout(t);
    }, [revealAllRoles]);

    // Snapshot roomId for page reload persistence (survives GameContext cleanup)
    useEffect(() => {
        const rid = currentRoomId || roomIdRef.current;
        if (rid) {
            sessionStorage.setItem('gameOver_roomId', rid.toString());
        }
    }, [currentRoomId]);

    // After on-chain reveals settle, fetch missing roles from GM (fills in dead players etc.)
    useEffect(() => {
        // Slight delay to avoid setState-during-render on mount
        const t0 = setTimeout(() => fetchGMRoles(), 500);
        // Retry with backoff to handle chain lag
        const t1 = setTimeout(() => fetchGMRoles(), 3000);
        const t2 = setTimeout(() => fetchGMRoles(), 8000);
        const t3 = setTimeout(() => fetchGMRoles(), 15000);

        return () => {
            clearTimeout(t0);
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [fetchGMRoles]);


    useEffect(() => {
        // Poll until all roles known, or 5 min max
        let pollCount = 0;
        const maxPolls = 100; // 100 × 3s = 5 min

        pollIntervalRef.current = setInterval(async () => {
            pollCount++;
            
            // SPEED: Stop immediately if everything is already known (via refs)
            if (pollCount > maxPolls || allRolesKnown()) {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }
                return;
            }

            // Always try both sources — GM may cache roles at any time
            await Promise.all([
                fetchOnChainRoles(revealedRolesRef.current),
                fetchGMRoles(),
            ]);

            // SPEED: Check again immediately after fetches to stop interval faster
            if (allRolesKnown()) {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }
            }
        }, 3000);

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [fetchOnChainRoles, fetchGMRoles, allRolesKnown]);

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

    const myRole = revealedRoles.get(myPlayer?.address.toLowerCase() || '') || myPlayer?.role || Role.UNKNOWN;

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
                                {isRevealing && <span className="text-xs text-white/30">(loading...)</span>}
                            </div>
                            {/* Manual refresh — useful when GM was slow to cache roles */}
                            <button
                                onClick={async () => {
                                    await Promise.all([
                                        fetchOnChainRoles(revealedRolesRef.current),
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
                                const onChainRole = onChainRoles.get(player.address.toLowerCase());
                                const localRole = revealedRoles.get(player.address.toLowerCase());
                                // Priority: on-chain > GM cache > previous gameState role
                                let role = Role.UNKNOWN;
                                if (onChainRole && onChainRole !== Role.UNKNOWN) role = onChainRole;
                                else if (localRole && localRole !== Role.UNKNOWN) role = localRole;
                                else if (player.role !== Role.UNKNOWN) role = player.role;

                                const roleKnown = role !== Role.UNKNOWN;
                                const isOnChain = !!onChainRole && onChainRole !== Role.UNKNOWN;

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
                        {gameState.isTournament && (
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
        </motion.div>
    );
});

GameOver.displayName = 'GameOver';
