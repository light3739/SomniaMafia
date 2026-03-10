import React, { useRef, useEffect, useState } from 'react';
import { Camera, Upload, Check, Link, Unlink, LogOut, Edit2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { usePrivy } from '@privy-io/react-auth';
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
    const { user, logout, linkGoogle, linkTwitter, linkDiscord, unlinkGoogle, unlinkTwitter, unlinkDiscord, createWallet } = usePrivy();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [hydrated, setHydrated] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [tempName, setTempName] = useState('');

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
                    <div className="flex flex-col items-center gap-1 w-full max-w-[280px]">
                        <AnimatePresence mode="wait">
                            {editingName ? (
                                <motion.div key="editing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 w-full">
                                    <Input
                                        autoFocus
                                        value={tempName}
                                        onChange={e => setTempName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                                        placeholder="Your nickname"
                                        containerClassName="flex-1"
                                        className="!text-center !font-['Cinzel'] text-base"
                                    />
                                    <button onClick={saveName} className="p-2 rounded-lg bg-[#916A47] text-white hover:bg-[#A37B58] transition-all">
                                        <Check className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setEditingName(false)} className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all">
                                        <X className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.div key="display" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                                    <span className="text-white text-lg font-['Cinzel'] font-semibold">
                                        {playerName || <span className="text-white/30 italic text-base">No nickname set</span>}
                                    </span>
                                    <button onClick={startEditing} className="text-white/30 hover:text-[#ffb01d] transition-colors">
                                        <Edit2 className="w-3.5 h-3.5" />
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

                {/* In-Game Wallet */}
                <div className="w-full bg-[rgba(40,22,8,0.70)] backdrop-blur-md rounded-[32px] p-5 md:p-6 border border-white/10 shadow-xl flex flex-col gap-3">
                    <h3 className="text-white/60 text-xs font-bold uppercase tracking-[0.15em] mb-1">In-Game Wallet</h3>
                    <SocialCard
                        icon="💳"
                        name="Embedded Wallet"
                        linked={hasEmbeddedWallet}
                        username={embeddedWalletAddress ? `${embeddedWalletAddress.slice(0, 6)}...${embeddedWalletAddress.slice(-4)}` : undefined}
                        onLink={() => createWallet?.()}
                    />
                </div>

                {/* Connected Accounts */}
                <div className="w-full bg-[rgba(40,22,8,0.70)] backdrop-blur-md rounded-[32px] p-5 md:p-6 border border-white/10 shadow-xl flex flex-col gap-3">
                    <h3 className="text-white/60 text-xs font-bold uppercase tracking-[0.15em] mb-1">Connected Accounts</h3>
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

                {/* Actions */}
                <div className="w-full flex flex-col gap-3">
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
        </div>
    );
};
