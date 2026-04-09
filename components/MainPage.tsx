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

            {/* Noir fog — fixed overlay at the bottom, pointer-events-none so clicks pass through */}
            <div className="fixed bottom-0 left-0 right-0 h-[45%] pointer-events-none z-20 overflow-hidden">
                <div
                    className="absolute w-[140%] h-full -left-[20%] bottom-0"
                    style={{
                        background: 'radial-gradient(ellipse 70% 55% at 25% 100%, rgba(180,130,70,0.25) 0%, transparent 70%)',
                        animation: 'fog-drift-1 30s ease-in-out infinite',
                        willChange: 'transform',
                    }}
                />
                <div
                    className="absolute w-[140%] h-full -left-[20%] bottom-0"
                    style={{
                        background: 'radial-gradient(ellipse 60% 50% at 75% 100%, rgba(140,100,50,0.20) 0%, transparent 65%)',
                        animation: 'fog-drift-2 24s ease-in-out infinite',
                        willChange: 'transform',
                    }}
                />
                <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-black/50 to-transparent" />
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

                {/* Subtitle Row */}
                <div
                    className="animate-landing-subtitle mt-[-10px] relative overflow-hidden bg-black/40 px-2 rounded-full backdrop-blur-md border border-white/10 shadow-xl h-[40px] md:h-[50px] lg:h-[60px] flex items-center justify-center w-[220px] md:w-[300px] lg:w-[380px]"
                >
                    <div className="flex flex-row items-center justify-center gap-3 h-full">
                        <p className="font-sans text-[#ffb01d] uppercase tracking-[0.2em] font-semibold text-[10px] md:text-[14px] lg:text-[18px] whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                            On Somnia Network
                        </p>
                        <Image src={somniaLogo} alt="Somnia" width={45} height={40} className="h-6 md:h-8 lg:h-10 object-contain drop-shadow-md" />
                    </div>
                </div>

                {/* Game Description — answers "what is it?" in 5 seconds */}
                <p
                    className="mt-10 text-center font-bold"
                    style={{
                        fontFamily: 'var(--font-cinzel), serif',
                        fontSize: 'clamp(0.85rem, 2.5vw, 1.3rem)',
                        letterSpacing: '0.12em',
                        color: '#C49A6C',
                        textShadow: '0 2px 20px rgba(0,0,0,1), 0 0 40px rgba(0,0,0,0.5)',
                        animation: 'landing-slide-up 1s ease-out 0.5s both',
                    }}
                >
                    Unmask the Mafia. Deceive the Town.
                </p>
                <p
                    className="mt-3 text-center text-white/50 font-sans tracking-[0.15em] uppercase"
                    style={{
                        fontSize: 'clamp(0.6rem, 1.2vw, 0.8rem)',
                        textShadow: '0 1px 10px rgba(0,0,0,1)',
                        animation: 'landing-slide-up 1s ease-out 0.65s both',
                    }}
                >
                    Voice chat · 4–16 players · Play free in your browser
                </p>

                {/* CONNECT / ENTER Button */}
                <div className="animate-landing-button mt-14 relative z-20">
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
                                    LOGIN / CONNECT
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