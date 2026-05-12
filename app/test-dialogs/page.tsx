"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useNoirDialog } from "@/contexts/NoirDialogContext";
import { JoinByIdModal } from "@/components/lobby_flow/JoinByIdModal";

export default function TestDialogsPage() {
    const { showAlert, showConfirm, showPrompt } = useNoirDialog();
    const [lastResult, setLastResult] = useState<string>("—");
    const [joinByIdOpen, setJoinByIdOpen] = useState(false);
    const [joinByIdLoading, setJoinByIdLoading] = useState(false);

    const setResult = (v: unknown) => setLastResult(String(v));

    // Every sample below is copied verbatim from a real call site in the
    // app — JoinLobby, useLobbyActions, SetupProfile, WaitingRoom. The
    // `source` field points to the file/line where each one fires so the
    // gallery doubles as a quick-jump index.
    const samples: {
        label: string;
        description: string;
        source: string;
        run: () => void;
    }[] = [
        // ── Alerts · default ─────────────────────────────────────────
        {
            label: "Alert · Room Not Found",
            description: "Triggers when Join-by-ID looks up a room that doesn't exist on chain.",
            source: "components/lobby_flow/JoinLobby.tsx",
            run: () =>
                showAlert("Room #1234 doesn't exist.", { title: "Room Not Found" })
                    .then(() => setResult("dismissed")),
        },
        {
            label: "Alert · Game In Progress",
            description: "Tried to join a room that has already started or ended.",
            source: "components/lobby_flow/JoinLobby.tsx",
            run: () =>
                showAlert("Room #1234 has already started or ended.", { title: "Game In Progress" })
                    .then(() => setResult("dismissed")),
        },
        {
            label: "Alert · Room Full",
            description: "Room has reached its max player count.",
            source: "components/lobby_flow/JoinLobby.tsx",
            run: () =>
                showAlert("Room #1234 is full.", { title: "Room Full" })
                    .then(() => setResult("dismissed")),
        },
        {
            label: "Alert · Private Room",
            description: "Joining a private room with no password supplied yet.",
            source: "hooks/game/useLobbyActions.ts",
            run: () =>
                showAlert("This room is private. Please enter the password.", { title: "Private Room" })
                    .then(() => setResult("dismissed")),
        },
        {
            label: "Alert · Invalid Code",
            description: "User typed a room ID the parser couldn't read.",
            source: "components/lobby_flow/JoinLobby.tsx",
            run: () =>
                showAlert("That room code isn't valid.", { title: "Invalid Code" })
                    .then(() => setResult("dismissed")),
        },
        {
            label: "Alert · Invalid Invite",
            description: "Auto-join from a shared invite link, but the link is malformed.",
            source: "components/lobby_flow/JoinLobby.tsx",
            run: () =>
                showAlert("That invite link isn't valid.", { title: "Invalid Invite" })
                    .then(() => setResult("dismissed")),
        },

        // ── Alerts · danger ──────────────────────────────────────────
        {
            label: "Alert · AFK Cooldown",
            description: "User was kicked for AFK earlier and is still in cooldown.",
            source: "hooks/game/useLobbyActions.ts",
            run: () =>
                showAlert(
                    "You were kicked for inactivity in a previous game. Access returns in 4m 12s.",
                    { variant: "danger", title: "AFK Cooldown" }
                ).then(() => setResult("dismissed")),
        },
        {
            label: "Alert · Insufficient Balance (join)",
            description: "Not enough SOMI to cover buy-in plus session funding when joining.",
            source: "hooks/game/useLobbyActions.ts",
            run: () =>
                showAlert(
                    "Insufficient balance. You need at least 2.5 SOMI to join and fund your session. You have 1.8 SOMI.",
                    { variant: "danger", title: "Insufficient Balance" }
                ).then(() => setResult("dismissed")),
        },
        {
            label: "Alert · Insufficient Balance (create)",
            description: "Not enough SOMI to fund a fresh session when creating a room.",
            source: "hooks/game/useLobbyActions.ts",
            run: () =>
                showAlert(
                    "Insufficient balance to fund session. You have 0.4 SOMI but need at least 1.5 SOMI. Please use a Faucet.",
                    { variant: "danger", title: "Insufficient Balance" }
                ).then(() => setResult("dismissed")),
        },
        {
            label: "Alert · Network Error",
            description: "RPC call to load a room failed.",
            source: "components/lobby_flow/JoinLobby.tsx",
            run: () =>
                showAlert("Couldn't load room #1234. Please try again.", { title: "Network Error" })
                    .then(() => setResult("dismissed")),
        },
        {
            label: "Alert · Transaction Failed",
            description: "Main-wallet funding tx reverted or was rejected.",
            source: "components/lobby_flow/SetupProfile.tsx",
            run: () =>
                showAlert(
                    "Funding failed: user rejected the request",
                    { variant: "danger", title: "Transaction Failed" }
                ).then(() => setResult("dismissed")),
        },
        {
            label: "Alert · Withdrawal Failed",
            description: "Withdraw-to-main tx didn't go through.",
            source: "components/lobby_flow/SetupProfile.tsx",
            run: () =>
                showAlert(
                    "Withdrawal failed: insufficient gas",
                    { variant: "danger", title: "Withdrawal Failed" }
                ).then(() => setResult("dismissed")),
        },
        {
            label: "Alert · Join Failed",
            description: "Private-room permit request rejected by the GM server.",
            source: "hooks/game/useLobbyActions.ts",
            run: () =>
                showAlert(
                    "Failed to get join permit: invalid password",
                    { variant: "danger", title: "Join Failed" }
                ).then(() => setResult("dismissed")),
        },
        {
            label: "Alert · Password Sync Failed",
            description: "Room minted on-chain but the GM server didn't accept the password.",
            source: "hooks/game/useLobbyActions.ts",
            run: () =>
                showAlert(
                    "Room created but password could not be set on GM server: 502 Bad Gateway. The room is private but inaccessible. Please recreate it.",
                    { variant: "danger", title: "Password Sync Failed" }
                ).then(() => setResult("dismissed")),
        },

        // ── Alerts · success ─────────────────────────────────────────
        {
            label: "Alert · Transaction Sent",
            description: "Fund-in-game-wallet tx accepted by the main wallet.",
            source: "components/lobby_flow/SetupProfile.tsx",
            run: () =>
                showAlert(
                    "Transaction successfully sent from main wallet!",
                    { variant: "success", title: "Transaction Sent" }
                ).then(() => setResult("dismissed")),
        },
        {
            label: "Alert · Withdrawal Sent",
            description: "Withdraw-from-session-wallet to main wallet succeeded.",
            source: "components/lobby_flow/SetupProfile.tsx",
            run: () =>
                showAlert(
                    "Withdrawal sent to your main wallet!",
                    { variant: "success", title: "Withdrawal Sent" }
                ).then(() => setResult("dismissed")),
        },

        // ── Confirm (only real call in the codebase) ─────────────────
        {
            label: "Confirm · Cancel Tournament",
            description: "Host abandons a tournament before it starts — all buy-ins refunded.",
            source: "components/lobby_flow/WaitingRoom.tsx",
            run: () =>
                showConfirm(
                    "Are you sure you want to cancel this tournament? All players will be refunded.",
                    {
                        title: "Cancel Tournament",
                        variant: "danger",
                        confirmLabel: "Cancel Tournament",
                        cancelLabel: "Keep",
                    }
                ).then(setResult),
        },

        // ── Prompt (only real call in the codebase) ──────────────────
        {
            label: "Prompt · Enter Password",
            description: "Private-room join flow asks for the password.",
            source: "components/lobby_flow/JoinLobby.tsx",
            run: () =>
                showPrompt("Enter room password:", {
                    title: "Private Room",
                    placeholder: "Password...",
                }).then(setResult),
        },
    ];

    return (
        <div className="min-h-screen relative overflow-hidden bg-[#0a0604] text-white font-['Montserrat']">
            {/* Atmospheric backdrop */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage:
                        "radial-gradient(ellipse at 30% 20%, rgba(196,154,60,0.10) 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(139,0,0,0.07) 0%, transparent 55%)",
                }}
            />
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
                }}
            />

            <div className="relative max-w-4xl mx-auto px-6 py-10">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-white/60 hover:text-white text-xs uppercase tracking-[0.25em] mb-8 transition"
                >
                    <ArrowLeft className="w-4 h-4" /> Back
                </Link>

                <div className="mb-10 border-b border-[#C49A3C]/25 pb-6">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-[#C49A3C]/80 mb-2">
                        Internal · Visual Test
                    </p>
                    <h1 className="font-['Cinzel'] text-3xl md:text-4xl tracking-[0.08em] text-white/95">
                        Dialog Gallery
                    </h1>
                    <p className="text-white/45 text-sm mt-3 max-w-xl leading-relaxed italic">
                        Every alert, confirm and prompt rendered by the shared NoirDialog —
                        plus the new Join-by-ID modal. Click any tile to see it live.
                    </p>
                </div>

                {/* Last result strip */}
                <div className="flex items-center gap-3 mb-8 px-4 py-3 rounded-md border border-white/10 bg-black/30">
                    <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
                        Last result
                    </span>
                    <span className="font-mono text-[#C49A3C] text-sm tabular-nums">
                        {lastResult}
                    </span>
                </div>

                {/* Standard dialog samples */}
                <div className="grid sm:grid-cols-2 gap-3 mb-10">
                    {samples.map((s) => (
                        <button
                            key={s.label}
                            onClick={s.run}
                            className="group text-left p-5 rounded-md border border-white/10 bg-gradient-to-br from-[#1A0F05] to-[#0E0703] hover:border-[#C49A3C]/50 hover:from-[#241608] transition-all"
                        >
                            <span className="block text-[10px] uppercase tracking-[0.3em] text-[#C49A3C]/80 mb-2">
                                {s.label}
                            </span>
                            <span className="block text-white/75 text-sm leading-relaxed group-hover:text-white transition">
                                {s.description}
                            </span>
                            <span className="block mt-3 text-white/30 text-[10px] font-mono">
                                {s.source}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Bespoke modals section */}
                <div className="mb-10">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-[#C49A3C]/80 mb-3">
                        Bespoke modals
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <button
                            onClick={() => {
                                setJoinByIdLoading(false);
                                setJoinByIdOpen(true);
                            }}
                            className="group text-left p-5 rounded-md border border-[#C49A3C]/35 bg-gradient-to-br from-[#2A1A0A] to-[#160B03] hover:border-[#C49A3C]/70 transition-all"
                        >
                            <span className="block text-[10px] uppercase tracking-[0.3em] text-[#C49A3C] mb-2">
                                Join by Room ID
                            </span>
                            <span className="block text-white/75 text-sm leading-relaxed group-hover:text-white transition">
                                Door-code modal opened from the Live Sessions header.
                            </span>
                        </button>

                        <button
                            onClick={() => {
                                setJoinByIdOpen(true);
                                setJoinByIdLoading(true);
                                setTimeout(() => {
                                    setJoinByIdLoading(false);
                                    setJoinByIdOpen(false);
                                    setResult("loading demo finished");
                                }, 2500);
                            }}
                            className="group text-left p-5 rounded-md border border-[#C49A3C]/35 bg-gradient-to-br from-[#2A1A0A] to-[#160B03] hover:border-[#C49A3C]/70 transition-all"
                        >
                            <span className="block text-[10px] uppercase tracking-[0.3em] text-[#C49A3C] mb-2">
                                Join by ID · loading
                            </span>
                            <span className="block text-white/75 text-sm leading-relaxed group-hover:text-white transition">
                                Same modal but locked in the spinner / "Joining…" state for 2.5s.
                            </span>
                        </button>
                    </div>
                </div>

                <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] text-center">
                    Press Esc or click the backdrop to dismiss any dialog
                </p>
            </div>

            <JoinByIdModal
                open={joinByIdOpen}
                isLoading={joinByIdLoading}
                onClose={() => setJoinByIdOpen(false)}
                onSubmit={async (id) => {
                    setResult(`Join submitted: #${id}`);
                    setJoinByIdLoading(true);
                    await new Promise((r) => setTimeout(r, 1200));
                    setJoinByIdLoading(false);
                    setJoinByIdOpen(false);
                }}
            />
        </div>
    );
}
