import React from 'react';
import { motion } from 'framer-motion';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline-gold' | 'ghost';
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

    const baseStyles = "relative flex items-center justify-center font-[Montserrat] font-medium transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

    const variants = {
        primary: "bg-[#916A47] hover:bg-[#a37a55] text-white shadow-lg border border-white/10 rounded-[15px]",
        secondary: "bg-[#19130D] hover:bg-[#2a2118] text-white/80 border border-white/5 rounded-[15px]",
        'outline-gold': "bg-transparent border-2 border-[#916A47] text-[#916A47] hover:bg-[#916A47] hover:text-[#281608] rounded-[15px] box-border",
        ghost: "bg-transparent text-white/60 hover:text-white"
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
