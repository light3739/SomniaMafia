"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    BrainCircuit,
    ChevronDown,
    MessageSquare,
    Search,
    ShieldCheck,
    Skull,
    Users,
    Vote,
} from "lucide-react";
import { keccak256, parseAbi, parseAbiItem, toHex } from "viem";
import { useGameContext } from "../../contexts/GameContext";
import { Role, type LogEntry, type Player } from "../../types";

const AGENT_REGISTRY_READ_ABI = parseAbi([
    "function isAgent(uint256 roomId, address player) view returns (bool)",
]);

const AGENT_INFERENCE_EVENT = parseAbiItem(
    "event AgentInferenceCommitted(uint256 indexed roomId, bytes32 indexed phaseId, address indexed agent, bytes32 actionHash, bytes32 traceCommitment)"
);

const AGENT_MESSAGE_EVENT = parseAbiItem(
    "event AgentMessageCommittedV2(uint256 indexed roomId, bytes32 indexed phaseId, address indexed agent, bytes32 messageHash)"
);

const AGENT_REVEAL_EVENT = parseAbiItem(
    "event AgentInferenceRevealed(uint256 indexed roomId, bytes32 indexed phaseId, address indexed agent, uint256 somniaRequestId, bytes32 promptHash, bytes32 responseHash, bytes32 actionHash)"
);

type InferenceType = "inferChat" | "inferString" | "inferToolsChat" | "unknown";

interface AuditEntry {
    kind: "message" | "inference";
    phaseId: string;
    phaseLabel: string;
    inferenceType: InferenceType;
    txHash: string;
    actionHash?: string;
    revealed?: boolean;
}

type AuditByAgent = Record<string, AuditEntry[]>;

interface VoteEvent {
    day: number;
    target: string;
}

interface AgentSummary {
    player: Player;
    won: boolean;
    publicLines: number;
    inferenceCommits: number;
    messageCommits: number;
    auditEntries: AuditEntry[];
    votesCast: VoteEvent[];
    votesReceived: number;
    eliminatedByVoteDay: number | null;
    killedAtNightDay: number | null;
    timeline: string[];
}

const compactAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const shortAddressVariants = (addr: string) => [
    `${addr.slice(0, 6)}...${addr.slice(-4)}`.toLowerCase(),
    `${addr.slice(0, 6)}…${addr.slice(-4)}`.toLowerCase(),
];

const looksLikeAgentName = (name: string) => /^agent\s*#\d+/i.test(name.trim());

const toDayNumber = (log: LogEntry, fallback: number) => {
    const eventDay = Number(log.eventData?.dayNumber);
    if (Number.isFinite(eventDay) && eventDay > 0) return eventDay;
    const match = log.message.match(/Day\s+(\d+)\s+has begun/i);
    return match ? Number(match[1]) : fallback;
};

const logTime = (log: LogEntry) => {
    const raw = log.timestamp as unknown;
    if (typeof raw === "number") return raw;
    const parsed = Date.parse(String(raw));
    return Number.isFinite(parsed) ? parsed : 0;
};

function didPlayerWin(player: Player, winner: string | null) {
    if (winner === "MAFIA") return player.role === Role.MAFIA;
    if (winner === "TOWN") return player.role !== Role.MAFIA && player.role !== Role.UNKNOWN;
    if (winner === "DRAW") return player.isAlive;
    return false;
}

function resolveName(players: Player[], addr?: string | null, fallback?: string | null) {
    if (addr) {
        const match = players.find((p) => p.address.toLowerCase() === addr.toLowerCase());
        if (match?.name) return match.name;
    }
    return fallback || (addr ? compactAddress(addr) : "Unknown");
}

function resolveAddressByName(players: Player[], name?: string | null) {
    if (!name) return null;
    const normalized = name.trim().toLowerCase();
    const match = players.find((p) => p.name.trim().toLowerCase() === normalized);
    return match?.address ?? null;
}

function samePlayerByAddressOrName(player: Player, addr?: string | null, name?: string | null) {
    if (addr && player.address.toLowerCase() === addr.toLowerCase()) return true;
    if (name && player.name.trim().toLowerCase() === name.trim().toLowerCase()) return true;
    return false;
}

