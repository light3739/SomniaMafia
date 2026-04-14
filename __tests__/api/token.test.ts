/**
 * @jest-environment node
 *
 * /api/token Daily.co migration tests.
 *
 * Verifies the token route correctly swaps LiveKit for Daily:
 *   1. creates Daily room (idempotent on 409)
 *   2. mints Daily meeting token
 *   3. preserves signed-request auth and on-chain player-membership check
 */

jest.mock('@/app/api/_lib/security', () => ({
    verifySignedRequestBody: jest.fn(),
}));

jest.mock('viem', () => {
    const actual = jest.requireActual('viem');
    return {
        ...actual,
        createPublicClient: jest.fn(),
    };
});

jest.mock('@/contracts/config', () => {
    const deployment = {
        chain: { id: 50312, name: 'Somnia Testnet' },
        chainId: 50312,
        explorer: 'https://explorer.example',
        contracts: {
            MafiaDiamond: '0x1111111111111111111111111111111111111111',
            Groth16Verifier: '0x2222222222222222222222222222222222222222',
            LobbyFacet: '0x0',
            ShuffleFacet: '0x0',
            VotingFacet: '0x0',
            NightFacet: '0x0',
            GameEndFacet: '0x0',
            TournamentFacet: '0x0',
            TimeoutsFacet: '0x0',
            RefundsFacet: '0x0',
        },
    };
    return {
        somniaChain: deployment.chain,
        MAFIA_CONTRACT_ADDRESS: deployment.contracts.MafiaDiamond,
        MAFIA_ABI: [],
        ACTIVE_DEPLOYMENT: deployment,
        getDeploymentByChainId: jest.fn(() => deployment),
    };
});

import { POST } from '@/app/api/token/route';
import { verifySignedRequestBody } from '@/app/api/_lib/security';
import { createPublicClient } from 'viem';

const PLAYER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function buildRequest(overrides: Record<string, unknown> = {}): Request {
    const body = {
        room: '42-lobby',
        username: 'Alice',
        playerAddress: PLAYER,
        signerAddress: PLAYER,
        signature: '0xdeadbeef',
        nonce: 'abcdef12',
        timestamp: Math.floor(Date.now() / 1000),
        chainId: 50312,
        ...overrides,
    };
    return new Request('http://localhost/api/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'jest' },
        body: JSON.stringify(body),
    });
}

const mockVerify = verifySignedRequestBody as jest.Mock;
const mockCreateClient = createPublicClient as jest.Mock;

describe('/api/token Daily migration', () => {
    let fetchMock: jest.Mock;
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        jest.clearAllMocks();

        process.env.DAILY_API_KEY = 'test-daily-key';
        process.env.NEXT_PUBLIC_DAILY_DOMAIN = 'mafiaonchain';

        originalFetch = global.fetch;
        fetchMock = jest.fn();
        global.fetch = fetchMock as any;

        mockCreateClient.mockReturnValue({
            readContract: jest.fn(async () => [{ wallet: PLAYER }]),
        });

        mockVerify.mockResolvedValue({
            ok: true,
            context: {
                body: {},
                roomId: '42',
                actorAddress: PLAYER,
                signerAddress: PLAYER,
                nonce: 'abcdef12',
                timestamp: 0,
                deps: {} as any,
            },
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
        delete process.env.DAILY_API_KEY;
        delete process.env.NEXT_PUBLIC_DAILY_DOMAIN;
    });

    function mockDailyRoomsOk() {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ name: 'mafia-50312-42', url: 'https://mafiaonchain.daily.co/mafia-50312-42' }),
            text: async () => '',
        });
    }
    function mockDailyRoomsConflict() {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 409,
            json: async () => ({ error: 'already-exists' }),
            text: async () => 'already-exists',
        });
    }
    function mockDailyTokenOk(token = 'daily-token-123') {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ token }),
            text: async () => '',
        });
    }

    it('mints a Daily token on a valid signed request for a game room', async () => {
        mockDailyRoomsOk();
        mockDailyTokenOk();

        const res = await POST(buildRequest() as any);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.token).toBe('daily-token-123');
        expect(body.roomUrl).toContain('mafiaonchain.daily.co');
        expect(fetchMock).toHaveBeenCalledTimes(2);

        const [[roomsUrl, roomsInit], [tokensUrl, tokensInit]] = fetchMock.mock.calls;
        expect(roomsUrl).toBe('https://api.daily.co/v1/rooms');
        expect(tokensUrl).toBe('https://api.daily.co/v1/meeting-tokens');
        expect((roomsInit as RequestInit).headers).toMatchObject({
            Authorization: 'Bearer test-daily-key',
        });
        expect((tokensInit as RequestInit).headers).toMatchObject({
            Authorization: 'Bearer test-daily-key',
        });
    });

    it('still mints token when Daily /rooms returns 409 (already exists)', async () => {
        mockDailyRoomsConflict();
        mockDailyTokenOk('token-after-conflict');

        const res = await POST(buildRequest() as any);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.token).toBe('token-after-conflict');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('returns 401 when signature verification fails', async () => {
        mockVerify.mockResolvedValueOnce({ ok: false, status: 401, error: 'Invalid signature' });

        const res = await POST(buildRequest() as any);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Invalid signature');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 403 when signer is not an on-chain player', async () => {
        mockCreateClient.mockReturnValue({
            readContract: jest.fn(async () => [{ wallet: OTHER }]),
        });

        const res = await POST(buildRequest() as any);
        const body = await res.json();

        expect(res.status).toBe(403);
        expect(body.error).toContain('not a member');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 500 when DAILY_API_KEY env is missing', async () => {
        delete process.env.DAILY_API_KEY;

        const res = await POST(buildRequest() as any);
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toMatch(/misconfigured/i);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 500 when Daily API is unreachable', async () => {
        fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

        const res = await POST(buildRequest() as any);
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toBeTruthy();
    });

    it('returns 400 for a game room request missing required signature fields', async () => {
        const res = await POST(buildRequest({ signature: undefined }) as any);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toMatch(/missing/i);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 400 when room is missing', async () => {
        const res = await POST(buildRequest({ room: undefined }) as any);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toMatch(/missing room/i);
    });
});
