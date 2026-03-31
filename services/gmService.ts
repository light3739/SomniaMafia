import { GM_SERVER_URL } from '../contracts/config';
import { loadOrCreateKeypair, exportPublicKeyHex, eciesDecrypt, type EciesEncrypted } from './eciesService';
import { signRequest } from './requestSigning';
import { Role } from '../types';
import { SignatureBuilder } from './SignatureBuilder';

export interface GmRoleResponse {
    encrypted?: EciesEncrypted;
    pending?: boolean;
    error?: string;
}

/**
 * Register player's ECIES public key with the GM server.
 */
export async function registerEciesPubkey(
    roomId: string,
    address: string,
    walletClient: any,
    chainId?: number,
    forceWallet?: boolean
): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey; isNew: boolean }> {
    const keypair = await loadOrCreateKeypair(roomId, address);
    const pubkeyHex = await exportPublicKeyHex(keypair.publicKey);

    const meta = await signRequest({
        address,
        roomId: Number(roomId),
        walletClient,
        forceWallet,
        buildMessage: ({ nonce, timestamp }) =>
            new SignatureBuilder('register-pubkey', chainId, roomId)
                .withAddress(address)
                .withParam(pubkeyHex)
                .withModern(nonce, timestamp)
                .build(),
    });

    const res = await fetch(`${GM_SERVER_URL}/register-pubkey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            roomId,
            playerAddress: address,
            pubkey: pubkeyHex,
            signature: meta.signature,
            signerAddress: meta.signerAddress,
            nonce: meta.nonce,
            timestamp: meta.timestamp,
            chainId,
        }),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to register ECIES pubkey: ${error.error || res.statusText}`);
    }

    return keypair;
}

/**
 * Register session key mapping on GM server (local cache, bypasses on-chain RPC lag).
 * Signed by the SESSION KEY itself (no MetaMask popup needed).
 * The session private key proves ownership — only the generator knows it.
 */
export async function registerSessionOnGm(params: {
    roomId: string;
    mainWallet: string;
    sessionAddress: string;
    walletClient: any;
    chainId?: number;
}): Promise<void> {
    const { roomId, mainWallet, sessionAddress, walletClient, chainId } = params;
    const normalizedMain = mainWallet.toLowerCase();
    const normalizedSession = sessionAddress.toLowerCase();

    const timestamp = Date.now();
    const nonce = Math.random().toString(36).slice(2) + timestamp.toString(36);
    const effectiveChainId = String(chainId || 43113);
    const message = new SignatureBuilder('register-session', effectiveChainId, roomId)
        .withAddress(mainWallet)
        .withAddress(sessionAddress)
        .withModern(nonce, timestamp)
        .build();

    // Secure: Sign with main wallet to authorize this session Address
    const signature = await walletClient.signMessage({ message });

    const payload = {
        mainWallet: normalizedMain,
        sessionAddress: normalizedSession,
        roomId,
        signature,
        signerAddress: normalizedMain,
        nonce,
        timestamp,
        chainId,
    };
    console.log('[GM] Registering session:', { ...payload, signature: '...' });

    const res = await fetch(`${GM_SERVER_URL}/register-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to register session on GM: ${error.error || res.statusText}`);
    }
    console.log('[GM] Session key registered on GM server ✅');
}

/**
 * Submit SRA decryption key to GM server (off-chain, signed).
 */
