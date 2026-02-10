import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { BackButton } from '../ui/BackButton';
import { usePublicClient, useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '../../contracts/config';

interface JoinLobbyProps {
    initialRoomId?: string | null;
}

export const JoinLobby: React.FC<JoinLobbyProps> = ({ initialRoomId }) => {
    const { setLobbyName, joinLobbyOnChain, isTxPending } = useGameContext();
    const router = useRouter();
    const publicClient = usePublicClient();
    const [rooms, setRooms] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Получаем список комнат прямо из блокчейна
    useEffect(() => {
        const fetchRooms = async () => {
            if (!publicClient) return;
            try {
                const roomList = [];

                if (initialRoomId) {
                    // Fetch SPECIFIC room
                    const roomId = BigInt(initialRoomId);
                    const roomData = await publicClient.readContract({
                        address: MAFIA_CONTRACT_ADDRESS,
                        abi: MAFIA_ABI,
                        functionName: 'getRoom',
                        args: [roomId],
                    }) as any;

                    // Check if it exists/is valid (phase 0 = LOBBY)
                    if (Number(roomData.id) === Number(roomId)) {
                        const phase = Number(roomData.phase);
                        if (phase === 0) {
                            roomList.push({
                                id: Number(roomData.id),
                                host: roomData.host,
                                name: roomData.name,
                                players: Number(roomData.playersCount),
                                max: Number(roomData.maxPlayers)
                            });
                        }
                    }

                } else {
                    // Fetch LAST 10 rooms (Default behavior)
                    const nextId = await publicClient.readContract({
                        address: MAFIA_CONTRACT_ADDRESS,
                        abi: MAFIA_ABI,
                        functionName: 'nextRoomId',
                    }) as bigint;

                    const start = nextId > 10n ? nextId - 10n : 1n;
                    const fetchPromises = [];

                    for (let i = nextId - 1n; i >= start; i--) {
                        fetchPromises.push(
                            publicClient.readContract({
                                address: MAFIA_CONTRACT_ADDRESS,
                                abi: MAFIA_ABI,
                                functionName: 'getRoom',
                                args: [i],
                            }).then(data => ({ id: i, data: data as any }))
                        );
                    }

                    const results = await Promise.all(fetchPromises);

                    // Process results in order
                    for (const { id, data } of results) {
                        const phase = Number(data.phase);
                        if (phase === 0) {
                            roomList.push({
                                id: Number(data.id),
                                host: data.host,
                                name: data.name,
                                players: Number(data.playersCount),
                                max: Number(data.maxPlayers)
                            });
                        }
                    }
                }
                setRooms(roomList);
            } catch (e) {
                console.error("Error fetching rooms:", e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRooms();
    }, [publicClient, initialRoomId]);

    const { isConnected } = useAccount();

    const handleJoin = async (room: any) => {
        if (!isConnected) {
            return;
        }
        const success = await joinLobbyOnChain(room.id);
        if (success) {
            setLobbyName(room.name || `Room #${room.id}`);
            router.push('/waiting');
        }
    };

    return (
        <div className="relative w-full min-h-screen font-['Montserrat'] flex items-center justify-center p-4">


            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="relative z-10 w-full max-w-[600px] flex flex-col items-center gap-6 py-10">
                <div className="w-full flex items-center justify-between">
                    <BackButton />
                    <ConnectButton accountStatus="avatar" chainStatus="icon" showBalance={false} />
                </div>

                {initialRoomId && !isLoading && (
                    <div className="w-full p-4 bg-[#916A47]/20 border border-[#916A47] rounded-xl text-center mb-4">
                        <h3 className="text-white text-xl font-bold mb-2">You were invited to Room #{initialRoomId}</h3>
                        {rooms.find(r => r.id === Number(initialRoomId)) ? (
                            <div className="flex flex-col gap-3">
                                <p className="text-white/70 text-sm">Join the conspiracy now.</p>
                                {!isConnected ? (
                                    <div className="flex justify-center"><ConnectButton label="Connect & Join" /></div>
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

                <h2 className="text-white text-3xl font-light tracking-widest uppercase">Live Sessions</h2>

                <div className="w-full flex flex-col gap-3">
                    {isLoading ? (
                        <div className="text-white/40 text-center py-10">Scanning Somnia Network...</div>
                    ) : rooms.length === 0 ? (
                        <div className="text-white/40 text-center py-10 bg-black/20 rounded-2xl border border-white/5">
                            No active lobbies found. <br /> Be the first to create one!
                        </div>
                    ) : rooms.map((room) => (
                        <motion.button
                            key={room.id}
                            whileHover={{ scale: 1.02, backgroundColor: "rgba(145, 106, 71, 0.2)" }}
                            onClick={() => !isConnected ? null : handleJoin(room)}
                            disabled={isTxPending || (!isConnected && !initialRoomId)} // Allow click if not connected to trigger tooltip? No, replace with connect instructions?
                            // Actually, let's keep it simple: If not connected, the top right button allows connection. 
                            // But better UX: click room -> if not connected -> highlight connect button or show alert.
                            className={`w-full p-5 bg-[#19130D]/80 backdrop-blur-sm border border-white/10 rounded-[15px] flex items-center justify-between group transition-all ${!isConnected ? 'opacity-70 grayscale' : ''}`}
                        >
                            <div className="flex flex-col items-start gap-1">
                                <span className="text-white text-lg font-medium">{room.name || `Room #${room.id}`}</span>
                                <span className="text-white/40 text-[10px] font-mono uppercase">By {room.host.slice(0, 10)}...</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <span className="text-[#916A47] font-bold block">{room.players}/{room.max}</span>
                                    <span className="text-white/20 text-[8px] uppercase tracking-wider">Players Joined</span>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-[#916A47]/20 flex items-center justify-center text-[#916A47]">
                                    {isConnected ? '→' : '🔒'}
                                </div>
                            </div>
                        </motion.button>
                    ))}
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