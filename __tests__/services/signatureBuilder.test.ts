/**
 * SignatureBuilder + signingSchema tests.
 *
 * These tests verify that frontend and GM server produce IDENTICAL message strings.
 * A mismatch here means signature verification will fail in production.
 * The builder is shared logic — signingSchema.ts builds messages for specific actions.
 */
import { SignatureBuilder } from '@/services/SignatureBuilder';
import {
  buildAvatarMessage,
  buildNightActionMessage,
  buildResolveNightMessage,
  buildDiscussionMessage,
  buildRegisterPubkeyMessage,
  buildTokenMessage,
  buildInvestigateMessage,
  buildRoleSyncMessage,
  buildMafiaMembersMessage,
  buildRevealSecretMessage,
} from '@/services/signingSchema';

// ================================================================
// SIGNATURE BUILDER — Core string construction
// ================================================================

describe('SignatureBuilder', () => {
  it('builds base format: action:chainId:roomId', () => {
    expect(new SignatureBuilder('night', 50312, '42').build()).toBe('night:50312:42');
  });

  it('defaults chainId to 50312 when undefined', () => {
    expect(new SignatureBuilder('test', undefined, '1').build()).toBe('test:50312:1');
  });

  it('coerces chainId and roomId to strings', () => {
    expect(new SignatureBuilder('x', 43113, 99).build()).toBe('x:43113:99');
  });

  it('lowercases addresses', () => {
    const msg = new SignatureBuilder('a', 1, '1').withAddress('0xABCDEF').build();
    expect(msg).toBe('a:1:1:0xabcdef');
  });

  it('preserves case for generic params', () => {
    const msg = new SignatureBuilder('a', 1, '1').withParam('Kill').build();
    expect(msg).toBe('a:1:1:Kill');
  });

  it('chains multiple params with colons', () => {
    const msg = new SignatureBuilder('a', 1, '1')
      .withParam('kill')
      .withAddress('0xABC')
      .withParam(42)
      .build();
    expect(msg).toBe('a:1:1:kill:0xabc:42');
  });

  it('appends modern replay protection suffix', () => {
    const msg = new SignatureBuilder('a', 1, '1')
      .withModern('nonce123', 1700000000)
      .build();
    expect(msg).toBe('a:1:1:nonce123:1700000000');
  });

  it('full chain: params + modern suffix', () => {
    const msg = new SignatureBuilder('register-session', '50312', '42')
      .withAddress('0xMain')
      .withAddress('0xSession')
      .withModern('abc', 999)
      .build();
    expect(msg).toBe('register-session:50312:42:0xmain:0xsession:abc:999');
  });
});

// ================================================================
// SIGNING SCHEMA — Action-specific message builders
// ================================================================

