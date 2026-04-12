import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { parseEther, formatEther } from 'viem';
import { useGameContext } from '../../contexts/GameContext';
import { MAFIA_ABI } from '../../contracts/config';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { BackButton } from '../ui/BackButton';
import { NetworkSelector } from '../ui/NetworkSelector';
import { useSoundEffects } from '../ui/SoundEffects';
import { FlowLayout } from '../layout/FlowLayout';

// Matches `LOBBY_FUNDING_VALUE` in useWalletManager.ts — the amount sent to
// the session wallet on join and refunded via drainSessionGas at game end.
// Shown as the refundable gas reserve in the fee breakdown below.
const SESSION_GAS_RESERVE = parseEther('1.5');

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
        playerName,
        runtimeContractAddress,
    } = useGameContext();

    // Fetch the non-refundable platform entry fee from the diamond so the
    // breakdown below always matches the actual on-chain value (0.5 STT at
    // deploy time, but can be changed by admin). Falls back to 0.5 STT on
    // read failure so the UI still shows a sensible number.
    const [entryFee, setEntryFee] = useState<bigint>(parseEther('0.5'));
    useEffect(() => {
        if (!publicClient || !runtimeContractAddress) return;
        let cancelled = false;
        (async () => {
            try {
                const fee = await publicClient.readContract({
                    address: runtimeContractAddress,
                    abi: MAFIA_ABI,
                    functionName: 'getEntryFee',
                }) as bigint;
                if (!cancelled) setEntryFee(fee);
            } catch { /* leave fallback */ }
        })();
        return () => { cancelled = true; };
    }, [publicClient, runtimeContractAddress]);

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

    // Pre-fill form from rematch settings (set by GameOver "Rematch" button)
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('rematch_settings');
            if (!raw) return;
            sessionStorage.removeItem('rematch_settings');
            const settings = JSON.parse(raw);
            if (settings.lobbyName) setLobbyName(settings.lobbyName);
            if (settings.maxPlayers >= 10 && settings.maxPlayers <= 16) setMaxPlayers(settings.maxPlayers);
        } catch { /* ignore malformed data */ }
    }, [setLobbyName]);

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
                                className="h-[50px] md:h-[54px] !font-['Montserrat'] focus:border-[#C49A3C]"
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
                                className="h-[50px] md:h-[54px] !font-['Montserrat'] focus:border-[#C49A3C]"
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
                                    className="absolute top-[12px] w-[20px] h-[20px] rounded-full bg-[#C49A3C] border border-white/20 shadow-[0_0_10px_rgba(196,154,60,0.4)] pointer-events-none z-20"
                                    animate={{
                                        left: `calc(${((maxPlayers - 10) / 6) * 100}% - ${((maxPlayers - 10) / 6) * 20}px)`,
                                        scale: sliderActive && !isTxPending ? 1.15 : 1
                                    }}
                                    transition={{
                                        left: { type: "spring", stiffness: 400, damping: 30 },
                                        scale: { duration: 0.15 }
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
                                                ? 'text-white font-bold text-[14px] scale-110'
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
                            <span className="text-[#C49A3C] text-sm md:text-base font-semibold uppercase tracking-wider font-['Montserrat']">
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
                                    backgroundColor: isTournament ? 'rgba(196, 154, 60, 0.15)' : 'rgba(0, 0, 0, 0.5)',
                                    borderColor: isTournament ? 'rgba(196, 154, 60, 0.4)' : 'rgba(255, 255, 255, 0.1)'
                                }}
                            >
                                <motion.div
                                    animate={{ x: isTournament ? 24 : 0 }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                    className={`w-[20px] h-[20px] rounded-full shadow-md transition-colors duration-300 ${isTournament
                                        ? 'bg-gradient-to-b from-[#A8784F] to-[#C49A3C] shadow-[0_0_10px_rgba(196,154,60,0.5)]'
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
                                                    className={`relative flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-300 group ${tournamentType === type ? 'text-[#281608]' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                                                        }`}
                                                >
                                                    {tournamentType === type && (
                                                        <motion.div
                                                            layoutId="tournament-tab"
                                                            className="absolute inset-0 bg-[#C49A3C] rounded-lg"
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
                                            <label className="text-[#C49A3C]/80 text-xs md:text-sm font-medium uppercase tracking-wider">
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
                                                    className="h-[50px] md:h-[54px] text-center !pl-16 !font-['Montserrat'] !text-[#C49A3C] !border-[#C49A3C]/30 focus:!border-[#C49A3C] !pr-16"
                                                    type="text"
                                                    inputMode="decimal"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#C49A3C]/50 text-sm font-bold pointer-events-none">
                                                    {currencySymbol}
                                                </span>
                                            </div>

                                            {/* Прячем дергание: фиксированная высота под текст */}
                                            <div className="h-[16px] mt-1 pl-1">
                                                <span className={`text-[11px] text-[#C49A3C]/60 italic transition-opacity duration-300 block ${tournamentType === 'free-roll' ? 'opacity-100' : 'opacity-0 pointer-events-none'
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

                {/* Fee breakdown — shown above the create button so players
                    understand what they're signing. Platform fee is a
                    non-refundable entry charge; gas reserve is put on a
                    session wallet and returned at game end via drainSessionGas. */}
                {isConnected && (
                    <div className="w-full bg-[rgba(15,10,5,0.7)] backdrop-blur-xl rounded-2xl px-4 py-3 border border-white/5 mt-1">
                        <div className="flex items-center justify-between gap-3 mb-2">
                            <span className="text-white/40 text-[9px] uppercase tracking-[0.2em] font-mono font-bold">Transaction Cost</span>
                        </div>
                        <div className="space-y-1.5 text-[11px] font-mono">
                            <div className="flex items-center justify-between">
                                <span className="text-white/55">Platform fee</span>
                                <span className="text-white/85 tabular-nums">{parseFloat(formatEther(entryFee)).toFixed(2)} {currencySymbol}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-white/55">Gas reserve <span className="text-[#5BBB8C]/80">(refundable)</span></span>
                                <span className="text-white/85 tabular-nums">{parseFloat(formatEther(SESSION_GAS_RESERVE)).toFixed(2)} {currencySymbol}</span>
                            </div>
                            {isTournament && tournamentAmount && Number(tournamentAmount) > 0 && (
                                <div className="flex items-center justify-between">
                                    <span className="text-white/55">
                                        {tournamentType === 'buy-in' ? 'Your buy-in' : 'Initial prize pool'}
                                    </span>
                                    <span className="text-white/85 tabular-nums">{parseFloat(tournamentAmount || '0').toFixed(2)} {currencySymbol}</span>
                                </div>
                            )}
                            <div className="h-px bg-white/10 my-1" />
                            <div className="flex items-center justify-between">
                                <span className="text-[#C49A3C]/75 uppercase text-[9px] tracking-[0.15em]">Total upfront</span>
                                <span className="text-[#C49A3C] font-bold tabular-nums">
                                    {parseFloat(formatEther(
                                        entryFee + SESSION_GAS_RESERVE +
                                        (isTournament && tournamentAmount ? parseEther(tournamentAmount || '0') : 0n)
                                    )).toFixed(2)} {currencySymbol}
                                </span>
                            </div>
                        </div>
                        <p className="text-white/35 text-[9px] leading-relaxed mt-2 pt-2 border-t border-white/5">
                            The {parseFloat(formatEther(SESSION_GAS_RESERVE)).toFixed(1)} {currencySymbol} gas reserve funds a session wallet for in-game transactions; whatever&apos;s left is returned to you when the game ends.
                        </p>
                    </div>
                )}

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
                    disabled={(!lobbyName.trim()) || (isTournament && (!tournamentAmount.trim() || Number(tournamentAmount) <= 0)) || isTxPending}
                    className={`w-full h-[54px] md:h-[60px] text-lg md:text-xl tracking-[0.1em] font-['Cinzel'] transition-all duration-300 mt-2 ${isTournament
                        ? '!bg-[#C49A3C] hover:!bg-[#B8894A] !text-[#281608] !border-[#C49A3C]/30'
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