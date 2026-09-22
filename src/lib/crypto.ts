/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Native Web Crypto API utilities for End-to-End Encryption (AES-256-GCM + PBKDF2 + SHA-256)

export function generateSalt(length = 16): Uint8Array {
  const salt = new Uint8Array(length);
  window.crypto.getRandomValues(salt);
  return salt;
}

export function generateBaseIV(length = 12): Uint8Array {
  const iv = new Uint8Array(length);
  window.crypto.getRandomValues(iv);
  return iv;
}

/**
 * Derives a deterministic unique 12-byte IV for each chunk index from a base IV.
 * This guarantees no IV reuse across billions of chunks while avoiding per-chunk IV overhead.
 */
export function getChunkIV(baseIV: Uint8Array, chunkIndex: number): Uint8Array {
  const chunkIV = new Uint8Array(baseIV.length);
  chunkIV.set(baseIV);
  const view = new DataView(chunkIV.buffer, chunkIV.byteOffset, chunkIV.byteLength);
  // Mix in the chunkIndex into the last 4 bytes using Big-Endian
  const offset = baseIV.length - 4;
  const currentVal = view.getUint32(offset, false);
  view.setUint32(offset, (currentVal ^ chunkIndex) >>> 0, false);
  return chunkIV;
}

/**
 * Derives an AES-256-GCM CryptoKey from a 6-digit code and a random salt using PBKDF2.
 */
export async function deriveKeyFromCode(code: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(code),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts an ArrayBuffer chunk with AES-256-GCM using the derived key and chunk-specific IV.
 */
export async function encryptChunk(
  key: CryptoKey,
  iv: Uint8Array,
  data: ArrayBuffer
): Promise<ArrayBuffer> {
  return await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: 128, // Full 128-bit authentication tag
    },
    key,
    data
  );
}

/**
 * Decrypts an ArrayBuffer chunk. Throws an error if data was tampered or tag mismatch occurs.
 */
export async function decryptChunk(
  key: CryptoKey,
  iv: Uint8Array,
  encryptedData: BufferSource
): Promise<ArrayBuffer> {
  try {
    return await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
        tagLength: 128,
      },
      key,
      encryptedData
    );
  } catch (err) {
    throw new Error('INTEGRITY_TAMPER_DETECTED: Authentication tag verification failed. Transfer halted for security.');
  }
}

/**
 * Computes full SHA-256 hexadecimal hash of a given Buffer or Uint8Array.
 */
export async function computeSHA256(data: ArrayBuffer | Uint8Array): Promise<string> {
  const source = data instanceof Uint8Array ? (data as BufferSource) : (data as BufferSource);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', source);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToBuffer(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
