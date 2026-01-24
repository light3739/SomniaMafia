import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import Image from 'next/image';
const lobbyBg = "/assets/lobby_background.webp";
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { BackButton } from '../ui/BackButton';

export const CreateLobby: React.FC = () => {
    const {
        lobbyName,
        setLobbyName,
        createLobbyOnChain,
        isTxPending,
        currentRoomId
    } = useGameContext();

    const router = useRouter();

    // Как только транзакция прошла и контракт выдал нам ID комнаты — идем в ожидание
    useEffect(() => {
        if (currentRoomId !== null) {
            router.push('/waiting');
        }
    }, [currentRoomId, router]);

    const handleCreate = async () => {
        if (!lobbyName.trim() || isTxPending) return;
        await createLobbyOnChain();
    };

    return (
        <div className="relative w-full min-h-screen font-['Montserrat'] flex items-center justify-center p-4">


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
                    <h2 className="text-white text-2xl font-['Montserrat']">Name Your Lobby</h2>
                    <Input
                        value={lobbyName}
                        onChange={(e) => setLobbyName(e.target.value)}
                        placeholder="e.g. Best Mafia Game"
                        autoFocus
                        disabled={isTxPending}
                        containerClassName="w-full"
                        className="h-[60px] !font-['Montserrat']"
                    />
                </div>

                <Button
                    onClick={handleCreate}
                    isLoading={isTxPending}
                    disabled={!lobbyName.trim() || isTxPending}
                    className="w-full h-[60px] text-xl"
                >
                    {isTxPending ? "Deploying on Somnia..." : "Create & Enter"}
                </Button>
            </motion.div>
        </div>
    );
};