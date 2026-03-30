import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { BackButton } from '../ui/BackButton';

interface FlowLayoutProps {
    children: React.ReactNode;
    backTo?: string;
    backLabel?: string;
    rightElement?: React.ReactNode;
    title?: string;
    maxWidth?: string; // e.g. "600px" or "560px"
}

/**
 * A shared layout for lobby flow screens (SetupProfile, CreateLobby, JoinLobby).
 * Includes:
 * 1. Optimized scroll-driven vignette (framer-motion useScroll/useTransform).
 * 2. Sticky transparent header with BackButton and optional right elements.
 * 3. Centered content container with proper padding.
 */
export const FlowLayout: React.FC<FlowLayoutProps> = ({
    children,
    backTo,
    backLabel = "Back",
    rightElement,
    title,
    maxWidth = "600px"
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
    // High-performance scroll tracking using framer-motion.
    // This updates the vignette opacity directly in DOM, bypassing React re-renders.
    const { scrollY } = useScroll({
        container: scrollContainerRef
    });

    // Map scroll from 0-80px to opacity 0-1
    const vignetteOpacity = useTransform(scrollY, [0, 80], [0, 1]);

    return (
        <div 
            ref={scrollContainerRef} 
            className="relative w-full h-[100dvh] font-['Montserrat'] flex flex-col items-center overflow-y-auto overflow-x-hidden p-4 pb-12 custom-scrollbar"
        >
            {/* Top vignette: transitions opacity on scroll to fade content behind nav */}
            <motion.div
                className="fixed top-0 left-0 right-0 h-24 pointer-events-none z-40"
                style={{ 
                    opacity: vignetteOpacity,
                    background: 'linear-gradient(to bottom, rgba(10,7,4,0.92) 0%, rgba(10,7,4,0.5) 60%, transparent 100%)' 
                }}
            />

            {/* Sticky Header: Always transparent, absolute vertical centering for perfect alignment */}
            <div 
                className={`w-full relative sticky top-0 z-50 h-[76px] shrink-0`}
                style={{ maxWidth }}
            >
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2">
                    <BackButton to={backTo} label={backLabel} />
                </div>
                
                {title && (
                    <h1 className="text-white text-lg font-['Cinzel'] font-bold tracking-widest absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                        {title}
                    </h1>
                )}

                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {rightElement}
                </div>
            </div>

            {/* Main content: centered via my-auto */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="relative z-10 w-full flex flex-col items-center gap-4 py-4 md:py-6 my-auto"
                style={{ maxWidth }}
            >
                {children}
            </motion.div>
        </div>
    );
};
