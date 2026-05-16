'use client';

import React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useSwitchChain } from 'wagmi';
import { Wallet, ChevronDown, User, Lock } from 'lucide-react';
import { SOMNIA_TESTNET, SOMNIA_MAINNET } from '../../contracts/config';
import { useGameContext } from '../../contexts/GameContext';

interface NetworkSelectorProps {
  compact?: boolean;
  showWallet?: boolean;
}

const CHAINS = [
  { chain: SOMNIA_TESTNET, label: 'Testnet' },
  { chain: SOMNIA_MAINNET, label: 'Mainnet' },
];

/**
 * NetworkSelector — pill toggle between Somnia Testnet and Mainnet.
 * Calls wagmi switchChain so Privy embedded + external wallets both follow.
 * Locked while the user is inside an active room (currentRoomId != null) —
 * mid-game swap would invalidate the session key and break game state.
 */
export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  compact = false,
  showWallet = false,
}) => {
  const { login, authenticated, user, logout } = usePrivy();
  const { chainId } = useAccount();
  const { switchChain, isPending, variables } = useSwitchChain();
  const { currentRoomId } = useGameContext();

  const inRoom = currentRoomId != null;
  const activeId = chainId ?? SOMNIA_TESTNET.id;

  const handleSwitch = (targetId: number) => {
    if (inRoom || targetId === activeId) return;
    switchChain({ chainId: targetId });
  };

  return (
    <div
      className={`flex items-center justify-center ${(compact || !showWallet) ? 'w-fit' : 'w-full max-w-[500px] mb-2'}`}
    >
      <div
        className="relative flex items-center p-1 bg-[rgba(15,10,5,0.85)] backdrop-blur-xl border border-white/10 rounded-[20px] shadow-2xl overflow-hidden"
        title={inRoom ? 'Network locked while in room' : undefined}
      >
        {/* Two-chain pill toggle */}
        <div className="relative flex p-0.5 shrink-0 gap-0.5">
          {CHAINS.map(({ chain, label }) => {
            const isActive = chain.id === activeId;
            const pending = isPending && variables?.chainId === chain.id;
            return (
              <button
                key={chain.id}
                onClick={() => handleSwitch(chain.id)}
                disabled={inRoom || pending}
                className={[
                  'relative py-2.5 px-3 md:px-4 font-sans font-bold text-[11px] md:text-xs z-10',
                  'flex items-center justify-center gap-2 rounded-[14px] whitespace-nowrap',
                  'min-w-[88px] md:min-w-[104px] transition-all',
                  isActive
                    ? 'text-[#ffb01d] drop-shadow-md bg-[#4A3222] border border-white/5'
                    : 'text-white/50 hover:text-white/80 border border-transparent',
                  (inRoom || pending) ? 'cursor-not-allowed' : 'cursor-pointer',
                  pending ? 'opacity-60' : '',
                ].join(' ')}
              >
                {inRoom && isActive ? (
                  <Lock className="w-3 h-3 shrink-0 text-[#ffb01d]" />
                ) : (
                  <div
                    className={`w-1.5 h-1.5 shrink-0 rounded-full ${isActive ? 'bg-[#ffb01d] shadow-[0_0_8px_#ffb01d]' : 'bg-white/30'}`}
                  />
                )}
                {label}
              </button>
            );
          })}
        </div>

        {/* Optional Wallet Section */}
        {showWallet && (
          <>
            <div className="w-[1px] h-6 bg-white/10 mx-1 shrink-0" />
            {!authenticated ? (
              <button
                onClick={() => login()}
                className="py-2.5 px-4 text-[11px] md:text-xs font-bold text-[#ffb01d] hover:text-white transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Wallet className="w-3.5 h-3.5" />
                Connect
              </button>
            ) : (
              <button
                onClick={() => logout()}
                className="py-1 px-2.5 md:py-1.5 md:px-3 flex items-center gap-2 hover:bg-white/5 rounded-[14px] transition-all group"
                title="Click to logout"
              >
                <div className="w-6 h-6 rounded-full bg-[#ffb01d]/10 border border-[#ffb01d]/30 flex items-center justify-center overflow-hidden">
                  <User className="w-3.5 h-3.5 text-[#ffb01d]" />
                </div>
                <span className="text-[11px] md:text-xs font-bold text-white/80 group-hover:text-white transition-colors hidden sm:block">
                  {user?.wallet?.address ? `${user.wallet.address.slice(0, 4)}...${user.wallet.address.slice(-4)}` : 'Connected'}
                </span>
                <ChevronDown className="w-3 h-3 text-white/50 group-hover:text-white/70 transition-colors" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
