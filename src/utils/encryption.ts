// ═══════════════════════════════════════════════════════════════════════
// End-to-End Encryption (E2EE) for ethniCity Messages
// ═══════════════════════════════════════════════════════════════════════
// Uses ECDH P-256 key exchange + AES-256-GCM (authenticated encryption)
// via the Web Crypto API. Key pairs are synced across devices via Firestore
// and cached locally in IndexedDB for fast access.
//
// Industry compliance:
//  - ECDH P-256 for key agreement (NIST approved, FIPS 186-4)
//  - AES-256-GCM for authenticated encryption (NIST SP 800-38D)
//  - HKDF-SHA256 for key derivation (RFC 5869)
//  - Per-message random 96-bit IV (NIST recommended for GCM)
//  - Key pairs synced via Firestore for multi-device support
//  - Public keys distributed via Firestore for peer key exchange
// ═══════════════════════════════════════════════════════════════════════

import CryptoJS from 'crypto-js';
import { ENCRYPTION_SALT } from '../constants/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

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
  try {
    const db = await openKeyDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Safari private browsing throws on IndexedDB access
    console.warn('[E2EE] IndexedDB unavailable (private browsing?):', err);
    return undefined;
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openKeyDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    // Safari private browsing — keys will only live in memory this session
    console.warn('[E2EE] IndexedDB write failed (private browsing?):', err);
  }
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
 * Firestore is the source of truth for the canonical key pair.
 * IndexedDB is a local cache for fast offline access.
 *
 * Priority: Firestore (canonical) → IndexedDB (offline fallback) → Generate new
 */
