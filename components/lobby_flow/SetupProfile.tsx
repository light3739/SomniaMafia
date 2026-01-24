import React, { useRef } from 'react';
import { Camera, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import Image from 'next/image';
const lobbyBg = "/assets/lobby_background.webp";
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export const SetupProfile: React.FC = () => {
    const { playerName, setPlayerName, avatarUrl, setAvatarUrl } = useGameContext();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setAvatarUrl(url);
        }
    };

    return (
        <div className="relative w-full min-h-screen font-montserrat flex items-center justify-center p-4">
            {/* Fixed Background */}
            {/* Fixed Background */}
            <div className="fixed inset-0 z-0">
                <Image
                    src={lobbyBg}
                    alt="Lobby Background"
                    fill
                    priority
                    className="object-cover"
                />
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
                    <h2 className="text-white/60 text-lg font-montserrat italic mb-6">Setup Your Profile</h2>

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
                        <label className="text-white/40 text-sm font-montserrat italic">Enter Name</label>
                        <Input
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            placeholder="Your Name"
                            containerClassName="w-full"
                            className="!font-montserrat"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="w-full flex flex-col gap-4">
                    <Button
                        onClick={() => router.push('/create')}
                        disabled={!playerName.trim()}
                        className="w-full h-[60px] text-xl"
                    >
                        Create Game
                    </Button>
                    <Button
                        onClick={() => router.push('/join')}
                        disabled={!playerName.trim()}
                        variant="outline-gold"
                        className="w-full h-[60px] text-xl"
                    >
                        Connect to Lobby
                    </Button>
                </div>
            </motion.div>
        </div>
    );
};
