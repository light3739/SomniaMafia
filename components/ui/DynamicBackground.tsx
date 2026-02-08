"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

export const DynamicBackground = () => {
    const pathname = usePathname();

    const backgroundImage = useMemo(() => {
        if (pathname === "/") {
            return "/assets/mafia1.jpg";
        }
        return "/assets/lobby_background.png";
    }, [pathname]);

    return (
        <div className="fixed inset-0 z-0 bg-black">
            <div className="absolute inset-0">
                <Image
                    src={backgroundImage}
                    alt="Background"
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover"
                />
            </div>
            {/* Dark overlay for better text readability */}
            <div className="absolute inset-0 bg-black/20" />
        </div>
    );
};