describe('signingSchema', () => {
  const CHAIN = 50312;
  const ROOM = '42';
  const ADDR = '0xAbCdEf0000000000000000000000000000000001';
  const NONCE = 'nonce_xyz';
  const TS = 1700000000;

  describe('buildAvatarMessage', () => {
    it('matches expected format', () => {
      const msg = buildAvatarMessage({ roomId: ROOM, address: ADDR, nonce: NONCE, timestamp: TS, chainId: CHAIN });
      expect(msg).toBe(`avatar:${CHAIN}:${ROOM}:${ADDR.toLowerCase()}:${NONCE}:${TS}`);
    });
  });

  describe('buildNightActionMessage', () => {
    it('includes dayCount, actionType, target, nonce', () => {
      const msg = buildNightActionMessage({
        roomId: ROOM, dayCount: 3, actionType: 'kill',
        targetAddress: ADDR, nonce: NONCE, timestamp: TS, chainId: CHAIN,
      });
      expect(msg).toBe(`night:${CHAIN}:${ROOM}:3:kill:${ADDR.toLowerCase()}:${NONCE}:${TS}`);
    });

    it('different actionTypes produce different messages', () => {
      const base = { roomId: ROOM, dayCount: 1, targetAddress: ADDR, nonce: NONCE, timestamp: TS, chainId: CHAIN };
      const kill = buildNightActionMessage({ ...base, actionType: 'kill' });
      const heal = buildNightActionMessage({ ...base, actionType: 'heal' });
      const check = buildNightActionMessage({ ...base, actionType: 'check' });
      expect(kill).not.toBe(heal);
      expect(heal).not.toBe(check);
      expect(kill).toContain(':kill:');
      expect(heal).toContain(':heal:');
      expect(check).toContain(':check:');
    });
  });

  describe('buildResolveNightMessage', () => {
    it('has no target or action params', () => {
      const msg = buildResolveNightMessage({ roomId: ROOM, nonce: NONCE, timestamp: TS, chainId: CHAIN });
      expect(msg).toBe(`resolve-night:${CHAIN}:${ROOM}:${NONCE}:${TS}`);
    });
  });

  describe('buildDiscussionMessage', () => {
    it('includes dayCount and action', () => {
      const msg = buildDiscussionMessage({
        roomId: ROOM, dayCount: 2, action: 'start', nonce: NONCE, timestamp: TS, chainId: CHAIN,
      });
      expect(msg).toBe(`discussion:${CHAIN}:${ROOM}:2:start:${NONCE}:${TS}`);
    });
  });

  describe('buildMafiaMembersMessage', () => {
    it('matches expected format (no extra params)', () => {
      const msg = buildMafiaMembersMessage({ roomId: ROOM, nonce: NONCE, timestamp: TS, chainId: CHAIN });
      expect(msg).toBe(`mafia-members:${CHAIN}:${ROOM}:${NONCE}:${TS}`);
    });
  });

  describe('buildRevealSecretMessage', () => {
    it('has no nonce/timestamp (one-time reveal)', () => {
      const msg = buildRevealSecretMessage({ roomId: ROOM, role: 1, salt: 'mysalt', chainId: CHAIN });
      expect(msg).toBe(`reveal-secret:${CHAIN}:${ROOM}:1:mysalt`);
      // No nonce/timestamp — deterministic per role+salt
    });
  });

  describe('buildRegisterPubkeyMessage', () => {
    it('includes pubkey as param (case preserved)', () => {
      const msg = buildRegisterPubkeyMessage({
        roomId: ROOM, address: ADDR, pubkey: '0xPUBKEY_HEX', nonce: NONCE, timestamp: TS, chainId: CHAIN,
      });
      expect(msg).toContain(':0xPUBKEY_HEX:');
      expect(msg).toContain(ADDR.toLowerCase());
    });
  });

  describe('buildInvestigateMessage', () => {
    it('includes dayCount and target', () => {
      const msg = buildInvestigateMessage({
        roomId: ROOM, dayCount: 4, targetAddress: ADDR, nonce: NONCE, timestamp: TS, chainId: CHAIN,
      });
      expect(msg).toBe(`investigate:${CHAIN}:${ROOM}:4:${ADDR.toLowerCase()}:${NONCE}:${TS}`);
    });
  });

  describe('buildRoleSyncMessage', () => {
    it('lowercases txHash (treated as address)', () => {
      const msg = buildRoleSyncMessage({
        roomId: ROOM, txHash: '0xABCDEF123456', nonce: NONCE, timestamp: TS, chainId: CHAIN,
      });
      expect(msg).toContain(':0xabcdef123456:');
    });
  });

  // ---- Cross-cutting: message uniqueness ----

  describe('Cross-action uniqueness', () => {
    it('different actions produce different messages even with same params', () => {
      const base = { roomId: ROOM, nonce: NONCE, timestamp: TS, chainId: CHAIN };
      const resolve = buildResolveNightMessage(base);
      const mafia = buildMafiaMembersMessage(base);
      expect(resolve).not.toBe(mafia);
      // Action prefix differs: resolve-night vs mafia-members
    });

    it('different roomIds produce different messages', () => {
      const base = { nonce: NONCE, timestamp: TS, chainId: CHAIN };
      const r1 = buildResolveNightMessage({ ...base, roomId: '1' });
      const r2 = buildResolveNightMessage({ ...base, roomId: '2' });
      expect(r1).not.toBe(r2);
    });

    it('different chainIds produce different messages', () => {
      const base = { roomId: ROOM, nonce: NONCE, timestamp: TS };
      const fuji = buildResolveNightMessage({ ...base, chainId: 43113 });
      const somnia = buildResolveNightMessage({ ...base, chainId: 50312 });
      expect(fuji).not.toBe(somnia);
    });

    it('different nonces produce different messages', () => {
      const base = { roomId: ROOM, timestamp: TS, chainId: CHAIN };
      const n1 = buildResolveNightMessage({ ...base, nonce: 'aaa' });
      const n2 = buildResolveNightMessage({ ...base, nonce: 'bbb' });
      expect(n1).not.toBe(n2);
    });
  });
});
