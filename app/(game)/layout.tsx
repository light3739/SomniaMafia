"use client";

import { GameProvider } from "@/contexts/GameContext";
import { RefundBanner } from "@/components/game/RefundBanner";

export default function GameLayout({ children }: { children: React.ReactNode }) {
    return (
        <GameProvider>
            <RefundBanner />
            {children}
        </GameProvider>
    );
}
