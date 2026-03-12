import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { useGameContext } from '../../contexts/GameContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { BackButton } from '../ui/BackButton';
import { NetworkSelector } from '../ui/NetworkSelector';

export const CreateLobby: React.FC = () => {
    const {
        lobbyName,
        setLobbyName,
        createLobbyOnChain,
        isTxPending,
    } = useGameContext();

    const { isConnected } = useAccount();
    const { login } = usePrivy();
    const router = useRouter();

    // Tournament mode state
    const [isTournament, setIsTournament] = useState(false);
    const [tournamentPassword, setTournamentPassword] = useState('');
    const [tournamentPrize, setTournamentPrize] = useState('');
    const [tournamentMaxPlayers, setTournamentMaxPlayers] = useState(10);

    const handleCreate = async () => {
        if (!lobbyName.trim() || isTxPending) return;

        // TODO: When smart contract supports tournaments, pass tournament params:
        // { isTournament, password: tournamentPassword, prize: tournamentPrize, maxPlayers: tournamentMaxPlayers }
        const success = await createLobbyOnChain();
        if (success) {
            router.push('/waiting');
        }
    };

    return (
        <div className="relative w-full h-[100dvh] font-['Montserrat'] flex flex-col items-center justify-center overflow-y-auto overflow-x-hidden p-4 custom-scrollbar">
            {/* Background is provided by RootLayout/DynamicBackground */}

            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="relative z-10 w-full max-w-[600px] flex flex-col items-center gap-4 md:gap-6 py-6 md:py-10"
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

                    {/* Tournament Mode Toggle */}
                    <div className="w-full flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <span className="text-lg">🏆</span>
                            <span className="text-white/80 text-sm md:text-base font-medium">Tournament Mode</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsTournament(!isTournament)}
                            disabled={isTxPending}
                            className={`relative w-[52px] h-[28px] rounded-full transition-all duration-300 ease-in-out cursor-pointer border
                                ${isTournament
                                    ? 'bg-gradient-to-r from-[#D4A54A] to-[#F0C868] border-[#D4A54A]/50 shadow-[0_0_12px_rgba(212,165,74,0.4)]'
                                    : 'bg-[#19130D]/80 border-white/10 hover:border-white/20'
                                }
                                disabled:opacity-50 disabled:cursor-not-allowed
                            `}
                            aria-label="Toggle tournament mode"
                        >
                            <motion.div
                                layout
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                className={`absolute top-[3px] w-[20px] h-[20px] rounded-full shadow-md
                                    ${isTournament
                                        ? 'left-[28px] bg-[#281608]'
                                        : 'left-[3px] bg-white/40'
                                    }
                                `}
                            />
                        </button>
                    </div>

                    {/* Tournament Settings (expandable) */}
                    <AnimatePresence initial={false}>
                        {isTournament && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                                className="w-full overflow-hidden"
                            >
                                <div className="flex flex-col gap-4 pt-2 pb-1">
                                    {/* Golden divider */}
                                    <div className="w-full h-px bg-gradient-to-r from-transparent via-[#D4A54A]/40 to-transparent" />

                                    {/* Prize Pool */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[#D4A54A]/80 text-xs md:text-sm font-medium uppercase tracking-wider flex items-center gap-1.5">
                                            <span>💰</span> Prize Pool
                                        </label>
                                        <div className="relative">
                                            <Input
                                                value={tournamentPrize}
                                                onChange={(e) => setTournamentPrize(e.target.value)}
                                                placeholder="0.00"
                                                disabled={isTxPending}
                                                containerClassName="w-full"
                                                className="h-[48px] md:h-[52px] !font-['Montserrat'] !text-[#D4A54A] !border-[#D4A54A]/20 focus:!border-[#D4A54A]/60 !pr-16 !text-right"
                                                type="text"
                                                inputMode="decimal"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D4A54A]/50 text-sm font-semibold pointer-events-none">
                                                STT
                                            </span>
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[#D4A54A]/80 text-xs md:text-sm font-medium uppercase tracking-wider flex items-center gap-1.5">
                                            <span>🔒</span> Password
                                            <span className="text-white/20 text-[10px] normal-case tracking-normal ml-1">(optional)</span>
                                        </label>
                                        <Input
                                            value={tournamentPassword}
                                            onChange={(e) => setTournamentPassword(e.target.value)}
                                            placeholder="Leave empty for public"
                                            disabled={isTxPending}
                                            containerClassName="w-full"
                                            className="h-[48px] md:h-[52px] !font-['Montserrat'] !border-[#D4A54A]/20 focus:!border-[#D4A54A]/60"
                                            type="password"
                                        />
                                    </div>

                                    {/* Max Players Slider */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[#D4A54A]/80 text-xs md:text-sm font-medium uppercase tracking-wider flex items-center gap-1.5">
                                                <span>👥</span> Max Players
                                            </label>
                                            <span className="text-[#D4A54A] text-xl md:text-2xl font-bold font-['Cinzel']">
                                                {tournamentMaxPlayers}
                                            </span>
                                        </div>
                                        <div className="relative w-full px-1">
                                            <input
                                                type="range"
                                                min={10}
                                                max={16}
                                                step={1}
                                                value={tournamentMaxPlayers}
                                                onChange={(e) => setTournamentMaxPlayers(Number(e.target.value))}
                                                disabled={isTxPending}
                                                className="tournament-slider w-full h-[6px] rounded-full appearance-none cursor-pointer bg-[#19130D] outline-none"
                                            />
                                            <div className="flex justify-between mt-1.5 px-0.5">
                                                {[10, 11, 12, 13, 14, 15, 16].map((n) => (
                                                    <span
                                                        key={n}
                                                        className={`text-[9px] md:text-[10px] transition-colors ${
                                                            n === tournamentMaxPlayers ? 'text-[#D4A54A] font-bold' : 'text-white/20'
                                                        }`}
                                                    >
                                                        {n}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Golden divider */}
                                    <div className="w-full h-px bg-gradient-to-r from-transparent via-[#D4A54A]/40 to-transparent" />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <Button
                    onClick={() => {
                        if (!isConnected) {
                            login();
                            return;
                        }
                        handleCreate();
                    }}
                    isLoading={isTxPending}
                    disabled={(!isConnected && false) || (isConnected && !lobbyName.trim()) || isTxPending}
                    className={`w-full h-[54px] md:h-[60px] text-lg md:text-xl ${
                        isTournament ? '!bg-gradient-to-r !from-[#D4A54A] !to-[#F0C868] !text-[#281608] !border-[#D4A54A]/30 !shadow-[0_0_20px_rgba(212,165,74,0.3)]' : ''
                    }`}
                >
                    {!isConnected
                        ? "Connect Wallet"
                        : isTxPending
                        ? "Deploying on Somnia..."
                        : isTournament
                        ? "🏆 Create Tournament"
                        : "Create & Enter"
                    }
                </Button>
            </motion.div>

            {/* Custom styles for the range slider */}
            <style jsx>{`
                .tournament-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #D4A54A, #F0C868);
                    cursor: pointer;
                    box-shadow: 0 0 8px rgba(212, 165, 74, 0.5), 0 2px 4px rgba(0, 0, 0, 0.3);
                    border: 2px solid #281608;
                    transition: box-shadow 0.2s ease;
                }
                .tournament-slider::-webkit-slider-thumb:hover {
                    box-shadow: 0 0 14px rgba(212, 165, 74, 0.7), 0 2px 6px rgba(0, 0, 0, 0.4);
                }
                .tournament-slider::-moz-range-thumb {
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #D4A54A, #F0C868);
                    cursor: pointer;
                    box-shadow: 0 0 8px rgba(212, 165, 74, 0.5), 0 2px 4px rgba(0, 0, 0, 0.3);
                    border: 2px solid #281608;
                }
                .tournament-slider::-webkit-slider-runnable-track {
                    background: linear-gradient(to right, #D4A54A, #19130D);
                    border-radius: 999px;
                    height: 6px;
                }
                .tournament-slider::-moz-range-track {
                    background: linear-gradient(to right, #D4A54A, #19130D);
                    border-radius: 999px;
                    height: 6px;
                }
            `}</style>
        </div>
    );
};