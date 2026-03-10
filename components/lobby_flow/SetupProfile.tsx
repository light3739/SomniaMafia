import React, { useRef, useEffect, useState } from 'react';
import { Camera, Upload, Check, Link, Unlink, LogOut, Edit2, X, Wallet, Users, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useBalance } from 'wagmi';
import { formatEther } from 'viem';
import { SOMNIA_TESTNET, AVALANCHE_FUJI } from '../../contracts/config';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { BackButton } from '../ui/BackButton';

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
    icon: string;
    name: string;
    linked: boolean;
    username?: string;
    onLink: () => void;
    onUnlink?: () => void;
}
const SocialCard: React.FC<SocialCardProps> = ({ icon, name, linked, username, onLink, onUnlink }) => (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${linked ? 'border-[#916A47]/50 bg-[#916A47]/10' : 'border-white/10 bg-white/5'}`}>
        <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
                <p className="text-white text-sm font-semibold">{name}</p>
                {linked && username && <p className="text-white/40 text-xs mt-0.5">@{username}</p>}
                {!linked && <p className="text-white/30 text-xs mt-0.5">Not connected</p>}
            </div>
        </div>
        <div className="flex items-center gap-2">
            {linked ? (
                <>
                    <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                        <Check className="w-3 h-3" /> Linked
                    </span>
                    {onUnlink && (
                        <button
                            onClick={onUnlink}
                            className="ml-2 p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
                            title="Unlink"
                        >
                            <Unlink className="w-3.5 h-3.5" />
                        </button>
                    )}
                </>
            ) : (
                <button
                    onClick={onLink}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#ffb01d] border border-[#ffb01d]/30 hover:bg-[#ffb01d]/10 transition-all"
                >
                    <Link className="w-3 h-3" /> Connect
                </button>
            )}
        </div>
    </div>
);

// --- Main Component ---
export const SetupProfile: React.FC = () => {
    const { playerName, setPlayerName, avatarUrl, setAvatarUrl } = useGameContext();
    const { user, logout, linkGoogle, linkTwitter, linkDiscord, unlinkGoogle, unlinkTwitter, unlinkDiscord, createWallet, linkWallet } = usePrivy();
    const { wallets } = useWallets();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [hydrated, setHydrated] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [tempName, setTempName] = useState('');
    const [fundAmount, setFundAmount] = useState('0.5');
    const [fundingNetwork, setFundingNetwork] = useState<number>(SOMNIA_TESTNET.id);
    const [isFunding, setIsFunding] = useState(false);

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
                let width = img.width, height = img.height;
                if (width > height) {
                    if (width > MAX_AVATAR_SIZE) { height = (height * MAX_AVATAR_SIZE) / width; width = MAX_AVATAR_SIZE; }
                } else {
                    if (height > MAX_AVATAR_SIZE) { width = (width * MAX_AVATAR_SIZE) / height; height = MAX_AVATAR_SIZE; }
                }
                canvas.width = width; canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                const base64 = canvas.toDataURL('image/jpeg', 0.8);
                localStorage.setItem(AVATAR_STORAGE_KEY, base64);
                setAvatarUrl(base64);
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

    const { data: avaxBalance } = useBalance({
        address: embeddedWalletAddress as `0x${string}`,
        chainId: AVALANCHE_FUJI.id,
        query: { enabled: !!embeddedWalletAddress }
    });

    const externalWallet = wallets.find(w => w.walletClientType !== 'privy');

    const handleFundWallet = async () => {
        if (!externalWallet || !embeddedWalletAddress) return;
        try {
            setIsFunding(true);
            await externalWallet.switchChain(fundingNetwork);
            const provider = await externalWallet.getEthereumProvider() as any;

            const valueWei = BigInt(Math.floor(parseFloat(fundAmount) * 1e18));
            await provider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: externalWallet.address,
                    to: embeddedWalletAddress,
                    value: '0x' + valueWei.toString(16),
                }],
            });
            alert('Transaction successfully sent from main wallet!');
        } catch (err: any) {
            console.error('Funding failed:', err);
            alert('Funding failed: ' + (err.message || 'Unknown error'));
        } finally {
            setIsFunding(false);
        }
    };

    return (
        <div className="relative w-full h-[100dvh] font-montserrat flex flex-col items-center overflow-y-auto overflow-x-hidden p-4 custom-scrollbar">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="relative z-10 w-full max-w-[560px] flex flex-col items-center gap-4 py-6 md:py-10 my-auto"
            >
                {/* Header */}
                <div className="w-full flex items-center justify-between">
                    <BackButton to="/" />
                    <button
                        onClick={() => logout().then(() => router.push('/'))}
                        className="flex items-center gap-2 text-white/40 hover:text-red-400 text-xs font-medium transition-colors"
                    >
                        <LogOut className="w-3.5 h-3.5" /> Logout
                    </button>
                </div>

                {/* Profile Card */}
                <div className="w-full bg-[rgba(40,22,8,0.75)] backdrop-blur-md rounded-[32px] p-6 md:p-8 border border-white/10 shadow-2xl flex flex-col items-center gap-5">
                    <h2 className="text-white text-xl font-['Cinzel'] tracking-wider">Your Profile</h2>

                    {/* Avatar */}
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-[100px] h-[100px] md:w-[120px] md:h-[120px] rounded-full border-2 border-[#916A47] shadow-xl overflow-hidden flex items-center justify-center bg-[#19130D] transition-transform group-hover:scale-105">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <Camera className="w-10 h-10 text-white/20 group-hover:text-white/50 transition-colors" />
                            )}
                        </div>
                        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Upload className="w-6 h-6 text-white" />
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                    </div>

                    {/* Nickname */}
                    <div className="flex flex-col items-center gap-2 w-full max-w-[320px] mt-2">
                        <AnimatePresence mode="wait">
                            {editingName ? (
                                <motion.div key="editing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 w-full">
                                    <Input
                                        autoFocus
                                        value={tempName}
                                        onChange={e => setTempName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                                        placeholder="Your nickname"
                                        containerClassName="w-full"
                                        className="!text-center !font-montserrat !font-bold tracking-[0.1em] uppercase text-xl py-3"
                                    />
                                    <div className="flex items-center gap-2 w-full justify-center">
                                        <button onClick={saveName} className="flex-1 max-w-[120px] py-2.5 rounded-xl bg-gradient-to-r from-[#916A47] to-[#A37B58] text-white text-sm font-bold hover:scale-[1.02] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#916A47]/20 border border-white/10">
                                            <Check className="w-4 h-4" /> Save
                                        </button>
                                        <button onClick={() => setEditingName(false)} className="flex-1 max-w-[120px] py-2.5 rounded-xl bg-white/5 text-white/70 text-sm font-bold hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2 border border-white/5">
                                            <X className="w-4 h-4" /> Cancel
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div key="display" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center relative w-full h-[40px]">
                                    <span className="text-white text-xl md:text-2xl font-montserrat font-bold tracking-[0.15em] uppercase text-center max-w-[280px] truncate">
                                        {playerName || <span className="text-white/30 italic text-base font-normal tracking-normal normal-case">No nickname set</span>}
                                    </span>
                                    <button onClick={startEditing} className="absolute right-0 text-white/30 hover:text-[#ffb01d] transition-colors p-2 rounded-full hover:bg-white/5">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        {walletAddress && (
                            <span className="text-white/20 text-[10px] font-mono mt-1">
                                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                            </span>
                        )}
                    </div>
                </div>

                {/* Settings Menu Buttons */}
                <div className="w-full flex flex-col gap-2">
                    <button
                        onClick={() => setActiveModal('wallet')}
                        className="w-full bg-[rgba(40,22,8,0.70)] backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-lg flex items-center justify-between group hover:bg-[rgba(60,32,12,0.80)] transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#19130D] border border-white/10 flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-[#ffb01d]" />
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-white font-montserrat font-bold text-lg tracking-wide">In-Game Wallet</span>
                                {hasEmbeddedWallet ? (
                                    <span className="text-green-400 text-xs flex items-center gap-1 font-medium"><Check className="w-3 h-3" /> Active</span>
                                ) : (
                                    <span className="text-white/40 text-xs">Not Created</span>
                                )}
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/70 transition-colors" />
                    </button>

                    <button
                        onClick={() => setActiveModal('accounts')}
                        className="w-full bg-[rgba(40,22,8,0.70)] backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-lg flex items-center justify-between group hover:bg-[rgba(60,32,12,0.80)] transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#19130D] border border-white/10 flex items-center justify-center">
                                <Users className="w-5 h-5 text-[#916A47]" />
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-white font-montserrat font-bold text-lg tracking-wide">Connected Accounts</span>
                                <span className="text-white/40 text-xs mt-0.5">Manage Social Links</span>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/70 transition-colors" />
                    </button>
                </div>

                {/* Actions */}
                <div className="w-full flex flex-col gap-3 mt-4">
                    <Button
                        onClick={() => router.push('/create')}
                        disabled={!hydrated || !playerName.trim()}
                        className="w-full h-[54px] md:h-[60px] text-lg md:text-xl"
                    >
                        Create Game
                    </Button>
                    <Button
                        onClick={() => router.push('/join')}
                        disabled={!hydrated || !playerName.trim()}
                        variant="outline-gold"
                        className="w-full h-[54px] md:h-[60px] text-lg md:text-xl"
                    >
                        Connect to Lobby
                    </Button>
                </div>
            </motion.div>

            {/* MODALS */}
            <AnimatePresence>
                {activeModal === 'wallet' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setActiveModal(null)}
                    >
                        <motion.div
                            initial={{ y: 50, scale: 0.95 }}
                            animate={{ y: 0, scale: 1 }}
                            exit={{ y: 20, scale: 0.95 }}
                            className="w-full max-w-[500px] bg-[rgba(40,22,8,0.95)] rounded-[32px] p-6 md:p-8 border border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col gap-5 max-h-[90vh] overflow-y-auto custom-scrollbar"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-white text-xl font-montserrat font-bold tracking-wide flex items-center gap-2">
                                    <Wallet className="w-6 h-6 text-[#ffb01d]" />
                                    In-Game Wallet
                                </h2>
                                <button onClick={() => setActiveModal(null)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                                    <X className="w-5 h-5 text-white/50 hover:text-white" />
                                </button>
                            </div>

                            <SocialCard
                                icon="💳"
                                name="Embedded Wallet"
                                linked={hasEmbeddedWallet}
                                username={embeddedWalletAddress ? `${embeddedWalletAddress.slice(0, 6)}...${embeddedWalletAddress.slice(-4)}` : undefined}
                                onLink={() => createWallet?.()}
                            />

                            {hasEmbeddedWallet && (
                                <div className="flex flex-col gap-2 mt-2">
                                    <h4 className="text-white/50 text-xs font-medium mb-1 uppercase tracking-wider">Testnet Balances</h4>

                                    <div className="flex items-center justify-between bg-white/5 rounded-xl p-4 border border-white/10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#19130D] flex items-center justify-center border border-white/20 p-1">
                                                <img src="/assets/somniayeal.png" alt="Somnia" className="w-full h-full object-contain" />
                                            </div>
                                            <span className="text-white font-semibold">Somnia</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-[#ffb01d] font-mono shadow-[#ffb01d]/20 drop-shadow-sm">
                                                {somniaBalance ? Number(formatEther(somniaBalance.value)).toFixed(3) : '0.000'} STT
                                            </span>
                                            <a
                                                href="https://faucet.testnet.somnia.network/"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-1.5 bg-[#ffb01d]/10 hover:bg-[#ffb01d]/20 text-[#ffb01d] border border-[#ffb01d]/30 rounded-lg text-xs font-bold transition-all"
                                            >
                                                Faucet
                                            </a>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between bg-white/5 rounded-xl p-4 border border-white/10 mt-1">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#19130D] flex items-center justify-center border border-white/20 p-1">
                                                <img src="/assets/avalanche-avax-logo.png" alt="Avalanche" className="w-full h-full object-contain" />
                                            </div>
                                            <span className="text-white font-semibold">Avalanche</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-red-400 font-mono shadow-red-400/20 drop-shadow-sm">
                                                {avaxBalance ? Number(formatEther(avaxBalance.value)).toFixed(3) : '0.000'} AVAX
                                            </span>
                                            <a
                                                href="https://core.app/tools/testnet-faucet/?subnet=c&token=c"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-1.5 bg-red-400/10 hover:bg-red-400/20 text-red-400 border border-red-400/30 rounded-lg text-xs font-bold transition-all"
                                            >
                                                Faucet
                                            </a>
                                        </div>
                                    </div>

                                    {/* Fund from External Wallet Section */}
                                    <div className="mt-6 p-5 rounded-2xl border border-[#ffb01d]/30 bg-gradient-to-b from-[#ffb01d]/10 to-transparent flex flex-col gap-4">
                                        <h4 className="text-[#ffb01d] text-base font-bold flex items-center gap-2">
                                            💰 Fund from Main Wallet
                                        </h4>
                                        {!externalWallet ? (
                                            <div className="flex flex-col items-center gap-3 py-2">
                                                <p className="text-white/60 text-sm text-center">
                                                    Connect your external wallet (e.g. MetaMask/Phantom) to send tokens locally securely.
                                                </p>
                                                <button
                                                    onClick={() => linkWallet()}
                                                    className="px-6 py-3 bg-[#ffb01d]/20 hover:bg-[#ffb01d]/30 text-[#ffb01d] font-bold rounded-xl transition-colors border border-[#ffb01d]/30 w-full"
                                                >
                                                    Connect Main Wallet
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-4">
                                                <div className="flex justify-between items-center bg-black/50 p-3 rounded-xl border border-white/10">
                                                    <div className="flex flex-col">
                                                        <span className="text-white/40 text-[10px] uppercase">From Wallet</span>
                                                        <span className="text-white text-sm font-mono">{externalWallet.address.slice(0, 6)}...{externalWallet.address.slice(-4)}</span>
                                                    </div>
                                                    <button onClick={() => linkWallet()} className="text-[#ffb01d] text-xs font-medium hover:underline bg-[#ffb01d]/10 px-3 py-1.5 rounded-lg border border-[#ffb01d]/20">Change</button>
                                                </div>
                                                <div className="flex gap-3 w-full">
                                                    <select
                                                        value={fundingNetwork}
                                                        onChange={(e) => setFundingNetwork(Number(e.target.value))}
                                                        className="bg-black/60 border border-white/20 text-white font-medium rounded-xl px-3 outline-none w-[100px] p-3 appearance-none focus:border-[#ffb01d]/50 transition-colors"
                                                    >
                                                        <option value={SOMNIA_TESTNET.id}>STT</option>
                                                        <option value={AVALANCHE_FUJI.id}>AVAX</option>
                                                    </select>
                                                    <input
                                                        type="number"
                                                        value={fundAmount}
                                                        onChange={(e) => setFundAmount(e.target.value)}
                                                        className="flex-1 bg-black/60 border border-white/20 text-white font-mono text-lg rounded-xl px-4 outline-none p-3 text-right focus:border-[#ffb01d]/50 transition-colors"
                                                        step="0.1"
                                                        min="0.01"
                                                    />
                                                </div>
                                                <button
                                                    onClick={handleFundWallet}
                                                    disabled={isFunding}
                                                    className={`px-4 py-3.5 font-bold text-base rounded-xl transition-all shadow-lg mt-2 ${isFunding ? 'bg-gray-600 text-gray-300 cursor-wait' : 'bg-gradient-to-r from-[#ffb01d] to-[#d68e0d] text-black hover:scale-[1.02]'}`}
                                                >
                                                    {isFunding ? 'Processing Transaction...' : 'Send Tokens'}
                                                </button>
                                            </div>
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
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setActiveModal(null)}
                    >
                        <motion.div
                            initial={{ y: 50, scale: 0.95 }}
                            animate={{ y: 0, scale: 1 }}
                            exit={{ y: 20, scale: 0.95 }}
                            className="w-full max-w-[500px] bg-[rgba(40,22,8,0.95)] rounded-[32px] p-6 md:p-8 border border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col gap-6"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="text-white text-xl font-montserrat font-bold tracking-wide flex items-center gap-2">
                                    <Users className="w-6 h-6 text-[#916A47]" />
                                    Connected Accounts
                                </h2>
                                <button onClick={() => setActiveModal(null)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                                    <X className="w-5 h-5 text-white/50 hover:text-white" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-3">
                                <SocialCard
                                    icon="🔵"
                                    name="Google"
                                    linked={!!google}
                                    username={google?.email ?? undefined}
                                    onLink={() => linkGoogle()}
                                    onUnlink={google?.subject ? () => unlinkGoogle(google.subject) : undefined}
                                />
                                <SocialCard
                                    icon="𝕏"
                                    name="Twitter / X"
                                    linked={!!twitter}
                                    username={twitter?.username ?? undefined}
                                    onLink={() => linkTwitter()}
                                    onUnlink={twitter?.subject ? () => unlinkTwitter(twitter.subject) : undefined}
                                />
                                <SocialCard
                                    icon="🟣"
                                    name="Discord"
                                    linked={!!discord}
                                    username={discord?.username ?? undefined}
                                    onLink={() => linkDiscord()}
                                    onUnlink={discord?.subject ? () => unlinkDiscord(discord.subject) : undefined}
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
