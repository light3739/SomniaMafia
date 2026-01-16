import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import lobbyBg from '../../assets/lobby_background.png';
import { BackButton } from '../ui/BackButton';
import { usePublicClient } from 'wagmi';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '../../contracts/config';

export const JoinLobby: React.FC = () => {
    const { setLobbyName, joinLobbyOnChain, isTxPending } = useGameContext();
    const navigate = useNavigate();
    const publicClient = usePublicClient();
    const [rooms, setRooms] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Получаем список комнат прямо из блокчейна
    useEffect(() => {
        const fetchRooms = async () => {
            if (!publicClient) return;
            try {
                // Узнаем сколько всего комнат было создано
                const nextId = await publicClient.readContract({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MAFIA_ABI,
                    functionName: 'nextRoomId',
                }) as bigint;

                const roomList = [];
                // Берем последние 10 комнат (или меньше, если их нет)
                const start = nextId > 10n ? nextId - 10n : 1n;

                for (let i = nextId - 1n; i >= start; i--) {
                    const roomData = await publicClient.readContract({
                        address: MAFIA_CONTRACT_ADDRESS,
                        abi: MAFIA_ABI,
                        functionName: 'rooms',
                        args: [i],
                    }) as any;

                    // roomData[2] is now the Name (string) in V4
                    // roomData[3] is the Phase (uint8, 0 = LOBBY)
                    const phase = Number(roomData[3]);
                    if (phase === 0) {
                        roomList.push({
                            id: Number(roomData[0]),
                            host: roomData[1],
                            name: roomData[2],
                            players: Number(roomData[5]), // index 5 is players for V4
                            max: Number(roomData[4])    // index 4 is maxPlayers for V4
                        });
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
    }, [publicClient]);

    const handleJoin = async (room: any) => {
        await joinLobbyOnChain(room.id);
        setLobbyName(room.name || `Room #${room.id}`);
        navigate('/lobby');
    };

    return (
        <div className="relative w-full min-h-screen font-['Montserrat'] flex items-center justify-center p-4">
            <div className="fixed inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(${lobbyBg})` }}>
                <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
            </div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="relative z-10 w-full max-w-[600px] flex flex-col items-center gap-6 py-10">
                <div className="w-full flex items-center justify-start"><BackButton /></div>
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
                            onClick={() => handleJoin(room)}
                            disabled={isTxPending}
                            className="w-full p-5 bg-[#19130D]/80 backdrop-blur-sm border border-white/10 rounded-[15px] flex items-center justify-between group transition-all"
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
                                <div className="w-8 h-8 rounded-full bg-[#916A47]/20 flex items-center justify-center text-[#916A47]">→</div>
                            </div>
                        </motion.button>
                    ))}
                </div>
            </motion.div>
        </div>
    );
};