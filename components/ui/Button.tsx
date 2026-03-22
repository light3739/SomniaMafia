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
        // Главная: Тяжелая бронза
        primary: "bg-[#916A47] text-[#050505] hover:brightness-110 font-bold border border-[#C5A059]/30 shadow-md rounded-md",
        
        // Вторичные: Глубокий черный фон
        secondary: "bg-[#0A0A0A] hover:bg-[#111111] text-white/80 border border-white/5 shadow-sm rounded-md",
        
        // Золотой контур: Инверсия при наведении (текст и фон меняются местами)
        'outline-gold': "bg-[#0A0A0A] border border-[#916A47]/60 text-[#916A47] hover:bg-[#916A47] hover:text-[#050505] shadow-sm rounded-md transition-all",
        
        ghost: "bg-transparent text-white/60 hover:text-white",
        
        // Спец-кнопки: Инверсия при наведении
        noir: "bg-[#0A0A0A] border border-[#916A47]/30 hover:bg-[#916A47] hover:text-[#050505] shadow-sm rounded-md tracking-[0.08em] uppercase font-['Cinzel'] text-[13px]",
        
        'noir-danger': "bg-[#1A0505] border border-[#8B0000]/30 hover:bg-[#8B0000] hover:text-white shadow-sm rounded-md tracking-[0.08em] uppercase font-['Cinzel'] text-[13px]",
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
