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
    signerAddress?: string;
    forceWallet?: boolean; // NEW: bypass session key even if registered
    buildMessage: (input: { nonce: string; timestamp: number }) => string;
}): Promise<SignedRequestMeta> {
    const { address, roomId, walletClient, signerAddress, buildMessage } = params;

    if (!address) {
        throw new Error('Missing address for signing');
    }

    const timestamp = Date.now(); // Unix milliseconds — GM server expects ms for modern sig (Date.now())
    const nonce = generateNonce(timestamp);
    const message = buildMessage({ nonce, timestamp });

    const normalizedAddress = address.toLowerCase();
    const session = loadSession();

    if (
        !params.forceWallet &&
        roomId !== undefined &&
        Number.isFinite(roomId) &&
        session &&
        session.mainWallet.toLowerCase() === normalizedAddress &&
        session.roomId === roomId &&
        Date.now() < session.expiresAt &&
        session.registeredOnChain
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
