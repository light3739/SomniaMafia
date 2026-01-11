import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import lobbyBg from '../../assets/lobby_background.png';
import { MOCK_LOBBIES } from '../../services/mockData';
import { BackButton } from '../ui/BackButton';

export const JoinLobby: React.FC = () => {
    const { setLobbyName } = useGameContext();
    const navigate = useNavigate();

    const handleJoin = (name: string) => {
        setLobbyName(name);
        navigate('/lobby');
    };

    return (
        <div className="relative w-full min-h-screen font-['Montserrat'] flex items-center justify-center p-4">
            {/* Fixed Background */}
            <div className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${lobbyBg})` }}
            >
                <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="relative z-10 w-full max-w-[600px] flex flex-col items-center gap-6 py-10"
            >
                <div className="w-full flex items-center justify-start">
                    <BackButton />
                </div>

                <h2 className="text-white text-3xl font-['Montserrat'] tracking-wide">Available Lobbies</h2>

                <div className="w-full flex flex-col gap-3">
                    {MOCK_LOBBIES.map((lobby) => (
                        <motion.button
                            key={lobby.id}
                            whileHover={{ scale: 1.02, backgroundColor: "rgba(145, 106, 71, 0.2)" }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleJoin(lobby.name)}
                            className="w-full p-5 bg-[#19130D]/80 backdrop-blur-sm border border-white/10 rounded-[15px] flex items-center justify-between group transition-all"
                        >
                            <div className="flex flex-col items-start gap-1">
                                <span className="text-white text-lg font-medium">{lobby.name}</span>
                                <span className="text-white/40 text-sm">ID: #{lobby.id}002</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[#916A47] font-bold">{lobby.players}/{lobby.max}</span>
                                <span className="text-white/20 text-xs uppercase tracking-wider">Players</span>
                            </div>
                        </motion.button>
                    ))}
                </div>
            </motion.div>
        </div>
    );
};
