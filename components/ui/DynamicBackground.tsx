"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

const LANDING_BG = "/images/mainscreen.png";
const LOBBY_BG = "/images/setup.png";

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
                    unoptimized
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
                    unoptimized
                    className="object-cover"
                />
            </div>
            {/* Dark overlay — landing gets 20%, lobby gets extra 40% to match landing darkness */}
            <div className="absolute inset-0 bg-black/20" />
            {!isLanding && <div className="absolute inset-0 bg-black/40" />}
        </div>
    );
};
