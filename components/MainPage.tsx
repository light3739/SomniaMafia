import React from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { usePrivy } from '@privy-io/react-auth';
const somniaLogo = "/assets/somniayeal.png";

const LightRays = dynamic(() => import('./ui/LightRays'), { ssr: false });

interface MainPageProps {
    onStart: () => void;
}

export const MainPage: React.FC<MainPageProps> = ({ onStart }) => {

    const { login, authenticated, ready } = usePrivy();

    return (
        <div className="relative w-full h-[100dvh] overflow-y-auto overflow-x-hidden font-sans flex flex-col items-center custom-scrollbar">
            {/* Background is provided by RootLayout/DynamicBackground */}

            {/* Light rays overlay — WebGL, pointer-events-none */}
            <div className="fixed inset-0 z-[5] pointer-events-none">
                <LightRays
                    raysOrigin="top-center"
                    raysColor="#fec28b"
                    raysSpeed={0.6}
                    lightSpread={0.7}
                    rayLength={100}
                    followMouse={true}
                    mouseInfluence={0.05}
                    noiseAmount={0.27}
                    distortion={0}
                    pulsating={false}
                    fadeDistance={1}
                    saturation={0}
                    intensity={2}
                />
            </div>

            {/* Content Container — radial vignette behind text for readability over busy background */}
            <div
                className="relative z-10 w-full flex flex-col items-center justify-center p-4 my-auto min-h-full"
                style={{
                    background: 'radial-gradient(ellipse 80% 65% at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
                }}
            >

                {/* Main Title — CSS animation for fast LCP (no JS needed) */}
                <div className="w-full flex items-center justify-center animate-landing-title">
                    <h1
                        className="text-center font-bold text-[#ffffff] whitespace-nowrap"
                        style={{
                            fontFamily: 'var(--font-cinzel), serif',
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

                {/* Decorative divider */}
                <div className="animate-landing-subtitle w-[120px] md:w-[180px] h-[1px] mt-3 mb-1 bg-gradient-to-r from-transparent via-[#C49A6C]/50 to-transparent" />

                {/* Game Description */}
                <p
                    className="animate-landing-subtitle mt-2 text-center font-bold"
                    style={{
                        fontFamily: 'var(--font-cinzel), serif',
                        fontSize: 'clamp(0.85rem, 2.5vw, 1.3rem)',
                        letterSpacing: '0.12em',
                        color: '#C49A6C',
                        textShadow: '0 2px 20px rgba(0,0,0,1), 0 0 40px rgba(0,0,0,0.5)',
                    }}
                >
                    Where lies pay real money.
                </p>
                <p
                    className="mt-3 text-center text-white/50 font-sans tracking-[0.15em] uppercase"
                    style={{
                        fontSize: 'clamp(0.6rem, 1.2vw, 0.8rem)',
                        textShadow: '0 1px 10px rgba(0,0,0,1)',
                        animation: 'landing-slide-up 1s ease-out 0.5s both',
                    }}
                >
                    Tournaments · Voice chat · 4–16 players · On-chain prizes
                </p>

                {/* Corner ribbon — On Somnia Network */}
                <div
                    className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
                >
                    <div
                        className="absolute flex items-center justify-center gap-3"
                        style={{
                            width: '600px',
                            top: '110px',
                            right: '-180px',
                            transform: 'rotate(45deg)',
                            background: 'linear-gradient(135deg, #1a1208 0%, #2a1d0e 50%, #1a1208 100%)',
                            borderTop: '1px solid rgba(196,154,108,0.35)',
                            borderBottom: '1px solid rgba(196,154,108,0.35)',
                            padding: '12px 0',
                            boxShadow: '0 6px 30px rgba(0,0,0,0.7)',
                        }}
                    >
                        <span
                            className="font-sans uppercase tracking-[0.2em] font-bold text-[15px]"
                            style={{
                                color: '#ffe08a',
                                textShadow: '0 0 8px rgba(255,200,80,0.7), 0 1px 3px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.8)',
                            }}
                        >
                            On Somnia Network
                        </span>
                        <Image src={somniaLogo} alt="Somnia" width={28} height={28} className="h-7 w-7 object-contain drop-shadow-md" />
                    </div>
                </div>

                {/* CONNECT / ENTER Button */}
                <div className="animate-landing-button mt-20 relative z-20">
                    {(() => {
                        if (!ready) {
                            // Reserve the exact final button footprint so the
                            // flex column above doesn't reflow when Privy
                            // hydrates and the placeholder swaps to the real
                            // button. Without this, the title visibly jumps up
                            // by ~16px once the button grows from ~20px-tall
                            // text to ~52px-tall styled button (justify-center
                            // re-centers the whole stack). Same paddings,
                            // same text size, same ring — invisible.
                            return (
                                <div
                                    aria-hidden
                                    className="px-14 py-3.5 rounded-xl font-mono font-bold text-base md:text-lg tracking-[0.1em] ring-1 ring-transparent invisible"
                                >
                                    PLAY NOW
                                </div>
                            );
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
                                    <span className="relative z-10">PLAY NOW</span>
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