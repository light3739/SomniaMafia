import React, { useRef } from 'react';
import { Camera, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import lobbyBg from '../../assets/lobby_background.png';

export const SetupProfile: React.FC = () => {
    const { playerName, setPlayerName, avatarUrl, setAvatarUrl } = useGameContext();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setAvatarUrl(url);
        }
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="relative z-10 w-full max-w-[600px] flex flex-col items-center gap-8 py-10"
            >
                {/* Profile Section */}
                <div className="w-full bg-[rgba(40,22,8,0.70)] backdrop-blur-md rounded-[42px] relative flex flex-col items-center p-8 border border-white/10 shadow-2xl">
                    <h2 className="text-white/60 text-lg font-['Playfair_Display'] italic mb-6">Setup Your Profile</h2>

                    {/* Photo Input */}
                    <div
                        className="relative group cursor-pointer mb-6"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="w-[150px] h-[150px] rounded-full border-2 border-[#916A47] shadow-xl overflow-hidden flex items-center justify-center bg-[#19130D] transition-transform group-hover:scale-105">
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
                        onClick={() => navigate('/create')}
                        disabled={!playerName.trim()}
                        className={`w-full h-[60px] ${playerName.trim() ? 'bg-[#916A47] hover:bg-[#a37a55] text-white/80' : 'bg-[#19130D]/50 cursor-not-allowed text-white/50'} text-xl font-medium rounded-[15px] shadow-lg transition-all active:scale-[0.98] border border-white/5`}
                    >
                        <span>Create Game</span>
                    </button>
                    <button
                        onClick={() => navigate('/join')}
                        disabled={!playerName.trim()}
                        className={`w-full h-[60px] ${playerName.trim() ? 'bg-transparent border-2 border-[#916A47] text-[#916A47] hover:bg-[#916A47] hover:text-[#281608]' : 'bg-transparent border-2 border-white/10 text-white/20 cursor-not-allowed'} text-xl font-medium rounded-[15px] shadow-lg transition-all active:scale-[0.98] box-border`}
                    >
                        Connect to Lobby
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
