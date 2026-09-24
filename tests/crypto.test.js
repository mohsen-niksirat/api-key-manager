// tests/crypto.test.js - Encryption unit tests (Node 20+ has globalThis.crypto)

import {
  encryptWithPassword,
  decryptWithPassword,
  isEncrypted,
  makeVerifier,
  verifyPassword
} from '../js/crypto.js';
import {
  assert,
  assertEqual,
  assertNotEqual,
  assertIncludes,
  assertThrowsAsync
} from './helpers.js';

export const tests = {
  async 'encryptWithPassword produces portable encrypted string'() {
    const cipher = await encryptWithPassword('hunter2secret', 'sk-test-123456');
    assert(typeof cipher === 'string', 'cipher should be a string');
    assertIncludes(cipher, 'enc:v1:', 'cipher should carry the format prefix');
    const parts = cipher.split(':');
    assertEqual(parts.length, 6, 'enc | v1 | iterations | salt | iv | cipher');
    assertEqual(parts[0], 'enc', 'magic prefix');
    assertEqual(parts[1], 'v1', 'format version');
    assertEqual(parseInt(parts[2], 10) >= 100000, true, 'iterations stored and OWASP-grade');
    assertNotEqual(cipher.includes('sk-test'), true, 'plaintext must not appear in ciphertext');
  },

  async 'decrypt roundtrip recovers plaintext'() {
    const secret = 'sk-ant-api03-abcDEF123!@# ادامه فارسی 🎲';
    const cipher = await encryptWithPassword('correct horse battery staple', secret);
    const plain = await decryptWithPassword('correct horse battery staple', cipher);
    assertEqual(plain, secret, 'roundtrip must restore the exact plaintext');
  },

  async 'each encryption uses a fresh random salt and IV'() {
    const a = await encryptWithPassword('pw', 'same-plaintext');
    const b = await encryptWithPassword('pw', 'same-plaintext');
    assertNotEqual(a, b, 'identical plaintexts must yield different ciphertexts');
  },

  async 'wrong password fails GCM auth'() {
    const cipher = await encryptWithPassword('right-password', 'top secret');
    await assertThrowsAsync(
      () => decryptWithPassword('wrong-password', cipher),
      'decrypting with a wrong password must throw'
    );
  },

  async 'tampered ciphertext is rejected'() {
    const cipher = await encryptWithPassword('pw123456', 'data');
    // Flip a character in the ciphertext segment (last part)
    const parts = cipher.split(':');
    const last = parts[parts.length - 1];
    const flipped = (last[0] === 'A' ? 'B' : 'A') + last.slice(1);
    parts[parts.length - 1] = flipped;
    await assertThrowsAsync(
      () => decryptWithPassword('pw123456', parts.join(':')),
      'tampered ciphertext must fail authentication'
    );
  },

  async 'isEncrypted detects format'() {
    const cipher = await encryptWithPassword('pw12345678', 'x');
    assertEqual(isEncrypted(cipher), true, 'ciphertext should be detected');
    assertEqual(isEncrypted('sk-plain-key-123456'), false, 'plaintext should not be detected');
    assertEqual(isEncrypted(''), false, 'empty string should not be detected');
    assertEqual(isEncrypted(null), false, 'null should not be detected');
  },

  async 'decrypt rejects non-encrypted payload'() {
    await assertThrowsAsync(
      () => decryptWithPassword('pw', 'plain-key'),
      'decrypting a plaintext value must throw'
    );
  },

  async 'makeVerifier + verifyPassword accept right password'() {
    const verifier = await makeVerifier('my-master-pass');
    assert(verifier.salt && verifier.hash, 'verifier needs salt and hash');
    assertEqual(await verifyPassword('my-master-pass', verifier), true);
  },

  async 'verifyPassword rejects wrong password'() {
    const verifier = await makeVerifier('my-master-pass');
    assertEqual(await verifyPassword('wrong-pass', verifier), false);
    assertEqual(await verifyPassword('', verifier), false);
  },

  async 'verifyPassword handles missing verifier'() {
    assertEqual(await verifyPassword('x', null), false);
    assertEqual(await verifyPassword('x', {}), false);
  }
};
