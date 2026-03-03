import { NextResponse } from 'next/server';
import { createPublicClient, http, type PublicClient, verifyMessage } from 'viem';
import { somniaChain, MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '@/contracts/config';
import { ServerStore } from '@/services/serverStore';

export interface SecurityDependencies {
    publicClient: PublicClient;
    consumeReplayNonce: (scope: string, roomId: string, actorAddress: string, nonce: string) => Promise<boolean>;
    now: () => number;
    maxClockSkewMs: number;
    nonceMinLength: number;
}

export function createSecurityDependencies(overrides: Partial<SecurityDependencies> = {}): SecurityDependencies {
    const defaults: SecurityDependencies = {
        publicClient: createPublicClient({
            chain: somniaChain,
            transport: http(),
        }),
        consumeReplayNonce: (scope, roomId, actorAddress, nonce) =>
            ServerStore.consumeReplayNonce(scope, roomId, actorAddress, nonce),
        now: () => Date.now(),
        maxClockSkewMs: 2 * 60 * 1000,
        nonceMinLength: 8,
    };

    return {
        ...defaults,
        ...overrides,
    };
}

const defaultDeps = createSecurityDependencies();

interface SessionKeyRecord {
    sessionAddress: string;
    expiresAt: bigint;
    roomId: bigint;
    isActive: boolean;
}

function toSessionKeyRecord(raw: any): SessionKeyRecord {
    if (Array.isArray(raw)) {
        return {
            sessionAddress: String(raw[0]),
            expiresAt: BigInt(raw[1]),
            roomId: BigInt(raw[2]),
            isActive: Boolean(raw[3]),
        };
    }

    return {
        sessionAddress: String(raw.sessionAddress),
        expiresAt: BigInt(raw.expiresAt),
        roomId: BigInt(raw.roomId),
        isActive: Boolean(raw.isActive),
    };
}

async function verifySessionKeyOwnership(
    deps: SecurityDependencies,
    roomId: string,
    actorAddress: string,
    signerAddress: string,
    validateRoomMatch: boolean,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
    const sessionRaw = await deps.publicClient.readContract({
        address: MAFIA_CONTRACT_ADDRESS,
        abi: MAFIA_ABI,
        functionName: 'sessionKeys',
        args: [actorAddress as `0x${string}`],
    });

    const session = toSessionKeyRecord(sessionRaw as any);

    if (!session.sessionAddress || session.sessionAddress.toLowerCase() !== signerAddress) {
        return { ok: false, status: 403, error: 'Session key is not registered for this player' };
    }

    if (!session.isActive || Number(session.expiresAt) <= Math.floor(deps.now() / 1000)) {
        return { ok: false, status: 403, error: 'Session key inactive or expired' };
    }

    if (validateRoomMatch && BigInt(roomId) !== session.roomId) {
        return { ok: false, status: 403, error: 'Session key room mismatch' };
    }

    return { ok: true };
}

export interface SignedRequestVerificationContext<TBody> {
    body: TBody;
    roomId: string;
    actorAddress: string;
    signerAddress: string;
    nonce: string;
    timestamp: number;
    deps: SecurityDependencies;
}

interface VerifySignedRequestOptions<TBody> {
    body: TBody;
    scope: string;
    requiredFields?: string[];
    getRoomId: (body: TBody) => string | number | bigint;
    getActorAddress: (body: TBody) => string;
    getSignerAddress?: (body: TBody) => string | undefined;
    getMessage: (ctx: {
        body: TBody;
        roomId: string;
        actorAddress: string;
        signerAddress: string;
        nonce: string;
        timestamp: number;
    }) => string;
    validateSessionRoomMatch?: boolean;
    requireReplayProtection?: boolean;
    deps?: SecurityDependencies;
}

function isMissingField(value: any): boolean {
    return value === undefined || value === null || value === '';
}

export async function verifySignedRequestBody<TBody extends Record<string, any>>(
    options: VerifySignedRequestOptions<TBody>
): Promise<{ ok: true; context: SignedRequestVerificationContext<TBody> } | { ok: false; status: number; error: string }> {
    const deps = options.deps ?? defaultDeps;

    for (const field of options.requiredFields ?? []) {
        if (isMissingField(options.body[field])) {
            return { ok: false, status: 400, error: `Missing required field: ${field}` };
        }
    }

    const roomIdRaw = options.getRoomId(options.body);
    const roomId = BigInt(roomIdRaw as any).toString();

    const actorAddress = options.getActorAddress(options.body).toLowerCase();
    const signerAddress = (options.getSignerAddress?.(options.body) || actorAddress).toLowerCase();
    const nonce = String(options.body.nonce ?? '');
    const timestamp = Number(options.body.timestamp);

    if (options.requireReplayProtection !== false) {
        if (!Number.isFinite(timestamp) || Math.abs(deps.now() - timestamp) > deps.maxClockSkewMs) {
            return { ok: false, status: 401, error: 'Request expired or invalid timestamp' };
        }

        if (nonce.length < deps.nonceMinLength || nonce.length > 128) {
            return { ok: false, status: 400, error: 'Invalid nonce' };
        }
    }

    const message = options.getMessage({
        body: options.body,
        roomId,
        actorAddress,
        signerAddress,
        nonce,
        timestamp,
    });

    const signature = String(options.body.signature || '');
    if (!signature) {
        return { ok: false, status: 400, error: 'Missing required field: signature' };
    }

    const sigValid = await verifyMessage({
        address: signerAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
    });

    if (!sigValid) {
        return { ok: false, status: 401, error: 'Invalid signature' };
    }

    if (signerAddress !== actorAddress) {
        const sessionCheck = await verifySessionKeyOwnership(
            deps,
            roomId,
            actorAddress,
            signerAddress,
            options.validateSessionRoomMatch !== false,
        );

        if (!sessionCheck.ok) return sessionCheck;
    }

    if (options.requireReplayProtection !== false) {
        const accepted = await deps.consumeReplayNonce(options.scope, roomId, actorAddress, nonce);
        if (!accepted) {
            return { ok: false, status: 409, error: 'Replay detected: nonce already used' };
        }
    }

    return {
        ok: true,
        context: {
            body: options.body,
            roomId,
            actorAddress,
            signerAddress,
            nonce,
            timestamp,
            deps,
        }
    };
}

interface WithSignedRouteOptions<TBody extends Record<string, any>> extends Omit<VerifySignedRequestOptions<TBody>, 'body'> {}

export function withSignedRoute<TBody extends Record<string, any>>(
    options: WithSignedRouteOptions<TBody>,
    handler: (ctx: SignedRequestVerificationContext<TBody>) => Promise<NextResponse>
) {
    return async function POST(request: Request): Promise<NextResponse> {
        try {
            const body = await request.json() as TBody;
            const verified = await verifySignedRequestBody({ ...options, body });

            if (!verified.ok) {
                return NextResponse.json({ error: verified.error }, { status: verified.status });
            }

            return handler(verified.context);
        } catch (error: any) {
            return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
        }
    };
}