function makePhaseLookup(dayCount: number) {
    const map = new Map<string, { label: string; inferenceType: InferenceType }>();
    const days = Math.max(1, dayCount || 1);
    for (let day = 1; day <= days; day++) {
        map.set(keccak256(toHex(`D${day}-DAY`)).toLowerCase(), {
            label: `Day ${day} discussion`,
            inferenceType: "inferChat",
        });
        map.set(keccak256(toHex(`D${day}-VOTING`)).toLowerCase(), {
            label: `Day ${day} vote`,
            inferenceType: "inferString",
        });
        map.set(keccak256(toHex(`D${day}-NIGHT`)).toLowerCase(), {
            label: `Night ${day} action`,
            inferenceType: "inferToolsChat",
        });
    }
    return map;
}

async function fetchAgentAuditEntries(args: {
    publicClient: any;
    contractAddress: `0x${string}`;
    roomId: bigint;
    dayCount: number;
}): Promise<AuditByAgent> {
    const byAgent: AuditByAgent = {};
    const phaseLookup = makePhaseLookup(args.dayCount);
    const addEntry = (addr: string, entry: AuditEntry) => {
        const key = addr.toLowerCase();
        byAgent[key] ??= [];
        byAgent[key].push(entry);
    };

    const currentBlock = await args.publicClient.getBlockNumber();
    const inferenceLogs: any[] = [];
    const messageLogs: any[] = [];
    const revealLogs: any[] = [];

    for (let offset = 0n; offset < 30000n; offset += 900n) {
        const toBlock = currentBlock > offset ? currentBlock - offset : 0n;
        const fromBlock = toBlock > 900n ? toBlock - 900n : 0n;

        const [inferChunk, messageChunk, revealChunk] = await Promise.all([
            args.publicClient.getLogs({
                address: args.contractAddress,
                event: AGENT_INFERENCE_EVENT,
                args: { roomId: args.roomId },
                fromBlock,
                toBlock,
            }),
            args.publicClient.getLogs({
                address: args.contractAddress,
                event: AGENT_MESSAGE_EVENT,
                args: { roomId: args.roomId },
                fromBlock,
                toBlock,
            }),
            args.publicClient.getLogs({
                address: args.contractAddress,
                event: AGENT_REVEAL_EVENT,
                args: { roomId: args.roomId },
                fromBlock,
                toBlock,
            }),
        ]);

        inferenceLogs.push(...inferChunk);
        messageLogs.push(...messageChunk);
        revealLogs.push(...revealChunk);

        if (toBlock === 0n) break;
    }

    const revealKeys = new Set(
        revealLogs.map((log) => {
            const a = log.args?.agent?.toLowerCase?.() ?? "";
            const p = String(log.args?.phaseId ?? "").toLowerCase();
            const action = String(log.args?.actionHash ?? "").toLowerCase();
            return `${a}:${p}:${action}`;
        })
    );

    for (const log of inferenceLogs) {
        const agent = log.args?.agent;
        const phaseId = String(log.args?.phaseId ?? "").toLowerCase();
        const actionHash = String(log.args?.actionHash ?? "").toLowerCase();
        if (!agent || !phaseId) continue;
        const phase = phaseLookup.get(phaseId) ?? { label: "Unknown phase", inferenceType: "unknown" as InferenceType };
        addEntry(agent, {
            kind: "inference",
            phaseId,
            phaseLabel: phase.label,
            inferenceType: phase.inferenceType,
            txHash: String(log.transactionHash ?? ""),
            actionHash,
            revealed: revealKeys.has(`${agent.toLowerCase()}:${phaseId}:${actionHash}`),
        });
    }

    for (const log of messageLogs) {
        const agent = log.args?.agent;
        const phaseId = String(log.args?.phaseId ?? "").toLowerCase();
        if (!agent || !phaseId) continue;
        const phase = phaseLookup.get(phaseId) ?? { label: "Unknown phase", inferenceType: "inferChat" as InferenceType };
        addEntry(agent, {
            kind: "message",
            phaseId,
            phaseLabel: phase.label,
            inferenceType: "inferChat",
            txHash: String(log.transactionHash ?? ""),
        });
    }

    for (const entries of Object.values(byAgent)) {
        entries.sort((a, b) => a.phaseLabel.localeCompare(b.phaseLabel));
    }

    return byAgent;
}

