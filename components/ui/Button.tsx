import React from 'react';
import { motion } from 'framer-motion';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline-gold' | 'ghost' | 'noir' | 'noir-danger';
    isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    className = "",
    variant = 'primary',
    isLoading,
    disabled,
    ...props
}) => {

    const baseStyles = "relative flex items-center justify-center font-[Montserrat] font-medium transition-all active:scale-[0.98] cursor-pointer disabled:opacity-90 disabled:brightness-50 disabled:cursor-not-allowed disabled:active:scale-100";

    const variants = {
        primary: "bg-[#916A47] text-[#050505] hover:bg-[#C5A059] font-bold border border-[#C5A059]/30 shadow-[0_15px_40px_rgba(0,0,0,0.9)] rounded-md",
        secondary: "bg-[#1E1E1E] hover:bg-[#2A2A2A] text-white/80 border border-white/5 shadow-[0_15px_40px_rgba(0,0,0,0.9)] rounded-md",
        'outline-gold': "bg-[#161616] border-2 border-[#916A47]/50 text-[#916A47] hover:bg-[#916A47] hover:border-[#916A47] hover:text-[#050505] shadow-[0_15px_40px_rgba(0,0,0,0.9)] rounded-md",
        ghost: "bg-transparent text-white/60 hover:text-white",
        noir: "bg-[#916A47]/10 border border-[#916A47]/30 hover:bg-[#916A47]/30 text-[#916A47] shadow-[0_15px_40px_rgba(0,0,0,0.9)] rounded-md tracking-[0.08em] uppercase font-['Cinzel'] text-[13px]",
        'noir-danger': "bg-[#8B0000]/10 border border-[#8B0000]/30 hover:bg-[#8B0000]/30 text-[#8B0000] shadow-[0_15px_40px_rgba(0,0,0,0.9)] rounded-md tracking-[0.08em] uppercase font-['Cinzel'] text-[13px]",
    };

    return (
        <motion.button
            whileTap={{ scale: disabled ? 1 : 0.98 }}
            className={`${baseStyles} ${variants[variant]} ${className}`}
            disabled={disabled || isLoading}
            {...(props as any)}
        >
            {isLoading ? (
                <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : children}
        </motion.button>
    );
};
