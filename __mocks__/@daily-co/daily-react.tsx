import React from 'react';

type AppMessageHandler = (ev: { data: any; fromId?: string }) => void;

const appMessageHandlers = new Set<AppMessageHandler>();

const call = {
    sendAppMessage: jest.fn(),
    join: jest.fn(() => Promise.resolve()),
    leave: jest.fn(() => Promise.resolve()),
    destroy: jest.fn(() => Promise.resolve()),
    setLocalAudio: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    meetingState: jest.fn(() => 'joined-meeting'),
    participants: jest.fn(() => ({ local: { session_id: 'local-session' } })),
};

export const __mockCall = call;

export const __triggerAppMessage = (data: any, fromId = 'remote-peer') => {
    appMessageHandlers.forEach((h) => h({ data, fromId }));
};

export const __resetDailyMocks = () => {
    appMessageHandlers.clear();
    call.sendAppMessage.mockReset();
    call.join.mockReset().mockImplementation(() => Promise.resolve());
    call.leave.mockReset().mockImplementation(() => Promise.resolve());
    call.destroy.mockReset().mockImplementation(() => Promise.resolve());
    call.setLocalAudio.mockReset();
    call.on.mockReset();
    call.off.mockReset();
};

export const DailyProvider = (props: any) => props.children ?? null;

export const useDaily = jest.fn(() => call);

export const useAppMessage = jest.fn(({ onAppMessage }: { onAppMessage?: AppMessageHandler } = {}) => {
    React.useEffect(() => {
        if (!onAppMessage) return;
        appMessageHandlers.add(onAppMessage);
        return () => {
            appMessageHandlers.delete(onAppMessage);
        };
    }, [onAppMessage]);
    return { sendAppMessage: call.sendAppMessage };
});

export const useMeetingState = jest.fn(() => 'joined-meeting');
export const useLocalSessionId = jest.fn(() => 'local-session');
export const useParticipantIds = jest.fn(() => [] as string[]);
export const useParticipant = jest.fn(() => null);
export const useParticipantProperty = jest.fn(() => 'off');
export const useAudioLevel = jest.fn(() => 0);

export const DailyAudio: React.FC = () => null;
