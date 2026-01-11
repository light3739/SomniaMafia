import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
    to?: string; // If not provided, goes back in history
    label?: string;
    className?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ to, label = "Back", className = "" }) => {
    const navigate = useNavigate();

    const handleClick = () => {
        if (to) {
            navigate(to);
        } else {
            navigate(-1);
        }
    };

    return (
        <button
            onClick={handleClick}
            className={`text-white/60 hover:text-white flex items-center gap-2 transition-colors ${className}`}
        >
            <ArrowLeft className="w-5 h-5" />
            <span>{label}</span>
        </button>
    );
};
