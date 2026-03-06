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
        <div className="relative w-full h-[100dvh] overflow-y-auto overflow-x-hidden font-sans flex flex-col items-center custom-scrollbar">
            {/* Background is provided by RootLayout/DynamicBackground */}

            {/* Content Container */}
            <div className="relative z-10 w-full flex flex-col items-center justify-center p-4 my-auto min-h-full">

                {/* Main Title */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="w-full flex items-center justify-center"
                >
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
                </motion.div>

                {/* Subtitle Row - Vertical Scroll Slot Machine */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 1 }}
                    className="mt-[-10px] relative overflow-hidden bg-black/40 px-2 rounded-full backdrop-blur-md border border-white/10 shadow-xl h-[40px] md:h-[50px] lg:h-[60px] flex items-center justify-center w-[220px] md:w-[300px] lg:w-[380px]"
                >
                    <motion.div
                        animate={{ y: ["0%", "-50%"] }}
                        transition={{
                            repeat: Infinity,
                            ease: "linear",
                            duration: 5,
                            delay: 2.0
                        }}
                        className="flex flex-col items-center absolute top-0"
                    >
                        {/* ITEM 1 */}
                        <div className="flex w-full flex-row items-center justify-center gap-3 h-[40px] md:h-[50px] lg:h-[60px]">
                            <p className="font-sans text-[#ffb01d] uppercase tracking-[0.2em] font-semibold text-[10px] md:text-[14px] lg:text-[18px] whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                                On Avalanche Fuji
                            </p>
                            <Image src={avalancheLogo} alt="Avalanche" width={45} height={40} className="h-6 md:h-8 lg:h-10 w-auto object-contain drop-shadow-md" />
                        </div>
                        {/* ITEM 2 */}
                        <div className="flex w-full flex-row items-center justify-center gap-3 h-[40px] md:h-[50px] lg:h-[60px]">
                            <p className="font-sans text-[#ffb01d] uppercase tracking-[0.2em] font-semibold text-[10px] md:text-[14px] lg:text-[18px] whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                                On Somnia Testnet
                            </p>
                            <Image src={somniaLogo} alt="Somnia" width={45} height={40} className="h-6 md:h-8 lg:h-10 w-auto object-contain drop-shadow-md" />
                        </div>
                        {/* ITEM 1 COPY FOR SEAMLESS LOOP */}
                        <div className="flex w-full flex-row items-center justify-center gap-3 h-[40px] md:h-[50px] lg:h-[60px]">
                            <p className="font-sans text-[#ffb01d] uppercase tracking-[0.2em] font-semibold text-[10px] md:text-[14px] lg:text-[18px] whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                                On Avalanche Fuji
                            </p>
                            <Image src={avalancheLogo} alt="Avalanche" width={45} height={40} className="h-6 md:h-8 lg:h-10 w-auto object-contain drop-shadow-md" />
                        </div>
                        {/* ITEM 2 COPY */}
                        <div className="flex w-full flex-row items-center justify-center gap-3 h-[40px] md:h-[50px] lg:h-[60px]">
                            <p className="font-sans text-[#ffb01d] uppercase tracking-[0.2em] font-semibold text-[10px] md:text-[14px] lg:text-[18px] whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                                On Somnia Testnet
                            </p>
                            <Image src={somniaLogo} alt="Somnia" width={45} height={40} className="h-6 md:h-8 lg:h-10 w-auto object-contain drop-shadow-md" />
                        </div>
                    </motion.div>
                </motion.div>

                {/* CONNECT / ENTER Button */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.0, duration: 0.5 }}
                    className="mt-32 relative z-20"
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