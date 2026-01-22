import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { somniaChain, MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '@/contracts/config';
import { ServerStore, DiscussionState } from '@/services/serverStore';

const publicClient = createPublicClient({
    chain: somniaChain,
    transport: http()
});

const FLAG_ACTIVE = 2;
const SPEAKER_DURATION = 60; // seconds per speaker

/**
 * GET /api/game/discussion?roomId=...&playerAddress=...
 * Returns current discussion state with calculated time remaining.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const rawRoomId = searchParams.get('roomId');
        const playerAddress = searchParams.get('playerAddress');

        if (!rawRoomId) {
            return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId).toString();
        const rawDayCount = searchParams.get('dayCount');
        const dayCount = rawDayCount ? parseInt(rawDayCount) : 1;
        let state = await ServerStore.getDiscussionState(roomId, dayCount);

        if (!state) {
            return NextResponse.json({
                active: false,
                message: 'Discussion not started'
            });
        }

        // Get alive players to determine speaker order
        const players: any = await publicClient.readContract({
            address: MAFIA_CONTRACT_ADDRESS as `0x${string}`,
            abi: MAFIA_ABI,
            functionName: 'getPlayers',
            args: [BigInt(roomId)],
        });

        const alivePlayers = players.filter((p: any) => (Number(p.flags) & FLAG_ACTIVE) !== 0);
        const totalSpeakers = alivePlayers.length;

        // Auto-advance if time expired
        const elapsed = (Date.now() - state.speakerStartTime) / 1000;
        if (!state.finished && elapsed >= state.speakerDuration) {
            const newState = await ServerStore.advanceSpeaker(roomId, dayCount, totalSpeakers);
            if (newState) {
                state = newState; // Update state for buildResponse
            }
        }

        return buildResponse(state, alivePlayers, playerAddress);

    } catch (error: any) {
        console.error('[API/Discussion] GET Error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}

/**
 * POST /api/game/discussion
 * Body: { roomId, dayCount, action: 'start' | 'skip', playerAddress }
 */
export async function POST(request: Request) {
    try {
        const { roomId: rawRoomId, dayCount: rawDayCount, action, playerAddress } = await request.json();

        if (!rawRoomId || !action) {
            return NextResponse.json({ error: 'Missing roomId or action' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId).toString();
        const dayCount = rawDayCount ? parseInt(rawDayCount) : 1;

        // Get alive players
        const players: any = await publicClient.readContract({
            address: MAFIA_CONTRACT_ADDRESS as `0x${string}`,
            abi: MAFIA_ABI,
            functionName: 'getPlayers',
            args: [BigInt(roomId)],
        });

        const alivePlayers = players.filter((p: any) => (Number(p.flags) & FLAG_ACTIVE) !== 0);
        const totalSpeakers = alivePlayers.length;

        if (action === 'start') {
            // Initialize discussion state
            const newState: DiscussionState = {
                currentSpeakerIndex: 0,
                speakerStartTime: Date.now(),
                speakerDuration: SPEAKER_DURATION,
                finished: false
            };
            await ServerStore.setDiscussionState(roomId, dayCount, newState);
            console.log(`[API/Discussion] Started discussion for Room #${roomId} Day ${dayCount}`);
            return buildResponse(newState, alivePlayers, playerAddress);
        }

        if (action === 'skip') {
            const state = await ServerStore.getDiscussionState(roomId, dayCount);
            if (!state || state.finished) {
                return NextResponse.json({ error: 'Discussion not active' }, { status: 400 });
            }

            // Verify it's the current speaker OR the Host
            const currentSpeaker = alivePlayers[state.currentSpeakerIndex];

            // Fetch Room Host to allow force-skip
            const roomData = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS as `0x${string}`,
                abi: MAFIA_ABI,
                functionName: 'rooms',
                args: [BigInt(roomId)],
            }) as any;
            const hostAddress = roomData[1]; // storage Room member 1 is host

            const isSpeaker = currentSpeaker?.wallet.toLowerCase() === playerAddress?.toLowerCase();
            const isHost = hostAddress.toLowerCase() === playerAddress?.toLowerCase();

            if (!isSpeaker && !isHost) {
                return NextResponse.json({ error: 'Not your turn to speak (and you are not Host)' }, { status: 403 });
            }

            const newState = await ServerStore.advanceSpeaker(roomId, dayCount, totalSpeakers);
            console.log(`[API/Discussion] Speaker skipped by ${isHost ? 'HOST' : 'PLAYER'} in Room #${roomId} Day ${dayCount}, new index: ${newState?.currentSpeakerIndex}`);
            return buildResponse(newState, alivePlayers, playerAddress);
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

    } catch (error: any) {
        console.error('[API/Discussion] POST Error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}

function buildResponse(state: DiscussionState | null, alivePlayers: any[], playerAddress?: string | null) {
    if (!state) {
        return NextResponse.json({ active: false, finished: true });
    }

    const currentSpeaker = alivePlayers[state.currentSpeakerIndex];
    const elapsed = (Date.now() - state.speakerStartTime) / 1000;
    const timeRemaining = Math.max(0, Math.floor(state.speakerDuration - elapsed));

    const isMyTurn = playerAddress
        ? currentSpeaker?.wallet.toLowerCase() === playerAddress.toLowerCase()
        : false;

    return NextResponse.json({
        active: !state.finished,
        finished: state.finished,
        currentSpeakerIndex: state.currentSpeakerIndex,
        currentSpeakerAddress: currentSpeaker?.wallet || null,
        totalSpeakers: alivePlayers.length,
        timeRemaining,
        speakerDuration: state.speakerDuration,
        isMyTurn
    });
}
