import { GM_SERVER_URL } from '../contracts/config';
import { loadOrCreateKeypair, exportPublicKeyHex, eciesDecrypt, type EciesEncrypted } from './eciesService';
import { signRequest } from './requestSigning';
import { Role } from '../types';

export interface GmRoleResponse {
    encrypted?: EciesEncrypted;
    pending?: boolean;
    error?: string;
}

/**
 * Register player's ECIES public key with the GM server.
 */
export async function registerEciesPubkey(roomId: string, address: string): Promise<void> {
    const keypair = await loadOrCreateKeypair(roomId, address);
    const pubkeyHex = await exportPublicKeyHex(keypair.publicKey);

    const res = await fetch(`${GM_SERVER_URL}/register-pubkey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            roomId,
            playerAddress: address,
            pubkey: pubkeyHex,
        }),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to register ECIES pubkey: ${error.error || res.statusText}`);
    }
}

/**
 * Submit SRA decryption key to GM server (off-chain, signed).
 */
export async function submitSraKeyToGm(params: {
    roomId: string;
    address: string;
    sraKey: string;
    walletClient: any;
}): Promise<void> {
    const { roomId, address, sraKey, walletClient } = params;

    const meta = await signRequest({
        address,
        roomId: Number(roomId),
        walletClient,
        buildMessage: ({ nonce, timestamp }) =>
            `submit-key:${roomId}:${sraKey}:${nonce}:${timestamp}`,
    });

    const res = await fetch(`${GM_SERVER_URL}/submit-sra-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            roomId,
            playerAddress: address,
            sraKey,
            signature: meta.signature,
            signerAddress: meta.signerAddress,
            nonce: meta.nonce,
            timestamp: meta.timestamp,
        }),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to submit SRA key: ${error.error || res.statusText}`);
    }
}

/**
 * Fetch and decrypt player role from GM server.
 */
export async function fetchMyRoleFromGm(params: {
    roomId: string;
    address: string;
    walletClient: any;
    chainId?: number;
}): Promise<Role | null> {
    const { roomId, address, walletClient, chainId } = params;

    const meta = await signRequest({
        address,
        roomId: Number(roomId),
        walletClient,
        buildMessage: ({ nonce, timestamp }) =>
            `my-role:${roomId}:${address.toLowerCase()}:${nonce}:${timestamp}`,
    });

    const query = new URLSearchParams({
        playerAddress: address,
        signature: meta.signature,
        signerAddress: meta.signerAddress,
        nonce: meta.nonce,
        timestamp: String(meta.timestamp),
    });
    if (chainId) query.append('chainId', String(chainId));

    const res = await fetch(`${GM_SERVER_URL}/my-role/${roomId}?${query}`);
    const data: GmRoleResponse = await res.json();

    if (res.status === 202 && data.pending) {
        return null; // Still pending (waiting for other players' keys)
    }

    if (!res.ok || !data.encrypted) {
        throw new Error(data.error || `GM returned ${res.status}`);
    }

    // Decrypt
    const keypair = await loadOrCreateKeypair(roomId, address);
    const roleStr = await eciesDecrypt(data.encrypted, keypair.privateKey);

    const roleMap: Record<string, Role> = {
        MAFIA: Role.MAFIA,
        DOCTOR: Role.DOCTOR,
        DETECTIVE: Role.DETECTIVE,
        CIVILIAN: Role.CIVILIAN,
    };

    return roleMap[roleStr] || Role.UNKNOWN;
}
