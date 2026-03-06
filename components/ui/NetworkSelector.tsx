import React, { useState } from 'react';
import { useChainId, useSwitchChain, useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { NETWORKS, type SupportedNetwork } from '../../contracts/config';
import { Wallet, ChevronDown, User } from 'lucide-react';
import { useSoundEffects } from './SoundEffects';

interface NetworkSelectorProps {
  compact?: boolean;
  showWallet?: boolean;
}

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  compact = false,
  showWallet = false
}) => {
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { isConnected } = useAccount();
  const [targetNetwork, setTargetNetwork] = useState<SupportedNetwork | null>(null);

  const isAvalanche = chainId === NETWORKS.avalanche_fuji.id;
  const isSomnia = chainId === NETWORKS.somnia_testnet.id;

  const { playMarkSound } = useSoundEffects();
  const handleSwitch = async (network: SupportedNetwork) => {
    if (targetNetwork) return;
    playMarkSound();
    setTargetNetwork(network);
    try {
      await switchChainAsync({ chainId: NETWORKS[network].id });
      localStorage.setItem('mafia_selected_network', network);
    } catch (e) {
      console.error("Failed to switch network", e);
    } finally {
      setTargetNetwork(null);
    }
  };

  return (
    <div className={`flex items-center justify-center ${(compact || !showWallet) ? 'w-fit' : 'w-full max-w-[500px] mb-2'}`}>
      <div className="relative flex items-center p-1 bg-[rgba(15,10,5,0.85)] backdrop-blur-xl border border-white/10 rounded-[20px] shadow-2xl overflow-hidden">

        {/* Network Toggle Segment */}
        <div className="relative flex p-0.5 gap-1 shrink-0">
          {/* Sliding background for active state */}
          <div
            className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] bg-[#4A3222] rounded-[14px] transition-all duration-500 ease-out z-0 shadow-inner border border-white/5"
            style={{
              left: '2px',
              transform: isAvalanche ? 'translateX(0%)' : isSomnia ? 'translateX(100%)' : 'translateX(0%)',
              opacity: (isAvalanche || isSomnia) ? 1 : 0
            }}
          />

          <button
            onClick={() => handleSwitch('avalanche_fuji')}
            disabled={!!targetNetwork || isAvalanche}
            className={`relative py-2.5 px-4 font-sans font-bold text-[11px] md:text-xs transition-all duration-300 z-10 flex items-center justify-center gap-2 rounded-[14px] whitespace-nowrap min-w-[100px] md:min-w-[120px] ${isAvalanche ? 'text-[#ffb01d] drop-shadow-md' : 'text-white/30 hover:text-white/50'
              }`}
          >
            {isAvalanche && <div className="w-1.5 h-1.5 shrink-0 rounded-full bg-[#ffb01d] shadow-[0_0_8px_#ffb01d]" />}
            {targetNetwork === 'avalanche_fuji' ? '...' : 'Avalanche'}
          </button>

          <button
            onClick={() => handleSwitch('somnia_testnet')}
            disabled={!!targetNetwork || isSomnia}
            className={`relative py-2.5 px-4 font-sans font-bold text-[11px] md:text-xs transition-all duration-300 z-10 flex items-center justify-center gap-2 rounded-[14px] whitespace-nowrap min-w-[100px] md:min-w-[120px] ${isSomnia ? 'text-[#ffb01d] drop-shadow-md' : 'text-white/30 hover:text-white/50'
              }`}
          >
            {isSomnia && <div className="w-1.5 h-1.5 shrink-0 rounded-full bg-[#ffb01d] shadow-[0_0_8px_#ffb01d]" />}
            {targetNetwork === 'somnia_testnet' ? '...' : 'Somnia'}
          </button>
        </div>

        {/* Optional Wallet Section */}
        {showWallet && (
          <>
            {/* Divider */}
            <div className="w-[1px] h-6 bg-white/10 mx-1 shrink-0" />

            {/* Wallet Section */}
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
              }) => {
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
                    className="flex items-center"
                  >
                    {(() => {
                      if (!connected) {
                        return (
                          <button
                            onClick={openConnectModal}
                            className="py-2.5 px-4 text-[11px] md:text-xs font-bold text-[#ffb01d] hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap"
                          >
                            <Wallet className="w-3.5 h-3.5" />
                            Connect
                          </button>
                        );
                      }

                      if (chain.unsupported) {
                        return (
                          <button
                            onClick={openChainModal}
                            className="py-2.5 px-4 text-[11px] md:text-xs font-bold text-rose-500 hover:text-rose-400 transition-colors whitespace-nowrap"
                          >
                            Wrong Network
                          </button>
                        );
                      }

                      return (
                        <button
                          onClick={openAccountModal}
                          className="py-1 px-2.5 md:py-1.5 md:px-3 flex items-center gap-2 hover:bg-white/5 rounded-[14px] transition-all group"
                        >
                          <div className="w-6 h-6 rounded-full bg-[#ffb01d]/10 border border-[#ffb01d]/30 flex items-center justify-center overflow-hidden">
                            {account.ensAvatar ? (
                              <img
                                src={account.ensAvatar}
                                alt="Avatar"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-3.5 h-3.5 text-[#ffb01d]" />
                            )}
                          </div>
                          <span className="text-[11px] md:text-xs font-bold text-white/80 group-hover:text-white transition-colors hidden sm:block">
                            {account.displayName}
                          </span>
                          <ChevronDown className="w-3 h-3 text-white/30 group-hover:text-white/50 transition-colors" />
                        </button>
                      );
                    })()}
                  </div>
                );
              }}
            </ConnectButton.Custom>
          </>
        )}
      </div>
    </div>
  );
};
