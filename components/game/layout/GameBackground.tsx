import React from 'react';
import Image from 'next/image';

interface GameBackgroundProps {
    isNightPhase: boolean;
    dayBg: string;
    nightBg: string;
}

export const GameBackground: React.FC<GameBackgroundProps> = ({ isNightPhase, dayBg, nightBg }) => {
    return (
        <div className="fixed inset-0 z-0 pointer-events-none">
            {/* Day Background */}
            <div className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${isNightPhase ? 'opacity-0' : 'opacity-100'}`}>
                <Image
                    src={dayBg}
                    alt="Day Background"
                    fill
                    priority
                    unoptimized
                    className="object-cover"
                    style={{ filter: 'grayscale(30%) brightness(55%)' }}
                />
            </div>

            {/* Night Background */}
            <div className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${isNightPhase ? 'opacity-100' : 'opacity-0'}`}>
                <Image
                    src={nightBg}
                    alt="Night Background"
                    fill
                    priority
                    unoptimized
                    className="object-cover"
                    style={{ filter: 'brightness(50%) sepia(20%) contrast(105%)' }}
                />
            </div>

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,#000_100%)] z-10" />
            <div className="absolute inset-0 z-20 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]" />
        </div>
    );
};
