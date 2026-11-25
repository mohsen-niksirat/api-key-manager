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
  },

  async 'providers-only backup exports active public metadata without keys or settings'() {
    const { App } = await import('../js/app.js');
    const { ProviderManager } = await import('../js/providers.js');
    const storage = createStorageStub();
    await storage.addProvider({
      id: 'openai',
      name: 'OpenAI',
      base_url: 'https://api.openai.com/v1',
      models: ['gpt-4o', 'gpt-4o-mini'],
      website: 'https://platform.openai.com',
      category: 'OpenAI',
      pinned: true
    });
    await storage.addProvider({
      id: 'trashed',
      name: 'Trashed',
      base_url: 'https://trashed.test',
      deleted: true
    });
    await storage.addAPIKey({ provider_id: 'openai', name: 'Prod', key: 'sk-super-secret-key' });
    await storage.saveSetting('masterVerifier', { salt: 'x', hash: 'y' });

    const app = new App();
    app.storage = storage;
    app.providerManager = new ProviderManager(storage);

    const payload = await app.buildProvidersOnlyExport();
    assertEqual(payload.type, 'providers-only');
    assertEqual(payload.providers.length, 1, 'only active providers included');
    assertEqual(payload.providers[0].id, 'openai');
    assertEqual(payload.providers[0].base_url, 'https://api.openai.com/v1');
    assertEqual(payload.providers[0].models.length, 2);
    assertEqual(payload.api_keys.length, 0, 'must not export any API keys');
    assertEqual(Object.keys(payload.settings).length, 0, 'must not export settings or verifier');
    assert(!JSON.stringify(payload).includes('sk-super-secret-key'), 'secret key must never appear');
  }
};
