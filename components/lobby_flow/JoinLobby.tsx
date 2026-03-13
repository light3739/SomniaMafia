import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrivy } from '@privy-io/react-auth';
import { useGameContext } from '../../contexts/GameContext';
import { BackButton } from '../ui/BackButton';
import { usePublicClient, useAccount, useChainId } from 'wagmi';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '../../contracts/config';
import { NetworkSelector } from '../ui/NetworkSelector';

// --- ИКОНКИ ---
const RefreshIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
    </svg>
);
const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
);
const TrophyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4A54A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
);
const ChevronRight = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
);

interface JoinLobbyProps {
    initialRoomId?: string | null;
}

// Parse a room struct
function parseRoom(id: bigint, data: any): {
    id: number; host: string; name: string; players: number; max: number;
    phase: number; timestamp: number;
} | null {
    try {
        let phase: number, timestamp: number, host: string, name: string, playersCount: number, maxPlayers: number;
        if (Array.isArray(data)) {
            phase = Number(data[3]); timestamp = Number(data[9]); host = data[1];
            name = data[2]; playersCount = Number(data[5]); maxPlayers = Number(data[4]);
        } else {
            phase = Number(data.phase); timestamp = Number(data.lastActionTimestamp);
            host = data.host; name = data.name;
            playersCount = Number(data.playersCount); maxPlayers = Number(data.maxPlayers);
        }
        return { id: Number(data.id ?? id), host, name, players: playersCount, max: maxPlayers, phase, timestamp };
    } catch { return null; }
}

interface TournamentInfo {
    isTournament: boolean;
    prize?: string;
    hasPassword?: boolean;
}

function getTournamentInfo(_room: any): TournamentInfo {
    // TODO: Read tournament flag from smart contract room data
    return { isTournament: false };
}

