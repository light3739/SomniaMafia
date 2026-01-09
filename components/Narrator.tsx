import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Activity } from 'lucide-react';
import { LogEntry } from '../types';

interface SystemLogProps {
  logs: LogEntry[];
}

export const SystemLog: React.FC<SystemLogProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogStyle = (type: LogEntry['type']) => {
    switch (type) {
      case 'danger': return 'text-red-400 border-l-2 border-red-500 pl-2';
      case 'success': return 'text-green-400 border-l-2 border-green-500 pl-2';
      case 'warning': return 'text-amber-400 border-l-2 border-amber-500 pl-2';
      case 'phase': return 'text-purple-300 font-bold border-l-2 border-purple-500 pl-2 mt-2 pt-2 border-t border-t-white/10';
      default: return 'text-gray-300';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-6 relative z-10">
      <div className="absolute -inset-0.5 bg-gradient-to-b from-gray-800 to-black rounded-lg opacity-50"></div>
      
      <div className="relative bg-[#090909] border border-white/10 rounded-lg overflow-hidden shadow-2xl flex flex-col h-[200px]">
        
        {/* Header */}
        <div className="bg-[#111] px-4 py-2 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-green-500" />
            <span className="text-xs font-mono text-green-500 uppercase tracking-widest">System Log</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
          </div>
        </div>

        {/* Log Area */}
        <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-2 scroll-smooth"
        >
          <AnimatePresence initial={false}>
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex gap-3 ${getLogStyle(log.type)}`}
              >
                <span className="opacity-40 select-none">[{log.timestamp}]</span>
                <span>{log.message}</span>
              </motion.div>
            ))}
            {logs.length === 0 && (
                <div className="text-gray-600 italic">Waiting for connection...</div>
            )}
          </AnimatePresence>
        </div>

        {/* Scanline Effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10 pointer-events-none" style={{ backgroundSize: '100% 4px' }}></div>
      </div>
    </div>
  );
};