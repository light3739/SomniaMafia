import React from 'react';
import { GamePhase, Role } from '../types';
import { Moon, Sun, Vote } from 'lucide-react';

interface GameControlsProps {
  phase: GamePhase;
  myRole: Role | null;
  dayCount: number;
  onNextPhase: () => void; // Dev tool / Admin simulation
}

export const GameControls: React.FC<GameControlsProps> = ({ phase, myRole, dayCount, onNextPhase }) => {
  
  const getPhaseDisplay = () => {
    switch (phase) {
      case GamePhase.NIGHT:
        return { icon: <Moon className="w-6 h-6 text-indigo-400" />, text: "Night Phase", sub: "Mafia is working..." };
      case GamePhase.DAY:
        return { icon: <Sun className="w-6 h-6 text-amber-400" />, text: "Day Phase", sub: "Discuss events" };
      case GamePhase.VOTING:
        return { icon: <Vote className="w-6 h-6 text-red-400" />, text: "Voting", sub: "Cast your judgment" };
      default:
        return { icon: null, text: phase, sub: "" };
    }
  };

  const display = getPhaseDisplay();

  return (
    <div className="flex flex-col md:flex-row items-center justify-between bg-[#111] p-4 rounded-b-xl border-t border-white/10">
      
      <div className="flex items-center gap-4 mb-4 md:mb-0">
        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
          {display.icon}
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{display.text} <span className="text-gray-500 text-sm ml-2">Day {dayCount}</span></h2>
          <p className="text-gray-400 text-sm">{display.sub}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {myRole && (
          <div className="text-right mr-4 hidden md:block">
            <div className="text-xs text-gray-500 uppercase tracking-widest">Your Role</div>
            <div className={`font-bold ${myRole === Role.MAFIA ? 'text-red-400' : 'text-blue-400'}`}>{myRole}</div>
          </div>
        )}
        
        {/* Mock Control for Simulation - In Web3 this would be automated by block time or admin */}
        <button 
            onClick={onNextPhase}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium text-sm transition-colors"
        >
            Simulate Next Phase
        </button>
      </div>
    </div>
  );
};