function buildAgentSummaries(args: {
    agents: Player[];
    players: Player[];
    logs: LogEntry[];
    auditByAgent: AuditByAgent;
    winner: string | null;
}): AgentSummary[] {
    const byAddress = new Map(args.agents.map((p) => [p.address.toLowerCase(), p]));
    const data = new Map<string, AgentSummary>();

    const ensure = (player: Player) => {
        const key = player.address.toLowerCase();
        const auditEntries = args.auditByAgent[key] ?? [];
        if (!data.has(key)) {
            data.set(key, {
                player,
                won: didPlayerWin(player, args.winner),
                publicLines: 0,
                inferenceCommits: auditEntries.filter((entry) => entry.kind === "inference").length,
                messageCommits: auditEntries.filter((entry) => entry.kind === "message").length,
                auditEntries,
                votesCast: [],
                votesReceived: 0,
                eliminatedByVoteDay: null,
                killedAtNightDay: null,
                timeline: [],
            });
        }
        return data.get(key)!;
    };

    args.agents.forEach(ensure);

    let currentDay = 1;
    const logs = [...args.logs].sort((a, b) => logTime(a) - logTime(b));

    for (const log of logs) {
        if (
            log.eventType === "DayStarted" ||
            log.eventType === "DAY_STARTED" ||
            /Day\s+\d+\s+has begun/i.test(log.message)
        ) {
            currentDay = toDayNumber(log, currentDay);
        }

        const day = currentDay || 1;

        if (String(log.id ?? "").startsWith("agentchat-")) {
            const message = log.message.toLowerCase();
            const matched = args.agents.find((agent) =>
                shortAddressVariants(agent.address).some((variant) => message.includes(variant))
            );
            if (matched) {
                const summary = ensure(matched);
                summary.publicLines += 1;
                const line = `Day ${day}: spoke in discussion`;
                if (!summary.timeline.includes(line)) summary.timeline.push(line);
            }
        }

        if (log.eventType === "PLAYER_VOTED" || log.eventType === "VoteCast") {
            const voterAddress =
                log.eventData?.voterAddress ||
                resolveAddressByName(args.players, log.eventData?.playerName || null);
            const targetAddress =
                log.eventData?.targetAddress ||
                resolveAddressByName(args.players, log.eventData?.targetName || null);
            const voter = voterAddress ? byAddress.get(voterAddress.toLowerCase()) : null;
            const target = targetAddress ? byAddress.get(targetAddress.toLowerCase()) : null;

            if (voter) {
                const targetName = resolveName(args.players, targetAddress, log.eventData?.targetName);
                const summary = ensure(voter);
                summary.votesCast.push({ day, target: targetName });
                summary.timeline.push(`Day ${day}: voted ${targetName}`);
            }
            if (target) {
                ensure(target).votesReceived += 1;
            }
        }

        if (log.eventType === "VOTING_RESULT" || log.eventType === "VotingFinalized") {
            if (!log.eventData?.isEliminated) continue;
            for (const agent of args.agents) {
                if (samePlayerByAddressOrName(agent, log.eventData?.playerAddress, log.eventData?.playerName)) {
                    const summary = ensure(agent);
                    summary.eliminatedByVoteDay = day;
                    summary.timeline.push(`Day ${day}: eliminated by vote`);
                }
            }
        }

        if (log.eventType === "NIGHT_RESULT" || log.eventType === "NightFinalized") {
            if (!log.eventData?.isEliminated) continue;
            for (const agent of args.agents) {
                if (samePlayerByAddressOrName(agent, log.eventData?.playerAddress, log.eventData?.playerName)) {
                    const summary = ensure(agent);
                    summary.killedAtNightDay = day;
                    summary.timeline.push(`Night ${Math.max(1, day - 1)}: killed by Mafia`);
                }
            }
        }
    }

    return [...data.values()].sort((a, b) => a.player.name.localeCompare(b.player.name));
}

