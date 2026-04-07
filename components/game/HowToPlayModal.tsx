// components/game/HowToPlayModal.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Skull, Shield, Search, Users } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────
type TabKey = "roles" | "phases" | "voting" | "night";

interface RoleEntry {
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

// ─── Data ──────────────────────────────────────────────────────
const ROLES: RoleEntry[] = [
  {
    label: "MAFIA",
    icon: <Skull className="w-4 h-4" />,
    color: "#8B0000",
    description:
      "Eliminate all civilians. Vote by day, kill by night. Know your teammates.",
  },
  {
    label: "DOCTOR",
    icon: <Shield className="w-4 h-4" />,
    color: "#0D9488",
    description:
      "Choose one player to protect each night. If the mafia targets them, they survive.",
  },
  {
    label: "DETECTIVE",
    icon: <Search className="w-4 h-4" />,
    color: "#A85832",
    description:
      "Investigate one player each night to learn if they are Mafia or Innocent.",
  },
  {
    label: "CIVILIAN",
    icon: <Users className="w-4 h-4" />,
    color: "#6B5A4A",
    description:
      "Find and vote out the mafia during the day. Use discussion clues to survive.",
  },
];

const PHASES = [
  {
    title: "Discussion",
    text: "Players take turns speaking. Listen for clues about who might be Mafia.",
  },
  {
    title: "Voting",
    text: "Vote for who you think is Mafia. Majority vote eliminates a player.",
  },
  {
    title: "Night",
    text: "Mafia picks a target. Doctor protects. Detective investigates. Civilians sleep.",
  },
  {
    title: "Results",
    text: "Morning reveals who was killed (if anyone). A new day begins.",
  },
];

const VOTING_RULES = [
  "Select a player on the board to vote for them.",
  "You need a majority (>50% of alive players) to eliminate.",
  "If no majority is reached, no one is eliminated.",
  "A 60-second timer counts down. Auto-vote for yourself if time runs out.",
];

const NIGHT_ACTIONS = [
  "Your role determines your night action.",
  "Mafia: Select a player to eliminate. All mafia must agree.",
  "Doctor: Select a player to protect (can protect yourself).",
  "Detective: Select a player to investigate. Their alignment is revealed.",
];

const TABS: { key: TabKey; label: string }[] = [
  { key: "roles", label: "Roles" },
  { key: "phases", label: "Phases" },
  { key: "voting", label: "Voting" },
  { key: "night", label: "Night Actions" },
];

// ─── Overlay animation ────────────────────────────────────────
// Pure fade — no scaling — to keep the panel at a stable size
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// ─── Tab Content Renderers ─────────────────────────────────────
const RolesTab: React.FC = () => (
  <div className="space-y-3">
    {ROLES.map((role) => (
      <div
        key={role.label}
        className="flex items-start gap-3 rounded-sm px-3 py-2.5"
        style={{
          backgroundColor: `${role.color}08`,
          border: `1px solid ${role.color}20`,
        }}
      >
        <div
          className="shrink-0 mt-0.5 flex items-center justify-center w-7 h-7 rounded-full"
          style={{ backgroundColor: `${role.color}18`, color: role.color }}
        >
          {role.icon}
        </div>
        <div className="min-w-0">
          <p
            className="text-[11px] font-bold tracking-widest uppercase"
            style={{ color: role.color }}
          >
            {role.label}
          </p>
          <p className="text-white/70 text-[12px] leading-relaxed mt-0.5">
            {role.description}
          </p>
        </div>
      </div>
    ))}
  </div>
);

const PhasesTab: React.FC = () => (
  <div className="space-y-3">
    {PHASES.map((phase, i) => (
      <div key={phase.title} className="flex items-start gap-3">
        <span className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-[#916A47]/15 text-[#916A47] text-[11px] font-bold mt-0.5">
          {i + 1}
        </span>
        <div>
          <p className="text-white/90 text-[13px] font-semibold">
            {phase.title}
          </p>
          <p className="text-white/70 text-[12px] leading-relaxed mt-0.5">
            {phase.text}
          </p>
        </div>
      </div>
    ))}
  </div>
);

const BulletList: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="space-y-2.5">
    {items.map((item, i) => (
      <li key={i} className="flex items-start gap-2.5">
        <span className="shrink-0 mt-[7px] w-1.5 h-1.5 rounded-full bg-[#916A47]/60" />
        <p className="text-white/70 text-[12px] leading-relaxed">{item}</p>
      </li>
    ))}
  </ul>
);

// ─── Main Component ────────────────────────────────────────────
const HowToPlayModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("roles");

  // Listen for the custom DOM event
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("open-how-to-play", handler);
    return () => window.removeEventListener("open-how-to-play", handler);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="htp-overlay"
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.2 }}
          onClick={close}
        >
          <motion.div
            className="relative w-[92vw] max-w-[520px] max-h-[85vh] flex flex-col bg-[#0D0D0D] border border-[#916A47]/25 rounded-sm shadow-2xl font-['Montserrat']"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ──────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2
                className="text-[18px] font-bold tracking-wide"
                style={{ color: "#916A47" }}
              >
                How to Play
              </h2>
              <button
                onClick={close}
                className="w-10 h-10 flex items-center justify-center rounded-sm text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── Tabs ────────────────────────────────────────── */}
            <div className="flex gap-1 px-5 pb-3 border-b border-white/5">
              {TABS.map((tab) => {
                const isActive = tab.key === activeTab;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`
                      px-3 py-1.5 text-[10px] uppercase tracking-widest rounded-sm transition-colors
                      ${
                        isActive
                          ? "bg-[#916A47]/15 text-[#C49A6C]"
                          : "text-white/35 hover:text-white/60 hover:bg-white/5"
                      }
                    `}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* ── Tab content ─────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {activeTab === "roles" && <RolesTab />}
                  {activeTab === "phases" && <PhasesTab />}
                  {activeTab === "voting" && <BulletList items={VOTING_RULES} />}
                  {activeTab === "night" && (
                    <BulletList items={NIGHT_ACTIONS} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HowToPlayModal;
