"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sun, Moon, Vote, Skull, Shield, Search, Users, HelpCircle } from 'lucide-react';
import { useGameContext } from '../../contexts/GameContext';
import { GamePhase, Role } from '../../types';

/* ── Phase config ─────────────────────────────────────────────── */

const PHASE_CONFIG: Record<
  GamePhase.DAY | GamePhase.VOTING | GamePhase.NIGHT,
  { icon: React.ReactNode; label: string }
> = {
  [GamePhase.DAY]:    { icon: <Sun   className="w-4 h-4" />, label: 'Day' },
  [GamePhase.VOTING]: { icon: <Vote  className="w-4 h-4" />, label: 'Voting' },
  [GamePhase.NIGHT]:  { icon: <Moon  className="w-4 h-4" />, label: 'Night' },
};

/* ── Role config ──────────────────────────────────────────────── */

const ROLE_COLOR: Record<Role, string> = {
  [Role.MAFIA]:     '#8B0000',
  [Role.DOCTOR]:    '#0D9488',
  [Role.DETECTIVE]: '#A85832',
  [Role.CIVILIAN]:  '#6B5A4A',
  [Role.UNKNOWN]:   '#6B5A4A',
};

const ROLE_ICON: Record<Role, React.ReactNode> = {
  [Role.MAFIA]:     <Skull   className="w-3.5 h-3.5" />,
  [Role.DOCTOR]:    <Shield  className="w-3.5 h-3.5" />,
  [Role.DETECTIVE]: <Search  className="w-3.5 h-3.5" />,
  [Role.CIVILIAN]:  <Users   className="w-3.5 h-3.5" />,
  [Role.UNKNOWN]:   <Users   className="w-3.5 h-3.5" />,
};

/* ── Timer hook ───────────────────────────────────────────────── */

function useCountdown(deadlineUnix: number) {
  const calcRemaining = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, deadlineUnix - now);
  }, [deadlineUnix]);

  const [remaining, setRemaining] = useState(calcRemaining);

  useEffect(() => {
    setRemaining(calcRemaining());
    const id = setInterval(() => setRemaining(calcRemaining()), 1000);
    return () => clearInterval(id);
  }, [calcRemaining]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return { remaining, display };
}

/* ── Visible phases ───────────────────────────────────────────── */

const VISIBLE_PHASES = new Set<GamePhase>([
  GamePhase.DAY,
  GamePhase.VOTING,
  GamePhase.NIGHT,
]);

/* ── Component ────────────────────────────────────────────────── */

export const GameHUD = React.memo(function GameHUD() {
  const { gameState, myPlayer } = useGameContext();
  const { remaining, display } = useCountdown(gameState.phaseDeadline);

  // Hidden during non-gameplay phases
  if (!VISIBLE_PHASES.has(gameState.phase)) return null;

  const phase = gameState.phase as GamePhase.DAY | GamePhase.VOTING | GamePhase.NIGHT;
  const phaseInfo = PHASE_CONFIG[phase];

  const aliveCount = gameState.players.filter((p) => p.isAlive).length;
  const totalCount = gameState.players.length;

  const role = myPlayer?.role ?? Role.UNKNOWN;
  const roleColor = ROLE_COLOR[role];
  const roleIcon = ROLE_ICON[role];
  const isAlive = myPlayer?.isAlive ?? false;

  const handleHowToPlay = () => {
    window.dispatchEvent(new CustomEvent('open-how-to-play'));
  };

  return (
    <div
      className="fixed top-0 inset-x-0 z-50 h-12 flex items-center justify-between px-4
                 bg-[#050505]/90 backdrop-blur-md border-b border-[#916A47]/20"
    >
      {/* ── Left: Phase + Day counter ────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[#916A47]">
          {phaseInfo.icon}
          <span className="font-[Cinzel] text-xs uppercase tracking-wide">
            {phaseInfo.label}
          </span>
        </div>

        <span className="text-white/30 text-xs font-[Montserrat]">
          Day {gameState.dayCount}
        </span>
      </div>

      {/* ── Center: Timer ────────────────────────── */}
      <div
        className={`
          font-[Montserrat] text-sm font-semibold tabular-nums tracking-wider
          ${remaining <= 10 ? 'text-red-500 animate-pulse' : 'text-white/80'}
        `}
      >
        {display}
      </div>

      {/* ── Right: Role badge + Alive count + Help ── */}
      <div className="flex items-center gap-3">
        {/* Role badge */}
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-[Montserrat] font-medium"
          style={{
            color: roleColor,
            borderColor: `${roleColor}40`,
            backgroundColor: `${roleColor}10`,
          }}
        >
          {roleIcon}
          <span className="uppercase tracking-wide">{role}</span>
          {!isAlive && (
            <span className="ml-1 text-white/30 line-through text-[10px]">DEAD</span>
          )}
        </div>

        {/* Alive count */}
        <div className="flex items-center gap-1 text-white/50 text-xs font-[Montserrat]">
          <Users className="w-3.5 h-3.5" />
          <span>
            {aliveCount}/{totalCount} alive
          </span>
        </div>

        {/* How to Play */}
        <button
          onClick={handleHowToPlay}
          className="p-1 rounded text-[#916A47]/60 hover:text-[#916A47] transition-colors"
          aria-label="How to Play"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});
