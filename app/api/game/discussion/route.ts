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
const DELAY_INITIAL = 5; // seconds before first speaker

/**
 * Deterministic shuffle using roomId as seed (must match frontend GameLayout.tsx logic)
 */
function shufflePlayers(players: any[], roomId: string): any[] {
    const shuffled = [...players];
    const seed = Number(BigInt(roomId) % 1000000n);
    let m = shuffled.length, t, i;
    let s = seed;

    const random = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };

    while (m) {
        i = Math.floor(random() * m--);
        t = shuffled[m];
        shuffled[m] = shuffled[i];
        shuffled[i] = t;
    }
    return shuffled;
}

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
        let alivePlayers: any[] = [];
        try {
            const players: any = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS as `0x${string}`,
                abi: MAFIA_ABI,
                functionName: 'getPlayers',
                args: [BigInt(roomId)],
            });
            const allShuffled = shufflePlayers(players, roomId);
            alivePlayers = allShuffled.filter((p: any) => (Number(p.flags) & FLAG_ACTIVE) !== 0);
        } catch (e) {
            if (roomId === '999') {
                alivePlayers = Array(10).fill(null).map((_, i) => ({
                    wallet: `0x${(i + 1).toString().repeat(40)}`,
                    nickname: `Player ${i + 1}`,
                    flags: FLAG_ACTIVE
                }));
                alivePlayers = shufflePlayers(alivePlayers, roomId);
            } else throw e;
        }

        // Shuffle moved inside try/catch to ensure stability
        // alivePlayers = shufflePlayers(alivePlayers, roomId);
        const totalSpeakers = alivePlayers.length;

        // Auto-advance based on current phase
        if (!state.finished) {
            if (state.phase === 'speaking') {
                // Check if speaker time expired
                const elapsed = (Date.now() - state.speakerStartTime) / 1000;
                if (elapsed >= state.speakerDuration) {
                    const newState = await ServerStore.advanceSpeaker(roomId, dayCount, totalSpeakers);
                    if (newState) state = newState;
                }
            } else if (state.phase === 'initial_delay') {
                // Check if delay time expired
                const delayElapsed = (Date.now() - (state.delayStartTime || 0)) / 1000;
                const delayDuration = state.delayDuration || 5;
                if (delayElapsed >= delayDuration) {
                    const newState = await ServerStore.advanceSpeaker(roomId, dayCount, totalSpeakers);
                    if (newState) state = newState;
                }
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
        let alivePlayers: any[] = [];
        let hostAddress = '0x0000000000000000000000000000000000000000';
        try {
            const players: any = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS as `0x${string}`,
                abi: MAFIA_ABI,
                functionName: 'getPlayers',
                args: [BigInt(roomId)],
            });
            const allShuffled = shufflePlayers(players, roomId);
            alivePlayers = allShuffled.filter((p: any) => (Number(p.flags) & FLAG_ACTIVE) !== 0);

            const roomData = await publicClient.readContract({
                address: MAFIA_CONTRACT_ADDRESS as `0x${string}`,
                abi: MAFIA_ABI,
                functionName: 'rooms',
                args: [BigInt(roomId)],
            }) as any;
            hostAddress = roomData[1];
        } catch (e) {
            if (roomId === '999') {
                alivePlayers = Array(10).fill(null).map((_, i) => ({
                    wallet: i === 0 ? (playerAddress || '0xhost') : `0x${(i + 1).toString().repeat(40)}`,
                    nickname: i === 0 ? 'Tester' : `Player ${i + 1}`,
                    flags: FLAG_ACTIVE
                }));
                alivePlayers = shufflePlayers(alivePlayers, roomId);
                hostAddress = playerAddress || '0xhost';
            } else throw e;
        }

        // Shuffle moved inside try/catch
        // alivePlayers = shufflePlayers(alivePlayers, roomId);
        const totalSpeakers = alivePlayers.length;

        if (action === 'start') {
            // Initialize discussion state with initial delay
            const newState: DiscussionState = {
                currentSpeakerIndex: 0,
                speakerStartTime: Date.now(),
                speakerDuration: SPEAKER_DURATION,
                finished: false,
                phase: 'initial_delay',
                delayStartTime: Date.now(),
                delayDuration: DELAY_INITIAL
            };
            await ServerStore.setDiscussionState(roomId, dayCount, newState);
            console.log(`[API/Discussion] Started discussion for Room #${roomId} Day ${dayCount} (initial delay: ${DELAY_INITIAL}s)`);
            return buildResponse(newState, alivePlayers, playerAddress);
        }

        if (action === 'skip') {
            const state = await ServerStore.getDiscussionState(roomId, dayCount);
            if (!state || state.finished) {
                return NextResponse.json({ error: 'Discussion not active' }, { status: 400 });
            }

            // Test Mode: Bypass all checks
            if (roomId === '999') {
                const newState = await ServerStore.advanceSpeaker(roomId, dayCount, totalSpeakers);
                return buildResponse(newState, alivePlayers, playerAddress);
            }

            // Verify it's the current speaker OR the Host
            const currentSpeaker = alivePlayers[state.currentSpeakerIndex];
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
        return NextResponse.json({ active: false, finished: true, phase: 'finished' });
    }

    const currentSpeaker = alivePlayers[state.currentSpeakerIndex];

    // Calculate time remaining based on current phase
    let timeRemaining = 0;
    if (state.phase === 'speaking') {
        const elapsed = (Date.now() - state.speakerStartTime) / 1000;
        timeRemaining = Math.max(0, Math.floor(state.speakerDuration - elapsed));
    } else if (state.phase === 'initial_delay') {
        const elapsed = (Date.now() - (state.delayStartTime || 0)) / 1000;
        timeRemaining = Math.max(0, Math.ceil((state.delayDuration || 5) - elapsed));
    }

    const isMyTurn = playerAddress && state.phase === 'speaking'
        ? currentSpeaker?.wallet.toLowerCase() === playerAddress.toLowerCase()
        : false;

    return NextResponse.json({
        active: !state.finished,
        finished: state.finished,
        phase: state.phase || 'speaking',
        currentSpeakerIndex: state.currentSpeakerIndex,
        currentSpeakerAddress: currentSpeaker?.wallet || null,
        totalSpeakers: alivePlayers.length,
        timeRemaining,
        speakerDuration: state.speakerDuration,
        delayDuration: state.delayDuration,
        isMyTurn
    });
}
