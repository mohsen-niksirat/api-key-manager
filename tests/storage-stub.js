// tests/storage-stub.js - In-memory implementation of the APIKeyStorage interface

export function createStorageStub() {
  const providers = [];
  const keys = [];
  const settings = {};
  let nextId = 1;

  return {
    // expose internals for test setup
    providers,
    keys,
    seed(providerList) { providers.push(...providerList); },

    async init() {},

    async addProvider(p) {
      if (providers.some(x => x.id === p.id)) {
        throw new Error('ConstraintError: Key already exists');
      }
      providers.push({ ...p });
    },
    async getProviders() { return providers.map(p => ({ ...p })); },
    async getProvider(id) { return providers.find(p => p.id === id) || null; },
    async updateProvider(id, data) {
      const i = providers.findIndex(p => p.id === id);
      if (i >= 0) providers[i] = { ...providers[i], ...data };
    },
    async deleteProvider(id) {
      const idx = providers.findIndex(p => p.id === id);
      if (idx >= 0) providers.splice(idx, 1);
      // cascade
      for (let i = keys.length - 1; i >= 0; i--) {
        if (keys[i].provider_id === id) keys.splice(i, 1);
      }
    },

    async addAPIKey(k) {
      keys.push({ ...k, id: nextId++, created_at: new Date().toISOString(), is_active: true });
    },
    async getAPIKeys(providerId) {
      return keys
        .filter(k => !providerId || k.provider_id === providerId)
        .map(k => ({ ...k }));
    },
    async getAPIKey(id) { return keys.find(k => k.id === Number(id)) || null; },
    async updateAPIKey(id, data) {
      const i = keys.findIndex(k => k.id === Number(id));
      if (i >= 0) keys[i] = { ...keys[i], ...data };
    },
    async deleteAPIKey(id) {
      const i = keys.findIndex(k => k.id === Number(id));
      if (i >= 0) keys.splice(i, 1);
    },

    async saveSetting(key, value) { settings[key] = value; },
    async getSetting(key) { return key in settings ? settings[key] : null; },
    async getAllSettings() { return { ...settings }; },
    async exportData() {
      return { providers: [...providers], api_keys: [...keys], settings: { ...settings } };
    },
    async importData(data) {
      providers.length = 0;
      keys.length = 0;
      providers.push(...(data.providers || []));
      keys.push(...(data.api_keys || []));
      Object.assign(settings, data.settings || {});
    }
  };
}
