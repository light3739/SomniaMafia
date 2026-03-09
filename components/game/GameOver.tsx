// components/game/GameOver.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useGameContext } from '../../contexts/GameContext';
import { usePublicClient, useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { MAFIA_ABI } from '../../contracts/config';
import { ShuffleService, getShuffleService } from '../../services/shuffleService';
import { hexToString } from '../../services/cryptoUtils';
import { Role } from '../../types';
import { Button } from '../ui/Button';
import { useSoundEffects } from '../ui/SoundEffects';
import { Trophy, Skull, Users, Shield, Search, Home, RotateCcw, Eye, Coins } from 'lucide-react';
import { MicButton } from './MicButton';

const RoleIcons: Record<Role, React.ReactNode> = {
    [Role.MAFIA]: <Skull className="w-5 h-5 text-rose-500" />,
    [Role.DOCTOR]: <Shield className="w-5 h-5 text-teal-500" />,
    [Role.DETECTIVE]: <Search className="w-5 h-5 text-sky-500" />,
    [Role.CIVILIAN]: <Users className="w-5 h-5 text-amber-500" />,
    [Role.UNKNOWN]: <Users className="w-5 h-5 text-gray-500" />
};

const RoleColors: Record<Role, string> = {
    [Role.MAFIA]: 'text-rose-500',
    [Role.DOCTOR]: 'text-teal-500',
    [Role.DETECTIVE]: 'text-sky-500',
    [Role.CIVILIAN]: 'text-amber-500',
    [Role.UNKNOWN]: 'text-gray-500'
};

const RoleBgColors: Record<Role, string> = {
    [Role.MAFIA]: 'bg-rose-900/50',
    [Role.DOCTOR]: 'bg-teal-900/50',
    [Role.DETECTIVE]: 'bg-sky-900/50',
    [Role.CIVILIAN]: 'bg-amber-900/50',
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
    const { gameState, myPlayer, currentRoomId, setGameState, isTestMode, claimRefund, isTxPending, runtimeContractAddress, currencySymbol } = useGameContext();
    const publicClient = usePublicClient();
    const { address } = useAccount();
    const router = useRouter();
    const [revealedRoles, setRevealedRoles] = useState<Map<string, Role>>(new Map());
    const [onChainRoles, setOnChainRoles] = useState<Map<string, Role>>(new Map());
    const [isRevealing, setIsRevealing] = useState(false);
    const [winner, setWinner] = useState<Winner>((gameState.winner as Winner) || 'DRAW');
    const [refundClaimed, setRefundClaimed] = useState(false);
    const [refundAutomatic, setRefundAutomatic] = useState(false);
    const [depositAmount, setDepositAmount] = useState<string>('0');
    const { playTownWin, playMafiaWin, stopVictoryMusic } = useSoundEffects();
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

    const handleClaimRefund = useCallback(async () => {
        try {
            await claimRefund();
            setRefundClaimed(true);
            setDepositAmount('0');
        } catch (e) {
            console.error('[GameOver] Claim refund failed:', e);
        }
    }, [claimRefund]);


    // Расшифровать все роли в конце игры
    const revealAllRoles = useCallback(async () => {
        if (!publicClient || !currentRoomId || isRevealing || !address) return;

        if (isTestMode) {
            console.log('[GameOver] Test mode role reveal');
            const roles = new Map<string, Role>();
            gameState.players.forEach(p => {
                roles.set(p.address.toLowerCase(), p.role);
            });
            setRevealedRoles(roles);
            determineWinner(roles);
            return;
        }

        setIsRevealing(true);
        try {
            const shuffleService = getShuffleService();
            // SPEED: Ensure keys are loaded (critical for decryption after page refresh)
            if (!shuffleService.hasKeys()) {
                shuffleService.loadKeys(currentRoomId.toString(), address);
            }
            // SPEED: Fetch deck and keys in parallel — saves one sequential RPC roundtrip
            const [deck, keysResult] = await Promise.all([
                publicClient.readContract({
                    address: runtimeContractAddress,
                    abi: MAFIA_ABI,
                    functionName: 'getDeck',
                    args: [currentRoomId],
                }) as Promise<string[]>,
                publicClient.readContract({
                    address: runtimeContractAddress,
                    abi: MAFIA_ABI,
                    functionName: 'getAllKeysForMe',
                    args: [currentRoomId],
                    account: address,
                }).catch(e => {
                    console.error("Failed to batch fetch keys:", e);
                    return [[], []] as [string[], string[]];
                }) as Promise<[string[], string[]]>,
            ]);

            // Собираем ключи от всех игроков (V3.1 Batch Fetch)
            const keys = new Map<string, string>();
            const [senders, keyBytes] = keysResult;
            for (let i = 0; i < senders.length; i++) {
                if (keyBytes[i] && keyBytes[i] !== '0x') {
                    keys.set(senders[i].toLowerCase(), keyBytes[i]);
                }
            }

            const roles = new Map<string, Role>();
            const hasMyKeys = shuffleService.hasKeys();

            for (let i = 0; i < deck.length && i < gameState.players.length; i++) {
                try {
                    let encryptedCard = deck[i];

                    if (hasMyKeys) {
                        // Skip empty/uninitialised deck slots
                        if (!encryptedCard) continue;

                        // Расшифровываем своим ключом
                        encryptedCard = shuffleService.decrypt(encryptedCard);

                        // Расшифровываем ключами других (пропускаем dummy 0x00 байты с чейна)
                        for (const [_, key] of keys) {
                            const decryptionKey = hexToString(key).replace(/\0/g, '').trim();
                            if (!decryptionKey || !/^\d+$/.test(decryptionKey)) continue;
                            encryptedCard = shuffleService.decryptWithKey(encryptedCard, decryptionKey);
                        }

                        const role = ShuffleService.roleNumberToRole(encryptedCard, currentRoomId?.toString());
                        if (role !== Role.UNKNOWN) {
                            roles.set(gameState.players[i].address.toLowerCase(), role);
                        }
                    }
                } catch (e: any) {
                    if (e.message !== "Keys not generated") {
                        console.warn(`Failed to decrypt card ${i}:`, e);
                    }
                }
            }

            setRevealedRoles(roles);

            // Обновляем gameState с раскрытыми ролями
            setGameState(prev => ({
                ...prev,
                players: prev.players.map(p => ({
                    ...p,
                    role: roles.get(p.address.toLowerCase()) || p.role
                }))
            }));

            // Fetch on-chain roles and merge (they take priority)
            await fetchOnChainRoles(roles);

        } catch (e) {
            console.error("Failed to reveal roles:", e);
            // Still try to fetch on-chain roles even if local decryption failed
            await fetchOnChainRoles(new Map());
        } finally {
            setIsRevealing(false);
        }
    }, [publicClient, currentRoomId, gameState.players, address, setGameState, isRevealing]);

    // Fetch roles revealed on-chain (trustless source)
    const fetchOnChainRoles = useCallback(async (localRoles: Map<string, Role>) => {
        if (!publicClient || !currentRoomId) return;

        try {
            const roles = new Map<string, Role>();

            // SPEED: Batch all playerRoles reads into single multicall
            // Was: N sequential readContract calls (one per player = N roundtrips)
            // Now: 1 multicall RPC call for all players
            const roleResults = await publicClient.multicall({
                contracts: gameState.players.map(player => ({
                    address: runtimeContractAddress,
                    abi: MAFIA_ABI as any,
                    functionName: 'playerRoles' as const,
                    args: [currentRoomId, player.address],
                })),
                allowFailure: true,
            });

            for (let i = 0; i < gameState.players.length; i++) {
                const result = roleResults[i];
                if (result.status === 'success') {
                    const role = contractRoleToRole(Number(result.result));
                    if (role !== Role.UNKNOWN) {
                        roles.set(gameState.players[i].address.toLowerCase(), role);
                    }
                }
            }

            setOnChainRoles(roles);

            // Merge: on-chain > local > existing
            const merged = new Map<string, Role>();
            for (const player of gameState.players) {
                const addr = player.address.toLowerCase();
                const onChain = roles.get(addr);
                const local = localRoles.get(addr);
                merged.set(addr, onChain || local || player.role);
            }

            // Update game state with merged roles
            setGameState(prev => ({
                ...prev,
                players: prev.players.map(p => ({
                    ...p,
                    role: merged.get(p.address.toLowerCase()) || p.role
                }))
            }));

            // Determine winner based on merged roles
            determineWinner(merged);

        } catch (e) {
            console.error("Failed to fetch on-chain roles:", e);
        }
    }, [publicClient, currentRoomId, gameState.players, setGameState]);

    // Fetch all roles from GM server (GM has decrypted deck using all SRA keys)
    // Used as fallback when on-chain playerRoles reverts or returns 0 (e.g. dead players)
    const fetchGMRoles = useCallback(async () => {
        if (!currentRoomId) return;
        try {
            const res = await fetch(`/api/game/room-roles?roomId=${currentRoomId.toString()}`);
            if (!res.ok) return;
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

            console.log(`[GameOver] GM roles fetched: ${gmRoles.size} players`);

            // Fill in roles not yet revealed on-chain (on-chain takes priority)
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
        } catch (_e) {
            // Non-fatal — on-chain reveals are the canonical source
        }
    }, [currentRoomId, setGameState]);

    // Определяем победителя на основе раскрытых ролей
    const determineWinner = (roles: Map<string, Role>) => {
        const alivePlayers = gameState.players.filter(p => p.isAlive);

        let aliveMafia = 0;
        let aliveTown = 0; // civilian + doctor + detective

        for (const player of alivePlayers) {
            const role = roles.get(player.address.toLowerCase()) || player.role;
            if (role === Role.MAFIA) aliveMafia++;
            else if (role !== Role.UNKNOWN) aliveTown++;
        }

        // Условия победы:
        // MAFIA wins: мафия >= город
        // TOWN wins: мафия = 0
        // DRAW: никто не выжил

        if (alivePlayers.length === 0) {
            setWinner('DRAW');
        } else if (aliveMafia > 0 && aliveMafia >= aliveTown) {
            setWinner('MAFIA');
        } else if (aliveMafia === 0) {
            setWinner('TOWN');
        } else {
            // Игра должна продолжаться, но раз мы в GameOver - значит что-то пошло не так
            setWinner('DRAW');
        }
    };

    // Reveal на монтирование
    useEffect(() => {
        revealAllRoles();
    }, [revealAllRoles]);

    // After on-chain reveals settle, fetch missing roles from GM (fills in dead players etc.)
    useEffect(() => {
        const timer = setTimeout(() => fetchGMRoles(), 3000);
        return () => clearTimeout(timer);
    }, [fetchGMRoles]);

    // Poll for late on-chain reveals (other players may reveal after us)
    const revealedRolesRef = useRef<Map<string, Role>>(revealedRoles);
    useEffect(() => {
        revealedRolesRef.current = revealedRoles;
    }, [revealedRoles]);

    useEffect(() => {
        // Start polling for 60 seconds (people take time to reveal manually sometimes)
        let pollCount = 0;
        const maxPolls = 20; // 20 polls * 3 seconds = 60 seconds

        pollIntervalRef.current = setInterval(async () => {
            pollCount++;
            if (pollCount > maxPolls) {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }
                return;
            }

            // Re-fetch on-chain roles to catch late reveals
            // Pass the LATEST revealed roles from the ref to avoid stale closure
            await fetchOnChainRoles(revealedRolesRef.current);
            // On the first poll, also pull from GM (in case on-chain reveals have populated)
            if (pollCount === 1) await fetchGMRoles();
        }, 3000);

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [fetchOnChainRoles, fetchGMRoles]);

    // Музыка победы
    useEffect(() => {
        if (winner === 'MAFIA') {
            playMafiaWin();
        } else if (winner === 'TOWN') {
            playTownWin();
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
            color: 'text-rose-400',
            bg: 'from-rose-950/50 to-rose-900/30 border-rose-400/30',
            trophy: 'text-rose-400'
        },
        'TOWN': {
            title: 'Town Wins!',
            description: 'Justice prevails! All evil has been eliminated.',
            color: 'text-amber-400',
            bg: 'from-amber-950/50 to-amber-900/30 border-amber-500/30',
            trophy: 'text-amber-500'
        },
        'DRAW': {
            title: 'Draw!',
            description: 'No one survived...',
            color: 'text-gray-400',
            bg: 'from-gray-950/50 to-gray-900/30 border-gray-500/30',
            trophy: 'text-gray-500'
        }
    }), []);

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
            className="fixed inset-0 z-[100] flex flex-col items-center p-8 bg-black/80 backdrop-blur-xl pointer-events-auto overflow-y-auto overflow-x-hidden custom-scrollbar h-[100dvh] w-screen"
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
                        className={`text-center p-8 rounded-3xl mb-8 bg-gradient-to-br ${config.bg} border`}
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
                        className="bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 p-6 mb-6"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-white/50 text-sm uppercase tracking-wider">All Roles Revealed</h3>
                            {isRevealing && <span className="text-xs text-white/30">(decrypting...)</span>}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {gameState.players.map((player, index) => {
                                const isMe = player.address.toLowerCase() === myPlayer?.address.toLowerCase();
                                const isDead = !player.isAlive;
                                const onChainRole = onChainRoles.get(player.address.toLowerCase());
                                const localRole = revealedRoles.get(player.address.toLowerCase());
                                // Priority: 
                                // 1. On-chain revealed role (verified source)
                                // 2. Local decryption (ShuffleService) 
                                // 3. Previous gameState role (only if not UNKNOWN)
                                let role = Role.UNKNOWN;
                                if (onChainRole && onChainRole !== Role.UNKNOWN) role = onChainRole;
                                else if (localRole && localRole !== Role.UNKNOWN) role = localRole;
                                else if (player.role !== Role.UNKNOWN) role = player.role;

                                const roleKnown = role !== Role.UNKNOWN;
                                const isOnChain = !!onChainRole;

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
                                            <div className={`relative w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border border-white/10 ${RoleBgColors[role]}`}>
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
                                                        <Users className="w-5 h-5 text-white/20" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-medium truncate ${isMe ? 'text-[#916A47]' : 'text-white'}`}>
                                                    {player.name} {isMe && '(You)'}
                                                </p>
                                                <div className="flex items-center gap-1">
                                                    <p className={`text-xs ${roleKnown ? RoleColors[role] : 'text-gray-500'}`}>
                                                        {roleKnown ? role : '🔒 Encrypted'}
                                                    </p>
                                                    {isOnChain && (
                                                        <span className="text-[10px] text-white/40">✓</span>
                                                    )}
                                                </div>
                                            </div>
                                            {isDead && (
                                                <Skull className="w-4 h-4 text-rose-400/50" />
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* Deposit Refund */}
                    {!refundClaimed && parseFloat(depositAmount) > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.8 }}
                            className="bg-gradient-to-r from-emerald-950/40 to-emerald-900/20 border border-emerald-500/30 rounded-2xl p-4 mb-4 flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <Coins className="w-6 h-6 text-emerald-400" />
                                <div>
                                    <p className="text-emerald-300 font-medium text-sm">Deposit Available</p>
                                    <p className="text-emerald-400/70 text-xs">{depositAmount} STT refundable</p>
                                </div>
                            </div>
                            <Button
                                onClick={handleClaimRefund}
                                disabled={isTxPending}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-sm"
                            >
                                {isTxPending ? 'Claiming...' : 'Claim Refund'}
                            </Button>
                        </motion.div>
                    )}

                    {refundClaimed && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center text-emerald-400/60 text-xs mb-4"
                        >
                            ✓ {refundAutomatic ? 'Deposit auto-refunded by contract' : 'Deposit refunded'}
                        </motion.div>
                    )}

                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 2 }}
                        className="flex gap-4"
                    >
                        <Button
                            onClick={handlePlayAgain}
                            className="flex-1 h-[60px] text-lg"
                        >
                            <RotateCcw className="w-5 h-5 mr-2" />
                            Play Again
                        </Button>
                        <Button
                            onClick={handleHome}
                            variant="outline-gold"
                            className="flex-1 h-[60px] text-lg"
                        >
                            <Home className="w-5 h-5 mr-2" />
                            Home
                        </Button>
                    </motion.div>

                </motion.div>
            </div>
        </motion.div>
    );
});

GameOver.displayName = 'GameOver';
