"use client";

import { JoinLobby } from "@/components/lobby_flow/JoinLobby";
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function JoinContent() {
    const searchParams = useSearchParams();
    const roomId = searchParams.get('roomId');
    return <JoinLobby initialRoomId={roomId} />;
}

export default function JoinPage() {
    return (
        <Suspense fallback={<div className="w-full h-screen bg-black flex items-center justify-center text-white/50">Loading Link...</div>}>
            <JoinContent />
        </Suspense>
    );
}
