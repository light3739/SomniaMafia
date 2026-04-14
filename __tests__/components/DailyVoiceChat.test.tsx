/**
 * DailyVoiceChat render tests.
 *
 * Verifies the Daily-backed replacement for LiveKitVoiceChat handles:
 *   - inactive state (null)
 *   - loading (token fetch pending)
 *   - fetch failure (error + retry button)
 *   - successful token → call.join invoked
 */
jest.mock('@daily-co/daily-react', () => jest.requireActual('../../__mocks__/@daily-co/daily-react'));
jest.mock('@daily-co/daily-js', () => jest.requireActual('../../__mocks__/@daily-co/daily-js'));

jest.mock('wagmi', () => ({
    useAccount: () => ({ address: '0xAAaa', chainId: 50312 }),
    useWalletClient: () => ({ data: { signMessage: jest.fn() } }),
}));

jest.mock('@/services/requestSigning', () => ({
    signRequest: jest.fn(async () => ({
        signature: '0xdead',
        signerAddress: '0xAAaa',
        nonce: 'abcdef12',
        timestamp: Math.floor(Date.now() / 1000),
    })),
}));

jest.mock('@/services/sessionKeyService', () => ({
    loadSession: jest.fn(() => null),
}));

jest.mock('@/services/signingSchema', () => ({
    buildTokenMessage: jest.fn(() => 'token-msg:50312:42'),
}));

jest.mock('@/hooks/useGameSignaling', () => ({
    useGameSignaling: () => ({ broadcast: jest.fn() }),
}));

import { render, screen, waitFor } from '@testing-library/react';
import { DailyVoiceChat } from '@/components/game/DailyVoiceChat';
import { __mockCall, __resetDailyMocks } from '../_helpers/dailyMock';

let fetchMock: jest.Mock;

beforeEach(() => {
    __resetDailyMocks();
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
});

describe('DailyVoiceChat', () => {
    it('renders null when isActive=false', () => {
        const { container } = render(
            <DailyVoiceChat roomId="42-lobby" userName="Alice" isActive={false} />
        );
        expect(container.firstChild).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('shows a loader while the token request is pending', () => {
        fetchMock.mockReturnValue(new Promise(() => { /* never resolves */ }));

        render(<DailyVoiceChat roomId="42-lobby" userName="Alice" isActive={true} />);

        expect(screen.getByText(/connecting to voice/i)).toBeInTheDocument();
    });

    it('shows an error and retry button when the token fetch fails', async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ error: 'server-misconfigured' }),
            text: async () => 'server-misconfigured',
        });

        render(<DailyVoiceChat roomId="42-lobby" userName="Alice" isActive={true} />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
        });
    });

    it('calls call.join with returned url and token on successful fetch', async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                token: 'daily-token',
                roomUrl: 'https://mafiaonchain.daily.co/mafia-50312-42',
                roomName: 'mafia-50312-42',
            }),
            text: async () => '',
        });

        render(<DailyVoiceChat roomId="42-lobby" userName="Alice" isActive={true} />);

        await waitFor(() => {
            expect(__mockCall.join).toHaveBeenCalledTimes(1);
        }, { timeout: 3000 });
        expect(__mockCall.join).toHaveBeenCalledWith(expect.objectContaining({
            url: 'https://mafiaonchain.daily.co/mafia-50312-42',
            token: 'daily-token',
        }));
    });
});