export async function submitSraKeyToGm(params: {
    roomId: string;
    address: string;
    sraKey: string;
    walletClient: any;
    chainId?: number;
}): Promise<void> {
    const { roomId, address, sraKey, walletClient, chainId } = params;

    const meta = await signRequest({
        address,
        roomId: Number(roomId),
        walletClient,
        buildMessage: ({ nonce, timestamp }) =>
            new SignatureBuilder('submit-key', chainId, roomId)
                .withParam(sraKey)
                .withModern(nonce, timestamp)
                .build(),
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
            chainId,
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
            new SignatureBuilder('my-role', chainId, roomId)
                .withAddress(address)
                .withModern(nonce, timestamp)
                .build(),
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
    try {
        const { privateKey } = await loadOrCreateKeypair(roomId, address);
        const roleStr = await eciesDecrypt(data.encrypted, privateKey);

        const normalized = roleStr.trim().toUpperCase();
        const roleMap: Record<string, Role> = {
            MAFIA: Role.MAFIA,
            DOCTOR: Role.DOCTOR,
            DETECTIVE: Role.DETECTIVE,
            CIVILIAN: Role.CIVILIAN,
            CIVIL: Role.CIVILIAN, // Alias
        };

        let myRole = roleMap[normalized];
        if (myRole === undefined) {
            const num = parseInt(normalized, 10);
            const roleEnumMap: Record<number, Role> = {
                1: Role.MAFIA, 2: Role.DOCTOR, 3: Role.DETECTIVE, 4: Role.CIVILIAN
            };
            myRole = roleEnumMap[num] || Role.UNKNOWN;
        }

        return myRole;
    } catch (e: any) {
        if (e instanceof DOMException && e.name === 'OperationError') return Role.UNKNOWN;
        throw e;
    }
}

/**
 * Fetch investigation result proof directly from GM.
 * Fallback for when currentBlock data hasn't synced yet.
 */
export async function fetchInvestigationProofFromGM(params: {
    roomId: string;
    detectiveAddress: string;
    targetAddress: string;
    walletClient: any;
    chainId?: number;
    dayCount?: number;
}): Promise<{ role: Role; source: string } | null> {
    const { roomId, detectiveAddress, targetAddress, walletClient, chainId } = params;

    const meta = await signRequest({
        address: detectiveAddress,
        roomId: Number(roomId),
        walletClient,
        buildMessage: ({ nonce, timestamp }) =>
            new SignatureBuilder('investigate', chainId, roomId)
                .withParam(params.dayCount || 0)
                .withAddress(targetAddress)
                .withModern(nonce, timestamp)
                .build(),
    });

    const body = {
        roomId,
        detectiveAddress,
        targetAddress,
        signature: meta.signature,
        signerAddress: meta.signerAddress,
        nonce: meta.nonce,
        timestamp: meta.timestamp,
        chainId,
        dayCount: params.dayCount
    };

    const res = await fetch(`${GM_SERVER_URL}/investigation-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        if (res.status === 404) return null;
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to fetch proof: ${error.error || res.statusText}`);
    }

    const data = await res.json();
    // GM returns { role: Role... } if it has already resolved it
    // Wait, the GM server /investigation-proof currently returns ok: true + proof details.
    const rawRole = Number(data.role);
    let mappedRole: Role;
    switch (rawRole) {
        case 1: mappedRole = Role.MAFIA; break;
        case 2: mappedRole = Role.DOCTOR; break;
        case 3: mappedRole = Role.DETECTIVE; break;
        case 4: mappedRole = Role.CIVILIAN; break;
        default: mappedRole = Role.UNKNOWN; break;
    }

    return { 
        role: mappedRole, 
        source: data.source 
    };
}

/**
 * Skip night action (effectively a pass).
 * Useful for players who lost their salt or simply want to pass.
 */
export async function skipNightActionToGM(params: {
    roomId: string;
    address: string;
    walletClient: any;
    chainId?: number;
    dayCount?: number;
}): Promise<void> {
    const { roomId, address, walletClient, chainId } = params;

    const meta = await signRequest({
        address,
        roomId: Number(roomId),
        walletClient,
        buildMessage: ({ nonce, timestamp }) =>
            new SignatureBuilder('skip-night', chainId, roomId)
                .withParam(params.dayCount || 0)
                .withModern(nonce, timestamp)
                .build(),
    });

    const body = {
        roomId,
        playerAddress: address,
        signature: meta.signature,
        signerAddress: meta.signerAddress,
        nonce: meta.nonce,
        timestamp: meta.timestamp,
        chainId,
        dayCount: params.dayCount
    };

    const res = await fetch(`${GM_SERVER_URL}/skip-night-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to skip: ${error.error || res.statusText}`);
    }
}

/**
 * Set room password on GM server (called by host).
 */
export async function setRoomPassword(params: {
    roomId: string;
    address: string;
    password: string;
    walletClient: any;
    chainId?: number;
    maxPlayers?: number;
    signerAddress?: string;
    forceWallet?: boolean;
}): Promise<void> {
    const { roomId, address, password, walletClient, chainId, maxPlayers, signerAddress } = params;

    const meta = await signRequest({
        address,
        roomId: Number(roomId),
        walletClient,
        signerAddress,
        forceWallet: params.forceWallet,
        buildMessage: ({ nonce, timestamp }) =>
            new SignatureBuilder('setRoomPassword', chainId, roomId)
                .withAddress(address)
                .withModern(nonce, timestamp)
                .build(),
    });

    const res = await fetch(`${GM_SERVER_URL}/room-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            roomId,
            password,
            hostAddress: address,
            signature: meta.signature,
            signerAddress: meta.signerAddress, // Uses the actual signer (session or main)
            nonce: meta.nonce,
            timestamp: meta.timestamp,
            chainId,
            maxPlayers
        }),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to set password: ${error.error || res.statusText}`);
    }
}

/**
 * Request a join permit (GM signature) from GM server by providing the room password.
 */
export async function requestJoinPermit(params: {
    roomId: string;
    password: string;
    playerAddress: string;
    chainId?: number;
}): Promise<`0x${string}`> {
    const { roomId, password, playerAddress, chainId } = params;

    const res = await fetch(`${GM_SERVER_URL}/request-join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            roomId,
            password,
            playerAddress,
            chainId,
        }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || `Failed to get join permit: ${res.status}`);
    }

    return data.gmSignature;
}

