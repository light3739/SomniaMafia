import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import lobbyBg from '../../assets/lobby_background.png';

export const WaitingRoom: React.FC = () => {
    const { lobbyName, playerName, startGame } = useGameContext();
    const navigate = useNavigate();

    // Mock players
    const players = Array(16).fill(null).map((_, i) => ({
        name: i === 0 ? (playerName || 'Host') : 'Haiman',
        address: `0x9c...${Math.floor(Math.random() * 1000).toString(16)}`
    }));

    const handleStart = async () => {
        await startGame();
        navigate('/game');
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
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4 }}
                className="relative z-10 w-full max-w-[600px] flex flex-col items-center gap-6 py-10"
            >
                {/* Header / Back */}
                <div className="w-full flex items-center justify-between">
                    <button
                        onClick={() => navigate('/setup')} // Back to setup
                        className="p-3 bg-[#19130D]/60 rounded-full hover:bg-[#916A47] transition-colors text-white"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex flex-col items-center">
                        <h1 className="text-white text-2xl font-light tracking-widest font-['Playfair_Display']">
                            {lobbyName}
                        </h1>
                        <span className="text-white/40 text-xs uppercase tracking-widest">Waiting for players</span>
                    </div>
                    <div className="w-12" /> {/* Spacer */}
                </div>

                {/* Lobby List */}
                <div className="w-full bg-[rgba(34,22,11,0.8)] backdrop-blur-md rounded-[20px] p-6 border border-white/5 shadow-2xl max-h-[500px] flex flex-col">
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 min-h-[300px]">
                        {players.map((player, index) => (
                            <div
                                key={index}
                                className="w-full p-4 bg-[#19130D]/60 hover:bg-[#251c14] rounded-[8px] flex justify-between items-center transition-colors border border-white/5 group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-[#916A47]/20 flex items-center justify-center text-[#916A47] text-xs">
                                        {index + 1}
                                    </div>
                                    <span className="text-white/90 font-light group-hover:text-white transition-colors">
                                        {player.name} {player.name === playerName && '(You)'}
                                    </span>
                                </div>
                                <span className="text-white/40 font-mono text-sm bg-black/20 px-2 py-1 rounded">{player.address}</span>
                            </div>
                        ))}
                    </div>
                    <div className="pt-4 mt-2 border-t border-white/5 flex items-center justify-end">
                        <div className="text-white/60 text-sm">
                            Players: <span className="text-white">{players.length}/16</span>
                        </div>
                    </div>
                </div>

                {/* Start Game Button */}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleStart}
                    className="w-full h-[70px] bg-gradient-to-r from-[#19130D] to-[#2a2118] hover:from-[#251c14] hover:to-[#362b22] text-white text-2xl tracking-widest font-light uppercase rounded-[12px] shadow-2xl border border-white/10 transition-all"
                >
                    Start Game
                </motion.button>
            </motion.div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(0,0,0,0.2);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #916A47;
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #A87B56;
                }
            `}</style>
        </div>
    );
};
