import { NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import { createPublicClient, http } from 'viem';
import { somniaChain, MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '@/contracts/config';
import { ServerStore } from '@/services/serverStore';

const publicClient = createPublicClient({
    chain: somniaChain,
    transport: http()
});

export async function POST(request: Request) {
    try {
        const { roomId: rawRoomId, address, role, salt, signature, sessionKeyAddress } = await request.json();

        if (!rawRoomId || !address || role === undefined || !salt || !signature) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify the caller owns the address (or has a valid session key for it)
        const message = `reveal-secret:${rawRoomId}:${role}:${salt}`;

        // Try verifying against main wallet address first
        let valid = await verifyMessage({
            address: address as `0x${string}`,
            message,
            signature: signature as `0x${string}`,
        });

        // If main wallet verification fails and a session key address was provided,
        // verify against the session key address instead.
        if (!valid && sessionKeyAddress) {
            valid = await verifyMessage({
                address: sessionKeyAddress as `0x${string}`,
                message,
                signature: signature as `0x${string}`,
            });
            if (valid) {
                console.log(`[RevealSecret] Verified via session key ${sessionKeyAddress} for player ${address}`);
            }
        }

        if (!valid) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // If signed by session key, enforce on-chain ownership + validity checks
        if (sessionKeyAddress) {
            const signedByMainWallet = await verifyMessage({
                address: address as `0x${string}`,
                message,
                signature: signature as `0x${string}`,
            });

            if (!signedByMainWallet) {
                const sessionKeyData = await publicClient.readContract({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MAFIA_ABI,
                    functionName: 'sessionKeys',
                    args: [address as `0x${string}`],
                }) as any;

                const registeredSession = Array.isArray(sessionKeyData)
                    ? sessionKeyData[0]
                    : sessionKeyData.sessionAddress;
                const expiresAt = Number(Array.isArray(sessionKeyData)
                    ? sessionKeyData[1]
                    : sessionKeyData.expiresAt);
                const roomIdFromChain = Number(Array.isArray(sessionKeyData)
                    ? sessionKeyData[2]
                    : sessionKeyData.roomId);
                const isActive = Boolean(Array.isArray(sessionKeyData)
                    ? sessionKeyData[3]
                    : sessionKeyData.isActive);

                if (!registeredSession || registeredSession.toLowerCase() !== sessionKeyAddress.toLowerCase()) {
                    return NextResponse.json({ error: 'Session key is not registered for this wallet' }, { status: 403 });
                }

                if (!isActive || expiresAt <= Math.floor(Date.now() / 1000)) {
                    return NextResponse.json({ error: 'Session key is inactive or expired' }, { status: 403 });
                }

                const requestRoomId = Number(BigInt(rawRoomId));
                if (roomIdFromChain !== requestRoomId) {
                    return NextResponse.json({ error: 'Session key room mismatch' }, { status: 403 });
                }
            }
        }

        // Validate role is a valid value (1-4)
        const roleNum = Number(role);
        if (![1, 2, 3, 4].includes(roleNum)) {
            return NextResponse.json({ error: 'Invalid role value' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId).toString();
        // Store the secret on the server
        const storeResult = await ServerStore.storeSecret(roomId, address, roleNum, salt);
        if (storeResult.status === 'conflict') {
            return NextResponse.json({ error: 'Secret conflict detected for this player/room' }, { status: 409 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API/RevealSecret] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to reveal secret to server' }, { status: 500 });
    }
}