export const JoinLobby: React.FC<JoinLobbyProps> = ({ initialRoomId }) => {
    const { setLobbyName, joinLobbyOnChain, isTxPending, runtimeContractAddress } = useGameContext();
    const { login, authenticated } = usePrivy();
    const { isConnected } = useAccount();

    // Отслеживаем смену сети явно
    const chainId = useChainId();
    const prevChainIdRef = useRef(chainId);

    const router = useRouter();
    const publicClient = usePublicClient();

    const [rooms, setRooms] = useState<any[]>([]);
    const [isInitialLoad, setIsInitialLoad] = useState(true); // Для Радара
    const [isRefreshing, setIsRefreshing] = useState(false);  // Для крутилки

    const [lastUpdate, setLastUpdate] = useState<number>(0);
    const mountedRef = useRef(true);
    const lastFetchRef = useRef(0);
    const MAX_LOBBY_AGE_SEC = 15 * 60;

    // Scroll-driven vignette: opacity directly tied to scroll position
    const [scrollProgress, setScrollProgress] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Типизируем причину вызова функции для идеального UX
    type FetchReason = 'initial' | 'refresh' | 'polling';

    const fetchRooms = useCallback(async (reason: FetchReason = 'polling') => {
        if (!publicClient) return;

        const now = Date.now();
        // Дебаунс только для фонового поллинга
        if (reason === 'polling' && now - lastFetchRef.current < 1500) return;
        lastFetchRef.current = now;

        // ИЗМЕНЕНИЕ ЗДЕСЬ: Теперь и заход на страницу, и ручной рефреш вызывают Радар
        const isHardLoad = reason === 'initial' || reason === 'refresh';

        if (isHardLoad) setIsInitialLoad(true);
        if (reason === 'refresh') setIsRefreshing(true);

        const fetchStartTime = Date.now(); // Засекаем время начала запроса

        try {
            const roomList: any[] = [];
            const nextId = await publicClient.readContract({
                address: runtimeContractAddress, abi: MAFIA_ABI,
                functionName: 'nextRoomId',
            }) as bigint;

            const lookAhead = 3n;
            const scanEnd = nextId + lookAhead;
            const scanCount = 15n + lookAhead;
            const start = scanEnd > scanCount ? scanEnd - scanCount : 0n;

            const queries = Array.from({ length: Number(scanEnd - start) }, (_, idx) => scanEnd - 1n - BigInt(idx));
            if (initialRoomId && !queries.includes(BigInt(initialRoomId))) {
                queries.push(BigInt(initialRoomId));
            }

            const results = await Promise.allSettled(
                queries.map(i => publicClient.readContract({
                    address: runtimeContractAddress, abi: MAFIA_ABI,
                    functionName: 'getRoom', args: [i],
                }).then(data => ({ i, data })))
            );

            const nowSec = Math.floor(Date.now() / 1000);
            for (const res of results) {
                if (res.status !== 'fulfilled') continue;
                const parsed = parseRoom(res.value.i, res.value.data);
                if (!parsed) continue;

                const isLobby = parsed.phase === 0;
                const isRecent = parsed.timestamp === 0 || (nowSec - parsed.timestamp) < MAX_LOBBY_AGE_SEC;
                const isValid = parsed.host !== '0x0000000000000000000000000000000000000000' && parsed.max > 0;

                if (isLobby && isRecent && isValid) {
                    roomList.push(parsed);
                }
            }

            roomList.sort((a, b) => b.id - a.id);

            // АНТИ-МЕРЦАНИЕ (ARTIFICIAL DELAY):
            // Если это хард-лоад (Радар), гарантируем, что он висит минимум 800мс.
            if (isHardLoad && mountedRef.current) {
                const elapsed = Date.now() - fetchStartTime;
                const MIN_RADAR_TIME = 800;
                if (elapsed < MIN_RADAR_TIME) {
                    await new Promise(resolve => setTimeout(resolve, MIN_RADAR_TIME - elapsed));
                }
            }

            if (mountedRef.current) {
                setRooms(roomList);
                setLastUpdate(Date.now());
                setIsInitialLoad(false);

                if (reason === 'refresh') {
                    setTimeout(() => setIsRefreshing(false), 500); // Крутилка крутится минимум полсекунды
                }
            }
        } catch (e) {
            console.error('[JoinLobby] fetchRooms error:', e);
            if (mountedRef.current) {
                setIsInitialLoad(false);
                setIsRefreshing(false);
            }
        }
    }, [publicClient, initialRoomId, runtimeContractAddress]);

    // Обработка смены сети (Жесткий сброс)
    useEffect(() => {
        if (chainId !== prevChainIdRef.current) {
            prevChainIdRef.current = chainId;
            setRooms([]); // Мгновенно очищаем старые комнаты
            fetchRooms('initial'); // Запускаем Радар для новой сети
        }
    }, [chainId, fetchRooms]);

    // Жизненный цикл (Первый рендер, фоновый поллинг и ивенты)
    useEffect(() => {
        mountedRef.current = true;

        // Вызываем initial только если комнат еще нет
        if (rooms.length === 0 && isInitialLoad) {
            fetchRooms('initial');
        }

        const interval = setInterval(() => fetchRooms('polling'), 3000);

        let unwatch1: (() => void) | undefined;
        let unwatch2: (() => void) | undefined;

        if (publicClient) {
            try {
                unwatch1 = publicClient.watchContractEvent({
                    address: runtimeContractAddress, abi: MAFIA_ABI,
                    eventName: 'RoomCreated',
                    onLogs: () => { fetchRooms('polling'); },
                });
                unwatch2 = publicClient.watchContractEvent({
                    address: runtimeContractAddress, abi: MAFIA_ABI,
                    eventName: 'PlayerJoined',
                    onLogs: () => { fetchRooms('polling'); },
                });
            } catch (e) {
                console.warn("Event watch failed", e);
            }
        }

        return () => {
            mountedRef.current = false;
            clearInterval(interval);
            unwatch1?.();
            unwatch2?.();
        };
    }, [fetchRooms, publicClient, runtimeContractAddress]); // Убрали лишние триггеры

    // Scroll-aware header listener
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const onScroll = () => setScrollProgress(Math.min(el.scrollTop / 80, 1));
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    const handleJoin = async (room: any) => {
        if (!isConnected || !authenticated) {
            login();
            return;
        }
        const success = await joinLobbyOnChain(room.id);
        if (success) {
            setLobbyName(room.name || `Room #${room.id}`);
            router.push('/waiting');
        }
    };

    const initialRoomData = initialRoomId ? rooms.find(r => r.id === Number(initialRoomId)) : null;

    return (
        <div ref={scrollContainerRef} className="relative w-full h-[100dvh] font-['Montserrat'] flex flex-col items-center overflow-y-auto overflow-x-hidden p-4 pb-12 custom-scrollbar">
            {/* Top vignette: fades content behind nav on scroll, no hard bar */}
            <div
                className="fixed top-0 left-0 right-0 h-24 pointer-events-none z-40"
                style={{
                    opacity: scrollProgress,
                    background: 'linear-gradient(to bottom, rgba(10,7,4,0.92) 0%, rgba(10,7,4,0.5) 60%, transparent 100%)'
                }}
            />

            {/* Navigation: always transparent, always has top padding */}
            <div className="w-full max-w-[600px] flex items-center justify-between sticky top-0 z-50 px-1 pt-4 pb-3 -mx-1">
                <div className="-ml-2">
                    <BackButton to="/setup" />
                </div>
                <div className="flex items-center gap-2">
                    <NetworkSelector compact />
                </div>
            </div>

            {/* Centered layout with safe scrolling via my-auto */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="relative z-10 w-full max-w-[600px] flex flex-col items-center gap-4 md:gap-6 my-auto pt-2 md:pt-4"
            >

                {/* Баннер Инвайта */}
                {initialRoomId && !isInitialLoad && (
                    <div className="w-full p-6 bg-gradient-to-br from-[#19130D] to-[#281608] border border-[#D4A54A]/30 rounded-[24px] shadow-[0_0_20px_rgba(212,165,74,0.15)] flex flex-col items-center text-center">
                        <h3 className="text-white text-xl md:text-2xl font-['Cinzel'] mb-1">Room #{initialRoomId} Invite</h3>

                        {initialRoomData ? (
                            <div className="flex flex-col gap-4 w-full mt-2">
                                <p className="text-white/60 text-sm">You have been invited to join <span className="text-[#D4A54A] font-semibold">{initialRoomData.name || 'this session'}</span>.</p>

                                {(!isConnected || !authenticated) ? (
                                    <button onClick={() => login()} className="w-full bg-gradient-to-r from-[#D4A54A] to-[#F0C868] text-[#281608] py-3.5 px-6 rounded-xl font-bold transition-transform hover:scale-[1.02] shadow-lg">
                                        Connect Wallet to Join
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleJoin(initialRoomData)}
                                        disabled={isTxPending}
                                        className="w-full bg-gradient-to-r from-[#D4A54A] to-[#F0C868] text-[#281608] py-3.5 px-6 rounded-xl font-bold transition-transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:hover:scale-100"
                                    >
                                        {isTxPending ? 'Joining...' : 'Accept Invite & Join'}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className="text-red-400/80 mt-2 text-sm bg-red-950/30 py-2 px-4 rounded-lg border border-red-900/50">
                                This room no longer exists or the game has already started.
                            </p>
                        )}
                    </div>
                )}

                {/* Заголовок списка */}
                <div className="flex items-center justify-between w-full mt-2">
                    <h2 className="text-white/90 text-xl md:text-2xl font-['Cinzel'] uppercase tracking-widest">
                        Live Sessions
                    </h2>
                    <div className="flex items-center gap-3">
                        {lastUpdate > 0 && !isInitialLoad && (
                            <span className="text-white/30 text-[10px] md:text-xs font-mono">
                                {new Date(lastUpdate).toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            onClick={() => fetchRooms('refresh')}
                            disabled={isRefreshing || isInitialLoad}
                            className="text-[#D4A54A] hover:text-[#F0C868] transition-colors p-1 disabled:opacity-50"
                            title="Refresh List"
                        >
                            <motion.div animate={{ rotate: isRefreshing ? 360 : 0 }} transition={{ duration: 0.5, ease: "easeInOut" }}>
                                <RefreshIcon className="w-5 h-5 md:w-6 md:h-6" />
                            </motion.div>
                        </button>
                    </div>
                </div>

                {/* Список комнат */}
                <div className="w-full flex flex-col gap-3 min-h-[250px]">
                    <AnimatePresence mode="wait">
                        {isInitialLoad || rooms.length === 0 ? (
                            // ЕДИНЫЙ КОНТЕЙНЕР для загрузки и пустого стейта (он не моргает!)
                            <motion.div
                                key="status-box"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.2 }}
                                className="w-full min-h-[250px] flex flex-col items-center justify-center bg-[#19130D]/40 rounded-[24px] border border-white/5 py-10 relative"
                            >
                                {/* Вложенная анимация: меняем только начинку */}
                                <AnimatePresence mode="wait">
                                    {isInitialLoad ? (
                                        <motion.div
                                            key="radar-content"
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            transition={{ duration: 0.2 }}
                                            className="flex flex-col items-center"
                                        >
                                            <div className="relative flex items-center justify-center mb-6 mt-2">
                                                <div className="absolute w-16 h-16 border-2 border-[#D4A54A] rounded-full animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-20" />
                                                <div className="absolute w-10 h-10 border-2 border-[#D4A54A] rounded-full animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite] opacity-40" style={{ animationDelay: '0.4s' }} />
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4A54A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                                                </svg>
                                            </div>
                                            <span className="text-white/40 font-medium tracking-wide text-sm animate-pulse">
                                                Scanning Network...
                                            </span>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="empty-content"
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            transition={{ duration: 0.2 }}
                                            className="flex flex-col items-center"
                                        >
                                            <span className="text-[#D4A54A]/30 mb-3">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                            </span>
                                            <span className="text-white/40 text-center leading-relaxed">
                                                No active lobbies found.<br />Be the first to create one!
                                            </span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ) : (
                            // А вот СПИСОК КОМНАТ — это уже отдельный блок, 
                            // он плавно заменит статус-бокс, когда найдутся игры
                            <motion.div
                                key="list"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="w-full flex flex-col gap-3"
                            >
                                <AnimatePresence>
                                    {rooms.map((room) => {
                                        const tournament = getTournamentInfo(room);
                                        return (
                                            <motion.button
                                                key={room.id}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                whileHover={{ scale: 1.015 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => handleJoin(room)}
                                                disabled={isTxPending}
                                                className={`w-full p-4 md:p-5 backdrop-blur-md rounded-[16px] flex items-center justify-between group transition-colors relative overflow-hidden text-left
                                                    ${tournament.isTournament
                                                        ? 'bg-gradient-to-r from-[#2A1F0A] to-[#19130D] border border-[#D4A54A]/30 hover:border-[#D4A54A]/60 shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
                                                        : 'bg-[#19130D]/80 border border-white/5 hover:border-white/20 shadow-lg'
                                                    }
                                                `}
                                            >
                                                {tournament.isTournament && (
                                                    <div className="absolute inset-0 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
                                                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D4A54A]/50 to-transparent" />
                                                    </div>
                                                )}

                                                <div className="flex flex-col items-start gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        {tournament.isTournament && <TrophyIcon />}
                                                        <span className={`text-base md:text-lg font-bold tracking-wide ${tournament.isTournament ? 'text-[#F0C868]' : 'text-white/90'}`}>
                                                            {room.name || `Room #${room.id}`}
                                                        </span>
                                                        {tournament.hasPassword && <LockIcon />}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white/40 text-[10px] font-mono uppercase">HOST: {room.host.slice(0, 8)}...</span>
                                                        {tournament.isTournament && (
                                                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#D4A54A]/10 text-[#D4A54A] border border-[#D4A54A]/20">
                                                                Tournament
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-5">
                                                    {tournament.isTournament && tournament.prize && (
                                                        <div className="text-right hidden sm:block">
                                                            <span className="text-[#D4A54A] font-bold text-sm block">{tournament.prize}</span>
                                                            <span className="text-[#D4A54A]/50 text-[9px] uppercase tracking-widest">Prize Pool</span>
                                                        </div>
                                                    )}
                                                    <div className="text-right">
                                                        <span className={`font-bold text-lg block leading-none ${tournament.isTournament ? 'text-[#D4A54A]' : 'text-white/80'}`}>
                                                            {room.players}<span className="text-white/30 text-sm">/{room.max}</span>
                                                        </span>
                                                        <span className="text-white/30 text-[9px] uppercase tracking-widest mt-1 block">Players</span>
                                                    </div>

                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                                                        ${tournament.isTournament
                                                            ? 'bg-[#D4A54A]/10 text-[#D4A54A] group-hover:bg-[#D4A54A] group-hover:text-[#281608]'
                                                            : 'bg-white/5 text-white/50 group-hover:bg-white/20 group-hover:text-white'
                                                        }
                                                    `}>
                                                        <ChevronRight />
                                                    </div>
                                                </div>
                                            </motion.button>
                                        );
                                    })}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {(!isConnected || !authenticated) && rooms.length > 0 && !initialRoomId && (
                    <div className="mt-2 text-white/40 text-xs italic">
                        * Wallet connection required to enter a session
                    </div>
                )}
            </motion.div>
        </div>
    );
};