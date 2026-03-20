import React, { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface CinematicOverlayProps {
    show: boolean;
    children: ReactNode;
    backgroundElements?: ReactNode;
    duration?: number;
    delay?: number;
    exitDuration?: number;
    zIndex?: number;
    className?: string; // Additional classes for the content wrapper
    onExitComplete?: () => void;
}

/**
 * CinematicOverlay: A unified portal-based wrapper for all transition and cinematic screens.
 * 
 * DESIGN RATIONALE:
 * 1. NO FLASHES: Uses createPortal(document.body) and a solid #050505 background 
 *    to ensure absolute coverage outside the React subtree.
 * 2. Z-INDEX CONTROL: High z-index (default 10000) prevents underlying UI bleed-through.
 * 3. FLEXIBILITY: Accepts backgroundElements slot for specific patterns (dust, rays, glows).
 */
export const CinematicOverlay: React.FC<CinematicOverlayProps> = ({
    show,
    children,
    backgroundElements,
    duration = 1.2,
    delay = 0,
    exitDuration = 1,
    zIndex = 10000,
    className = "",
    onExitComplete
}) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // SSR safety
    if (!mounted || typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence onExitComplete={onExitComplete}>
            {show && (
                <motion.div
                    className="fixed inset-0 flex items-center justify-center pointer-events-none"
                    style={{ zIndex }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration, delay, ease: "easeInOut" }}
                >
                    {/* Fixed Hard-Black Base Layer — catches any 1-tick render gaps */}
                    <div className="absolute inset-0 bg-[#050505]" />

                    {/* Ambient Visual Layer (Rays, Dust, Vignettes) */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {backgroundElements}
                    </div>

                    {/* Content Layer */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: delay + 0.3, duration: 1 }}
                        className={`relative z-10 flex flex-col items-center justify-center w-full h-full ${className}`}
                    >
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};
