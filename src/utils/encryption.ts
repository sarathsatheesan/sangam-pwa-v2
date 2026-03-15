// ═══════════════════════════════════════════════════════════════════════
// End-to-End Encryption (E2EE) for ethniCity Messages
// ═══════════════════════════════════════════════════════════════════════
// Uses ECDH P-256 key exchange + AES-256-GCM (authenticated encryption)
// via the Web Crypto API. Private keys never leave the device.
//
// Industry compliance:
//  - ECDH P-256 for key agreement (NIST approved, FIPS 186-4)
//  - AES-256-GCM for authenticated encryption (NIST SP 800-38D)
//  - HKDF-SHA256 for key derivation (RFC 5869)
//  - Per-message random 96-bit IV (NIST recommended for GCM)
//  - Private keys stored in IndexedDB (device-local, never transmitted)
//  - Public keys distributed via Firestore for peer key exchange
// ═══════════════════════════════════════════════════════════════════════

import CryptoJS from 'crypto-js';
import { ENCRYPTION_SALT } from '../constants/config';

// ─── IndexedDB Storage for Private Keys ──────────────────────────────

const DB_NAME = 'ethnicity_e2ee';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

function openKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openKeyDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openKeyDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── ECDH Key Pair Management ────────────────────────────────────────

export interface ExportedPublicKey {
  kty: string;
  crv: string;
  x: string;
  y: string;
}

/**
 * Generate or retrieve the user's ECDH key pair.
 * Private key is stored in IndexedDB (never leaves device).
 * Returns the public key in JWK format for Firestore distribution.
 */
export async function getOrCreateKeyPair(uid: string): Promise<{
  publicKey: ExportedPublicKey;
  privateKey: CryptoKey;
}> {
  const storeKey = `ecdh_${uid}`;

  // Try loading existing key pair from IndexedDB
  const stored = await idbGet<{ publicJwk: JsonWebKey; privateJwk: JsonWebKey }>(storeKey);
  if (stored) {
    const privateKey = await crypto.subtle.importKey(
      'jwk', stored.privateJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false, ['deriveKey', 'deriveBits']
    );
    return {
      publicKey: stored.publicJwk as unknown as ExportedPublicKey,
      privateKey,
    };
  }

  // Generate new ECDH P-256 key pair
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, // extractable for storage
    ['deriveKey', 'deriveBits']
  );

  // Export keys for storage
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  // Store in IndexedDB
  await idbSet(storeKey, { publicJwk, privateJwk });

  // Re-import private key as non-extractable for runtime use
  const privateKey = await crypto.subtle.importKey(
    'jwk', privateJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, ['deriveKey', 'deriveBits']
  );

  return {
    publicKey: publicJwk as unknown as ExportedPublicKey,
    privateKey,
  };
}

// ─── Shared Key Derivation (ECDH + HKDF) ────────────────────────────

/**
 * Derive a shared AES-256-GCM key from our private key and peer's public key.
 * Uses ECDH to produce shared bits, then HKDF-SHA256 for key derivation.
 */
export async function deriveSharedKey(
  privateKey: CryptoKey,
  peerPublicKeyJwk: ExportedPublicKey
): Promise<CryptoKey> {
  // Import peer's public key
  const peerPublicKey = await crypto.subtle.importKey(
    'jwk',
    { ...peerPublicKeyJwk, key_ops: [] },
    { name: 'ECDH', namedCurve: 'P-256' },
    false, []
  );

  // Derive shared bits via ECDH
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: peerPublicKey },
    privateKey,
    256
  );

  // Import shared bits as HKDF base key
  const hkdfKey = await crypto.subtle.importKey(
    'raw', sharedBits, 'HKDF', false, ['deriveKey']
  );

  // Derive AES-256-GCM key via HKDF
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('ethnicity_e2ee_v2'),
      info: new TextEncoder().encode('message_encryption'),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return aesKey;
}

// ─── AES-256-GCM Encryption / Decryption ─────────────────────────────

/**
 * Encrypt plaintext (or any string data) using AES-256-GCM.
 * Returns a JSON string with { iv, ct, tag } (all base64-encoded).
 */
export async function e2eEncrypt(plaintext: string, sharedKey: CryptoKey): Promise<string> {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV per NIST
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      encoded
    );

    // AES-GCM appends auth tag to ciphertext automatically
    return JSON.stringify({
      v: 2, // version marker
      iv: arrayToBase64(iv),
      ct: arrayToBase64(new Uint8Array(ciphertext)),
    });
  } catch (err) {
    console.error('E2EE encryption failed:', err);
    return plaintext; // Fallback to plaintext
  }
}

/**
 * Decrypt an E2EE encrypted payload using AES-256-GCM.
 */
