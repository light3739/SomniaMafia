import React, { useRef, useEffect, useState } from 'react';
import { Camera, Upload, Check, Link, Unlink, LogOut, Edit2, X, Wallet, Users, ChevronRight, Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { useNoirDialog } from '../../contexts/NoirDialogContext';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useBalance } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { SOMNIA_TESTNET } from '../../contracts/config';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { BackButton } from '../ui/BackButton';
import { FlowLayout } from '../layout/FlowLayout';

const AVATAR_STORAGE_KEY = 'mafia_player_avatar';
const NAME_STORAGE_KEY = 'mafia_player_name';
const MAX_AVATAR_SIZE = 150;

// --- Helpers ---
function getPrivyAvatar(user: any): string | null {
    return user?.google?.picture
        ?? user?.twitter?.profilePictureUrl
        ?? user?.discord?.avatarUrl
        ?? null;
}
function getPrivyName(user: any): string {
    return user?.google?.name
        ?? user?.twitter?.name
        ?? user?.discord?.username
        ?? user?.email?.address?.split('@')[0]
        ?? '';
}

// --- Social Provider Card ---
interface SocialCardProps {
    icon: React.ReactNode;
    name: string;
    linked: boolean;
    username?: string;
    onLink: () => void;
    onUnlink?: () => void;
}
const SocialCard: React.FC<SocialCardProps> = ({ icon, name, linked, username, onLink, onUnlink }) => (
    <div className={`flex items-center justify-between px-5 py-4 rounded-lg border transition-all ${linked ? 'border-[#916A47]/30 bg-gradient-to-r from-[#916A47]/10 to-transparent' : 'border-white/10 bg-white/5'}`}>
        <div className="flex items-stretch gap-4">
            <div className={`w-10 h-10 rounded-md flex items-center justify-center shadow-inner border border-white/5 transition-colors ${linked ? 'bg-[#19130D] text-white' : 'bg-black/50 text-white/50'}`}>
                {icon}
            </div>
            <div className="flex flex-col justify-center">
                <p className={`text-base font-montserrat font-medium tracking-wide transition-colors ${linked ? 'text-white' : 'text-white/70'}`}>{name}</p>
                {linked && username ? (
                    <p className="text-white/90 text-sm font-mono tracking-wide tabular-nums mt-0.5">{username}</p>
                ) : (
                    <p className="text-white/50 text-[10px] uppercase font-bold tracking-[0.15em] mt-1">Not connected</p>
                )}
            </div>
        </div>
        <div className="flex items-center gap-3">
            {linked ? (
                <>
                    {onUnlink && (
                        <button
                            onClick={onUnlink}
                            className="p-2 text-white/50 hover:text-white/80 transition-colors"
                            title="Disconnect"
                        >
                            <Unlink strokeWidth={1.5} className="w-5 h-5" />
                        </button>
                    )}
                </>
            ) : (
                <button
                    onClick={onLink}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-md text-[11px] uppercase font-montserrat font-bold tracking-[0.15em] text-[#C19A6B] hover:text-[#f5d9b3] bg-transparent hover:bg-white/5 transition-all border border-[#C19A6B]/50 hover:border-[#C19A6B]"
                >
                    Connect
                </button>
            )}
        </div>
    </div>
);

// --- Main Component ---
export const SetupProfile: React.FC = () => {
    const { showAlert } = useNoirDialog();
    const { playerName, setPlayerName, avatarUrl, setAvatarUrl, useEmbeddedWallet, setUseEmbeddedWallet, isWalletReady } = useGameContext();
    const { user, logout, linkGoogle, linkTwitter, linkDiscord, unlinkGoogle, unlinkTwitter, unlinkDiscord, createWallet, linkWallet } = usePrivy();
    const { wallets } = useWallets();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [hydrated, setHydrated] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [tempName, setTempName] = useState('');
    const [fundAmount, setFundAmount] = useState('');
    const [isFunding, setIsFunding] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [walletTab, setWalletTab] = useState<'fund' | 'withdraw'>('fund');
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    // Modal state: null = closed, 'wallet' | 'accounts' = open
    const [activeModal, setActiveModal] = useState<'wallet' | 'accounts' | null>(null);

    useEffect(() => { setHydrated(true); }, []);

    // Auto-fill name from Privy on first load
    useEffect(() => {
        if (!user) return;
        const savedName = localStorage.getItem(NAME_STORAGE_KEY);
        if (savedName) {
            setPlayerName(savedName);
        } else {
            const privyName = getPrivyName(user);
            if (privyName) {
                setPlayerName(privyName);
                localStorage.setItem(NAME_STORAGE_KEY, privyName);
            }
        }
    }, [user]);

    // Auto-fill avatar from Privy if no custom one
    useEffect(() => {
        if (!user) return;
        const savedAvatar = localStorage.getItem(AVATAR_STORAGE_KEY);
        if (savedAvatar) {
            setAvatarUrl(savedAvatar);
        } else {
            const privyAvatar = getPrivyAvatar(user);
            if (privyAvatar) setAvatarUrl(privyAvatar);
        }
    }, [user]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                // CENTER CROP LOGIC
                const size = Math.min(img.width, img.height);
                const sourceX = (img.width - size) / 2;
                const sourceY = (img.height - size) / 2;

                canvas.width = MAX_AVATAR_SIZE;
                canvas.height = MAX_AVATAR_SIZE;

                // Draw only the central square of the image into the canvas
                ctx.drawImage(
                    img,
                    sourceX, sourceY, size, size, // Source rect (center square)
                    0, 0, MAX_AVATAR_SIZE, MAX_AVATAR_SIZE // Target rect
                );

                const base64 = canvas.toDataURL('image/jpeg', 0.82);
                localStorage.setItem(AVATAR_STORAGE_KEY, base64);
                setAvatarUrl(base64);
            };
            img.onerror = () => {
                showAlert('Oops! This file is not a valid image or is corrupted.');
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const saveName = () => {
        const name = tempName.trim();
        if (name) {
            setPlayerName(name);
            localStorage.setItem(NAME_STORAGE_KEY, name);
        }
        setEditingName(false);
    };

    const startEditing = () => {
        setTempName(playerName);
        setEditingName(true);
    };

    const google = user?.google;
    const twitter = user?.twitter;
    const discord = user?.discord;
    const walletAddress = user?.wallet?.address;

    const privyWallet = user?.linkedAccounts?.find(
        (account: any) => account.type === 'wallet' && account.walletClientType === 'privy'
    ) as any;
    const hasEmbeddedWallet = !!privyWallet;
    const embeddedWalletAddress = privyWallet?.address;

    const { data: somniaBalance } = useBalance({
        address: embeddedWalletAddress as `0x${string}`,
        chainId: SOMNIA_TESTNET.id,
        query: { enabled: !!embeddedWalletAddress }
    });

    const externalWallet = wallets.find(w => w.walletClientType !== 'privy');

    const { data: externalBalance } = useBalance({
        address: externalWallet?.address as `0x${string}` | undefined,
        chainId: SOMNIA_TESTNET.id,
        query: { enabled: !!externalWallet?.address }
    });

    const handleMaxClick = () => {
        if (!externalBalance) return;
        let max = Number(formatEther(externalBalance.value));
        if (max > 0.001) max -= 0.001;
        setFundAmount(Math.max(0, max).toFixed(3));
    };

    const handleFundWallet = async () => {
        if (!externalWallet || !embeddedWalletAddress) return;
        try {
            setIsFunding(true);
            await externalWallet.switchChain(SOMNIA_TESTNET.id);
            const provider = await externalWallet.getEthereumProvider() as any;

            const valueWei = parseEther(fundAmount);
            await provider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: externalWallet.address,
                    to: embeddedWalletAddress,
                    value: '0x' + valueWei.toString(16),
                }],
            });
            await showAlert('Transaction successfully sent from main wallet!', { variant: 'success', title: 'Transaction Sent' });
        } catch (err: any) {
            console.error('Funding failed:', err);
            await showAlert('Funding failed: ' + (err.message || 'Unknown error'), { variant: 'danger', title: 'Transaction Failed' });
        } finally {
            setIsFunding(false);
        }
    };

    const handleWithdrawMax = () => {
        if (!somniaBalance) return;
        let max = Number(formatEther(somniaBalance.value));
        if (max > 0.001) max -= 0.001;
        setWithdrawAmount(Math.max(0, max).toFixed(3));
    };

    const handleWithdrawToMain = async () => {
        if (!externalWallet || !embeddedWalletAddress) return;
        const privyEmbeddedWallet = wallets.find(w => w.walletClientType === 'privy');
        if (!privyEmbeddedWallet) return;
        try {
            setIsWithdrawing(true);
            await privyEmbeddedWallet.switchChain(SOMNIA_TESTNET.id);
            const provider = await privyEmbeddedWallet.getEthereumProvider() as any;

            const valueWei = parseEther(withdrawAmount);
            await provider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: embeddedWalletAddress,
                    to: externalWallet.address,
                    value: '0x' + valueWei.toString(16),
                }],
            });
            await showAlert('Withdrawal sent to your main wallet!', { variant: 'success', title: 'Withdrawal Sent' });
            setWithdrawAmount('');
        } catch (err: any) {
            console.error('Withdrawal failed:', err);
            await showAlert('Withdrawal failed: ' + (err.message || 'Unknown error'), { variant: 'danger', title: 'Withdrawal Failed' });
        } finally {
            setIsWithdrawing(false);
        }
    };

    return (
        <FlowLayout
            backTo="/"
            rightElement={
                <button
                    onClick={() => logout().then(() => router.push('/'))}
                    className="group text-white/60 hover:text-white flex items-center gap-3 transition-all cursor-pointer"
                >
                    <span className="font-medium tracking-wide hidden sm:inline">Logout</span>
                    <div className="w-10 h-10 rounded-full bg-black/50 border border-white/10 backdrop-blur-sm flex items-center justify-center transition-all group-hover:bg-[#8B2E2E]/40 group-hover:border-[#C94040]/50 group-hover:shadow-[0_0_15px_rgba(201,64,64,0.2)]">
                        <LogOut className="w-5 h-5" />
                    </div>
                </button>
            }
        >
            {/* Profile Card */}
            <div className="w-full bg-[rgba(40,22,8,0.70)] backdrop-blur-md rounded-2xl p-5 md:p-8 border border-white/10 shadow-2xl flex flex-col gap-4 md:gap-6 items-center">
                <h2 className="text-white text-xl md:text-2xl font-['Cinzel']">Your Profile</h2>

                {/* Avatar */}
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <div className="w-[100px] h-[100px] md:w-[120px] md:h-[120px] rounded-full border-2 border-[#916A47] shadow-xl overflow-hidden flex items-center justify-center bg-[#19130D] transition-transform group-hover:scale-105">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <Camera className="w-10 h-10 text-white/50 group-hover:text-white/70 transition-colors" />
                        )}
                    </div>
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Upload className="w-6 h-6 text-white" />
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>

                {/* Nickname */}
                <div className="flex flex-col items-center gap-1 w-full mt-1">
                    <div className="flex items-center justify-center w-full h-[50px] relative">
                        {/* The Main Name / Input Container */}
                        <motion.div
                            layout
                            className={`relative flex items-center justify-center h-[50px] w-[180px] md:w-[220px] rounded-md border transition-all ${editingName ? 'bg-[#19130D] border-[#916A47] shadow-inner' : 'bg-black/40 border-white/5 hover:border-white/10 hover:bg-black/60 shadow-lg cursor-pointer group'}`}
                            onClick={!editingName ? startEditing : undefined}
                            title={!editingName ? "Click to edit nickname" : undefined}
                        >
                            {editingName ? (
                                <input
                                    autoFocus
                                    value={tempName}
                                    onChange={e => setTempName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                                    placeholder="Your nickname"
                                    className="w-full h-full bg-transparent text-center text-white text-xl md:text-2xl font-montserrat font-medium outline-none placeholder-[#916A47] px-4"
                                />
                            ) : (
                                <div className="flex items-center justify-center w-full h-full px-4">
                                    <span className="text-white text-xl md:text-2xl font-montserrat font-medium truncate group-hover:text-[#ffb01d] transition-colors text-center w-full">
                                        {playerName || <span className="text-white/50 italic text-base font-normal">No nickname set</span>}
                                    </span>
                                </div>
                            )}
                        </motion.div>

                        {/* The Buttons Container (Only shows during edit) */}
                        <AnimatePresence>
                            {editingName && (
                                <div className="absolute left-1/2 translate-x-[90px] md:translate-x-[110px] flex items-center pl-3">
                                    <motion.div key="editing-buttons" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex gap-1.5" transition={{ duration: 0.15 }}>
                                        <button onClick={saveName} className="p-2.5 rounded-md bg-[#916A47] text-white hover:bg-[#A37B58] transition-transform active:scale-95 shadow-md border border-[#916A47]" title="Save">
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setEditingName(false)} className="p-2.5 rounded-md bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-transform active:scale-95 border border-[#916A47]" title="Cancel">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Settings Menu Buttons */}
            <div className="w-full flex flex-col gap-2">
                <button
                    onClick={() => setActiveModal('wallet')}
                    className="w-full bg-[rgba(40,22,8,0.70)] backdrop-blur-md rounded-md p-4 border border-white/10 shadow-lg flex items-center justify-between group hover:bg-[rgba(60,32,12,0.80)] transition-all"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#19130D] border border-white/10 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-[#ffb01d]" />
                        </div>
                        <div className="flex flex-col items-start gap-0.5 mt-1">
                            <span className="text-white font-montserrat font-medium text-lg md:text-xl tracking-wide leading-none">In-Game Wallet</span>
                            {hasEmbeddedWallet ? (
                                !useEmbeddedWallet ? (
                                    <span className="text-white/50 text-[11px] font-medium tracking-[0.1em] uppercase flex items-center gap-1.5">Disabled</span>
                                ) : (
                                    <span className="text-[#C19A6B] text-[11px] font-medium tracking-[0.1em] uppercase flex items-center gap-1.5"><Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Active</span>
                                )
                            ) : (
                                <span className="text-white/40 text-[11px] font-medium tracking-[0.1em] uppercase">Not Created</span>
                            )}
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white/70 transition-colors" />
                </button>

                <button
                    onClick={() => setActiveModal('accounts')}
                    className="w-full bg-[rgba(40,22,8,0.70)] backdrop-blur-md rounded-md p-4 border border-white/10 shadow-lg flex items-center justify-between group hover:bg-[rgba(60,32,12,0.80)] transition-all"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#19130D] border border-white/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-[#916A47]" />
                        </div>
                        <div className="flex flex-col items-start gap-0.5 mt-1">
                            <span className="text-white font-montserrat font-medium text-lg md:text-xl tracking-wide leading-none">Connected Accounts</span>
                            <span className="text-white/40 text-[11px] font-medium tracking-[0.1em] uppercase">Manage Social Links</span>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white/70 transition-colors" />
                </button>
            </div>

            {/* Actions */}
            <div className="w-full flex flex-col gap-3 mt-4">
                <Button
                    onClick={() => router.push('/create')}
                    disabled={!hydrated || !playerName.trim() || !isWalletReady}
                    variant="primary-lobby"
                    className="w-full h-[54px] md:h-[60px] text-lg md:text-xl tracking-[0.1em]"
                >
                    {!hydrated || !isWalletReady ? 'Connecting...' : 'Create Game'}
                </Button>
                <Button
                    onClick={() => router.push('/join')}
                    disabled={!hydrated || !playerName.trim() || !isWalletReady}
                    variant="outline-gold-lobby"
                    className="w-full h-[54px] md:h-[60px] text-lg md:text-xl tracking-[0.1em]"
                >
                    {!hydrated || !isWalletReady ? 'Connecting...' : 'Connect to Lobby'}
                </Button>
            </div>

            {/* MODALS */}
            <AnimatePresence>
                {activeModal === 'wallet' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                        onClick={() => setActiveModal(null)}
                    >
                        <motion.div
                            initial={{ y: 50, scale: 0.95 }}
                            animate={{ y: 0, scale: 1 }}
                            exit={{ y: 20, scale: 0.95 }}
                            className="w-full max-w-[500px] bg-[#19130D] rounded-2xl p-6 md:p-8 border border-white/10 shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto custom-scrollbar"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-5 mt-2">
                                <div className="w-[34px]"></div>
                                <h2 className="text-white text-2xl md:text-[28px] font-['Cinzel'] tracking-widest text-center">
                                    In-Game Wallet
                                </h2>
                                <button onClick={() => setActiveModal(null)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/5">
                                    <X className="w-4 h-4 text-white/50 hover:text-white" />
                                </button>
                            </div>

                            {/* Toggle Use In-Game Wallet */}
                            <div className="flex items-center justify-between px-5 py-4 rounded-md border border-white/10 bg-white/5 mb-2 hover:bg-white/10 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-md bg-black/50 border border-white/10 flex items-center justify-center shadow-inner">
                                        <Wallet className={`w-5 h-5 transition-colors ${useEmbeddedWallet ? 'text-[#ffb01d]' : 'text-white/50'}`} />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-white text-base font-montserrat font-medium tracking-wide">Use In-Game Wallet</p>
                                        <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest leading-none mt-1">
                                            {useEmbeddedWallet ? 'Privy Embedded Wallet' : 'External Wallet Mode'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setUseEmbeddedWallet(!useEmbeddedWallet)}
                                    className={`relative w-[52px] h-[28px] rounded-full transition-all duration-300 ease-in-out cursor-pointer border shadow-inner flex items-center px-[3px] ${useEmbeddedWallet ? 'bg-[#916A47]/20 border-[#916A47]/40 shadow-[0_0_10px_rgba(145,106,71,0.2)]' : 'bg-black/50 border-white/10'}`}
                                >
                                    <div
                                        className={`w-[20px] h-[20px] rounded-full shadow-md transition-all duration-300 ${useEmbeddedWallet ? 'translate-x-6 bg-gradient-to-b from-[#F0C868] to-[#D4A54A] shadow-[0_0_10px_rgba(212,165,74,0.4)]' : 'translate-x-0 bg-[#6b584a]'}`}
                                    />
                                </button>
                            </div>

                            <div className={`flex items-center justify-between px-5 py-4 rounded-md border transition-all ${hasEmbeddedWallet ? 'border-[#916A47]/30 bg-gradient-to-r from-[#916A47]/10 to-transparent' : 'border-white/10 bg-white/5'}`}>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-md bg-black/50 border border-white/10 flex items-center justify-center shadow-inner">
                                        <Wallet className="w-5 h-5 text-white/70" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-white text-base font-montserrat font-medium tracking-wide">Embedded Wallet</p>
                                        {hasEmbeddedWallet && embeddedWalletAddress ? (
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-white/60 text-sm font-mono border border-white/10 bg-black/40 px-2.5 py-1 rounded-md inline-block w-fit tracking-wide shadow-inner tabular-nums">
                                                    {embeddedWalletAddress.slice(0, 6)}...{embeddedWalletAddress.slice(-4)}
                                                </p>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(embeddedWalletAddress)}
                                                    className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/10 transition-all"
                                                    title="Copy address"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-white/50 text-xs mt-1">Not connected</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {hasEmbeddedWallet ? (
                                        <span className="flex items-center gap-1.5 text-[#C19A6B] text-[10px] uppercase font-bold tracking-widest px-3 py-1.5 rounded-lg bg-[#916A47]/20 border border-[#916A47]/30">
                                            <Check className="w-3.5 h-3.5" /> Active
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => createWallet?.()}
                                            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold text-black bg-[#C19A6B] hover:bg-[#D4B08C] transition-all shadow-[0_0_15px_rgba(193,154,107,0.3)]"
                                        >
                                            <Link className="w-4 h-4" /> Create
                                        </button>
                                    )}
                                </div>
                            </div>

                            {hasEmbeddedWallet && (
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center mx-2 mb-1">
                                        <h4 className="text-white/60 text-[10px] font-montserrat font-bold uppercase tracking-[0.2em] whitespace-nowrap">Testnet Balances</h4>
                                        <div className="h-[1px] w-full bg-gradient-to-r from-white/20 to-transparent ml-6"></div>
                                    </div>

                                    {/* Balances block replacing faucets */}
                                    <div className="flex flex-col gap-2 mt-1 mb-2">
                                        <div className="flex items-center justify-between bg-black/40 rounded-md p-3 px-4 border border-white/5 group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#19130D] flex items-center justify-center border border-white/10 shadow-inner p-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    <img src="/assets/somniayeal.png" alt="Somnia" className="w-full h-full object-contain grayscale-[30%] group-hover:grayscale-0 transition-all" />
                                                </div>
                                                <span className="text-white font-montserrat text-sm font-medium tracking-wide">Somnia <span className="text-white/60 text-[10px] font-bold uppercase ml-2 tracking-wider">Testnet</span></span>
                                            </div>
                                            <span className="text-white font-mono text-base font-medium tabular-nums">
                                                {somniaBalance ? Number(formatEther(somniaBalance.value)).toFixed(3) : '0.000'} <span className="text-white/60 text-sm ml-1 font-semibold">STT</span>
                                            </span>
                                        </div>


                                    </div>

                                    {/* Fund / Withdraw — combined panel with tabs */}
                                    <div className="mt-4 p-5 rounded-md border border-[#916A47]/30 bg-gradient-to-b from-[#916A47]/10 to-transparent flex flex-col gap-4 relative overflow-hidden">
                                        {!externalWallet ? (
                                            <div className="flex flex-col items-center gap-4 py-3 relative z-10">
                                                <h4 className="text-[#C19A6B] text-[10px] font-montserrat font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                                                    <Wallet className="w-4 h-4 text-[#C19A6B]" /> Transfer Tokens
                                                </h4>
                                                <p className="text-white/50 text-xs text-center font-montserrat leading-relaxed max-w-[80%]">
                                                    Connect your external wallet securely to transfer testnet tokens.
                                                </p>
                                                <button
                                                    onClick={() => linkWallet()}
                                                    className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-montserrat font-semibold text-sm rounded-md transition-colors border border-white/10 w-full flex items-center justify-center gap-2 group"
                                                >
                                                    <Link className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" /> Connect Main Wallet
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Tab switcher */}
                                                <div className="flex rounded-md overflow-hidden border border-white/10 relative z-10">
                                                    <button
                                                        onClick={() => setWalletTab('fund')}
                                                        className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-1.5 ${walletTab === 'fund' ? 'bg-[#916A47]/20 text-[#C19A6B] border-r border-white/10' : 'bg-black/30 text-white/40 hover:text-white/60 border-r border-white/10'}`}
                                                    >
                                                        <Wallet className="w-3.5 h-3.5" /> Fund
                                                    </button>
                                                    <button
                                                        onClick={() => setWalletTab('withdraw')}
                                                        className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-1.5 ${walletTab === 'withdraw' ? 'bg-[#916A47]/20 text-[#C19A6B]' : 'bg-black/30 text-white/40 hover:text-white/60'}`}
                                                    >
                                                        <LogOut className="w-3.5 h-3.5" /> Withdraw
                                                    </button>
                                                </div>

                                                {/* Wallet address */}
                                                <div className="flex justify-between items-center bg-black/60 p-3.5 rounded-md border border-white/5 relative z-10">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-white/60 text-[10px] font-bold uppercase tracking-[0.15em]">
                                                            {walletTab === 'fund' ? 'Source Wallet' : 'Destination'}
                                                        </span>
                                                        <span className="text-white/60 text-sm font-mono border border-white/10 bg-black/40 px-2.5 py-1 rounded-md inline-block w-fit tracking-wide shadow-inner tabular-nums">
                                                            {externalWallet.address.slice(0, 6)}...{externalWallet.address.slice(-4)}
                                                        </span>
                                                    </div>
                                                    {walletTab === 'fund' && (
                                                        <button onClick={() => linkWallet()} className="text-white/70 text-xs font-semibold hover:text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-md border border-white/10 transition-all shadow-sm">Change</button>
                                                    )}
                                                </div>

                                                {/* Amount input */}
                                                <div className="flex flex-col gap-2 w-full relative z-10">
                                                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.15em] font-bold text-white/60 px-1">
                                                        <span>Token</span>
                                                        <span className="text-white/60">
                                                            Available: <span className="font-mono text-white/80 tabular-nums">
                                                                {walletTab === 'fund'
                                                                    ? (externalBalance ? Number(formatEther(externalBalance.value)).toFixed(3) : '0.000')
                                                                    : (somniaBalance ? Number(formatEther(somniaBalance.value)).toFixed(3) : '0.000')
                                                                }
                                                            </span> STT
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-2 w-full">
                                                        <div className="relative w-[80px] flex items-center justify-center">
                                                            <span className="text-white font-montserrat text-sm font-semibold">STT</span>
                                                        </div>
                                                        <div className="relative flex-1 group">
                                                            <button
                                                                onClick={walletTab === 'fund' ? handleMaxClick : handleWithdrawMax}
                                                                className="absolute left-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 border rounded-md text-[10px] font-bold uppercase tracking-widest transition-all z-10 bg-gradient-to-r from-[#C19A6B]/20 to-[#916A47]/20 hover:from-[#C19A6B]/30 hover:to-[#916A47]/30 border-[#C19A6B]/40 text-[#f5d9b3] shadow-[0_0_10px_rgba(193,154,107,0.1)]"
                                                            >
                                                                MAX
                                                            </button>
                                                            <input
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={walletTab === 'fund' ? fundAmount : withdrawAmount}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.replace(',', '.');
                                                                    if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                                                                        walletTab === 'fund' ? setFundAmount(val) : setWithdrawAmount(val);
                                                                    }
                                                                }}
                                                                className="w-full h-[54px] bg-black/60 border border-white/10 text-white font-mono font-medium text-xl text-right rounded-md pl-16 pr-5 outline-none transition-all placeholder:text-white/50 relative tabular-nums focus:border-[#C19A6B] focus:bg-black/80"
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Action button */}
                                                <div className="flex flex-col gap-1.5 w-full mt-2 relative z-10">
                                                    {walletTab === 'fund' ? (
                                                        <button
                                                            onClick={handleFundWallet}
                                                            disabled={isFunding || !fundAmount || isNaN(Number(fundAmount)) || Number(fundAmount) <= 0}
                                                            className={`w-full py-4 font-montserrat font-semibold text-base tracking-wide rounded-md transition-all shadow-lg flex items-center justify-center gap-2 border ${isFunding || !fundAmount || isNaN(Number(fundAmount)) || Number(fundAmount) <= 0 ? 'bg-white/5 text-white/50 border-white/5 cursor-not-allowed opacity-70' : 'bg-gradient-to-r from-[#916A47] to-[#A37B58] hover:from-[#A37B58] hover:to-[#B68E6A] text-white border-[#C19A6B]/50 hover:border-[#E8CBA3]/70 hover:scale-[1.02] shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),_0_0_15px_rgba(193,154,107,0.3)]'}`}
                                                        >
                                                            {isFunding ? 'Processing...' : 'Send Tokens'}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={handleWithdrawToMain}
                                                            disabled={isWithdrawing || !withdrawAmount || isNaN(Number(withdrawAmount)) || Number(withdrawAmount) <= 0}
                                                            className={`w-full py-4 font-montserrat font-semibold text-base tracking-wide rounded-md transition-all shadow-lg flex items-center justify-center gap-2 border ${isWithdrawing || !withdrawAmount || isNaN(Number(withdrawAmount)) || Number(withdrawAmount) <= 0 ? 'bg-white/5 text-white/50 border-white/5 cursor-not-allowed opacity-70' : 'bg-gradient-to-r from-[#916A47] to-[#A37B58] hover:from-[#A37B58] hover:to-[#B68E6A] text-white border-[#C19A6B]/50 hover:border-[#E8CBA3]/70 hover:scale-[1.02] shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),_0_0_15px_rgba(193,154,107,0.3)]'}`}
                                                        >
                                                            {isWithdrawing ? 'Processing...' : 'Withdraw'}
                                                        </button>
                                                    )}
                                                    <p className="text-center text-white/40 text-[10px] font-semibold uppercase tracking-widest mt-1">
                                                        Est. Network Fee: <span className="font-mono text-white/50 tabular-nums">~0.001 STT</span>
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}

                {activeModal === 'accounts' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                        onClick={() => setActiveModal(null)}
                    >
                        <motion.div
                            initial={{ y: 50, scale: 0.95 }}
                            animate={{ y: 0, scale: 1 }}
                            exit={{ y: 20, scale: 0.95 }}
                            className="w-full max-w-[500px] bg-[#19130D] rounded-2xl p-6 md:p-8 border border-white/10 shadow-2xl flex flex-col gap-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-5 mt-2">
                                <div className="w-[34px]"></div>
                                <h2 className="text-white text-2xl md:text-[28px] font-['Cinzel'] tracking-widest text-center flex items-center justify-center gap-3">
                                    <Users className="w-6 h-6 text-white/70" />
                                    Accounts
                                </h2>
                                <button onClick={() => setActiveModal(null)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/5">
                                    <X className="w-4 h-4 text-white/50 hover:text-white" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-3">
                                <SocialCard
                                    icon={
                                        <svg viewBox="0 0 24 24" width="20" height="20" className="opacity-90">
                                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                    }
                                    name="Google"
                                    linked={!!google}
                                    username={google?.email ?? undefined}
                                    onLink={() => linkGoogle()}
                                    onUnlink={google?.subject ? () => unlinkGoogle(google.subject) : undefined}
                                />
                                <SocialCard
                                    icon={
                                        <svg viewBox="0 0 24 24" width="20" height="20" className="opacity-90">
                                            <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                        </svg>
                                    }
                                    name="Twitter"
                                    linked={!!twitter}
                                    username={twitter?.username ? `@${twitter.username}` : undefined}
                                    onLink={() => linkTwitter()}
                                    onUnlink={twitter?.subject ? () => unlinkTwitter(twitter.subject) : undefined}
                                />
                                <SocialCard
                                    icon={
                                        <svg viewBox="0 0 24 24" width="20" height="20" className="opacity-90">
                                            <path fill="currentColor" d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                                        </svg>
                                    }
                                    name="Discord"
                                    linked={!!discord}
                                    username={discord?.username ? `@${discord.username}` : undefined}
                                    onLink={() => linkDiscord()}
                                    onUnlink={discord?.subject ? () => unlinkDiscord(discord.subject) : undefined}
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </FlowLayout>
    );
};
