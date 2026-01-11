import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import lobbyBg from '../../assets/lobby_background.png';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { BackButton } from '../ui/BackButton';

export const CreateLobby: React.FC = () => {
    const { lobbyName, setLobbyName } = useGameContext();
    const navigate = useNavigate();

    const handleCreate = () => {
        if (!lobbyName.trim()) return;
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
                    <BackButton />
                </div>

                <div className="w-full bg-[rgba(40,22,8,0.70)] backdrop-blur-md rounded-[42px] p-8 border border-white/10 shadow-xl flex flex-col gap-6 items-center">
                    <h2 className="text-white text-2xl font-['Playfair_Display']">Name Your Lobby</h2>
                    <Input
                        value={lobbyName}
                        onChange={(e) => setLobbyName(e.target.value)}
                        placeholder="e.g. Best Mafia Game"
                        autoFocus
                        containerClassName="w-full"
                        className="h-[60px]"
                    />
                </div>

                <Button
                    onClick={handleCreate}
                    disabled={!lobbyName.trim()}
                    className="w-full h-[70px] text-2xl font-light tracking-widest uppercase rounded-[12px] shadow-2xl"
                >
                    Create & Enter
                </Button>
            </motion.div>
        </div>
    );
};
