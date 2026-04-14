/**
 * Typed re-exports of Jest-only helpers on the mocked @daily-co/daily-react.
 * Declared in __mocks__/@daily-co/daily-react.tsx.
 */
import * as daily from '@daily-co/daily-react';

type MockedCall = {
    sendAppMessage: jest.Mock;
    join: jest.Mock;
    leave: jest.Mock;
    destroy: jest.Mock;
    setLocalAudio: jest.Mock;
    on: jest.Mock;
    off: jest.Mock;
    meetingState: jest.Mock;
    participants: jest.Mock;
};

export const __mockCall: MockedCall = (daily as any).__mockCall;
export const __triggerAppMessage: (data: any, fromId?: string) => void = (daily as any).__triggerAppMessage;
export const __resetDailyMocks: () => void = (daily as any).__resetDailyMocks;
