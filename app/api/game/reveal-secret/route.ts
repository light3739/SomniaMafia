import { NextResponse } from 'next/server';
import { verifyMessage, createPublicClient, http } from 'viem';
import { getDeploymentByChainId, ACTIVE_DEPLOYMENT, MAFIA_ABI } from '@/contracts/config';
import { ServerStore } from '@/services/serverStore';
import { buildRevealSecretMessage } from '@/services/signingSchema';

export async function POST(request: Request) {
    try {
        const { roomId: rawRoomId, address, role, salt, commitment, signature, sessionKeyAddress, chainId } = await request.json();

        if (!rawRoomId || !address || role === undefined || !salt || !signature) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Use SignatureBuilder for deterministic message construction
        const message = buildRevealSecretMessage({
            roomId: rawRoomId,
            role,
            salt,
            chainId,
        });

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
                const requestChainId = Number(chainId || ACTIVE_DEPLOYMENT.chainId);
                const deployment = getDeploymentByChainId(requestChainId);
                const dynamicClient = createPublicClient({ chain: deployment.chain, transport: http() });

                const sessionKeyData = await dynamicClient.readContract({
                    address: deployment.contracts.MafiaDiamond as `0x${string}`,
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
        const storeResult = await ServerStore.storeSecret(roomId, address, roleNum, salt, commitment, chainId);
        if (storeResult.status === 'conflict') {
            return NextResponse.json({ error: 'Secret conflict detected for this player/room' }, { status: 409 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[API/RevealSecret] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to reveal secret to server' }, { status: 500 });
    }
}
