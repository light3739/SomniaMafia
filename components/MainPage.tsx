import React from 'react';
import Image from 'next/image';
import { usePrivy } from '@privy-io/react-auth';
const somniaLogo = "/assets/somniayeal.png";

interface MainPageProps {
    onStart: () => void;
}

export const MainPage: React.FC<MainPageProps> = ({ onStart }) => {

    const { login, authenticated, ready } = usePrivy();

    return (
        <div className="relative w-full h-[100dvh] overflow-y-auto overflow-x-hidden font-sans flex flex-col items-center custom-scrollbar">
            {/* Background is provided by RootLayout/DynamicBackground */}

            {/* Content Container */}
            <div className="relative z-10 w-full flex flex-col items-center justify-center p-4 my-auto min-h-full">

                {/* Main Title — CSS animation for fast LCP (no JS needed) */}
                <div className="w-full flex items-center justify-center animate-landing-title">
                    <h1
                        className="text-center font-bold italic text-[#ffffff] whitespace-nowrap font-serif"
                        style={{
                            fontSize: 'clamp(2.5rem, 8vw, 6.5rem)',
                            letterSpacing: '0.05em',
                            paddingLeft: '0.05em',
                            textShadow: `
                                0px 4px 15px rgba(0,0,0,0.9),
                                0px 0px 30px rgba(0,0,0,0.6)
                            `,
                            lineHeight: '1.2'
                        }}
                    >
                        Onchain Mafia
                    </h1>
                </div>

                {/* Subtitle Row */}
                <div
                    className="animate-landing-subtitle mt-[-10px] relative overflow-hidden bg-black/40 px-2 rounded-full backdrop-blur-md border border-white/10 shadow-xl h-[40px] md:h-[50px] lg:h-[60px] flex items-center justify-center w-[220px] md:w-[300px] lg:w-[380px]"
                >
                    <div className="flex flex-row items-center justify-center gap-3 h-full">
                        <p className="font-sans text-[#ffb01d] uppercase tracking-[0.2em] font-semibold text-[10px] md:text-[14px] lg:text-[18px] whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                            On Somnia Network
                        </p>
                        <Image src={somniaLogo} alt="Somnia" width={45} height={40} className="h-6 md:h-8 lg:h-10 w-auto object-contain drop-shadow-md" />
                    </div>
                </div>

                {/* CONNECT / ENTER Button */}
                <div className="animate-landing-button mt-32 relative z-20">
                    {(() => {
                        if (!ready) {
                            return <div style={{ opacity: 0 }}>Loading...</div>;
                        }

                        if (!authenticated) {
                            return (
                                <button
                                    onClick={() => login()}
                                    className="px-14 py-3.5 rounded-xl font-mono font-bold text-black shadow-[0_0_15px_rgba(231,213,113,0.3)] hover:shadow-[0_0_25px_rgba(231,213,113,0.6)] hover:scale-[1.03] transition-all text-base md:text-lg tracking-[0.1em] relative overflow-hidden ring-1 ring-white/10"
                                    style={{
                                        background: 'linear-gradient(90deg, #E7D571 0%, #615511 100%)',
                                    }}
                                >
                                    <span className="relative z-10">LOGIN / CONNECT</span>
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] hover:translate-x-[100%] transition-transform duration-1000" />
                                </button>
                            );
                        }

                        return (
                            <button
                                onClick={onStart}
                                className="px-13 py-3.5 rounded-xl font-mono font-bold text-black shadow-[0_0_15px_rgba(231,213,113,0.3)] hover:shadow-[0_0_25px_rgba(231,213,113,0.6)] hover:scale-[1.03] transition-all text-base md:text-base tracking-[0.1em] relative overflow-hidden ring-1 ring-white/10"
                                style={{
                                    background: 'linear-gradient(90deg, #E7D571 0%, #615511 100%)',
                                }}
                            >
                                <span className="relative z-10">ENTER CITY</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] hover:translate-x-[100%] transition-transform duration-1000" />
                            </button>
                        );
                    })()}
                </div>

            </div>
        </div >
    );
};