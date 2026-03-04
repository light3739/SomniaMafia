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
    <div className={`flex items-center gap-2 bg-black/40 border border-white/15 rounded-xl ${compact ? 'px-2 py-1' : 'px-3 py-2'}`}>
      <span className={`text-white/70 uppercase tracking-wider ${compact ? 'text-[10px]' : 'text-xs'}`}>Network</span>
      <select
        value={selectedNetwork}
        onChange={(e) => handleChange(e.target.value as SupportedNetwork)}
        className={`bg-transparent text-white outline-none ${compact ? 'text-xs' : 'text-sm'}`}
      >
        <option className="text-black" value="avalanche_fuji">Avalanche Fuji</option>
        <option className="text-black" value="somnia_testnet">Somnia Testnet</option>
      </select>
      {isMismatch && (
        <button
          onClick={() => handleChange(selectedNetwork)}
          className="ml-1 px-2 py-1 text-[10px] rounded-md bg-orange-600 text-white"
        >
          switch
        </button>
      )}
    </div>
  );
};
