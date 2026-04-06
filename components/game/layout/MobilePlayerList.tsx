'use client';

import React, { memo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Player, Role } from '../../../types';
import { Skull, Shield, Search, Users, User, Volume2, HelpCircle } from 'lucide-react';

interface MobilePlayerListProps {
    players: Player[];
    myAddress?: string;
    myRole?: Role;
    selectedTarget: string | null;
    onAction?: (address: `0x${string}`) => void;
    canAct: (player: Player) => boolean;
    isNight?: boolean;
    playerMarks: Record<string, 'mafia' | 'civilian' | 'question' | null>;
    onSetMark: (address: string, mark: 'mafia' | 'civilian' | 'question' | null) => void;
    voters?: Record<string, Player[]>;
    speakingAddress?: string | null;
}

const RoleIcons: Record<Role, React.ReactNode> = {
    [Role.MAFIA]: <Skull className="w-4 h-4 text-[#8B0000]" />,
    [Role.DOCTOR]: <Shield className="w-4 h-4 text-[#0D9488]" />,
    [Role.DETECTIVE]: <Search className="w-4 h-4 text-[#A85832]" />,
    [Role.CIVILIAN]: <Users className="w-4 h-4 text-[#6B5A4A]" />,
    [Role.UNKNOWN]: <User className="w-4 h-4 text-white/40" />,
};

const RoleColors: Record<Role, string> = {
    [Role.MAFIA]: 'text-[#8B0000]',
    [Role.DOCTOR]: 'text-[#0D9488]',
    [Role.DETECTIVE]: 'text-[#A85832]',
    [Role.CIVILIAN]: 'text-[#6B5A4A]',
    [Role.UNKNOWN]: 'text-white/40',
};

const MarkIcon: React.FC<{ mark: string | null }> = ({ mark }) => {
    switch (mark) {
        case 'mafia': return <Skull className="w-3.5 h-3.5 text-[#8B0000]" />;
        case 'civilian': return <User className="w-3.5 h-3.5 text-[#0D9488]" />;
        case 'question': return <HelpCircle className="w-3.5 h-3.5 text-[#B45309]" />;
        default: return null;
    }
};

const MobilePlayerRow = memo<{
    player: Player;
    isMe: boolean;
    isSelected: boolean;
    isNight: boolean;
    myRole?: Role;
    canAct: boolean;
    mark: 'mafia' | 'civilian' | 'question' | null;
    onAction?: (address: `0x${string}`) => void;
    onSetMark: (address: string, mark: 'mafia' | 'civilian' | 'question' | null) => void;
    voterCount: number;
    isSpeaking: boolean;
}>(({ player, isMe, isSelected, isNight, myRole, canAct, mark, onAction, onSetMark, voterCount, isSpeaking }) => {
    const isMafiaVisible = isNight && myRole === Role.MAFIA && player.role === Role.MAFIA;

    const getBorderClass = () => {
        if (!player.isAlive) return 'border-white/10 opacity-50';
        if (isSelected) {
            if (isNight && myRole) {
                switch (myRole) {
                    case Role.MAFIA: return 'border-[#8B0000] bg-[#1A0505]';
                    case Role.DOCTOR: return 'border-[#0D9488] bg-[#031A18]';
                    case Role.DETECTIVE: return 'border-[#A85832] bg-[#1A0C06]';
                    default: return 'border-[#916A47] bg-[#2C2112]';
                }
            }
            return 'border-[#916A47] bg-[#2C2112]';
        }
        if (isSpeaking) return 'border-[#916A47]/60';
        return 'border-white/10';
    };

    return (
        <motion.button
            layout
            onClick={() => canAct && onAction?.(player.address)}
            disabled={!canAct}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${getBorderClass()} ${canAct ? 'active:scale-[0.98]' : ''}`}
        >
            {/* Avatar */}
            <div className={`relative w-11 h-11 rounded-lg overflow-hidden border border-white/10 shrink-0 ${!player.isAlive ? 'grayscale' : ''}`}>
                {player.avatarUrl ? (
                    <Image src={player.avatarUrl} alt={player.name} fill sizes="44px" className="object-cover" />
                ) : (
                    <div className="w-full h-full bg-[#19130D] flex items-center justify-center">
                        {RoleIcons[player.role] || <User className="w-5 h-5 text-white/30" />}
                    </div>
                )}
                {!player.isAlive && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Skull className="w-4 h-4 text-white/60" />
                    </div>
                )}
                {isSpeaking && (
                    <div className="absolute inset-0 rounded-lg border-2 border-[#916A47] animate-pulse" />
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-semibold truncate ${isMafiaVisible ? 'text-[#8B0000]' : isMe ? 'text-[#916A47]' : 'text-white'}`}>
                        {player.name}
                    </span>
                    {isMe && <span className="text-[8px] bg-[#916A47] text-black px-1.5 py-0.5 rounded-full font-bold uppercase">YOU</span>}
                    {!player.isAlive && <span className="text-[8px] bg-white/80 text-black px-1.5 py-0.5 rounded-full font-bold uppercase">DEAD</span>}
                </div>
                <div className="text-[10px] text-white/50 font-mono mt-0.5">
                    {player.address.slice(0, 4)}...{player.address.slice(-4)}
                </div>
            </div>

            {/* Right side: marks, votes */}
            <div className="flex items-center gap-2 shrink-0">
                {mark && <MarkIcon mark={mark} />}
                {voterCount > 0 && (
                    <span className="text-[10px] font-bold text-[#916A47] bg-[#916A47]/15 px-2 py-0.5 rounded-full">
                        {voterCount} vote{voterCount > 1 ? 's' : ''}
                    </span>
                )}
            </div>
        </motion.button>
    );
});

