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
    roomId?: number;
    walletClient?: SignCapableClient | null;
    messageBase: string;
}): Promise<SignedRequestMeta> {
    const { address, roomId, walletClient, messageBase } = params;

    if (!address) {
        throw new Error('Missing address for signing');
    }

    const timestamp = Date.now();
    const nonce = generateNonce(timestamp);
    const message = `${messageBase}:${nonce}:${timestamp}`;

    const normalizedAddress = address.toLowerCase();
    const session = loadSession();

    if (
        roomId !== undefined &&
        Number.isFinite(roomId) &&
        session &&
        session.registeredOnChain &&
        Date.now() < session.expiresAt &&
        session.mainWallet.toLowerCase() === normalizedAddress &&
        session.roomId === roomId
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

    const signature = await walletClient.signMessage({ message });
    return {
        signature,
        signerAddress: address,
        nonce,
        timestamp,
        message,
    };
}
