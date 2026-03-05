import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
const somniaLogo = "/assets/somniayeal.png";
const avalancheLogo = "/assets/avalanche-avax-logo.png";

interface MainPageProps {
    onStart: () => void;
}

export const MainPage: React.FC<MainPageProps> = ({ onStart }) => {

    return (
        <div className="relative w-full h-screen overflow-hidden font-sans flex items-center justify-center">



            {/* Content Container */}
            <div className="relative z-10 w-full flex flex-col items-center justify-center p-4">

                {/* Main Title */}
                <div className="w-full flex items-center justify-center">
                    <h1
                        className="text-center font-bold italic text-[#ffffff] whitespace-nowrap"
                        style={{
                            fontFamily: '"Cinzel", serif',
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

                {/* Subtitle Row - Infinite Marquee */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 1 }}
                    className="mt-[-10px] relative w-64 md:w-96 overflow-hidden bg-black/40 rounded-full backdrop-blur-md border border-white/10 shadow-xl"
                    style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}
                >
                    <motion.div
                        animate={{ x: ["0%", "-50%"] }}
                        transition={{
                            repeat: Infinity,
                            ease: "linear",
                            duration: 12,
                        }}
                        className="flex flex-row items-center w-max"
                    >
                        {/* FIRST COPY */}
                        <div className="flex flex-row items-center justify-center gap-6 px-3 py-1.5">
                            <div className="flex items-center gap-2">
                                <p className="font-sans text-[#ffb01d] uppercase tracking-[0.2em] font-semibold text-[9px] md:text-[13px] whitespace-nowrap drop-shadow-md">
                                    On Avalanche Fuji
                                </p>
                                <Image src={avalancheLogo} alt="Avalanche" width={30} height={30} className="h-4 md:h-6 w-auto object-contain drop-shadow-md" />
                            </div>
                            <div className="w-1 h-1 rounded-full bg-white/30" />
                            <div className="flex items-center gap-2">
                                <p className="font-sans text-[#b388ff] uppercase tracking-[0.2em] font-semibold text-[9px] md:text-[13px] whitespace-nowrap drop-shadow-md">
                                    On Somnia Testnet
                                </p>
                                <Image src={somniaLogo} alt="Somnia" width={30} height={30} className="h-4 md:h-6 w-auto object-contain drop-shadow-md" />
                            </div>
                            <div className="w-1 h-1 rounded-full bg-white/30" />
                        </div>
                        {/* SECOND COPY (duplicate for seamless loop) */}
                        <div className="flex flex-row items-center justify-center gap-6 px-3 py-1.5">
                            <div className="flex items-center gap-2">
                                <p className="font-sans text-[#ffb01d] uppercase tracking-[0.2em] font-semibold text-[9px] md:text-[13px] whitespace-nowrap drop-shadow-md">
                                    On Avalanche Fuji
                                </p>
                                <Image src={avalancheLogo} alt="Avalanche" width={30} height={30} className="h-4 md:h-6 w-auto object-contain drop-shadow-md" />
                            </div>
                            <div className="w-1 h-1 rounded-full bg-white/30" />
                            <div className="flex items-center gap-2">
                                <p className="font-sans text-[#b388ff] uppercase tracking-[0.2em] font-semibold text-[9px] md:text-[13px] whitespace-nowrap drop-shadow-md">
                                    On Somnia Testnet
                                </p>
                                <Image src={somniaLogo} alt="Somnia" width={30} height={30} className="h-4 md:h-6 w-auto object-contain drop-shadow-md" />
                            </div>
                            <div className="w-1 h-1 rounded-full bg-white/30" />
                        </div>
                    </motion.div>
                </motion.div>

                {/* CONNECT / ENTER Button */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.5, duration: 0.5 }}
                    className="mt-16"
                >
                    <ConnectButton.Custom>
                        {({
                            account,
                            chain,
                            openChainModal,
                            openConnectModal,
                            authenticationStatus,
                            mounted,
                        }) => {
                            // Note: If your app doesn't use authentication, you
                            // can remove all 'authenticationStatus' checks
                            const ready = mounted && authenticationStatus !== 'loading';
                            const connected =
                                ready &&
                                account &&
                                chain &&
                                (!authenticationStatus ||
                                    authenticationStatus === 'authenticated');

                            return (
                                <div
                                    {...(!ready && {
                                        'aria-hidden': true,
                                        'style': {
                                            opacity: 0,
                                            pointerEvents: 'none',
                                            userSelect: 'none',
                                        },
                                    })}
                                >
                                    {(() => {
                                        if (!connected) {
                                            return (
                                                <button
                                                    onClick={openConnectModal}
                                                    className="px-8 py-3 rounded-xl font-mono font-bold text-black shadow-[0_0_15px_rgba(231,213,113,0.3)] hover:shadow-[0_0_25px_rgba(231,213,113,0.6)] hover:scale-105 transition-all text-sm md:text-base tracking-wider relative overflow-hidden ring-1 ring-white/10"
                                                    style={{
                                                        background: 'linear-gradient(90deg, #E7D571 0%, #615511 100%)',
                                                    }}
                                                >
                                                    <span className="relative z-10">CONNECT WALLET</span>
                                                    {/* Shine effect overlay */}
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] hover:translate-x-[100%] transition-transform duration-1000" />
                                                </button>
                                            );
                                        }

                                        if (chain.unsupported) {
                                            return (
                                                <button
                                                    onClick={openChainModal}
                                                    className="px-8 py-3 rounded-xl font-mono font-bold text-white bg-red-600 shadow-lg hover:scale-105 transition-all text-sm md:text-base tracking-wider ring-1 ring-red-400/50"
                                                >
                                                    WRONG NETWORK
                                                </button>
                                            );
                                        }

                                        const preferredNetwork = typeof window !== 'undefined'
                                            ? localStorage.getItem('mafia_selected_network')
                                            : null;
                                        const preferredChainId = preferredNetwork === 'somnia_testnet' ? 50312 : 43113;

                                        if (chain.id !== preferredChainId) {
                                            return (
                                                <button
                                                    onClick={openChainModal}
                                                    className="px-8 py-3 rounded-xl font-mono font-bold text-white bg-orange-600 shadow-lg hover:scale-105 transition-all text-sm md:text-base tracking-wider ring-1 ring-orange-300/50"
                                                >
                                                    SWITCH NETWORK
                                                </button>
                                            );
                                        }

                                        return (
                                            <button
                                                onClick={onStart}
                                                className="px-8 py-3 rounded-xl font-mono font-bold text-black shadow-[0_0_15px_rgba(231,213,113,0.3)] hover:shadow-[0_0_25px_rgba(231,213,113,0.6)] hover:scale-105 transition-all text-sm md:text-base tracking-wider relative overflow-hidden ring-1 ring-white/10"
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
                            );
                        }}
                    </ConnectButton.Custom>

                </motion.div>

            </div>
        </div >
    );
};