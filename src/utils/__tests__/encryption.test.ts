// ═══════════════════════════════════════════════════════════════════════
// ENCRYPTION TESTS — legacy v1 (crypto-js AES-CBC) + v2 (Web Crypto AES-GCM)
// Regression tests asserting EXACT current behavior of src/utils/encryption.ts.
// Web Crypto suites are gated on crypto.subtle availability so they run on
// Node/Mac (`npm test`) and skip cleanly in environments without SubtleCrypto.
// Firebase imports inside encryption.ts are mocked globally by src/__tests__/setup.ts.
// ═══════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  generateConversationKey,
  encryptMessage,
  decryptMessage,
  isEncryptedPayload,
  e2eEncrypt,
  e2eDecrypt,
  deriveSharedKey,
  generateGroupKey,
  exportGroupKey,
  importGroupKey,
  wrapGroupKeyForMember,
  unwrapGroupKeyForMember,
  wrapGroupKeyForMemberWithECDH,
  unwrapGroupKeyWithECDH,
  getDeterministicSharedKey,
} from '../encryption';
import type { ExportedPublicKey } from '../encryption';

const DECRYPT_FALLBACK = '[Unable to decrypt message]';

// ═══════════════════════════════════════════════════════════════════════
// Legacy v1: generateConversationKey (PBKDF2 → hex)
// ═══════════════════════════════════════════════════════════════════════
describe('generateConversationKey', () => {
  it('is deterministic — same inputs always produce the same key', () => {
    const k1 = generateConversationKey('alice-uid', 'bob-uid');
    const k2 = generateConversationKey('alice-uid', 'bob-uid');
    expect(k1).toBe(k2);
  });

  it('is order-insensitive — (uid1, uid2) === (uid2, uid1)', () => {
    const k1 = generateConversationKey('alice-uid', 'bob-uid');
    const k2 = generateConversationKey('bob-uid', 'alice-uid');
    expect(k1).toBe(k2);
  });

  it('produces different keys for different user pairs', () => {
    const kAB = generateConversationKey('alice-uid', 'bob-uid');
    const kAC = generateConversationKey('alice-uid', 'carol-uid');
    const kBC = generateConversationKey('bob-uid', 'carol-uid');
    expect(kAB).not.toBe(kAC);
    expect(kAB).not.toBe(kBC);
    expect(kAC).not.toBe(kBC);
  });

  it('returns a 64-char lowercase hex string (256-bit key)', () => {
    const key = generateConversationKey('alice-uid', 'bob-uid');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Legacy v1: encryptMessage / decryptMessage round-trips (AES-CBC + Pkcs7)
// ═══════════════════════════════════════════════════════════════════════
describe('encryptMessage / decryptMessage round-trip', () => {
  const key = generateConversationKey('alice-uid', 'bob-uid');

  it('round-trips a simple plaintext', () => {
    const plaintext = 'hello world';
    const payload = encryptMessage(plaintext, key);
    expect(payload).not.toBe(plaintext);
    expect(decryptMessage(payload, key)).toBe(plaintext);
  });

  it('produces a JSON payload with hex iv and ciphertext', () => {
    const payload = encryptMessage('hello', key);
    const parsed = JSON.parse(payload);
    expect(Object.keys(parsed).sort()).toEqual(['ciphertext', 'iv']);
    expect(parsed.iv).toMatch(/^[0-9a-f]{32}$/); // 16-byte IV as hex
    expect(parsed.ciphertext).toMatch(/^[0-9a-f]+$/);
    expect(parsed.ciphertext.length % 32).toBe(0); // whole 16-byte CBC blocks
  });

  it('uses a random IV — encrypting the same plaintext twice differs', () => {
    const p1 = encryptMessage('same message', key);
    const p2 = encryptMessage('same message', key);
    expect(JSON.parse(p1).iv).not.toBe(JSON.parse(p2).iv);
    expect(p1).not.toBe(p2);
    // Both still decrypt to the same plaintext
    expect(decryptMessage(p1, key)).toBe('same message');
    expect(decryptMessage(p2, key)).toBe('same message');
  });

  it('round-trips unicode and emoji', () => {
    const plaintext = 'héllo wörld 你好世界 مرحبا 🎉🚀👨‍👩‍👧‍👦';
    expect(decryptMessage(encryptMessage(plaintext, key), key)).toBe(plaintext);
  });

  it('round-trips a long string (10k chars)', () => {
    const plaintext = 'sangam-'.repeat(1500); // 10,500 chars
    expect(decryptMessage(encryptMessage(plaintext, key), key)).toBe(plaintext);
  });

  it('empty string does NOT round-trip — decrypt returns the fallback string (current behavior)', () => {
    // decryptMessage does `plaintext || '[Unable to decrypt message]'`, so an
    // empty decrypted string is indistinguishable from a failed decrypt.
    const payload = encryptMessage('', key);
    const parsed = JSON.parse(payload);
    expect(parsed.iv).toMatch(/^[0-9a-f]{32}$/); // encryption itself succeeds
    expect(decryptMessage(payload, key)).toBe(DECRYPT_FALLBACK);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Legacy v1: decryptMessage with the WRONG key
// ═══════════════════════════════════════════════════════════════════════
describe('decryptMessage with wrong key', () => {
  const rightKey = generateConversationKey('alice-uid', 'bob-uid');
  const wrongKey = generateConversationKey('mallory-uid', 'eve-uid');

  it('never returns the original plaintext', () => {
    const plaintext = 'top secret meeting at noon';
    const payload = encryptMessage(plaintext, rightKey);
    const result = decryptMessage(payload, wrongKey);
    expect(typeof result).toBe('string');
    expect(result).not.toBe(plaintext);
  });

  it('returns either the fallback string, the payload as-is, or garbage — but not the plaintext', () => {
    // CBC + Pkcs7 with a wrong key usually yields invalid padding/UTF-8:
    // toString(Utf8) → '' → fallback, or it throws → catch returns payload as-is.
    // Occasionally it may yield garbage bytes that happen to decode. All are
    // acceptable as long as the plaintext never leaks.
    for (let i = 0; i < 5; i++) {
      const plaintext = `secret-${i}-${'x'.repeat(40)}`;
      const payload = encryptMessage(plaintext, rightKey);
      const result = decryptMessage(payload, wrongKey);
      expect(result).not.toBe(plaintext);
      expect(result).not.toContain(plaintext);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Legacy v1: decryptMessage passthrough behavior
// ═══════════════════════════════════════════════════════════════════════
describe('decryptMessage passthroughs', () => {
  const key = generateConversationKey('alice-uid', 'bob-uid');

  it('returns non-JSON input as-is', () => {
    expect(decryptMessage('just a plain message', key)).toBe('just a plain message');
  });

  it('returns valid-JSON-but-not-an-encrypted-payload input as-is', () => {
    expect(decryptMessage('42', key)).toBe('42');
    expect(decryptMessage('{"foo":"bar"}', key)).toBe('{"foo":"bar"}');
  });

  it('returns a v2 payload ({v:2, iv, ct}) as-is (missing "ciphertext" short-circuits)', () => {
    const v2 = JSON.stringify({ v: 2, iv: 'AAAA', ct: 'BBBB' });
    expect(decryptMessage(v2, key)).toBe(v2);
  });

  it('returns a payload marked v:2 as-is even when it has iv + ciphertext', () => {
    const v2ish = JSON.stringify({ v: 2, iv: '00112233445566778899aabbccddeeff', ciphertext: 'deadbeef' });
    expect(decryptMessage(v2ish, key)).toBe(v2ish);
  });

  it('returns payloads missing iv or ciphertext as-is', () => {
    const noIv = JSON.stringify({ ciphertext: 'deadbeef' });
    const noCt = JSON.stringify({ iv: '00112233445566778899aabbccddeeff' });
    expect(decryptMessage(noIv, key)).toBe(noIv);
    expect(decryptMessage(noCt, key)).toBe(noCt);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// isEncryptedPayload
// ═══════════════════════════════════════════════════════════════════════
describe('isEncryptedPayload', () => {
  it('returns true for a v1 payload ({iv, ciphertext})', () => {
    const key = generateConversationKey('alice-uid', 'bob-uid');
    expect(isEncryptedPayload(encryptMessage('hi', key))).toBe(true);
    expect(isEncryptedPayload(JSON.stringify({ iv: 'aa', ciphertext: 'bb' }))).toBe(true);
  });

  it('returns true for the v2 variant ({iv, ct})', () => {
    expect(isEncryptedPayload(JSON.stringify({ v: 2, iv: 'aa', ct: 'bb' }))).toBe(true);
    expect(isEncryptedPayload(JSON.stringify({ iv: 'aa', ct: 'bb' }))).toBe(true);
  });

  it('returns false when iv is present but ciphertext/ct is missing (and vice versa)', () => {
    expect(isEncryptedPayload(JSON.stringify({ iv: 'aa' }))).toBe(false);
    expect(isEncryptedPayload(JSON.stringify({ ciphertext: 'bb' }))).toBe(false);
    expect(isEncryptedPayload(JSON.stringify({ ct: 'bb' }))).toBe(false);
  });

  it('returns false for plain text and empty string', () => {
    expect(isEncryptedPayload('hello there')).toBe(false);
    expect(isEncryptedPayload('')).toBe(false);
  });

  it('returns false for non-object JSON values', () => {
    expect(isEncryptedPayload('42')).toBe(false);
    expect(isEncryptedPayload('"iv"')).toBe(false);
    expect(isEncryptedPayload('null')).toBe(false); // null.iv throws → caught → false
    expect(isEncryptedPayload('[]')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Web Crypto (v2) — only runs where SubtleCrypto is available (Mac/Node).
// Skips cleanly in DOM-only environments without crypto.subtle.
// ═══════════════════════════════════════════════════════════════════════
const hasSubtle = typeof globalThis.crypto?.subtle !== 'undefined';

describe.runIf(hasSubtle)('Web Crypto v2 (AES-GCM)', () => {
  // ── Deterministic V2 key derivation (PBKDF2 → AES-GCM) ──
  describe('getDeterministicSharedKey', () => {
    it('returns the same (cached) key instance for the same pair', async () => {
      const k1 = await getDeterministicSharedKey('alice-uid', 'bob-uid');
      const k2 = await getDeterministicSharedKey('alice-uid', 'bob-uid');
      expect(k1).toBe(k2); // module-level cache returns identical instance
      expect(k1.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
    });

    it('is order-insensitive — (uid1, uid2) and (uid2, uid1) hit the same cache entry', async () => {
      const k1 = await getDeterministicSharedKey('carol-uid', 'dave-uid');
      const k2 = await getDeterministicSharedKey('dave-uid', 'carol-uid');
      expect(k1).toBe(k2);
    });

    it('derives different keys for different pairs (ciphertext not cross-decryptable)', async () => {
      const kAB = await getDeterministicSharedKey('alice-uid', 'bob-uid');
      const kCD = await getDeterministicSharedKey('carol-uid', 'dave-uid');
      expect(kAB).not.toBe(kCD);
      const payload = await e2eEncrypt('cross-check', kAB);
      // Wrong key → GCM auth failure → e2eDecrypt catches and returns payload as-is
      expect(await e2eDecrypt(payload, kCD)).toBe(payload);
    });
  });

  // ── e2eEncrypt / e2eDecrypt ──
  describe('e2eEncrypt / e2eDecrypt', () => {
    it('round-trips plaintext', async () => {
      const key = await getDeterministicSharedKey('alice-uid', 'bob-uid');
      const plaintext = 'hello e2ee world';
      const payload = await e2eEncrypt(plaintext, key);
      expect(payload).not.toBe(plaintext);
      expect(await e2eDecrypt(payload, key)).toBe(plaintext);
    });

    it('emits a JSON payload {v:2, iv, ct} with base64 fields', async () => {
      const key = await getDeterministicSharedKey('alice-uid', 'bob-uid');
      const parsed = JSON.parse(await e2eEncrypt('shape check', key));
      expect(parsed.v).toBe(2);
      expect(parsed.iv).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(parsed.ct).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(atob(parsed.iv).length).toBe(12); // 96-bit IV
    });

    it('round-trips unicode, emoji, and long strings', async () => {
      const key = await getDeterministicSharedKey('alice-uid', 'bob-uid');
      const unicode = 'héllo 你好 مرحبا 🎉👨‍👩‍👧‍👦';
      const long = 'x'.repeat(20000);
      expect(await e2eDecrypt(await e2eEncrypt(unicode, key), key)).toBe(unicode);
      expect(await e2eDecrypt(await e2eEncrypt(long, key), key)).toBe(long);
    });

    it('round-trips the empty string (unlike legacy v1)', async () => {
      const key = await getDeterministicSharedKey('alice-uid', 'bob-uid');
      const payload = await e2eEncrypt('', key);
      expect(JSON.parse(payload).v).toBe(2);
      expect(await e2eDecrypt(payload, key)).toBe('');
    });

    it('with the wrong key, returns the encrypted payload as-is (never the plaintext)', async () => {
      const rightKey = await getDeterministicSharedKey('alice-uid', 'bob-uid');
      const wrongKey = await getDeterministicSharedKey('mallory-uid', 'eve-uid');
      const plaintext = 'gcm auth protects this';
      const payload = await e2eEncrypt(plaintext, rightKey);
      const result = await e2eDecrypt(payload, wrongKey);
      expect(result).toBe(payload); // decrypt throws internally → catch returns input
      expect(result).not.toBe(plaintext);
    });

    it('e2eDecrypt passes through non-v2 input as-is', async () => {
      const key = await getDeterministicSharedKey('alice-uid', 'bob-uid');
      expect(await e2eDecrypt('plain old text', key)).toBe('plain old text');
      const v1 = JSON.stringify({ iv: 'aa', ciphertext: 'bb' });
      expect(await e2eDecrypt(v1, key)).toBe(v1);
      const missingCt = JSON.stringify({ v: 2, iv: 'aa' });
      expect(await e2eDecrypt(missingCt, key)).toBe(missingCt);
    });
  });

  // ── Group keys: generate / export / import / wrap / unwrap ──
  describe('group key lifecycle', () => {
    it('generateGroupKey → exportGroupKey yields 32 raw bytes (AES-256)', async () => {
      const groupKey = await generateGroupKey();
      const raw = await exportGroupKey(groupKey);
      expect(raw.byteLength).toBe(32);
    });

    it('importGroupKey restores a working key from raw bytes', async () => {
      const groupKey = await generateGroupKey();
      const raw = await exportGroupKey(groupKey);
      const imported = await importGroupKey(raw);
      const payload = await e2eEncrypt('group message', groupKey);
      expect(await e2eDecrypt(payload, imported)).toBe('group message');
    });

    it('wrapGroupKeyForMember / unwrapGroupKeyForMember round-trips the group key', async () => {
      const groupKey = await generateGroupKey();
      const raw = await exportGroupKey(groupKey);
      const memberSharedKey = await getDeterministicSharedKey('alice-uid', 'bob-uid');

      const wrapped = await wrapGroupKeyForMember(raw, memberSharedKey);
      const parsed = JSON.parse(wrapped);
      expect(Object.keys(parsed).sort()).toEqual(['iv', 'wk']);

      const unwrapped = await unwrapGroupKeyForMember(wrapped, memberSharedKey);
      const payload = await e2eEncrypt('for the group', groupKey);
      expect(await e2eDecrypt(payload, unwrapped)).toBe('for the group');
    });

    it('unwrapping with the wrong shared key rejects (GCM auth failure, uncaught)', async () => {
      const groupKey = await generateGroupKey();
      const raw = await exportGroupKey(groupKey);
      const rightKey = await getDeterministicSharedKey('alice-uid', 'bob-uid');
      const wrongKey = await getDeterministicSharedKey('mallory-uid', 'eve-uid');

      const wrapped = await wrapGroupKeyForMember(raw, rightKey);
      let threw = false;
      try {
        await unwrapGroupKeyForMember(wrapped, wrongKey);
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });

  // ── ECDH key agreement (deriveSharedKey + ECDH wrap helpers) ──
  describe('ECDH shared key derivation', () => {
    async function makeKeyPair() {
      const pair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits'],
      );
      const publicJwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as unknown as ExportedPublicKey;
      return { privateKey: pair.privateKey, publicJwk };
    }

    it('both sides derive interoperable keys (A encrypts, B decrypts)', async () => {
      const alice = await makeKeyPair();
      const bob = await makeKeyPair();

      const keyAB = await deriveSharedKey(alice.privateKey, bob.publicJwk);
      const keyBA = await deriveSharedKey(bob.privateKey, alice.publicJwk);

      const payload = await e2eEncrypt('ecdh says hi', keyAB);
      expect(await e2eDecrypt(payload, keyBA)).toBe('ecdh says hi');
    });

    it('wrapGroupKeyForMemberWithECDH / unwrapGroupKeyWithECDH round-trips end-to-end', async () => {
      const distributor = await makeKeyPair();
      const member = await makeKeyPair();
      const groupKey = await generateGroupKey();

      const wrapped = await wrapGroupKeyForMemberWithECDH(groupKey, distributor.privateKey, member.publicJwk);
      const unwrapped = await unwrapGroupKeyWithECDH(wrapped, member.privateKey, distributor.publicJwk);

      const payload = await e2eEncrypt('group via ecdh', groupKey);
      expect(await e2eDecrypt(payload, unwrapped)).toBe('group via ecdh');
    });

    it('unwrapGroupKeyWithECDH with the wrong private key rejects', async () => {
      const distributor = await makeKeyPair();
      const member = await makeKeyPair();
      const intruder = await makeKeyPair();
      const groupKey = await generateGroupKey();

      const wrapped = await wrapGroupKeyForMemberWithECDH(groupKey, distributor.privateKey, member.publicJwk);
      let threw = false;
      try {
        await unwrapGroupKeyWithECDH(wrapped, intruder.privateKey, distributor.publicJwk);
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });
});
