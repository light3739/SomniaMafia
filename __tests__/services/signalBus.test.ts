/**
 * signalBus tests — verifies error isolation and SSR safety.
 *
 * The signal bus is the cross-component event bridge. If one listener
 * throws, others must still execute. If running on the server (no window),
 * it must be a no-op.
 */
import { emitGameSignal } from '@/services/signalBus';

describe('signalBus', () => {
  let dispatchSpy: jest.SpyInstance;

  beforeEach(() => {
    dispatchSpy = jest.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
  });

  it('dispatches CustomEvent with signal as detail', () => {
    const signal = { type: 'phase-change' as const, data: { phase: 3 } };
    emitGameSignal(signal as any);

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('send-game-signal');
    expect(event.detail).toEqual(signal);
  });

  it('wraps dispatchEvent in try-catch for error isolation', () => {
    // Verify the try-catch exists by mocking dispatchEvent to throw
    const originalDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = () => { throw new Error('simulated dispatch failure'); };

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Should not propagate the error
    expect(() => {
      emitGameSignal({ type: 'phase-change' } as any);
    }).not.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SignalBus] Listener error'),
      expect.any(Error),
    );

    errorSpy.mockRestore();
    window.dispatchEvent = originalDispatch;
  });

  it('is a no-op when window is undefined (SSR)', () => {
    const originalWindow = global.window;
    delete (global as any).window;

    expect(() => {
      emitGameSignal({ type: 'test' } as any);
    }).not.toThrow();

    global.window = originalWindow;
  });

  it('listeners receive the signal detail', () => {
    const received: unknown[] = [];
    const handler = (e: Event) => {
      received.push((e as CustomEvent).detail);
    };
    window.addEventListener('send-game-signal', handler);

    emitGameSignal({ type: 'night-resolved', data: { kill: '0xabc' } } as any);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ type: 'night-resolved', data: { kill: '0xabc' } });

    window.removeEventListener('send-game-signal', handler);
  });
});
