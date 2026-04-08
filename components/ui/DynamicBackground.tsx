"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

const LANDING_BG = "/assets/mafia1.jpg";
const LOBBY_BG = "/assets/lobby_background.png";

export const DynamicBackground = () => {
    const pathname = usePathname();
    const isLanding = pathname === "/";

    // Both backgrounds are rendered simultaneously with priority. The inactive
    // one sits at opacity 0 — this preloads lobby_background.png while the user
    // is still on the landing page, so navigating to /setup is an instant
    // opacity crossfade instead of a 2.4MB cold fetch.
    return (
        <div className="fixed inset-0 z-0 bg-black">
            <div
                className="absolute inset-0 transition-opacity duration-500"
                style={{ opacity: isLanding ? 1 : 0 }}
            >
                <Image
                    src={LANDING_BG}
                    alt=""
                    fill
                    priority
                    sizes="100vw"
                    quality={90}
                    className="object-cover"
                />
            </div>
            <div
                className="absolute inset-0 transition-opacity duration-500"
                style={{ opacity: isLanding ? 0 : 1 }}
            >
                <Image
                    src={LOBBY_BG}
                    alt=""
                    fill
                    priority
                    sizes="100vw"
                    quality={90}
                    className="object-cover"
                />
            </div>
            {/* Dark overlay for better text readability */}
            <div className="absolute inset-0 bg-black/20" />
        </div>
    );
};
