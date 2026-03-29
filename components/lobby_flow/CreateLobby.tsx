import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { useGameContext } from '../../contexts/GameContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { BackButton } from '../ui/BackButton';
import { NetworkSelector } from '../ui/NetworkSelector';
import { useSoundEffects } from '../ui/SoundEffects';
import { FlowLayout } from '../layout/FlowLayout';

type TournamentType = 'buy-in' | 'free-roll';

export const CreateLobby: React.FC = () => {
    const {
        lobbyName,
        setLobbyName,
        createLobbyOnChain,
        createTournamentOnChain,
        joinTournamentOnChain,
        createTournamentAndRoomOnChain,
        isTxPending,
        lobbyPassword,
        setLobbyPassword,
        currencySymbol,
        publicClient,
        address,
        playerName
    } = useGameContext();

    const { isConnected } = useAccount();
    const { login } = usePrivy();
    const router = useRouter();
    const { playMarkSound } = useSoundEffects();

    // Core Settings (Visual only for now, except lobbyName and password)
    const [maxPlayers, setMaxPlayers] = useState(10);
    const [sliderActive, setSliderActive] = useState(false);

    const [isTournament, setIsTournament] = useState(false);
    const [tournamentType, setTournamentType] = useState<TournamentType>('buy-in');
    const [tournamentAmount, setTournamentAmount] = useState(''); // Used for both entry fee and prize pool

    // Scroll-driven vignette: opacity directly tied to scroll position
    const [scrollProgress, setScrollProgress] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const onScroll = () => setScrollProgress(Math.min(el.scrollTop / 80, 1));
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, []);
    const handleCreate = async () => {
        if (!lobbyName.trim() || isTxPending) return;

        if (isTournament) {
            // TOURNAMENT FLOW
            const buyIn = tournamentType === 'buy-in' ? tournamentAmount : '0';
            const initialPrize = tournamentType === 'free-roll' ? tournamentAmount : '0';
            
            // For now, use native token
            const paymentToken = '0x0000000000000000000000000000000000000000' as `0x${string}`;

            // 0. Fetch base nonce to prevent "nonce too low" errors in rapid succession
            const baseNonce = await publicClient?.getTransactionCount({ 
                address: address as `0x${string}`, 
                blockTag: 'pending' 
            }) || 0;

            const success = await createTournamentAndRoomOnChain({
                name: lobbyName,
                buyIn: buyIn || '0',
                maxPlayers: 100, // Tournament max total players
                playersPerTable: maxPlayers,
                password: lobbyPassword.trim(),
                paymentToken,
                initialPrize: initialPrize || '0',
                roomName: lobbyName,
                nickname: playerName || 'Player',
                isPrivate: !!lobbyPassword,
                joinPassword: lobbyPassword.trim()
            });

            if (success) {
                router.push('/waiting');
            }
        } else {
            // STANDARD LOBBY FLOW
            const success = await createLobbyOnChain(maxPlayers);
            if (success) {
                router.push('/waiting');
            }
        }
    };

    return (
        <FlowLayout
            backTo="/setup"
            rightElement={<NetworkSelector compact />}
        >
            <div className="w-full max-w-[600px] flex flex-col items-center gap-4 md:gap-6">
                {/* Main Card */}
                <div className="w-full bg-[rgba(40,22,8,0.70)] backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/10 shadow-2xl flex flex-col gap-6 mt-2">

                    <h2 className="text-white text-xl md:text-2xl font-['Cinzel'] text-center tracking-widest border-b border-white/10 pb-4">
                        Lobby Settings
                    </h2>

                    {/* ==================== CORE SETTINGS BLOCK ==================== */}
                    <div className="flex flex-col gap-5 w-full">

                        {/* Lobby Name */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-white/70 text-xs md:text-sm font-medium uppercase tracking-wider pl-2">
                                Lobby Name
                            </label>
                            <Input
                                value={lobbyName}
                                onChange={(e) => setLobbyName(e.target.value)}
                                placeholder="e.g. Mafia Syndicate"
                                autoFocus
                                disabled={isTxPending}
                                containerClassName="w-full"
                                className="h-[50px] md:h-[54px] !font-['Montserrat'] focus:border-[#D4A54A]"
                            />
                        </div>

                        {/* Password */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-white/70 text-xs md:text-sm font-medium uppercase tracking-wider flex justify-between pl-2 pr-2">
                                <span>Password</span>
                                <span className="text-white/40 text-[10px] normal-case tracking-normal">(optional)</span>
                            </label>
                            <Input
                                value={lobbyPassword}
                                onChange={(e) => setLobbyPassword(e.target.value)}
                                placeholder="Leave empty for public"
                                disabled={isTxPending}
                                containerClassName="w-full"
                                className="h-[50px] md:h-[54px] !font-['Montserrat'] focus:border-[#D4A54A]"
                                type="password"
                            />
                        </div>

                        {/* Max Players Slider */}
                        <div className="flex flex-col gap-3 pt-2">
                            <div className="flex items-center justify-between pl-2 pr-2">
                                <label
                                    className="text-white/70 text-xs md:text-sm font-medium uppercase tracking-wider cursor-pointer select-none"
                                    htmlFor="max-players-slider"
                                >
                                    Max Players
                                </label>
                                <span className="text-white text-lg md:text-xl font-bold font-['Montserrat'] drop-shadow-md select-none">
                                    {maxPlayers}
                                </span>
                            </div>

                            {/* Контейнер: если идет транзакция, делаем весь блок полупрозрачным */}
                            <div className={`relative w-full h-[80px] mt-2 group/slider select-none transition-opacity duration-300 ${isTxPending ? 'opacity-50' : 'opacity-100'}`}>

                                {/* Визуальная полоска (трек) */}
                                <div className="absolute top-[19px] left-0 right-0 h-[6px] bg-black/50 rounded-full border border-white/5 pointer-events-none z-10" />

                                {/* Анимированный ползунок (Framer Motion) */}
                                <motion.div
                                    className="absolute top-[12px] w-[20px] h-[20px] rounded-full bg-[#D4A54A] border-2 border-[#281608] pointer-events-none z-20"
                                    animate={{
                                        left: `calc(${((maxPlayers - 10) / 6) * 100}% - ${((maxPlayers - 10) / 6) * 20}px)`,
                                        scale: sliderActive && !isTxPending ? 1.15 : 1,
                                        boxShadow: sliderActive && !isTxPending
                                            ? "0 0 15px rgba(212, 165, 74, 0.6)"
                                            : "0 0 10px rgba(212, 165, 74, 0.4)"
                                    }}
                                    transition={{
                                        left: { type: "spring", stiffness: 400, damping: 30 },
                                        scale: { duration: 0.15 },
                                        boxShadow: { duration: 0.15 }
                                    }}
                                />

                                {/* Невидимый нативный инпут */}
                                <input
                                    id="max-players-slider"
                                    type="range"
                                    min={10}
                                    max={16}
                                    step={1}
                                    value={maxPlayers}
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        if (val !== maxPlayers) {
                                            playMarkSound();
                                            setMaxPlayers(val);
                                        }
                                    }}
                                    onPointerEnter={() => setSliderActive(true)}
                                    onPointerLeave={() => setSliderActive(false)}
                                    onPointerDown={() => setSliderActive(true)}
                                    onPointerUp={() => setSliderActive(false)}
                                    onPointerCancel={() => setSliderActive(false)}
                                    disabled={isTxPending}
                                    aria-label="Select maximum number of players"
                                    onDragStart={(e) => e.preventDefault()}
                                    className="custom-slider-invisible absolute top-0 left-0 w-full h-[44px] appearance-none cursor-pointer bg-transparent outline-none z-30 disabled:cursor-not-allowed touch-none"
                                />

                                {/* Зона чисел */}
                                <div className="absolute top-[44px] left-0 right-0 flex justify-between z-20 px-[10px]">
                                    {[10, 11, 12, 13, 14, 15, 16].map((n) => (
                                        <div
                                            key={n}
                                            onClick={() => {
                                                if (isTxPending || n === maxPlayers) return;
                                                playMarkSound();
                                                setMaxPlayers(n);
                                            }}
                                            className={`flex flex-col items-center cursor-pointer group/num select-none w-6 ${isTxPending ? 'cursor-not-allowed' : ''
                                                }`}
                                        >
                                            <div className="w-full h-1" /> {/* Spacer */}
                                            <span className={`transition-all duration-200 font-montserrat ${n === maxPlayers
                                                ? 'text-[#D4A54A] font-bold text-[14px] scale-110 drop-shadow-[0_0_8px_rgba(212,165,74,0.4)]'
                                                : `text-white/40 text-[12px] ${!isTxPending ? 'group-hover/num:text-white/80' : ''}`
                                                }`}>
                                                {n}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>

                    <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-2" />

                    {/* ==================== TOURNAMENT BLOCK ==================== */}
                    <div className="flex flex-col w-full">
                        {/* Tournament Toggle Row */}
                        <div className="w-full flex items-center justify-between py-2 px-2">
                            <span className="text-[#D4A54A] text-sm md:text-base font-semibold uppercase tracking-wider font-['Montserrat']">
                                Tournament Mode
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    playMarkSound();
                                    setIsTournament(!isTournament);
                                }}
                                disabled={isTxPending}
                                data-custom-sound="true"
                                className="relative w-[52px] h-[28px] rounded-full transition-all duration-300 ease-in-out cursor-pointer border shadow-inner flex items-center px-[3px]"
                                style={{
                                    backgroundColor: isTournament ? 'rgba(212, 165, 74, 0.15)' : 'rgba(0, 0, 0, 0.5)',
                                    borderColor: isTournament ? 'rgba(212, 165, 74, 0.4)' : 'rgba(255, 255, 255, 0.1)'
                                }}
                            >
                                <motion.div
                                    animate={{ x: isTournament ? 24 : 0 }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                    className={`w-[20px] h-[20px] rounded-full shadow-md transition-colors duration-300 ${isTournament
                                        ? 'bg-gradient-to-b from-[#F0C868] to-[#D4A54A] shadow-[0_0_10px_rgba(212,165,74,0.5)]'
                                        : 'bg-[#6b584a]'
                                        }`}
                                />
                            </button>
                        </div>

                        {/* Expandable Tournament Settings */}
                        <AnimatePresence initial={false}>
                            {isTournament && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                                    className="w-full overflow-hidden"
                                >
                                    <div className="flex flex-col gap-5 pt-4 pb-2">

                                        <div className="w-full flex bg-[#19130D] rounded-xl p-1 border border-white/5 shadow-inner">
                                            {(['buy-in', 'free-roll'] as const).map((type) => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => {
                                                        if (tournamentType !== type) {
                                                            setTournamentType(type);
                                                        }
                                                    }}
                                                    className={`relative flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-300 ${tournamentType === type ? 'text-[#281608]' : 'text-white/50 hover:text-white/80'
                                                        }`}
                                                >
                                                    {tournamentType === type && (
                                                        <motion.div
                                                            layoutId="tournament-tab"
                                                            className="absolute inset-0 bg-gradient-to-r from-[#D4A54A] to-[#B08D57] rounded-lg shadow-md"
                                                            style={{ zIndex: 0 }}
                                                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                                        />
                                                    )}
                                                    <span className="relative z-10">
                                                        {type === 'buy-in' ? 'Buy-in' : 'Free Roll'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Dynamic Input based on Type */}
                                        <div className="flex flex-col gap-1.5 px-2">
                                            <label className="text-[#D4A54A]/80 text-xs md:text-sm font-medium uppercase tracking-wider">
                                                {tournamentType === 'buy-in' ? 'Entry Fee per player' : 'Total Prize Pool'}
                                            </label>
                                            <div className="relative">
                                                <Input
                                                    value={tournamentAmount}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(',', '.');
                                                        // SE-PATTERN: Regex validation to prevent parseEther crash
                                                        if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                                            setTournamentAmount(val);
                                                        }
                                                    }}
                                                    placeholder="0.00"
                                                    disabled={isTxPending}
                                                    containerClassName="w-full"
                                                    className="h-[50px] md:h-[54px] !font-['Montserrat'] !text-[#D4A54A] !border-[#D4A54A]/30 focus:!border-[#D4A54A] !pr-16"
                                                    type="text"
                                                    inputMode="decimal"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D4A54A]/50 text-sm font-bold pointer-events-none">
                                                    {currencySymbol}
                                                </span>
                                            </div>

                                            {/* Прячем дергание: фиксированная высота под текст */}
                                            <div className="h-[16px] mt-1 pl-1">
                                                <span className={`text-[11px] text-[#D4A54A]/60 italic transition-opacity duration-300 block ${tournamentType === 'free-roll' ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                                    }`}>
                                                    * You will need to deposit this amount upon creation.
                                                </span>
                                            </div>
                                        </div>

                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <Button
                    onClick={() => {
                        if (!isConnected) {
                            login();
                            return;
                        }
                        handleCreate();
                    }}
                    variant="primary-lobby"
                    isLoading={isTxPending}
                    disabled={(!lobbyName.trim()) || isTxPending}
                    className={`w-full h-[54px] md:h-[60px] text-lg md:text-xl tracking-[0.1em] font-['Cinzel'] transition-all duration-300 mt-2 ${isTournament && lobbyName.trim()
                        ? '!bg-gradient-to-r !from-[#D4A54A] !to-[#F0C868] !text-[#281608] !border-[#D4A54A]/30 !shadow-[0_0_20px_rgba(212,165,74,0.3)]'
                        : ''
                        }`}
                >
                    {!isConnected
                        ? "Connect Wallet"
                        : isTxPending
                            ? "Deploying..."
                            : isTournament && tournamentType === 'free-roll'
                                ? "Deposit & Create"
                                : isTournament && tournamentType === 'buy-in'
                                    ? "Create Buy-in Game"
                                    : "Create & Enter"
                    }
                </Button>
            </div>

            <style jsx>{`
                .custom-slider-invisible::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 20px;
                    height: 44px;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                }
                .custom-slider-invisible::-moz-range-thumb {
                    width: 20px;
                    height: 44px;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                }
                .custom-slider-invisible::-webkit-slider-runnable-track {
                    background: transparent;
                    height: 44px;
                }
                .custom-slider-invisible::-moz-range-track {
                    background: transparent;
                    height: 44px;
                }
            `}</style>
        </FlowLayout>
    );
};