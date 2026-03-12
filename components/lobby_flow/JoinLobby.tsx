import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { usePrivy } from '@privy-io/react-auth';
import { useGameContext } from '../../contexts/GameContext';
import { BackButton } from '../ui/BackButton';
import { usePublicClient, useAccount } from 'wagmi';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '../../contracts/config';
import { NetworkSelector } from '../ui/NetworkSelector';

interface JoinLobbyProps {
    initialRoomId?: string | null;
}

// Parse a room struct (handles both tuple-array and object forms from viem)
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

/**
 * TODO: When smart contract supports tournaments, read tournament data from chain.
 * For now, we use a stub that returns false for all rooms.
 * Replace this with actual on-chain data when available.
 */
interface TournamentInfo {
    isTournament: boolean;
    prize?: string;       // e.g. "5.0 STT"
    hasPassword?: boolean;
}

function getTournamentInfo(_room: any): TournamentInfo {
    // TODO: Read tournament flag from smart contract room data
    // Example future implementation:
    // return {
    //     isTournament: room.isTournament,
    //     prize: room.prize ? `${formatEther(room.prize)} STT` : undefined,
    //     hasPassword: room.hasPassword,
    // };
    return { isTournament: false };
}

export const JoinLobby: React.FC<JoinLobbyProps> = ({ initialRoomId }) => {
    const { setLobbyName, joinLobbyOnChain, isTxPending, runtimeContractAddress } = useGameContext();
    const { login } = usePrivy();
    const router = useRouter();
    const publicClient = usePublicClient();
    const [rooms, setRooms] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<number>(0);
    const mountedRef = useRef(true);
    const lastFetchRef = useRef(0); // debounce: min 1.5s between fetches
    const MAX_LOBBY_AGE_SEC = 15 * 60;

    // Core fetch function — no generation counter, just a simple mounted check + debounce
    const fetchRooms = useCallback(async (silent = false) => {
        if (!publicClient) return;

        // Debounce: skip if last fetch was < 1.5s ago (prevents RPC spam from events + polling overlap)
        const now = Date.now();
        if (silent && now - lastFetchRef.current < 1500) return;
        lastFetchRef.current = now;

        if (!silent) setIsLoading(true);
        try {
            const roomList: any[] = [];

            if (initialRoomId) {
                const roomId = BigInt(initialRoomId);
                const roomData = await publicClient.readContract({
                    address: runtimeContractAddress, abi: MAFIA_ABI,
                    functionName: 'getRoom', args: [roomId],
                }) as any;
                const parsed = parseRoom(roomId, roomData);
                if (parsed && parsed.phase === 0) {
                    roomList.push(parsed);
                }
            } else {
                const nextId = await publicClient.readContract({
                    address: runtimeContractAddress, abi: MAFIA_ABI,
                    functionName: 'nextRoomId',
                }) as bigint;

                // LOOK-AHEAD: scan 3 rooms BEYOND nextRoomId to catch rooms
                // created between the nextRoomId read and the getRoom reads.
                // Non-existent rooms return zero-address host → filtered by isValid.
                const lookAhead = 3n;
                const scanEnd = nextId + lookAhead;
                const scanCount = 15n + lookAhead; // 15 real + 3 look-ahead
                const start = scanEnd > scanCount ? scanEnd - scanCount : 0n;

                const results = await Promise.allSettled(
                    Array.from({ length: Number(scanEnd - start) }, (_, idx) => {
                        const i = scanEnd - 1n - BigInt(idx);
                        return publicClient.readContract({
                            address: runtimeContractAddress, abi: MAFIA_ABI,
                            functionName: 'getRoom', args: [i],
                        }).then(data => ({ i, data }));
                    })
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
            }

            roomList.sort((a, b) => b.id - a.id);

            if (mountedRef.current) {
                setRooms(roomList);
                setLastUpdate(Date.now());
                if (!silent) setIsLoading(false);
            }
        } catch (e) {
            console.error('[JoinLobby] fetchRooms error:', e);
            if (mountedRef.current && !silent) setIsLoading(false);
        }
    }, [publicClient, initialRoomId]);

    // Lifecycle: initial fetch + polling + event subscriptions
    useEffect(() => {
        mountedRef.current = true;

        // Immediate fetch
        fetchRooms();

        // 3-second polling
        const interval = setInterval(() => fetchRooms(true), 3000);

        // Event subscriptions for instant updates (RoomCreated, PlayerJoined)
        let unwatch1: (() => void) | undefined;
        let unwatch2: (() => void) | undefined;
        if (publicClient && !initialRoomId) {
            try {
                unwatch1 = publicClient.watchContractEvent({
                    address: runtimeContractAddress, abi: MAFIA_ABI,
                    eventName: 'RoomCreated',
                    onLogs: () => { fetchRooms(true); },
                });
            } catch { }
            try {
                unwatch2 = publicClient.watchContractEvent({
                    address: runtimeContractAddress, abi: MAFIA_ABI,
                    eventName: 'PlayerJoined',
                    onLogs: () => { fetchRooms(true); },
                });
            } catch { }
        }

        return () => {
            mountedRef.current = false;
            clearInterval(interval);
            unwatch1?.();
            unwatch2?.();
        };
    }, [fetchRooms, publicClient, initialRoomId]);

    const { isConnected } = useAccount();

    const handleJoin = async (room: any) => {
        if (!isConnected) {
            return;
        }
        // TODO: If tournament room has a password, show password prompt before joining
        const success = await joinLobbyOnChain(room.id);
        if (success) {
            setLobbyName(room.name || `Room #${room.id}`);
            router.push('/waiting');
        }
    };

    return (
        <div className="relative w-full h-[100dvh] font-['Montserrat'] flex flex-col items-center justify-center overflow-y-auto overflow-x-hidden p-4 custom-scrollbar">
            {/* Background is provided by RootLayout/DynamicBackground */}

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="relative z-10 w-full max-w-[600px] flex flex-col items-center gap-4 md:gap-6 py-6 md:py-10">
                <div className="w-full flex items-center justify-between">
                    <div className="-ml-3">
                        <BackButton to="/setup" />
                    </div>
                    <div className="flex items-center gap-2">
                        <NetworkSelector compact />
                    </div>
                </div>

                {initialRoomId && !isLoading && (
                    <div className="w-full p-4 bg-[#916A47]/20 border border-[#916A47] rounded-xl text-center mb-4">
                        <h3 className="text-white text-xl font-bold mb-2">You were invited to Room #{initialRoomId}</h3>
                        {rooms.find(r => r.id === Number(initialRoomId)) ? (
                            <div className="flex flex-col gap-3">
                                <p className="text-white/70 text-sm">Join the conspiracy now.</p>
                                {!isConnected ? (
                                    <div className="flex justify-center">
                                        {(() => {
                                            const { login, authenticated } = require('@privy-io/react-auth').usePrivy();
                                            if (authenticated) {
                                                return (
                                                    <button disabled className="bg-[#916A47]/50 text-white/50 py-2 px-4 rounded-lg font-bold transition-all cursor-wait">
                                                        Connecting...
                                                    </button>
                                                );
                                            }
                                            return (
                                                <button onClick={() => login()} className="bg-[#916A47] hover:bg-[#A37B58] text-white py-2 px-4 rounded-lg font-bold transition-all">
                                                    Connect & Join
                                                </button>
                                            );
                                        })()}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleJoin(rooms.find(r => r.id === Number(initialRoomId)))}
                                        disabled={isTxPending}
                                        className="bg-[#916A47] hover:bg-[#A37B58] text-white py-3 px-6 rounded-lg font-bold transition-all"
                                    >
                                        JOIN ROOM #{initialRoomId}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className="text-red-400">Room not found or game already started.</p>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-between w-full">
                    <h2 className="text-white text-2xl md:text-3xl font-['Cinzel'] font-light tracking-widest uppercase">Live Sessions</h2>
                    <div className="flex items-center gap-3">
                        {lastUpdate > 0 && (
                            <span className="text-white/20 text-[10px] font-mono">
                                {new Date(lastUpdate).toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            onClick={() => fetchRooms(false)}
                            className="text-[#916A47] hover:text-white transition-colors text-xl md:text-2xl"
                            title="Refresh List"
                        >
                            ⟳
                        </button>
                    </div>
                </div>

                <div className="w-full flex flex-col gap-3 min-h-[200px] md:min-h-[300px]">
                    {isLoading ? (
                        <div className="text-white/40 text-center flex-1 flex items-center justify-center bg-black/20 rounded-2xl border border-white/5 animate-pulse">Scanning Network...</div>
                    ) : rooms.length === 0 ? (
                        <div className="text-white/40 text-center flex-1 flex flex-col items-center justify-center bg-black/20 rounded-2xl border border-white/5">
                            No active lobbies found. <br /> Be the first to create one!
                        </div>
                    ) : rooms.map((room) => {
                        const tournament = getTournamentInfo(room);

                        return (
                            <motion.button
                                key={room.id}
                                whileHover={{ scale: 1.02, backgroundColor: tournament.isTournament ? "rgba(212, 165, 74, 0.15)" : "rgba(145, 106, 71, 0.2)" }}
                                onClick={() => {
                                    if (!isConnected) {
                                        login();
                                        return;
                                    }
                                    handleJoin(room);
                                }}
                                disabled={isTxPending}
                                className={`w-full p-4 md:p-5 backdrop-blur-sm rounded-[15px] flex items-center justify-between group transition-all relative overflow-hidden
                                    ${tournament.isTournament
                                        ? 'bg-gradient-to-r from-[#2A1F0A]/90 to-[#19130D]/90 border border-[#D4A54A]/30 shadow-[0_0_15px_rgba(212,165,74,0.1)]'
                                        : 'bg-[#19130D]/80 border border-white/10'
                                    }
                                    ${!isConnected ? 'hover:border-[#916A47]/40' : ''}
                                `}
                            >
                                {/* Tournament glow effect */}
                                {tournament.isTournament && (
                                    <div className="absolute inset-0 pointer-events-none">
                                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D4A54A]/50 to-transparent" />
                                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D4A54A]/30 to-transparent" />
                                    </div>
                                )}

                                <div className="flex flex-col items-start gap-1">
                                    <div className="flex items-center gap-2">
                                        {tournament.isTournament && (
                                            <span className="text-sm" title="Tournament Game">🏆</span>
                                        )}
                                        <span className={`text-base md:text-lg font-medium ${tournament.isTournament ? 'text-[#F0C868]' : 'text-white'}`}>
                                            {room.name || `Room #${room.id}`}
                                        </span>
                                        {tournament.hasPassword && (
                                            <span className="text-[10px] text-white/30" title="Password protected">🔒</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-white/40 text-[9px] md:text-[10px] font-mono uppercase">By {room.host.slice(0, 10)}...</span>
                                        {tournament.isTournament && (
                                            <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#D4A54A]/15 text-[#D4A54A] border border-[#D4A54A]/20">
                                                Tournament
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {/* Prize display for tournament rooms */}
                                    {tournament.isTournament && tournament.prize && (
                                        <div className="text-right mr-2">
                                            <span className="text-[#D4A54A] font-bold text-sm block">💰 {tournament.prize}</span>
                                            <span className="text-[#D4A54A]/40 text-[7px] md:text-[8px] uppercase tracking-wider">Prize Pool</span>
                                        </div>
                                    )}
                                    <div className="text-right">
                                        <span className={`font-bold block ${tournament.isTournament ? 'text-[#D4A54A]' : 'text-[#916A47]'}`}>
                                            {room.players}/{room.max}
                                        </span>
                                        <span className="text-white/20 text-[7px] md:text-[8px] uppercase tracking-wider">Players Joined</span>
                                    </div>
                                    <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-all
                                        ${tournament.isTournament
                                            ? 'bg-[#D4A54A]/20 text-[#D4A54A] group-hover:bg-[#D4A54A] group-hover:text-[#281608]'
                                            : 'bg-[#916A47]/20 text-[#916A47] group-hover:bg-[#916A47] group-hover:text-white'
                                        }
                                    `}>
                                        →
                                    </div>
                                </div>
                            </motion.button>
                        );
                    })}
                </div>
                {!isConnected && rooms.length > 0 && !initialRoomId && (
                    <div className="mt-4 text-white/50 text-xs">
                        * Connect Wallet to join a session
                    </div>
                )}
            </motion.div>
        </div>
    );
};