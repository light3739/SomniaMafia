import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { BackButton } from '../ui/BackButton';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { NetworkSelector } from '../ui/NetworkSelector';

export const CreateLobby: React.FC = () => {
    const {
        lobbyName,
        setLobbyName,
        createLobbyOnChain,
        isTxPending,
    } = useGameContext();

    const router = useRouter();

    const handleCreate = async () => {
        if (!lobbyName.trim() || isTxPending) return;
        const success = await createLobbyOnChain();
        if (success) {
            router.push('/waiting');
        }
    };

    return (
        <div className="relative w-full h-[100dvh] font-['Montserrat'] flex flex-col items-center overflow-y-auto overflow-x-hidden p-4 custom-scrollbar">
            {/* Background is provided by RootLayout/DynamicBackground */}

            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="relative z-10 w-full max-w-[600px] flex flex-col items-center gap-4 md:gap-8 py-6 md:py-10 my-auto"
            >
                <div className="w-full flex items-center justify-between">
                    <div className="-ml-3">
                        <BackButton to="/setup" />
                    </div>
                    <div className="flex items-center gap-2">
                        <NetworkSelector compact />
                    </div>
                </div>

                <div className="w-full bg-[rgba(40,22,8,0.70)] backdrop-blur-md rounded-[42px] p-5 md:p-8 border border-white/10 shadow-xl flex flex-col gap-4 md:gap-6 items-center mt-2">
                    <h2 className="text-white text-xl md:text-2xl font-['Cinzel']">Name Your Lobby</h2>
                    <Input
                        value={lobbyName}
                        onChange={(e) => setLobbyName(e.target.value)}
                        placeholder="e.g. Best Mafia Game"
                        autoFocus
                        disabled={isTxPending}
                        containerClassName="w-full"
                        className="h-[54px] md:h-[60px] !font-['Montserrat']"
                    />
                </div>

                <Button
                    onClick={handleCreate}
                    isLoading={isTxPending}
                    disabled={!lobbyName.trim() || isTxPending}
                    className="w-full h-[54px] md:h-[60px] text-lg md:text-xl"
                >
                    {isTxPending ? "Deploying on Somnia..." : "Create & Enter"}
                </Button>
            </motion.div>
        </div>
    );
};