import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import lobbyBg from '../../assets/lobby_background.png';

export const CreateLobby: React.FC = () => {
    const { lobbyName, setLobbyName } = useGameContext();
    const navigate = useNavigate();

    const handleCreate = () => {
        if (!lobbyName.trim()) return;
        // In a real app, you would send a request to create the lobby here
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
                className="relative z-10 w-full max-w-[600px] flex flex-col items-center gap-8 py-10"
            >
                <div className="w-full flex items-center justify-start">
                    <button onClick={() => navigate(-1)} className="text-white/60 hover:text-white flex items-center gap-2">
                        <ArrowLeft className="w-5 h-5" /> Back
                    </button>
                </div>

                <div className="w-full bg-[rgba(40,22,8,0.70)] backdrop-blur-md rounded-[42px] p-8 border border-white/10 shadow-xl flex flex-col gap-6 items-center">
                    <h2 className="text-white text-2xl font-['Playfair_Display']">Name Your Lobby</h2>
                    <input
                        type="text"
                        value={lobbyName}
                        onChange={(e) => setLobbyName(e.target.value)}
                        placeholder="e.g. Best Mafia Game"
                        className="w-full h-[60px] bg-[#19130D]/60 rounded-[10px] border border-white/10 text-center text-white text-xl placeholder:text-white/20 focus:outline-none focus:border-[#916A47]"
                        autoFocus
                    />
                </div>

                <button
                    onClick={handleCreate}
                    disabled={!lobbyName.trim()}
                    className={`w-full h-[70px] ${lobbyName.trim() ? 'bg-[#916A47] hover:bg-[#a37a55]' : 'bg-[#4a3b2f] cursor-not-allowed'} text-white text-2xl font-light tracking-widest uppercase rounded-[12px] shadow-2xl border border-white/10 transition-all`}
                >
                    Create & Enter
                </button>
            </motion.div>
        </div>
    );
};
