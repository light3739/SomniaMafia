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
        // Главная
        primary: "bg-[#916A47] text-[#050505] hover:brightness-110 font-bold border border-[#C5A059]/30 shadow-md rounded-md",

        // Вторичные
        secondary: "bg-[#0A0A0A] hover:bg-[#111111] text-white/80 border border-white/5 shadow-sm rounded-md",

        // OUTLINE-GOLD — инверсия при наведении, но приглушённая
        'outline-gold': "bg-[#1A1510] border border-[#B88A5E] text-[#B88A5E] hover:bg-[#6B5038] hover:border-[#6B5038] hover:text-[#F0E6D8] shadow-sm rounded-md transition-all",
        ghost: "bg-transparent text-white/60 hover:text-white",

        // Спец-кнопки
        noir: "bg-[#0A0A0A] border border-[#916A47]/30 text-[#916A47]/60 hover:bg-[#111111] hover:border-white/50 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.15)] shadow-sm rounded-md tracking-[0.08em] uppercase font-['Cinzel'] text-[13px] transition-all",

        'noir-danger': "bg-[#050505] border border-[#1a1a1a] text-[#8B0000]/40 hover:bg-[#1A0505] hover:border-[#8B0000] hover:text-[#8B0000] hover:shadow-[0_0_15px_rgba(139,0,0,0.2)] shadow-sm rounded-md tracking-[0.08em] uppercase font-['Cinzel'] text-[13px] transition-all",
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
