import { NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import { ServerStore } from '@/services/serverStore';

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
        // Session keys are registered on-chain and authorized to act on behalf of the player.
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

        // Validate role is a valid value (1-4)
        const roleNum = Number(role);
        if (![1, 2, 3, 4].includes(roleNum)) {
            return NextResponse.json({ error: 'Invalid role value' }, { status: 400 });
        }

        const roomId = BigInt(rawRoomId).toString();
        // Store the secret on the server
        await ServerStore.storeSecret(roomId, address, roleNum, salt);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API/RevealSecret] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to reveal secret to server' }, { status: 500 });
    }
}
