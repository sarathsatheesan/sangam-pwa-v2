// End-to-End Encryption Utility for ethniCity Private Messages
// Uses AES-256 encryption with per-conversation deterministic keys
// and random IVs per message for security.

import CryptoJS from 'crypto-js';
import { ENCRYPTION_SALT } from '../constants/config';

/**
 * Generate a deterministic conversation encryption key from both user UIDs.
 * Both participants will derive the same key since UIDs are sorted.
 *
 * @param uid1 - First user's Firebase UID
 * @param uid2 - Second user's Firebase UID
 * @returns A 256-bit key as a hex string
 */
export function generateConversationKey(uid1: string, uid2: string): string {
  // Sort UIDs to ensure both participants generate the same key
  const sortedUids = [uid1, uid2].sort().join('::');
  const passphrase = `${sortedUids}::${ENCRYPTION_SALT}`;

  // Derive key using PBKDF2 with SHA-256
  const key = CryptoJS.PBKDF2(passphrase, ENCRYPTION_SALT, {
    keySize: 256 / 32, // 256 bits
    iterations: 1000,
    hasher: CryptoJS.algo.SHA256,
  });

  return key.toString(CryptoJS.enc.Hex);
}

/**
 * Encrypt a plaintext message using AES-256-CBC with a random IV.
 *
 * @param plaintext - The message text to encrypt
 * @param conversationKey - The hex-encoded conversation key
 * @returns JSON string containing { iv, ciphertext } or the original text on failure
 */
export function encryptMessage(plaintext: string, conversationKey: string): string {
  try {
    // Generate random 16-byte IV for each message
    const iv = CryptoJS.lib.WordArray.random(16);
    const key = CryptoJS.enc.Hex.parse(conversationKey);

    // Encrypt using AES-CBC
    const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    // Return as JSON payload
    return JSON.stringify({
      iv: iv.toString(CryptoJS.enc.Hex),
      ciphertext: encrypted.ciphertext.toString(CryptoJS.enc.Hex),
    });
  } catch (error) {
    console.error('Encryption failed:', error);
    return plaintext; // Fallback to plaintext on error
  }
}

/**
 * Decrypt an encrypted message payload.
 *
 * @param encryptedPayload - JSON string containing { iv, ciphertext }
 * @param conversationKey - The hex-encoded conversation key
 * @returns Decrypted plaintext, or fallback message on failure
 */
export function decryptMessage(encryptedPayload: string, conversationKey: string): string {
  try {
    const payload = JSON.parse(encryptedPayload);

    if (!payload.iv || !payload.ciphertext) {
      // Not an encrypted payload — return as-is (backward compat)
      return encryptedPayload;
    }

    const iv = CryptoJS.enc.Hex.parse(payload.iv);
    const key = CryptoJS.enc.Hex.parse(conversationKey);
    const ciphertext = CryptoJS.enc.Hex.parse(payload.ciphertext);

    // Create CipherParams object for decryption
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: ciphertext,
    });

    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);

    if (!plaintext) {
      return '[Unable to decrypt message]';
    }

    return plaintext;
  } catch (error) {
    // If JSON parse fails, this is likely an unencrypted message
    return encryptedPayload;
  }
}

/**
 * Check if a message text is an encrypted payload
 */
export function isEncryptedPayload(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    return !!(parsed.iv && parsed.ciphertext);
  } catch {
    return false;
  }
}