export async function e2eDecrypt(encryptedPayload: string, sharedKey: CryptoKey): Promise<string> {
  try {
    const payload = JSON.parse(encryptedPayload);

    // Check if this is a v2 E2EE payload
    if (payload.v !== 2 || !payload.iv || !payload.ct) {
      // Not a v2 payload — might be legacy v1 or plaintext
      return encryptedPayload;
    }

    const iv = base64ToArray(payload.iv);
    const ct = base64ToArray(payload.ct);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      sharedKey,
      ct as BufferSource
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    // JSON parse failure = plaintext, or decryption failure
    return encryptedPayload;
  }
}

// ─── Group Chat Encryption ───────────────────────────────────────────

/**
 * Generate a random AES-256-GCM group key.
 */
export async function generateGroupKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable so we can wrap/unwrap for distribution
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a group key as raw bytes (for wrapping/distribution).
 */
export async function exportGroupKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', key);
}

/**
 * Import a group key from raw bytes.
 */
export async function importGroupKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', raw,
    { name: 'AES-GCM', length: 256 },
    true, ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a group key for a specific member using their shared ECDH key.
 * Returns base64-encoded encrypted group key.
 */
export async function wrapGroupKeyForMember(
  groupKeyRaw: ArrayBuffer,
  memberSharedKey: CryptoKey
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    memberSharedKey,
    groupKeyRaw
  );
  return JSON.stringify({
    iv: arrayToBase64(iv),
    wk: arrayToBase64(new Uint8Array(wrapped)),
  });
}

/**
 * Decrypt a group key that was encrypted for us.
 */
export async function unwrapGroupKeyForMember(
  wrappedPayload: string,
  memberSharedKey: CryptoKey
): Promise<CryptoKey> {
  const { iv, wk } = JSON.parse(wrappedPayload);
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToArray(iv) as BufferSource },
    memberSharedKey,
    base64ToArray(wk) as BufferSource
  );
  return importGroupKey(raw);
}

/**
 * Wrap a group key for a member using the ECDH shared key derived from
 * the distributor's private key and the member's public key.
 * All-in-one helper: derives shared key, wraps group key.
 */
export async function wrapGroupKeyForMemberWithECDH(
  groupKey: CryptoKey,
  distributorPrivateKey: CryptoKey,
  memberPublicKeyJwk: ExportedPublicKey
): Promise<string> {
  const sharedKey = await deriveSharedKey(distributorPrivateKey, memberPublicKeyJwk);
  const groupKeyRaw = await exportGroupKey(groupKey);
  return wrapGroupKeyForMember(groupKeyRaw, sharedKey);
}

/**
 * Unwrap a group key using the ECDH shared key derived from
 * our private key and the distributor's public key.
 * All-in-one helper: derives shared key, unwraps group key.
 */
export async function unwrapGroupKeyWithECDH(
  wrappedPayload: string,
  myPrivateKey: CryptoKey,
  distributorPublicKeyJwk: ExportedPublicKey
): Promise<CryptoKey> {
  const sharedKey = await deriveSharedKey(myPrivateKey, distributorPublicKeyJwk);
  return unwrapGroupKeyForMember(wrappedPayload, sharedKey);
}

// ─── Base64 Utility Helpers ──────────────────────────────────────────

function arrayToBase64(arr: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function base64ToArray(b64: string): Uint8Array {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

// ─── Legacy v1 Functions (backward compatibility) ────────────────────
// These are kept for decrypting old messages that used the v1 format.

export function generateConversationKey(uid1: string, uid2: string): string {
  const sortedUids = [uid1, uid2].sort().join('::');
  const passphrase = `${sortedUids}::${ENCRYPTION_SALT}`;
  const key = CryptoJS.PBKDF2(passphrase, ENCRYPTION_SALT, {
    keySize: 256 / 32,
    iterations: 1000,
    hasher: CryptoJS.algo.SHA256,
  });
  return key.toString(CryptoJS.enc.Hex);
}

export function encryptMessage(plaintext: string, conversationKey: string): string {
  try {
    const iv = CryptoJS.lib.WordArray.random(16);
    const key = CryptoJS.enc.Hex.parse(conversationKey);
    const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
      iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7,
    });
    return JSON.stringify({
      iv: iv.toString(CryptoJS.enc.Hex),
      ciphertext: encrypted.ciphertext.toString(CryptoJS.enc.Hex),
    });
  } catch {
    return plaintext;
  }
}

export function decryptMessage(encryptedPayload: string, conversationKey: string): string {
  try {
    const payload = JSON.parse(encryptedPayload);
    if (!payload.iv || !payload.ciphertext) return encryptedPayload;

    // Check if this is v2 payload — don't try legacy decrypt
    if (payload.v === 2) return encryptedPayload;

    const iv = CryptoJS.enc.Hex.parse(payload.iv);
    const key = CryptoJS.enc.Hex.parse(conversationKey);
    const ciphertext = CryptoJS.enc.Hex.parse(payload.ciphertext);
    const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext });
    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
      iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7,
    });
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    return plaintext || '[Unable to decrypt message]';
  } catch {
    return encryptedPayload;
  }
}

export function isEncryptedPayload(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    return !!(parsed.iv && (parsed.ciphertext || parsed.ct));
  } catch {
    return false;
  }
}
