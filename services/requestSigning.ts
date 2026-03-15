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
    signerAddress?: string; // NEW
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
        roomId !== undefined &&
        Number.isFinite(roomId) &&
        session &&
        session.mainWallet.toLowerCase() === normalizedAddress &&
        session.roomId === roomId &&
        Date.now() < session.expiresAt &&
        // Session must be registered on-chain to be used for authorized GM actions.
        // Exception: if it's NOT registered yet, we only use it if specifically allowed (not implemented here yet)
        // or just fallback to walletClient to be safe during race conditions.
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
