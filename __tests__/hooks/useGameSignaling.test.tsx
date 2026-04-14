/**
 * useGameSignaling — Daily.co app-message bridge tests.
 *
 * Replaces LiveKit DataChannel with Daily's sendAppMessage / onAppMessage.
 * Verifies outbound broadcast + inbound dispatch to GameContext setters.
 */
jest.mock('@daily-co/daily-react', () => jest.requireActual('../../__mocks__/@daily-co/daily-react'));

const mockGameContext = {
    setVoteMap: jest.fn(),
    setGameState: jest.fn(),
    currentRoomId: 42n,
    handleIncomingMafiaSignal: jest.fn(),
    fetchDiscussionState: jest.fn(),
};

jest.mock('../../contexts/GameContext', () => ({
    useGameContext: () => mockGameContext,
}));

jest.mock('wagmi', () => ({
    useAccount: () => ({ address: '0xAAaaAAaAAAaAaAaAAaAAaAaAAAAaAaaAaAaAAaAA' }),
}));

import { renderHook, act } from '@testing-library/react';
import { useGameSignaling, type GameSignal } from '@/hooks/useGameSignaling';
import { __mockCall, __triggerAppMessage, __resetDailyMocks } from '../_helpers/dailyMock';

const MY_ADDR_LC = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER_ADDR_LC = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

beforeEach(() => {
    __resetDailyMocks();
    mockGameContext.setVoteMap.mockReset();
    mockGameContext.setGameState.mockReset();
    mockGameContext.handleIncomingMafiaSignal.mockReset();
    mockGameContext.fetchDiscussionState.mockReset();
    mockGameContext.currentRoomId = 42n;
});

describe('useGameSignaling (Daily)', () => {
    it('broadcast() calls sendAppMessage with the signal object', () => {
        const { result } = renderHook(() => useGameSignaling());

        const signal: GameSignal = {
            type: 'OPTIMISTIC_VOTE',
            voter: MY_ADDR_LC,
            target: OTHER_ADDR_LC,
            roomId: '42',
        };
        act(() => { result.current.broadcast(signal); });

        expect(__mockCall.sendAppMessage).toHaveBeenCalledTimes(1);
        expect(__mockCall.sendAppMessage).toHaveBeenCalledWith(signal, '*');
    });

    it('incoming OPTIMISTIC_VOTE from another player updates state', () => {
        renderHook(() => useGameSignaling());

        act(() => {
            __triggerAppMessage({
                type: 'OPTIMISTIC_VOTE',
                voter: OTHER_ADDR_LC,
                target: MY_ADDR_LC,
                roomId: '42',
            });
        });

        expect(mockGameContext.setVoteMap).toHaveBeenCalledTimes(1);
        expect(mockGameContext.setGameState).toHaveBeenCalledTimes(1);
    });

    it('incoming signal from self is ignored', () => {
        renderHook(() => useGameSignaling());

        act(() => {
            __triggerAppMessage({
                type: 'OPTIMISTIC_VOTE',
                voter: MY_ADDR_LC,
                target: OTHER_ADDR_LC,
                roomId: '42',
            });
        });

        expect(mockGameContext.setVoteMap).not.toHaveBeenCalled();
        expect(mockGameContext.setGameState).not.toHaveBeenCalled();
    });

    it('incoming signal from a different room is ignored', () => {
        renderHook(() => useGameSignaling());

        act(() => {
            __triggerAppMessage({
                type: 'OPTIMISTIC_VOTE',
                voter: OTHER_ADDR_LC,
                target: MY_ADDR_LC,
                roomId: '999',
            });
        });

        expect(mockGameContext.setVoteMap).not.toHaveBeenCalled();
    });

    it('incoming OPTIMISTIC_COMMITTED updates gameState players', () => {
        renderHook(() => useGameSignaling());

        act(() => {
            __triggerAppMessage({
                type: 'OPTIMISTIC_COMMITTED',
                player: OTHER_ADDR_LC,
                roomId: '42',
            });
        });

        expect(mockGameContext.setGameState).toHaveBeenCalledTimes(1);
    });

    it('incoming OPTIMISTIC_SPEAKER triggers fetchDiscussionState', () => {
        renderHook(() => useGameSignaling());

        act(() => {
            __triggerAppMessage({
                type: 'OPTIMISTIC_SPEAKER',
                playerName: 'Bob',
                playerAddress: OTHER_ADDR_LC,
                roomId: '42',
            });
        });

        expect(mockGameContext.fetchDiscussionState).toHaveBeenCalledTimes(1);
    });

    it('incoming MAFIA_CHAT forwards to handleIncomingMafiaSignal', () => {
        renderHook(() => useGameSignaling());

        act(() => {
            __triggerAppMessage({
                type: 'MAFIA_CHAT',
                encryptedData: '0xcafe',
                sender: OTHER_ADDR_LC,
                roomId: '42',
            });
        });

        expect(mockGameContext.handleIncomingMafiaSignal).toHaveBeenCalledWith(OTHER_ADDR_LC, '0xcafe');
    });

    it('non-game payload is ignored (no throw)', () => {
        renderHook(() => useGameSignaling());

        expect(() => {
            act(() => {
                __triggerAppMessage({ type: 'SOMETHING_ELSE' });
                __triggerAppMessage(null);
                __triggerAppMessage({ foo: 'bar' });
            });
        }).not.toThrow();

        expect(mockGameContext.setVoteMap).not.toHaveBeenCalled();
    });

    it('broadcast does not throw when useDaily returns null', async () => {
        const daily = await import('@daily-co/daily-react');
        (daily.useDaily as jest.Mock).mockReturnValueOnce(null);

        const { result } = renderHook(() => useGameSignaling());
        const signal: GameSignal = {
            type: 'OPTIMISTIC_VOTE',
            voter: MY_ADDR_LC,
            target: OTHER_ADDR_LC,
            roomId: '42',
        };

        expect(() => act(() => { result.current.broadcast(signal); })).not.toThrow();
    });
});
