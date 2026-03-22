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
        'outline-gold': "bg-[#0A0A0A] border border-[#916A47] text-[#916A47] hover:bg-[#6B5038] hover:border-[#6B5038] hover:text-[#F0E6D8] shadow-sm rounded-md transition-all",

        ghost: "bg-transparent text-white/60 hover:text-white",

        // Спец-кнопки
        noir: "bg-[#0A0A0A] border border-[#916A47]/30 hover:bg-[#111111] hover:border-[#916A47]/80 text-[#916A47] shadow-sm rounded-md tracking-[0.08em] uppercase font-['Cinzel'] text-[13px]",

        'noir-danger': "bg-[#0A0A0A] border-2 border-[#8B0000]/80 text-[#8B0000] hover:bg-[#5A0000] hover:border-[#5A0000] hover:text-[#FFCCCC] shadow-sm rounded-md tracking-[0.08em] uppercase font-['Cinzel'] text-[13px] transition-all",
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
