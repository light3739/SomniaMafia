"use client";

import { JoinLobby } from "@/components/lobby_flow/JoinLobby";
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function JoinContent() {
    const searchParams = useSearchParams();
    const roomId = searchParams.get('roomId');
    const mockParam = searchParams.get('mock');
    const mockCount = mockParam ? Math.max(0, Math.min(50, parseInt(mockParam, 10) || 0)) : 0;
    return <JoinLobby initialRoomId={roomId} mockCount={mockCount} />;
}

export default function JoinPage() {
    return (
        <Suspense fallback={<div className="w-full h-screen bg-black flex items-center justify-center text-white/50">Loading Link...</div>}>
            <JoinContent />
        </Suspense>
    );
}