const shortHash = (hash?: string) => hash && hash.length > 10
    ? `${hash.slice(0, 6)}...${hash.slice(-4)}`
    : hash || "pending";

const inferenceLabel = (type: InferenceType) => {
    if (type === "inferChat") return "inferChat";
    if (type === "inferString") return "inferString";
    if (type === "inferToolsChat") return "inferToolsChat";
    return "inference";
};

const countLabel = (count: number, singular: string, plural = `${singular}s`) =>
    `${count} ${count === 1 ? singular : plural}`;

function decisionSignal(summary: AgentSummary) {
    const latestVote = summary.votesCast[summary.votesCast.length - 1];
    if (latestVote) {
        return `Public decision: voted ${latestVote.target} on Day ${latestVote.day}`;
    }
    if (summary.timeline.some((item) => item.toLowerCase().includes("spoke"))) {
        return "Public decision: contributed to discussion";
    }
    return "Public decision: no visible action captured";
}

export const AgentReport: React.FC = React.memo(() => {
    const { gameState, currentRoomId, publicClient, runtimeContractAddress } = useGameContext();
    const [isOpen, setIsOpen] = useState(true);
    const [agentFlags, setAgentFlags] = useState<Record<string, boolean>>({});
    const [flagsLoaded, setFlagsLoaded] = useState(false);
    const [auditByAgent, setAuditByAgent] = useState<AuditByAgent>({});
    const [auditLoading, setAuditLoading] = useState(false);
    const [openTraces, setOpenTraces] = useState<Record<string, boolean>>({});

    useEffect(() => {
        let cancelled = false;
        setFlagsLoaded(false);

        const load = async () => {
            if (!publicClient || !currentRoomId || gameState.players.length === 0) {
                if (!cancelled) {
                    setAgentFlags({});
                    setFlagsLoaded(true);
                }
                return;
            }

            const entries = await Promise.all(
                gameState.players.map(async (player) => {
                    try {
                        const isAgent = await publicClient.readContract({
                            address: runtimeContractAddress,
                            abi: AGENT_REGISTRY_READ_ABI,
                            functionName: "isAgent",
                            args: [currentRoomId, player.address],
                        });
                        return [player.address.toLowerCase(), Boolean(isAgent)] as const;
                    } catch {
                        return [player.address.toLowerCase(), looksLikeAgentName(player.name)] as const;
                    }
                })
            );

            if (!cancelled) {
                setAgentFlags(Object.fromEntries(entries));
                setFlagsLoaded(true);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [currentRoomId, gameState.players, publicClient, runtimeContractAddress]);

    useEffect(() => {
        let cancelled = false;
        setAuditByAgent({});

        const load = async () => {
            if (!publicClient || !currentRoomId || !runtimeContractAddress) return;
            setAuditLoading(true);
            try {
                const entries = await fetchAgentAuditEntries({
                    publicClient,
                    contractAddress: runtimeContractAddress,
                    roomId: currentRoomId,
                    dayCount: gameState.dayCount,
                });
                if (!cancelled) setAuditByAgent(entries);
            } catch (err) {
                console.warn("[AgentReport] Failed to fetch agent audit counts:", err);
            } finally {
                if (!cancelled) setAuditLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [currentRoomId, gameState.dayCount, publicClient, runtimeContractAddress]);

    const agents = useMemo(() => {
        return gameState.players.filter((player) => {
            const key = player.address.toLowerCase();
            return agentFlags[key] || (!flagsLoaded && looksLikeAgentName(player.name));
        });
    }, [agentFlags, flagsLoaded, gameState.players]);

    const summaries = useMemo(
        () =>
            buildAgentSummaries({
                agents,
                players: gameState.players,
                logs: gameState.logs,
                auditByAgent,
                winner: gameState.winner,
            }),
        [agents, auditByAgent, gameState.logs, gameState.players, gameState.winner]
    );

    const totals = useMemo(
        () => ({
            lines: summaries.reduce((sum, item) => sum + Math.max(item.publicLines, item.messageCommits), 0),
            votes: summaries.reduce((sum, item) => sum + item.votesCast.length, 0),
            commits: summaries.reduce(
                (sum, item) => sum + item.inferenceCommits + item.messageCommits,
                0
            ),
            winners: summaries.filter((item) => item.won).length,
        }),
        [summaries]
    );

    if (summaries.length === 0) {
        if (!flagsLoaded) {
            return (
                <div className="w-full rounded-md border border-white/10 bg-black/20 px-4 py-3">
                    <div className="flex items-center justify-center gap-2 text-white/45 text-[11px] font-['Montserrat'] uppercase tracking-[0.14em]">
                        <BrainCircuit className="w-4 h-4" />
                        Loading Agent Report
                    </div>
                </div>
            );
        }
        return null;
    }

    return (
        <div className="w-full rounded-md border border-[#C5A059]/25 bg-[#050505]/72 overflow-hidden">
            <button
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-4 px-4 py-3 bg-[#0A0908] hover:bg-[#120E08] transition-colors"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-md border border-[#C5A059]/25 bg-[#C5A059]/10 flex items-center justify-center shrink-0">
                        <BrainCircuit className="w-4 h-4 text-[#C5A059]" />
                    </span>
                    <div className="min-w-0 text-left">
                        <p className="text-[#C5A059] text-[12px] font-['Montserrat'] font-bold uppercase tracking-[0.16em]">
                            Agent Report
                        </p>
                        <p className="text-white/45 text-[10px] font-mono uppercase tracking-[0.12em] truncate">
                            Post-game autonomous action audit
                            {auditLoading ? " / syncing" : ""}
                        </p>
                    </div>
                </div>
                <span className="hidden sm:inline-flex text-white/38 text-[10px] font-mono uppercase tracking-[0.12em] whitespace-nowrap">
                    {summaries.length} agents / {totals.commits} commits
                </span>
                <ChevronDown
                    className={`w-4 h-4 text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="overflow-hidden"
                    >
                        <div className="border-y border-white/5 px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <SummaryPill icon={<Users className="w-3.5 h-3.5" />} label="Agents" value={summaries.length} />
                                <SummaryPill icon={<MessageSquare className="w-3.5 h-3.5" />} label="Lines" value={totals.lines} />
                                <SummaryPill icon={<Vote className="w-3.5 h-3.5" />} label="Votes" value={totals.votes} />
                                <SummaryPill icon={<BrainCircuit className="w-3.5 h-3.5" />} label="Commits" value={totals.commits} />
                                <SummaryPill icon={<ShieldCheck className="w-3.5 h-3.5" />} label="Won" value={totals.winners} />
                            </div>
                        </div>

                        <div className="max-h-[360px] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                            {summaries.map((summary) => {
                                const player = summary.player;
                                const visibleLines = Math.max(summary.publicLines, summary.messageCommits);
                                const commits = summary.inferenceCommits + summary.messageCommits;
                                const playerKey = player.address.toLowerCase();
                                const traceOpen = !!openTraces[playerKey];
                                const statusText = summary.won ? "Winner" : player.isAlive ? "Survived" : "Eliminated";
                                const statusColor = summary.won
                                    ? "text-[#4caf82]"
                                    : player.isAlive
                                      ? "text-white/60"
                                      : "text-[#B33A3A]";
                                const timeline = summary.timeline.length > 0
                                    ? summary.timeline.slice(0, 2)
                                    : ["No public actions captured"];

                                return (
                                    <div key={player.address} className="px-4 py-3.5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                                    <p className="text-white/90 text-sm font-['Montserrat'] font-bold truncate">
                                                        {player.name}
                                                    </p>
                                                    <span className="rounded-sm border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.1em] text-white/48">
                                                        {player.role}
                                                    </span>
                                                    <span className={`text-[9px] font-mono uppercase tracking-[0.1em] ${statusColor}`}>
                                                        {statusText}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-[10px] font-mono text-white/28">{compactAddress(player.address)}</p>
                                            </div>
                                            {!player.isAlive && <Skull className="w-4 h-4 text-[#8B0000] shrink-0 mt-1" />}
                                        </div>

                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono uppercase tracking-[0.1em] text-white/45">
                                            <span>{countLabel(visibleLines, "line")}</span>
                                            <span>{countLabel(summary.votesCast.length, "vote")}</span>
                                            <span>{countLabel(commits, "commit")}</span>
                                            {summary.votesReceived > 0 && <span>{countLabel(summary.votesReceived, "vote")} received</span>}
                                        </div>

                                        <div className="mt-2 flex flex-col gap-1">
                                            {timeline.map((item, idx) => (
                                                <div
                                                    key={`${player.address}-${idx}-${item}`}
                                                    className="flex items-start gap-2 text-[11px] text-white/58 font-['Montserrat'] leading-snug"
                                                >
                                                    <span className="mt-[0.42em] w-1 h-1 rounded-full bg-[#C5A059]/70 shrink-0" />
                                                    <span>{item}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setOpenTraces((prev) => ({ ...prev, [playerKey]: !prev[playerKey] }))}
                                            className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-[#C5A059]/70 hover:text-[#C5A059] transition-colors"
                                        >
                                            Autonomy Trace
                                            <ChevronDown className={`w-3 h-3 transition-transform ${traceOpen ? "rotate-180" : ""}`} />
                                        </button>

                                        <AnimatePresence initial={false}>
                                            {traceOpen && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.18, ease: "easeOut" }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="mt-2 rounded-sm border border-white/7 bg-black/20 px-3 py-2.5">
                                                        <div className="flex items-start gap-2 text-[11px] text-white/60 font-['Montserrat'] leading-snug">
                                                            <Search className="w-3.5 h-3.5 text-[#C5A059]/70 shrink-0 mt-0.5" />
                                                            <span>{decisionSignal(summary)}</span>
                                                        </div>
                                                        <div className="mt-1.5 text-[10px] text-white/32 font-mono uppercase tracking-[0.1em]">
                                                            Reasoning is sealed by commitments; prompts and raw responses stay hidden in this UI.
                                                        </div>

                                                        <div className="mt-2 flex flex-col gap-1.5">
                                                            {summary.auditEntries.length > 0 ? summary.auditEntries.slice(0, 5).map((entry, idx) => (
                                                                <div
                                                                    key={`${entry.txHash}-${entry.phaseId}-${idx}`}
                                                                    className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono uppercase tracking-[0.08em]"
                                                                >
                                                                    <span className="text-white/55">{entry.phaseLabel}</span>
                                                                    <span className="text-[#C5A059]/80">{inferenceLabel(entry.inferenceType)}</span>
                                                                    <span className="text-white/35">{entry.kind === "message" ? "message commit" : "action commit"}</span>
                                                                    <span className="text-white/28">tx {shortHash(entry.txHash)}</span>
                                                                    <span className={entry.revealed ? "text-[#4caf82]" : "text-white/34"}>
                                                                        {entry.kind === "message" ? "committed" : entry.revealed ? "verified" : "committed"}
                                                                    </span>
                                                                </div>
                                                            )) : (
                                                                <div className="text-[10px] text-white/35 font-mono uppercase tracking-[0.1em]">
                                                                    No on-chain agent commits found in the scanned window.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

AgentReport.displayName = "AgentReport";

const SummaryPill: React.FC<{ icon: React.ReactNode; label: string; value: number }> = ({ icon, label, value }) => (
    <div className="inline-flex items-center gap-2 rounded-sm border border-white/8 bg-white/[0.025] px-2.5 py-1.5">
        <span className="text-[#C5A059]/80 shrink-0">{icon}</span>
        <span className="text-white/86 text-[12px] font-mono tabular-nums leading-none">{value}</span>
        <span className="text-white/36 text-[9px] font-mono uppercase tracking-[0.12em] leading-none">{label}</span>
    </div>
);
