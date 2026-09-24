// storage.js - IndexedDB wrapper for API Key Manager

export class APIKeyStorage {
  constructor() {
    this.db = null;
    this.dbName = 'APIKeyManager';
    this.version = 2; // v2: soft-delete flags for recycle bin
  }

  async init() {
    if (!window.indexedDB) {
      throw new Error('IndexedDB not supported');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('providers')) {
          db.createObjectStore('providers', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('api_keys')) {
          const keyStore = db.createObjectStore('api_keys', { keyPath: 'id', autoIncrement: true });
          keyStore.createIndex('provider_id', 'provider_id', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  async addProvider(provider) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('providers', 'readwrite');
      const req = tx.objectStore('providers').add(provider);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getProviders() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('providers', 'readonly');
      const req = tx.objectStore('providers').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getProvider(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('providers', 'readonly');
      const req = tx.objectStore('providers').get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async updateProvider(id, data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('providers', 'readwrite');
      const store = tx.objectStore('providers');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          store.put({ ...existing, ...data });
        }
      };
      getReq.onerror = () => reject(getReq.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteProvider(id) {
    const tx = this.db.transaction(['providers', 'api_keys'], 'readwrite');
    const keyStore = tx.objectStore('api_keys');
    const index = keyStore.index('provider_id');

    return new Promise((resolve, reject) => {
      const cursorReq = index.openCursor(IDBKeyRange.only(id));
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);

      tx.objectStore('providers').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------- Soft delete (recycle bin) ----------

  async softDeleteProvider(id) {
    const tx = this.db.transaction(['providers', 'api_keys'], 'readwrite');
    const now = new Date().toISOString();
    const providerStore = tx.objectStore('providers');
    const getReq = providerStore.get(id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        providerStore.put({ ...getReq.result, deleted: true, deleted_at: now });
      }
    };

    const keyStore = tx.objectStore('api_keys');
    const index = keyStore.index('provider_id');
    const cursorReq = index.openCursor(IDBKeyRange.only(id));
    cursorReq.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const k = cursor.value;
        cursor.update({ ...k, deleted: true, deleted_at: now });
        cursor.continue();
      }
    };

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async softDeleteAPIKey(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('api_keys', 'readwrite');
      const store = tx.objectStore('api_keys');
      const getReq = store.get(Number(id));
      getReq.onsuccess = () => {
        if (getReq.result) {
          store.put({ ...getReq.result, deleted: true, deleted_at: new Date().toISOString() });
        }
      };
      getReq.onerror = () => reject(getReq.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async restoreProvider(id) {
    // Restore the provider and any keys deleted at the same moment (cascade)
    const provider = await this.getProvider(id);
    if (!provider) return;

    const deletedAt = provider.deleted_at;
    const tx = this.db.transaction(['providers', 'api_keys'], 'readwrite');
    tx.objectStore('providers').put({ ...provider, deleted: false, deleted_at: null });

    const keyStore = tx.objectStore('api_keys');
    const index = keyStore.index('provider_id');
    const cursorReq = index.openCursor(IDBKeyRange.only(id));
    cursorReq.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const k = cursor.value;
        if (k.deleted && (!deletedAt || k.deleted_at === deletedAt)) {
          cursor.update({ ...k, deleted: false, deleted_at: null });
        }
        cursor.continue();
      }
    };

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async restoreAPIKey(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('api_keys', 'readwrite');
      const store = tx.objectStore('api_keys');
      const getReq = store.get(Number(id));
      getReq.onsuccess = () => {
        if (getReq.result) {
          store.put({ ...getReq.result, deleted: false, deleted_at: null });
        }
      };
      getReq.onerror = () => reject(getReq.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async purgeProvider(id) {
    return await this.deleteProvider(id);
  }

  async purgeAPIKey(id) {
    return await this.deleteAPIKey(id);
  }

  async getTrashedProviders() {
    const all = await this.getProviders();
    return all.filter(p => p.deleted);
  }

  async getTrashedAPIKeys() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('api_keys', 'readonly');
      const req = tx.objectStore('api_keys').getAll();
      req.onsuccess = () => resolve((req.result || []).filter(k => k.deleted));
      req.onerror = () => reject(req.error);
    });
  }

  async emptyTrash() {
    const tx = this.db.transaction(['providers', 'api_keys'], 'readwrite');
    const providerStore = tx.objectStore('providers');
    const keyStore = tx.objectStore('api_keys');

    const pReq = providerStore.getAll();
    pReq.onsuccess = () => {
      (pReq.result || []).forEach(p => {
        if (p.deleted) providerStore.delete(p.id);
      });
    };
    const kReq = keyStore.getAll();
    kReq.onsuccess = () => {
      (kReq.result || []).forEach(k => {
        if (k.deleted) keyStore.delete(k.id);
      });
    };

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------- Keys ----------

  async addAPIKey(keyData) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('api_keys', 'readwrite');
      const req = tx.objectStore('api_keys').add({
        ...keyData,
        created_at: new Date().toISOString(),
        is_active: true
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAPIKeys(providerId) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('api_keys', 'readonly');
      const store = tx.objectStore('api_keys');
      let req;
      if (providerId) {
        req = store.index('provider_id').getAll(providerId);
      } else {
        req = store.getAll();
      }
      req.onsuccess = () => resolve((req.result || []).filter(k => !k.deleted));
      req.onerror = () => reject(req.error);
    });
  }

  async getAPIKey(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('api_keys', 'readonly');
      const req = tx.objectStore('api_keys').get(Number(id));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async updateAPIKey(id, data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('api_keys', 'readwrite');
      const store = tx.objectStore('api_keys');
      const getReq = store.get(Number(id));
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          store.put({ ...existing, ...data });
        }
      };
      getReq.onerror = () => reject(getReq.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteAPIKey(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('api_keys', 'readwrite');
      const req = tx.objectStore('api_keys').delete(Number(id));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async saveSetting(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readwrite');
      const req = tx.objectStore('settings').put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getSetting(key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllSettings() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').getAll();
      req.onsuccess = () => {
        const result = {};
        (req.result || []).forEach(s => { result[s.key] = s.value; });
        resolve(result);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async exportData() {
    const [providers, keys, settings] = await Promise.all([
      this.getProviders(),
      this.getAPIKeys(),
      this.getAllSettings()
    ]);

    return {
      version: this.version,
      timestamp: new Date().toISOString(),
      providers,
      api_keys: keys,
      settings
    };
  }

  async importData(data) {
    const tx = this.db.transaction(['providers', 'api_keys', 'settings'], 'readwrite');
    tx.objectStore('providers').clear();
    tx.objectStore('api_keys').clear();
    tx.objectStore('settings').clear();

    (data.providers || []).forEach(p => {
      tx.objectStore('providers').add(p);
    });
    (data.api_keys || []).forEach(k => {
      tx.objectStore('api_keys').add(k);
    });
    Object.entries(data.settings || {}).forEach(([key, value]) => {
      tx.objectStore('settings').put({ key, value });
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