MobilePlayerRow.displayName = 'MobilePlayerRow';

export const MobilePlayerList = memo<MobilePlayerListProps>(({
    players, myAddress, myRole, selectedTarget, onAction, canAct, isNight = false,
    playerMarks, onSetMark, voters = {}, speakingAddress
}) => {
    const alivePlayers = players.filter(p => p.isAlive);
    const deadPlayers = players.filter(p => !p.isAlive);

    const getVoterCount = (address: string) => {
        const v = voters[address.toLowerCase()];
        return v ? v.length : 0;
    };

    return (
        <div className="w-full h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 custom-scrollbar">
                {/* Alive Players */}
                {alivePlayers.map(player => (
                    <MobilePlayerRow
                        key={player.address}
                        player={player}
                        isMe={player.address.toLowerCase() === myAddress?.toLowerCase()}
                        isSelected={selectedTarget?.toLowerCase() === player.address.toLowerCase()}
                        isNight={isNight}
                        myRole={myRole}
                        canAct={canAct(player)}
                        mark={playerMarks[player.address.toLowerCase()] || null}
                        onAction={onAction}
                        onSetMark={onSetMark}
                        voterCount={getVoterCount(player.address)}
                        isSpeaking={speakingAddress?.toLowerCase() === player.address.toLowerCase()}
                    />
                ))}

                {/* Dead Players */}
                {deadPlayers.length > 0 && (
                    <>
                        <div className="flex items-center gap-2 pt-2 pb-1 px-1">
                            <div className="h-px flex-1 bg-white/10" />
                            <span className="text-[9px] text-white/30 uppercase tracking-widest font-mono">Eliminated</span>
                            <div className="h-px flex-1 bg-white/10" />
                        </div>
                        {deadPlayers.map(player => (
                            <MobilePlayerRow
                                key={player.address}
                                player={player}
                                isMe={player.address.toLowerCase() === myAddress?.toLowerCase()}
                                isSelected={false}
                                isNight={isNight}
                                myRole={myRole}
                                canAct={false}
                                mark={playerMarks[player.address.toLowerCase()] || null}
                                onAction={undefined}
                                onSetMark={onSetMark}
                                voterCount={0}
                                isSpeaking={false}
                            />
                        ))}
                    </>
                )}
            </div>
        </div>
    );
});

MobilePlayerList.displayName = 'MobilePlayerList';
