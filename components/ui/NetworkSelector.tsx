"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useChainId, useSwitchChain } from 'wagmi';
import { ACTIVE_NETWORK, NETWORKS, type SupportedNetwork } from '../../contracts/config';

interface NetworkSelectorProps {
  compact?: boolean;
}

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({ compact = false }) => {
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [targetNetwork, setTargetNetwork] = useState<SupportedNetwork | null>(null);

  // We rely fully on wagmi's chainId, no local selectedNetwork state!
  const isAvalanche = chainId === NETWORKS.avalanche_fuji.id;
  const isSomnia = chainId === NETWORKS.somnia_testnet.id;

  const handleSwitch = async (network: SupportedNetwork) => {
    if (targetNetwork) return;
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
    <div className={`flex flex-col items-center justify-center ${compact ? 'w-full max-w-[280px]' : 'w-full max-w-[350px] mb-2'}`}>
      <div className="relative w-full flex p-1.5 bg-[rgba(25,19,13,0.8)] backdrop-blur-md border border-white/10 rounded-[16px] shadow-2xl">

        {/* Sliding background for active state */}
        <div
          className="absolute top-1.5 bottom-1.5 w-[calc(50%-0.375rem)] bg-[#4A3222] rounded-[12px] transition-all duration-500 ease-out z-0 shadow-inner border border-white/5"
          style={{
            left: '0.375rem',
            transform: isAvalanche ? 'translateX(0%)' : isSomnia ? 'translateX(100%)' : 'translateX(0%)',
            opacity: (isAvalanche || isSomnia) ? 1 : 0
          }}
        />

        <button
          onClick={() => handleSwitch('avalanche_fuji')}
          disabled={!!targetNetwork || isAvalanche}
          className={`flex-1 py-3 px-2 font-sans font-semibold text-xs md:text-sm transition-all duration-300 z-10 flex flex-row items-center justify-center gap-1.5 rounded-[12px] whitespace-nowrap min-w-[110px] ${isAvalanche ? 'text-[#ffb01d] drop-shadow-md' : 'text-white/40 hover:text-white/60'
            }`}
        >
          {isAvalanche && <div className="w-1.5 h-1.5 shrink-0 rounded-full bg-[#ffb01d] shadow-[0_0_8px_#ffb01d]" />}
          {targetNetwork === 'avalanche_fuji' ? 'Confirming...' : 'Avalanche Fuji'}
        </button>

        <button
          onClick={() => handleSwitch('somnia_testnet')}
          disabled={!!targetNetwork || isSomnia}
          className={`flex-1 py-3 px-2 font-sans font-semibold text-xs md:text-sm transition-all duration-300 z-10 flex flex-row items-center justify-center gap-1.5 rounded-[12px] whitespace-nowrap min-w-[110px] ${isSomnia ? 'text-[#ffb01d] drop-shadow-md' : 'text-white/40 hover:text-white/60'
            }`}
        >
          {isSomnia && <div className="w-1.5 h-1.5 shrink-0 rounded-full bg-[#ffb01d] shadow-[0_0_8px_#ffb01d]" />}
          {targetNetwork === 'somnia_testnet' ? 'Confirming...' : 'Somnia Testnet'}
        </button>
      </div>
    </div>
  );
};