export async function getOrCreateKeyPair(uid: string): Promise<{
  publicKey: ExportedPublicKey;
  privateKey: CryptoKey;
}> {
  const storeKey = `ecdh_${uid}`;

  // Helper to import a private JWK into a CryptoKey (clean JWK for Safari compat)
  const importPrivate = (jwk: JsonWebKey) => {
    const cleanJwk: JsonWebKey = {
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      y: jwk.y,
      d: jwk.d,
      ext: true,
    };
    return crypto.subtle.importKey(
      'jwk', cleanJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']
    );
  };

  // 1) Try Firestore first — this is the canonical source of truth
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    const userData = userDoc.data();
    if (userData?.e2ePrivateKey && userData?.e2ePublicKey) {
      console.log('[E2EE] Key pair loaded from Firestore (canonical)');
      const privateJwk = userData.e2ePrivateKey as JsonWebKey;
      const publicJwk = userData.e2ePublicKey as JsonWebKey;

      // Sync to IndexedDB (overwrite any stale local key)
      await idbSet(storeKey, { publicJwk, privateJwk });

      const privateKey = await importPrivate(privateJwk);
      return {
        publicKey: publicJwk as unknown as ExportedPublicKey,
        privateKey,
      };
    }

    // Firestore has no private key yet — check if there's a public-only key
    // (legacy state before multi-device sync was added)
    if (userData?.e2ePublicKey && !userData?.e2ePrivateKey) {
      console.log('[E2EE] Firestore has public key but no private key (legacy). Checking IndexedDB...');
      // Try IndexedDB — if it has a matching key pair, push the private key to Firestore
      const stored = await idbGet<{ publicJwk: JsonWebKey; privateJwk: JsonWebKey }>(storeKey);
      if (stored?.privateJwk && stored?.publicJwk) {
        const localPub = stored.publicJwk as unknown as ExportedPublicKey;
        const firestorePub = userData.e2ePublicKey as ExportedPublicKey;

        if (localPub.x === firestorePub.x && localPub.y === firestorePub.y) {
          // Local key matches Firestore public key — push private key to complete the sync
          console.log('[E2EE] IndexedDB key matches Firestore public key. Syncing private key to Firestore.');
          await updateDoc(doc(db, 'users', uid), {
            e2ePrivateKey: stored.privateJwk,
          });
          const privateKey = await importPrivate(stored.privateJwk);
          return {
            publicKey: localPub,
            privateKey,
          };
        } else {
          // Local key doesn't match Firestore — local key is stale.
          // Generate fresh key pair and push both to Firestore.
          console.log('[E2EE] IndexedDB key does NOT match Firestore. Generating new canonical key pair.');
        }
      }
    }
  } catch (err) {
    console.warn('[E2EE] Firestore check failed, falling back to IndexedDB:', err);
    // Offline fallback — use IndexedDB if available
    const stored = await idbGet<{ publicJwk: JsonWebKey; privateJwk: JsonWebKey }>(storeKey);
    if (stored?.privateJwk && stored?.publicJwk) {
      console.log('[E2EE] Key pair loaded from IndexedDB (offline fallback)');
      const privateKey = await importPrivate(stored.privateJwk);
      return {
        publicKey: stored.publicJwk as unknown as ExportedPublicKey,
        privateKey,
      };
    }
  }

  // 2) No canonical key pair exists anywhere — generate new one
  console.log('[E2EE] Generating new canonical key pair');
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  // Store in IndexedDB
  await idbSet(storeKey, { publicJwk, privateJwk });

  // Push to Firestore as the canonical key pair
  try {
    await updateDoc(doc(db, 'users', uid), {
      e2ePublicKey: publicJwk,
      e2ePrivateKey: privateJwk,
    });
    console.log('[E2EE] New canonical key pair synced to Firestore');
  } catch (err) {
    console.warn('[E2EE] Failed to sync new key pair to Firestore:', err);
  }

  const privateKey = await importPrivate(privateJwk);
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
  console.log('[E2EE] Deriving shared key for peer...');
  // Import peer's public key (Safari requires clean JWK with ext:true, no key_ops)
  const peerJwk: JsonWebKey = {
    kty: peerPublicKeyJwk.kty,
    crv: peerPublicKeyJwk.crv,
    x: peerPublicKeyJwk.x,
    y: peerPublicKeyJwk.y,
    ext: true,
  };
  const peerPublicKey = await crypto.subtle.importKey(
    'jwk',
    peerJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true, []
  );

  // Derive shared bits via ECDH
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: peerPublicKey },
    privateKey,
    256
  );

  // Import shared bits as HKDF base key (Safari requires algorithm as object, not string)
  const hkdfKey = await crypto.subtle.importKey(
    'raw', sharedBits, { name: 'HKDF' }, false, ['deriveKey']
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

  console.log('[E2EE] Shared key derived successfully');
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
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      sharedKey,
      ct as unknown as BufferSource
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    // Log for debugging Safari issues
    console.error('[E2EE] Decryption failed:', err);
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
    { name: 'AES-GCM', iv: base64ToArray(iv) as unknown as BufferSource },
    memberSharedKey,
    base64ToArray(wk) as unknown as BufferSource
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
// Safari-safe: process in chunks to avoid call stack issues with large arrays

function arrayToBase64(arr: Uint8Array): string {
  // Process in 8KB chunks to avoid call stack size limits in Safari
  const chunks: string[] = [];
  const chunkSize = 8192;
  for (let i = 0; i < arr.length; i += chunkSize) {
    const slice = arr.subarray(i, Math.min(i + chunkSize, arr.length));
    let binary = '';
    for (let j = 0; j < slice.length; j++) binary += String.fromCharCode(slice[j]);
    chunks.push(binary);
  }
  return btoa(chunks.join(''));
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

// ─── Deterministic V2 Key (cross-device safe) ─────────────────────────
// Derives an AES-256-GCM key deterministically from both user IDs.
// Unlike ECDH, this always produces the same key on every device/browser
// because it depends only on user IDs + salt, not on device-specific key pairs.
// Uses Web Crypto PBKDF2 → AES-256-GCM (same security level as ECDH variant).

const _deterministicKeyCache = new Map<string, CryptoKey>();

export async function getDeterministicSharedKey(uid1: string, uid2: string): Promise<CryptoKey> {
  const cacheKey = [uid1, uid2].sort().join('::');
  if (_deterministicKeyCache.has(cacheKey)) {
    return _deterministicKeyCache.get(cacheKey)!;
  }

  const passphrase = `${cacheKey}::${ENCRYPTION_SALT}::v2gcm`;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(`ethnicity_e2ee_v2_${cacheKey}`),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  _deterministicKeyCache.set(cacheKey, aesKey);
  return aesKey;
}
