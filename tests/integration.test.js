// tests/integration.test.js - End-to-end flows over the storage + provider managers

import { ProviderManager } from '../js/providers.js';
import { encryptWithPassword, isEncrypted, makeVerifier } from '../js/crypto.js';
import { createStorageStub } from './storage-stub.js';
import { assert, assertEqual, assertThrowsAsync } from './helpers.js';

async function setup() {
  const storage = createStorageStub();
  const pm = new ProviderManager(storage);
  return { storage, pm };
}

export const tests = {
  async 'provider CRUD + cascade delete'() {
    const { storage, pm } = await setup();

    const p = await pm.addProvider({ name: 'Flow Test', base_url: 'https://flow.test' });
    await pm.addAPIKey(p.id, { name: 'K1', key: 'key-value-123456' });

    let keys = await pm.getAPIKeys(p.id);
    assertEqual(keys.length, 1);

    await pm.deleteProvider(p.id);
    const providers = await pm.getAllProviders();
    keys = await pm.getAPIKeys(p.id);
    assertEqual(providers.length, 0, 'provider deleted');
    assertEqual(keys.length, 0, 'keys cascade-deleted');
  },

  async 'key persists with correct fields'() {
    const { storage, pm } = await setup();
    const p = await pm.addProvider({ name: 'Persist', base_url: 'https://p.test' });

    await pm.addAPIKey(p.id, {
      name: 'Prod',
      key: 'sk-xyz-9876543210',
      expiry: '2027-01-01'
    });

    const keys = await pm.getAPIKeys(p.id);
    assertEqual(keys.length, 1);
    assertEqual(keys[0].name, 'Prod');
    assertEqual(keys[0].status, 'active', 'default status');
    assertEqual(keys[0].expiry, '2027-01-01');
    assert(keys[0].created_at, 'created_at set');
  },

  async 'updateProvider merges without losing fields'() {
    const { storage, pm } = await setup();
    const p = await pm.addProvider({
      name: 'Original', base_url: 'https://o.test', website: 'https://o.website', models: ['m1']
    });

    await pm.updateProvider(p.id, { name: 'Renamed', models: ['m2', 'm3'] });
    const updated = await pm.getProvider(p.id);

    assertEqual(updated.name, 'Renamed');
    assertEqual(updated.base_url, 'https://o.test', 'untouched field preserved');
    assertEqual(updated.website, 'https://o.website', 'untouched field preserved');
    assertEqual(updated.models.length, 2);
  },

  async 'encryptAllKeys encrypts only plaintext keys'() {
    const { storage, pm } = await setup();
    const p = await pm.addProvider({ name: 'Enc', base_url: 'https://e.test' });

    await pm.addAPIKey(p.id, { name: 'A', key: 'plain-key-aaaaaa' });
    // Insert an already-encrypted key directly
    const cipher = await encryptWithPassword('master-pw-123', 'already-encrypted-key');
    await storage.addAPIKey({ provider_id: p.id, name: 'B', key: cipher });

    const count = await pm.encryptAllKeys('master-pw-123');
    assertEqual(count, 1, 'only the plaintext key should be encrypted');

    const keys = await pm.getAPIKeys(p.id);
    assertEqual(keys.every(k => isEncrypted(k.key)), true, 'all keys encrypted now');
  },

  async 'decryptAllKeys reverses encryption'() {
    const { storage, pm } = await setup();
    const p = await pm.addProvider({ name: 'Dec', base_url: 'https://d.test' });
    await pm.addAPIKey(p.id, { name: 'A', key: 'my-plain-secret' });

    await pm.encryptAllKeys('another-pw-456');
    let keys = await pm.getAPIKeys(p.id);
    assertEqual(isEncrypted(keys[0].key), true);

    const count = await pm.decryptAllKeys('another-pw-456');
    assertEqual(count, 1);

    keys = await pm.getAPIKeys(p.id);
    assertEqual(keys[0].key, 'my-plain-secret', 'decrypted back to original');
  },

  async 'decryptAllKeys with wrong password fails loudly'() {
    const { storage, pm } = await setup();
    const p = await pm.addProvider({ name: 'W', base_url: 'https://w.test' });
    await pm.addAPIKey(p.id, { name: 'A', key: 'secret-value-1' });
    await pm.encryptAllKeys('right-password');

    await assertThrowsAsync(
      () => pm.decryptAllKeys('wrong-password'),
      'wrong password must throw'
    );
  },

  async 'crypto hook encrypts new keys automatically'() {
    const { pm } = await setup();
    const p = await pm.addProvider({ name: 'Hook', base_url: 'https://h.test' });

    pm.crypto = {
      encrypt: async (plain) => encryptWithPassword('hook-pw-12345', plain)
    };

    await pm.addAPIKey(p.id, { name: 'A', key: 'auto-encrypted-value' });
    const keys = await pm.getAPIKeys(p.id);
    assertEqual(isEncrypted(keys[0].key), true, 'new key should be encrypted via hook');
  },

  async 'full encryption lifecycle with verifier'() {
    const { storage, pm } = await setup();
    const p = await pm.addProvider({ name: 'Life', base_url: 'https://l.test' });
    await pm.addAPIKey(p.id, { name: 'A', key: 'lifecycle-secret-1' });

    const password = 'lifecycle-master-99';
    await pm.encryptAllKeys(password);
    const verifier = await makeVerifier(password);
    await storage.saveSetting('masterVerifier', verifier);

    // Simulate app restart: no password in memory
    pm.crypto = null;
    pm.masterPassword = undefined;

    // Wrong password rejected
    const { verifyPassword } = await import('../js/crypto.js');
    assertEqual(await verifyPassword('nope', await storage.getSetting('masterVerifier')), false);
    assertEqual(await verifyPassword(password, await storage.getSetting('masterVerifier')), true);

    // Disable encryption with correct password
    await pm.decryptAllKeys(password);
    const keys = await pm.getAPIKeys(p.id);
    assertEqual(keys[0].key, 'lifecycle-secret-1');
  },

  async 'addFromDirectory skips duplicates'() {
    const { pm } = await setup();
    await pm.addProvider({ id: 'openai', name: 'OpenAI', base_url: 'https://api.openai.com/v1' });

    const first = await pm.addFromDirectory({ id: 'openai', name: 'OpenAI', base_url: 'https://api.openai.com/v1' });
    assertEqual(first.added, false, 'duplicate must be skipped');

    const second = await pm.addFromDirectory({ id: 'cohere', name: 'Cohere', base_url: 'https://api.cohere.ai' });
    assertEqual(second.added, true, 'new provider should be added');
  },

  async 'exportData captures everything'() {
    const { storage, pm } = await setup();
    const p = await pm.addProvider({ name: 'Exp', base_url: 'https://x.test' });
    await pm.addAPIKey(p.id, { name: 'A', key: 'exported-key-123456' });
    await storage.saveSetting('theme', 'theme-light');

    const data = await storage.exportData();
    assertEqual(data.providers.length, 1);
    assertEqual(data.api_keys.length, 1);
    assertEqual(data.settings.theme, 'theme-light');

    // Import into a fresh storage
    const { createStorageStub: fresh } = await import('./storage-stub.js');
    const storage2 = fresh();
    await storage2.importData(data);
    const restored = await storage2.getProviders();
    assertEqual(restored.length, 1);
    assertEqual(restored[0].name, 'Exp');
  }
};
