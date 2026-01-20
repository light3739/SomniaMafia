import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BackButtonProps {
    to?: string; // If not provided, goes back in history
    label?: string;
    className?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ to, label = "Back", className = "" }) => {
    const router = useRouter();

    const handleClick = () => {
        if (to) {
            router.push(to);
        } else {
            router.back();
        }
    };

    return (
        <button
            onClick={handleClick}
            className={`text-white/60 hover:text-white flex items-center gap-2 transition-colors cursor-pointer ${className}`}
        >
            <ArrowLeft className="w-5 h-5" />
            <span>{label}</span>
        </button>
    );
};
