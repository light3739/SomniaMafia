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

        let mafiaKeys: string[] = [];
        try {
            if (typeof localStorage !== 'undefined') {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.startsWith('mafia_') || k.startsWith('somnia_mafia'))) mafiaKeys.push(k);
                }
            }
        } catch {}

        const sessionAgeMs = typeof raw?.createdAt === 'number' ? Date.now() - raw.createdAt : null;

        const eventId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

        const diagnostic: Record<string, any> = {
            eventId,
            forceWallet: !!params.forceWallet,
            roomIdProvided: roomId !== undefined,
            expectedRoom: roomId?.toString(),
            storedRoom: raw?.roomId?.toString(),
            roomMatch,
            expectedAddr: normalizedAddress,
            storedAddr: raw?.mainWallet?.toLowerCase(),
            addrMatch: raw?.mainWallet?.toLowerCase() === normalizedAddress,
            expired: typeof raw?.expiresAt === 'number' ? Date.now() >= raw.expiresAt : null,
            expiresInMs: typeof raw?.expiresAt === 'number' ? raw.expiresAt - Date.now() : null,
            createdAt: raw?.createdAt ?? null,
            sessionAgeMs,
            registered: raw?.registeredOnChain,
            chainId: raw?.chainId,
            mafiaKeys,
            visibilityState: typeof document !== 'undefined' ? document.visibilityState : null,
            msgPreview: message.slice(0, 80),
        };

        // Multi-tab probe via BroadcastChannel — count peers that respond within 200ms.
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const ch = new BroadcastChannel('somnia_mafia_tab_probe');
                let peers = 0;
                ch.onmessage = (ev) => { if (ev.data === 'pong') peers++; };
                ch.postMessage('ping');
                await new Promise((res) => setTimeout(res, 200));
                diagnostic.tabPeers = peers;
                ch.close();
            } catch {
                diagnostic.tabPeers = null;
            }
        } else {
            diagnostic.tabPeers = null;
        }

        console.warn('[signRequest] FALLBACK to wallet popup', diagnostic);

        if (typeof fetch !== 'undefined' && typeof window !== 'undefined') {
            try {
                fetch('/api/log/session-fallback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ts: Date.now(),
                        ua: typeof navigator !== 'undefined' ? navigator.userAgent : null,
                        url: window.location?.href,
                        ...diagnostic,
                    }),
                    keepalive: true,
                }).catch(() => {});
            } catch {}
        }
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
