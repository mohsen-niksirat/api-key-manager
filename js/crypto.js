// crypto.js - AES-GCM encryption for API keys (WebCrypto)

const PBKDF2_ITERATIONS = 310000; // OWASP-recommended minimum for PBKDF2-HMAC-SHA256
const SALT_BYTES = 16;
const IV_BYTES = 12;
const CRYPTO_PREFIX = 'enc:v1';

const subtle = () => {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto not available (needs HTTPS or localhost)');
  }
  return globalThis.crypto.subtle;
};

const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

// --- encoding helpers ---

export function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

export function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

// --- key derivation ---

async function deriveKey(password, salt, iterations) {
  const keyMaterial = await subtle().importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return subtle().deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// --- public API ---

/**
 * Encrypt plaintext with a password. Returns a portable string:
 *   enc:v1:<iterations_b64 salt_b64 iv_b64 ciphertext_b64>
 */
export async function encryptWithPassword(password, plaintext) {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);

  const ciphertext = new Uint8Array(
    await subtle().encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      enc.encode(plaintext)
    )
  );

  return [
    CRYPTO_PREFIX,
    PBKDF2_ITERATIONS,
    bytesToBase64(salt),
    bytesToBase64(iv),
    bytesToBase64(ciphertext)
  ].join(':');
}

/**
 * Decrypt a string produced by encryptWithPassword.
 * Throws if the password is wrong (GCM auth failure).
 */
export async function decryptWithPassword(password, payload) {
  if (!isEncrypted(payload)) {
    throw new Error('Payload is not encrypted');
  }

  // Strip 'enc:v1:' (prefix + separator) then parse iterations:salt:iv:ciphertext
  const parts = payload.slice(CRYPTO_PREFIX.length + 1).split(':');
  if (parts.length !== 4) {
    throw new Error('Malformed encrypted payload (expected iterations:salt:iv:ciphertext)');
  }

  const iterations = parseInt(parts[0], 10);
  const salt = base64ToBytes(parts[1]);
  const iv = base64ToBytes(parts[2]);
  const ciphertext = base64ToBytes(parts[3]);

  const key = await deriveKey(password, salt, iterations);

  const plaintext = await subtle().decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext)
  );

  return dec.decode(plaintext);
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(CRYPTO_PREFIX + ':');
}

/** Store for the derived verification hash (never the password itself). */
export async function makeVerifier(password) {
  const salt = randomBytes(SALT_BYTES);
  const hash = await verifierHash(password, salt);
  return { salt: bytesToBase64(salt), hash: bytesToBase64(hash) };
}

async function verifierHash(password, salt) {
  // deriveBits avoids extractable keys entirely
  const keyMaterial = await subtle().importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const raw = await subtle().deriveBits(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  return new Uint8Array(await subtle().digest('SHA-256', raw));
}

export async function verifyPassword(password, verifier) {
  if (!verifier?.salt || !verifier?.hash) return false;
  try {
    const salt = base64ToBytes(verifier.salt);
    const hash = await verifierHash(password, salt);
    return timingSafeEqual(bytesToBase64(hash), verifier.hash);
  } catch {
    return false;
  }
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
