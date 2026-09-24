// tests/backup.test.js - Encrypted backup format tests

import { encryptWithPassword, decryptWithPassword } from '../js/crypto.js';
import { createStorageStub } from './storage-stub.js';
import { assert, assertEqual, assertThrowsAsync } from './helpers.js';

const BACKUP_PREFIX = 'AKM-ENCRYPTED-BACKUP:v1:';

export const tests = {
  async 'encrypted backup roundtrip preserves full dataset'() {
    const storage = createStorageStub();
    await storage.addProvider({ id: 'p1', name: 'Test', base_url: 'https://t.test' });
    await storage.addAPIKey({ provider_id: 'p1', name: 'K', key: 'secret-key-value' });
    await storage.saveSetting('theme', 'theme-light');

    const data = await storage.exportData();
    const cipher = await encryptWithPassword('backup-pw-1234', JSON.stringify(data));
    const file = BACKUP_PREFIX + cipher;

    // Simulate import path
    assert(file.startsWith(BACKUP_PREFIX), 'file must carry backup prefix');
    const json = await decryptWithPassword('backup-pw-1234', file.slice(BACKUP_PREFIX.length));
    const restored = JSON.parse(json);

    assertEqual(restored.providers.length, 1);
    assertEqual(restored.api_keys.length, 1);
    assertEqual(restored.api_keys[0].key, 'secret-key-value');
    assertEqual(restored.settings.theme, 'theme-light');
  },

  async 'wrong backup password is rejected'() {
    const storage = createStorageStub();
    const data = await storage.exportData();
    const cipher = await encryptWithPassword('right-pw-12345', JSON.stringify(data));
    const file = BACKUP_PREFIX + cipher;

    await assertThrowsAsync(
      () => decryptWithPassword('wrong-pw-9999', file.slice(BACKUP_PREFIX.length)),
      'wrong backup password must fail'
    );
  },

  async 'plain JSON import path is unaffected'() {
    const storage = createStorageStub();
    const data = await storage.exportData();
    const text = JSON.stringify(data);
    assert(!text.startsWith(BACKUP_PREFIX), 'plain JSON must not collide with encrypted prefix');
    const parsed = JSON.parse(text);
    assert(Array.isArray(parsed.providers), 'plain backup must parse directly');
  }
};
