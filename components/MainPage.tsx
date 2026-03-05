import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useChainId } from 'wagmi';
import { NetworkSelector } from './ui/NetworkSelector';
const somniaLogo = "/assets/somniayeal.png";
const avalancheLogo = "/assets/avalanche-avax-logo.png";

interface MainPageProps {
    onStart: () => void;
}

export const MainPage: React.FC<MainPageProps> = ({ onStart }) => {
    const chainId = useChainId();
    const networkLabel = chainId === 43113 ? 'Avalanche Fuji' : 'Somnia Testnet';

    return (
        <div className="relative w-full h-screen overflow-hidden font-sans flex items-center justify-center">



            {/* Content Container */}
            <div className="relative z-10 w-full flex flex-col items-center justify-center p-4">

                {/* Main Title */}
                <div className="w-full max-w-[90vw] md:max-w-[800px]">
                    <svg viewBox="0 0 600 120" className="w-full h-auto overflow-visible">
                        <text
                            x="50%"
                            y="60%"
                            dominantBaseline="middle"
                            textAnchor="middle"
                            fill="#ffffff"
                            stroke="#000000"
                            strokeWidth="0"
                            strokeOpacity="0"
                            strokeLinecap="square"
                            strokeLinejoin="bevel"
                            textRendering="auto"
                            letterSpacing="1.44"
                            style={{
                                fontFamily: '"Playfair Display", serif',
                                fontSize: '72px',
                                fontStyle: 'italic',
                                fontWeight: 900,
                                filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.5))'
                            }}
                        >
                            Onchain Mafia
                        </text>
                    </svg>
                </div>

                {/* Subtitle Row */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 1 }}
                    className="flex flex-row items-center justify-center gap-2 mt-[-10px] md:mt-[-20px]"
                >
                    <p
                        style={{
                            fontFamily: '"Montserrat", sans-serif',
                            color: '#ffb01d',
                            textTransform: 'uppercase',
                            letterSpacing: '0.2em',
                            fontWeight: 600,
                            textShadow: '0px 2px 4px rgba(0,0,0,0.6)'
                        }}
                        className="text-[10px] md:text-[14px] lg:text-[18px] whitespace-nowrap"
                    >
                        On {networkLabel}
                    </p>
                    {chainId === 43113 ? (
                        <Image
                            src={avalancheLogo}
                            alt="Avalanche"
                            width={45}
                            height={40}
                            className="h-6 md:h-8 lg:h-10 w-auto object-contain drop-shadow-md"
                        />
                    ) : (
                        <Image
                            src={somniaLogo}
                            alt="Somnia"
                            width={45}
                            height={40}
                            className="h-6 md:h-8 lg:h-10 w-auto object-contain drop-shadow-md"
                        />
                    )}
                </motion.div>

                <div className="mt-4 flex items-center gap-2 bg-black/40 border border-white/15 rounded-xl px-3 py-2">
                    <NetworkSelector />
                </div>

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