import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// jsdom has no scrollIntoView — the component calls it on new messages.
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).scrollIntoView = jest.fn();
});

// Capture the gmWs.on handlers so the test can push events.
const onHandlers: Record<string, (data: unknown) => void> = {};
jest.mock('@/services/gmWebSocket', () => ({
  gmWs: {
    on: (evt: string, h: (d: unknown) => void) => {
      onHandlers[evt] = h;
      return () => { delete onHandlers[evt]; };
    },
    relay: jest.fn(),
    isConnected: true,
    state: 'connected',
    onStateChange: (h: (s: string) => void) => { h('connected'); return () => {}; },
  },
}));

jest.mock('@/contexts/GameContext', () => ({
  useGameContext: () => ({
    gameState: { phase: 3, dayCount: 1 }, // 3 === GamePhase.DAY
    myPlayer: { address: '0xMe', name: 'Me' },
  }),
}));

jest.mock('@/components/ui/SoundEffects', () => ({
  useSoundEffects: () => ({ playChatMessageSound: jest.fn() }),
}));

import { ChatToggleButton } from '@/components/game/DiscussionChat';

it('renders an incoming agent-chat message in the panel', async () => {
  render(<ChatToggleButton isExpanded={true} onToggle={() => {}} canWrite={false} />);
  act(() => {
    onHandlers['agent-chat']?.({
      by: '0xAgentA', text: 'Good morning, town.', persona: 'Gruff Miner',
      day: 1, messageHash: '0xhash1', commitTxHash: '0xtx1',
    });
  });
  expect(await screen.findByText('Good morning, town.')).toBeInTheDocument();
  expect(screen.getByText('Gruff Miner')).toBeInTheDocument();
});

it('renders an incoming discussion-chat message from another human', async () => {
  render(<ChatToggleButton isExpanded={true} onToggle={() => {}} canWrite={false} />);
  act(() => {
    onHandlers['discussion-chat']?.({
      by: '0xHumanB', name: 'Bob', text: 'I suspect C', day: 1, ts: 123,
    });
  });
  expect(await screen.findByText('I suspect C')).toBeInTheDocument();
  expect(screen.getByText('Bob')).toBeInTheDocument();
});

it('skips a discussion-chat echo of my own message (no duplicate with optimistic append)', () => {
  render(<ChatToggleButton isExpanded={true} onToggle={() => {}} canWrite={false} />);
  act(() => {
    onHandlers['discussion-chat']?.({
      by: '0xMe', name: 'Me', text: 'my own line', day: 1, ts: 999,
    });
  });
  expect(screen.queryByText('my own line')).not.toBeInTheDocument();
});

it('deduplicates agent-chat messages with the same messageHash', async () => {
  render(<ChatToggleButton isExpanded={true} onToggle={() => {}} canWrite={false} />);
  const msg = {
    by: '0xAgentA', text: 'repeated line', persona: 'Gruff Miner',
    day: 1, messageHash: '0xdup', commitTxHash: '0xtx',
  };
  act(() => { onHandlers['agent-chat']?.(msg); });
  act(() => { onHandlers['agent-chat']?.(msg); });
  expect(await screen.findByText('repeated line')).toBeInTheDocument();
  expect(screen.getAllByText('repeated line')).toHaveLength(1);
});
