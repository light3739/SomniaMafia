import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    containerClassName?: string;
}

export const Input: React.FC<InputProps> = ({
    label,
    className = "",
    containerClassName = "",
    ...props
}) => {
    return (
        <div className={`flex flex-col gap-2 ${containerClassName}`}>
            {label && (
                <label className="text-white/40 text-sm font-['Playfair_Display'] italic">
                    {label}
                </label>
            )}
            <input
                className={`w-full h-[50px] bg-[#19130D]/60 rounded-[10px] border border-white/10 text-center text-white text-xl placeholder:text-white/20 focus:outline-none focus:border-[#916A47] transition-all font-['Playfair_Display'] ${className}`}
                {...props}
            />
        </div>
    );
};
