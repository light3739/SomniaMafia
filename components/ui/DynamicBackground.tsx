"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const DynamicBackground = () => {
    const pathname = usePathname();

    const backgroundImage = useMemo(() => {
        if (pathname === "/") {
            return "/assets/mafia1.webp";
        }
        return "/assets/lobby_background.webp";
    }, [pathname]);

    return (
        <div className="fixed inset-0 z-0">
            <AnimatePresence mode="popLayout">
                <motion.div
                    key={backgroundImage}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute inset-0"
                >
                    <Image
                        src={backgroundImage}
                        alt="Background"
                        fill
                        priority
                        sizes="100vw"
                        className="object-cover"
                    />
                </motion.div>
            </AnimatePresence>
            {/* Dark overlay for better text readability */}
            <div className="absolute inset-0 bg-black/20" />
        </div>
    );
};
