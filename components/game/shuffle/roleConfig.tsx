import React from 'react';
import { Skull, Shield, Search, Users, EyeOff } from 'lucide-react';
import { Role } from '../../../types';

export const RoleConfig: Record<Role, { 
    icon: React.ReactNode; 
    color: string; 
    bgColor: string; 
    borderColor: string; 
    ringColor: string; 
    description: string; 
    label: string 
}> = {
    [Role.MAFIA]: {
        icon: <Skull className="w-16 h-16" />,
        color: 'text-[#8B0000]',
        bgColor: 'from-[#8B0000]/25 to-[#0A0705]/80',
        borderColor: 'border-[#8B0000]/30',
        ringColor: 'ring-[#8B0000]/10',
        label: 'MAFIA',
        description: 'Eliminate all civilians to win. Vote by day, kill by night.'
    },
    [Role.DOCTOR]: {
        icon: <Shield className="w-16 h-16" />,
        color: 'text-[#0D9488]',
        bgColor: 'from-[#0D9488]/25 to-[#0A0705]/80',
        borderColor: 'border-[#0D9488]/30',
        ringColor: 'ring-[#0D9488]/10',
        label: 'DOCTOR',
        description: 'Save one player each night from the mafia attack.'
    },
    [Role.DETECTIVE]: {
        icon: <Search className="w-16 h-16" />,
        color: 'text-[#A85832]',
        bgColor: 'from-[#A85832]/25 to-[#0A0705]/80',
        borderColor: 'border-[#A85832]/30',
        ringColor: 'ring-[#A85832]/10',
        label: 'DETECTIVE',
        description: 'Investigate one player each night to reveal their alignment.'
    },
    [Role.CIVILIAN]: {
        icon: <Users className="w-16 h-16" />,
        color: 'text-[#6B5A4A]',
        bgColor: 'from-[#6B5A4A]/25 to-[#0A0705]/80',
        borderColor: 'border-[#6B5A4A]/20',
        ringColor: 'ring-[#6B5A4A]/8',
        label: 'CIVILIAN',
        description: 'Find and vote out the mafia during the day to survive.'
    },
    [Role.UNKNOWN]: {
        icon: <EyeOff className="w-16 h-16" />,
        color: 'text-stone-600',
        bgColor: 'from-stone-950/50 to-[#0A0705]/80',
        borderColor: 'border-stone-700/20',
        ringColor: 'ring-stone-700/8',
        label: 'UNKNOWN',
        description: 'Role unknown'
    }
};
