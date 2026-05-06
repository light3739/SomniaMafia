import { privateKeyToAccount } from 'viem/accounts';
import { loadSession } from './sessionKeyService';

type SignCapableClient = {
    signMessage: (args: { message: string }) => Promise<`0x${string}`>;
};

export interface SignedRequestMeta {
    signature: `0x${string}`;
    signerAddress: string;
    nonce: string;
    timestamp: number;
    message: string;
}

function generateNonce(timestamp: number): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().replace(/-/g, '');
    }
    return `${Math.random().toString(36).slice(2)}${timestamp.toString(36)}`;
}

export async function signRequest(params: {
    address: string;
    roomId?: string | number;
    walletClient?: SignCapableClient | null;
    signerAddress?: string;
    forceWallet?: boolean; // NEW: bypass session key even if registered
    buildMessage: (input: { nonce: string; timestamp: number }) => string;
}): Promise<SignedRequestMeta> {
    const { address, roomId, walletClient, buildMessage } = params;

    if (!address) {
        throw new Error('Missing address for signing');
    }

    const timestamp = Date.now();
    const nonce = generateNonce(timestamp);
    const message = buildMessage({ nonce, timestamp });

    const normalizedAddress = address.toLowerCase();
    const session = loadSession();

    if (
        !params.forceWallet &&
        roomId !== undefined &&
        session &&
        session.mainWallet.toLowerCase() === normalizedAddress &&
        BigInt(session.roomId) === BigInt(roomId) &&
        Date.now() < session.expiresAt
    ) {
        const sessionAccount = privateKeyToAccount(session.privateKey);
        const signature = await sessionAccount.signMessage({ message });
        return {
            signature,
            signerAddress: sessionAccount.address,
            nonce,
            timestamp,
            message,
        };
    }

    if (!walletClient) {
        throw new Error('No wallet available to sign request');
    }

    try {
        const rawStored = typeof localStorage !== 'undefined' ? localStorage.getItem('somnia_mafia_session') : null;
        const raw = rawStored ? JSON.parse(rawStored) : null;
        let roomMatch: boolean | null = null;
        if (raw && roomId !== undefined) {
            try { roomMatch = BigInt(raw.roomId) === BigInt(roomId as any); } catch { roomMatch = null; }
        }
        console.warn('[signRequest] FALLBACK to wallet popup', {
            forceWallet: !!params.forceWallet,
            roomIdProvided: roomId !== undefined,
            expectedRoom: roomId?.toString(),
            storedRoom: raw?.roomId?.toString(),
            roomMatch,
            expectedAddr: normalizedAddress,
            storedAddr: raw?.mainWallet?.toLowerCase(),
            addrMatch: raw?.mainWallet?.toLowerCase() === normalizedAddress,
            expired: raw?.expiresAt ? Date.now() >= raw.expiresAt : null,
            expiresInMs: raw?.expiresAt ? raw.expiresAt - Date.now() : null,
            registered: raw?.registeredOnChain,
            chainId: raw?.chainId,
            msgPreview: message.slice(0, 80),
        });
    } catch (e) {
        console.warn('[signRequest] FALLBACK (diagnostic failed)', e);
    }

    const signature = await walletClient.signMessage({ message });
    return {
        signature,
        signerAddress: address,
        nonce,
        timestamp,
        message,
    };
}
