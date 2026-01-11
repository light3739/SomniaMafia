import React, { useState, useRef } from 'react';
import lobbyBg from '../assets/lobby_background.png';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, ArrowLeft } from 'lucide-react';

interface LobbyProps {
    onStart: () => void;
    connectedPlayers?: { name: string; address: string }[];
}

export const Lobby: React.FC<LobbyProps> = ({ onStart, connectedPlayers = [] }) => {

    // UI State: 'setup' or 'lobby'
    const [viewStatus, setViewStatus] = useState<'setup' | 'lobby'>('setup');

    const [playerName, setPlayerName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Mock data if empty
    const players = connectedPlayers.length > 0
        ? connectedPlayers
        : Array(16).fill(null).map((_, i) => ({
            name: i === 0 ? (playerName || 'Host') : 'Haiman',
            address: `0x9c...${Math.floor(Math.random() * 1000).toString(16)}`
        }));

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setAvatarUrl(url);
        }
    };

    const handleCreateGame = () => {
        if (!playerName.trim()) return; // Simple validation
        setViewStatus('lobby');
    };

    return (
        <div className="relative w-full min-h-screen font-['Montserrat'] flex items-center justify-center p-4">

            {/* Fixed Background */}
            <div className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${lobbyBg})` }}
            >
                <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
            </div>

            {/* Main Content Container - Single Column */}
            <div className="relative z-10 w-full max-w-[600px] flex flex-col items-center gap-8 py-10 transition-all">

                <AnimatePresence mode="wait">
                    {/* VIEW 1: SETUP */}
                    {viewStatus === 'setup' && (
                        <motion.div
                            key="setup"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                            className="w-full flex flex-col items-center gap-8"
                        >
                            {/* Profile Section */}
                            <div className="w-full bg-[rgba(40,22,8,0.70)] backdrop-blur-md rounded-[42px] relative flex flex-col items-center p-8 border border-white/10 shadow-2xl">
                                {/* Photo Input */}
                                <div
                                    className="relative group cursor-pointer mb-6"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className={`w-[150px] h-[150px] rounded-full border-2 border-[#916A47] shadow-xl overflow-hidden flex items-center justify-center bg-[#19130D] transition-transform group-hover:scale-105`}>
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <Camera className="w-12 h-12 text-white/20 group-hover:text-white/50 transition-colors" />
                                        )}
                                    </div>
                                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Upload className="w-8 h-8 text-white" />
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                </div>

                                {/* Name Input */}
                                <div className="w-full max-w-[300px] flex flex-col items-center gap-2">
                                    <label className="text-white/40 text-sm font-['Playfair_Display'] italic">Enter Name</label>
                                    <input
                                        type="text"
                                        value={playerName}
                                        onChange={(e) => setPlayerName(e.target.value)}
                                        placeholder="Your Name"
                                        className="w-full h-[50px] bg-[#19130D]/60 rounded-[10px] border border-white/10 text-center text-white text-xl placeholder:text-white/20 focus:outline-none focus:border-[#916A47] transition-all font-['Playfair_Display']"
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="w-full flex flex-col gap-4">
                                <button
                                    onClick={handleCreateGame}
                                    disabled={!playerName.trim()}
                                    className={`w-full h-[60px] ${playerName.trim() ? 'bg-[#916A47] hover:bg-[#a37a55]' : 'bg-[#4a3b2f] cursor-not-allowed'} text-white text-xl font-medium rounded-[15px] shadow-lg transition-all active:scale-[0.98] border border-white/10 flex items-center justify-center gap-3`}
                                >
                                    <span>Create Game</span>
                                </button>
                                <button className="w-full h-[60px] bg-[#19130D] hover:bg-[#2a2118] text-white/80 text-xl font-medium rounded-[15px] shadow-lg transition-all active:scale-[0.98] border border-white/5">
                                    Connect to Lobby
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* VIEW 2: LOBBY */}
                    {viewStatus === 'lobby' && (
                        <motion.div
                            key="lobby"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.4 }}
                            className="w-full flex flex-col items-center gap-6"
                        >
                            {/* Header / Back */}
                            <div className="w-full flex items-center justify-between">
                                <button
                                    onClick={() => setViewStatus('setup')}
                                    className="p-3 bg-[#19130D]/60 rounded-full hover:bg-[#916A47] transition-colors text-white"
                                >
                                    <ArrowLeft className="w-6 h-6" />
                                </button>
                                <h1 className="text-white text-2xl font-light tracking-widest font-['Playfair_Display']">
                                    {playerName}'s Lobby
                                </h1>
                                <div className="w-12" /> {/* Spacer for centering */}
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
                                onClick={onStart}
                                className="w-full h-[70px] bg-gradient-to-r from-[#19130D] to-[#2a2118] hover:from-[#251c14] hover:to-[#362b22] text-white text-2xl tracking-widest font-light uppercase rounded-[12px] shadow-2xl border border-white/10 transition-all"
                            >
                                Start Game
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>

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
