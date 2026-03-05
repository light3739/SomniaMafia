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
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetwork>(ACTIVE_NETWORK);

  useEffect(() => {
    const saved = typeof window !== 'undefined'
      ? localStorage.getItem('mafia_selected_network') as SupportedNetwork | null
      : null;

    if (saved && (saved === 'avalanche_fuji' || saved === 'somnia_testnet')) {
      setSelectedNetwork(saved);
      return;
    }

    if (chainId === NETWORKS.avalanche_fuji.id) {
      setSelectedNetwork('avalanche_fuji');
    } else if (chainId === NETWORKS.somnia_testnet.id) {
      setSelectedNetwork('somnia_testnet');
    }
  }, [chainId]);

  const selectedChain = useMemo(() => NETWORKS[selectedNetwork], [selectedNetwork]);
  const isMismatch = chainId !== selectedChain.id;

  const handleChange = async (network: SupportedNetwork) => {
    setSelectedNetwork(network);
    localStorage.setItem('mafia_selected_network', network);
    try {
      await switchChainAsync({ chainId: NETWORKS[network].id });
    } catch {
    }
  };

  return (
    <div className={`flex items-center gap-2 rounded-full border border-white/10 bg-black/20 backdrop-blur-md shadow-lg transition-all hover:bg-black/30 hover:border-white/20 ${compact ? 'px-3 py-1' : 'px-4 py-2'}`}>
      <span className={`text-white/60 font-sans uppercase tracking-widest font-semibold ${compact ? 'text-[9px]' : 'text-[10px]'}`}>Network</span>
      <select
        value={selectedNetwork}
        onChange={(e) => handleChange(e.target.value as SupportedNetwork)}
        className={`bg-transparent text-white font-sans font-medium outline-none cursor-pointer appearance-none pr-4 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22rgba(255,255,255,0.7)%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-right ${compact ? 'text-xs' : 'text-sm'}`}
      >
        <option className="bg-[#1A1210] text-[#ffb01d] font-sans" value="avalanche_fuji">Avalanche Fuji</option>
        <option className="bg-[#1A1210] text-purple-300 font-sans" value="somnia_testnet">Somnia Testnet</option>
      </select>
      {isMismatch && (
        <button
          onClick={() => handleChange(selectedNetwork)}
          className="ml-2 px-3 py-1 text-[10px] font-sans uppercase font-bold tracking-wider rounded-full bg-[#8B2E2E]/80 hover:bg-[#8B2E2E] border border-red-500/30 text-white transition-all shadow-[0_0_15px_rgba(139,46,46,0.4)]"
        >
          Switch
        </button>
      )}
    </div>
  );
};
