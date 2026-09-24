// tests/softdelete.test.js - Recycle bin (soft delete) tests

import { ProviderManager } from '../js/providers.js';
import { createStorageStub } from './storage-stub.js';
import { assert, assertEqual } from './helpers.js';

// Extend the stub with soft-delete ops mirroring the real APIKeyStorage
function softStorage() {
  const base = createStorageStub();
  const providers = base.providers;
  const keys = base.keys;

  return Object.assign(base, {
    async softDeleteProvider(id) {
      const p = providers.find(x => x.id === id);
      if (p) { p.deleted = true; p.deleted_at = new Date().toISOString(); }
      const at = p?.deleted_at;
      keys.forEach(k => {
        if (k.provider_id === id) { k.deleted = true; k.deleted_at = at; }
      });
    },
    async softDeleteAPIKey(id) {
      const k = keys.find(x => x.id === Number(id));
      if (k) { k.deleted = true; k.deleted_at = new Date().toISOString(); }
    },
    async restoreProvider(id) {
      const p = providers.find(x => x.id === id);
      if (p) { p.deleted = false; const at = p.deleted_at; p.deleted_at = null; }
      keys.forEach(k => { if (k.provider_id === id && k.deleted) { k.deleted = false; k.deleted_at = null; } });
    },
    async restoreAPIKey(id) {
      const k = keys.find(x => x.id === Number(id));
      if (k) { k.deleted = false; k.deleted_at = null; }
    },
    async getTrashedProviders() { return providers.filter(p => p.deleted); },
    async getTrashedAPIKeys() { return keys.filter(k => k.deleted); },
    async emptyTrash() {
      for (let i = providers.length - 1; i >= 0; i--) if (providers[i].deleted) providers.splice(i, 1);
      for (let i = keys.length - 1; i >= 0; i--) if (keys[i].deleted) keys.splice(i, 1);
    }
  });
}

export const tests = {
  async 'soft delete hides provider and keys from normal listing'() {
    const storage = softStorage();
    const pm = new ProviderManager(storage);
    const p = await pm.addProvider({ name: 'Doomed', base_url: 'https://doom.test' });
    await pm.addAPIKey(p.id, { name: 'K', key: 'key-doomed-123' });

    await pm.softDeleteProvider(p.id);
    assertEqual((await pm.getAllProviders()).length, 0, 'provider hidden');
    assertEqual((await pm.getAPIKeys(p.id)).length, 0, 'keys hidden');

    const trash = await pm.getTrash();
    assertEqual(trash.providers.length, 1, 'provider in trash');
    assertEqual(trash.keys.length, 1, 'key in trash');
  },

  async 'restore brings back provider and cascade keys'() {
    const storage = softStorage();
    const pm = new ProviderManager(storage);
    const p = await pm.addProvider({ name: 'Restorable', base_url: 'https://rest.test' });
    await pm.addAPIKey(p.id, { name: 'K', key: 'key-restorable' });

    await pm.softDeleteProvider(p.id);
    await pm.restoreProvider(p.id);

    assertEqual((await pm.getAllProviders()).length, 1, 'provider restored');
    assertEqual((await pm.getAPIKeys(p.id)).length, 1, 'key restored with provider');
  },

  async 'single key restore works independently'() {
    const storage = softStorage();
    const pm = new ProviderManager(storage);
    const p = await pm.addProvider({ name: 'P', base_url: 'https://p.test' });
    await pm.addAPIKey(p.id, { name: 'Keep', key: 'key-keep-1' });
    await pm.addAPIKey(p.id, { name: 'Drop', key: 'key-drop-1' });

    const keys = await pm.getAPIKeys(p.id);
    const dropKey = keys.find(k => k.name === 'Drop');
    await pm.softDeleteAPIKey(dropKey.id);

    assertEqual((await pm.getAPIKeys(p.id)).length, 1, 'one key remains visible');

    await pm.restoreAPIKey(dropKey.id);
    assertEqual((await pm.getAPIKeys(p.id)).length, 2, 'key restored');
  },

  async 'emptyTrash permanently removes everything trashed'() {
    const storage = softStorage();
    const pm = new ProviderManager(storage);
    const p1 = await pm.addProvider({ name: 'Gone1', base_url: 'https://g1.test' });
    const p2 = await pm.addProvider({ name: 'Stay', base_url: 'https://s.test' });
    await pm.softDeleteProvider(p1.id);

    await pm.emptyTrash();

    const providers = await pm.getAllProviders();
    assertEqual(providers.length, 1, 'only non-deleted provider remains');
    assertEqual(providers[0].name, 'Stay');
    assertEqual((await pm.getTrash()).providers.length, 0, 'trash empty');
  },

  async 'togglePin flips pinned flag'() {
    const storage = softStorage();
    const pm = new ProviderManager(storage);
    const p = await pm.addProvider({ name: 'Pinnable', base_url: 'https://pin.test' });

    assertEqual(await pm.togglePin(p.id), true, 'first toggle pins');
    assertEqual(await pm.togglePin(p.id), false, 'second toggle unpins');

    const provider = await pm.getProvider(p.id);
    assertEqual(provider.pinned, false);
  },

  async 'listProviders sorts pinned first by default'() {
    const storage = softStorage();
    const pm = new ProviderManager(storage);
    const a = await pm.addProvider({ id: 'alpha', name: 'Alpha', base_url: 'https://a.test' });
    const b = await pm.addProvider({ id: 'beta', name: 'Beta', base_url: 'https://b.test' });
    await pm.togglePin('beta'); // Beta pinned

    const list = await pm.listProviders({ sort: 'pinned' });
    assertEqual(list[0].id, 'beta', 'pinned provider first');

    await pm.togglePin('beta'); // back to unpinned: original order restored
    assertEqual((await pm.listProviders({ sort: 'pinned' }))[0].id, 'alpha', 'unpinned restores order');
  },

  async 'listProviders filters by keys/pinned/custom'() {
    const storage = softStorage();
    const pm = new ProviderManager(storage);
    await pm.addProvider({ id: 'withkeys', name: 'WithKeys', base_url: 'https://wk.test' });
    await pm.addProvider({ id: 'empty', name: 'Empty', base_url: 'https://e.test' });
    await pm.addAPIKey('withkeys', { name: 'K', key: 'key-wk-1' });
    await pm.togglePin('empty');

    assertEqual((await pm.listProviders({ filter: 'withKeys' })).length, 1);
    assertEqual((await pm.listProviders({ filter: 'noKeys' })).length, 1);
    assertEqual((await pm.listProviders({ filter: 'pinned' }))[0].id, 'empty');
  },

  async 'listProviders searches models too'() {
    const storage = softStorage();
    const pm = new ProviderManager(storage);
    await pm.addProvider({ name: 'Searchable', base_url: 'https://s.test', models: ['gpt-9-ultra'] });
    await pm.addProvider({ name: 'Other', base_url: 'https://o.test' });

    const hits = await pm.listProviders({ query: 'gpt-9' });
    assertEqual(hits.length, 1);
    assertEqual(hits[0].name, 'Searchable');
  }
};
