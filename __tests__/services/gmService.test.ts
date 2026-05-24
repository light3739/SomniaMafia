/**
 * gmService — reveal-handshake reliability.
 *
 * Root cause of the mixed-game roles=NONE bug (prod room 31): the human's SRA
 * key never reached the GM. The browser signed with a stale session key, the GM
 * returned 403 (unlogged), and the silent catch swallowed it → key never stored
 * → GM could not peel the human's deck layer → every role decoded to NONE.
 *
 * Fix: on a session-auth rejection (401/403) the GM calls must retry once with
 * forceWallet=true (self-sign with the main wallet, bypassing the stale session
 * key) so the key reliably lands.
 */
import { submitSraKeyToGm, registerEciesPubkey } from '@/services/gmService';
import { signRequest } from '@/services/requestSigning';

jest.mock('@/contracts/config', () => ({ GM_SERVER_URL: 'http://gm.test' }));
jest.mock('@/services/eciesService', () => ({
  loadOrCreateKeypair: jest.fn(async () => ({ publicKey: {}, privateKey: {}, isNew: true })),
  exportPublicKeyHex: jest.fn(async () => '0xpub'),
  eciesDecrypt: jest.fn(),
}));
jest.mock('@/services/requestSigning', () => ({ signRequest: jest.fn() }));

const mockSign = signRequest as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSign.mockResolvedValue({ signature: '0xsig', signerAddress: '0xsigner', nonce: 'n', timestamp: 1, message: 'm' });
});

describe('submitSraKeyToGm — wallet fallback on stale-session 403', () => {
  const params = { roomId: '31', address: '0xabc', sraKey: '123', walletClient: {}, chainId: 50312 };

  it('retries once with forceWallet=true when the GM rejects with 403', async () => {
    (global as any).fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: 'Session key mismatch/stale' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });

    await expect(submitSraKeyToGm(params)).resolves.toBeUndefined();

    expect(mockSign).toHaveBeenCalledTimes(2);
    expect(mockSign.mock.calls[0][0].forceWallet).toBeFalsy();
    expect(mockSign.mock.calls[1][0].forceWallet).toBe(true);
  });

  it('does not retry on first-try success', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    await submitSraKeyToGm(params);
    expect(mockSign).toHaveBeenCalledTimes(1);
  });

  it('throws if the wallet-fallback retry also fails', async () => {
    (global as any).fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: 'stale' }) })
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: 'stale again' }) });
    await expect(submitSraKeyToGm(params)).rejects.toThrow(/submit SRA key/i);
    expect(mockSign).toHaveBeenCalledTimes(2);
  });
});

describe('registerEciesPubkey — wallet fallback on stale-session 403', () => {
  const args = ['31', '0xabc', {} as any, 50312] as const;

  it('retries once with forceWallet=true when the GM rejects with 403', async () => {
    (global as any).fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: 'stale' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });

    await registerEciesPubkey(...args);

    expect(mockSign).toHaveBeenCalledTimes(2);
    expect(mockSign.mock.calls[1][0].forceWallet).toBe(true);
  });
});
