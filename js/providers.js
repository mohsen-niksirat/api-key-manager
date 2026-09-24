// providers.js - Provider management and utilities

import { encryptWithPassword, isEncrypted } from './crypto.js';

export const escapeHtml = (value) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export class ProviderManager {
  constructor(storage) {
    this.storage = storage;
    this.defaultProviders = [];
    this.directory = null;
    this.crypto = null; // set by app: { encrypt(plain) -> Promise<string> }
  }

  async loadDefaultProviders() {
    try {
      // Relative path so the app also works under a subpath (e.g. GitHub Pages)
      const response = await fetch('data/default-providers.json');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      this.defaultProviders = await response.json();
      return this.defaultProviders;
    } catch (e) {
      console.warn('Failed loading default providers:', e);
      this.defaultProviders = [];
      return [];
    }
  }

  async loadDirectory() {
    if (this.directory) return this.directory;
    try {
      const response = await fetch('data/provider-directory.json');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      this.directory = data.providers || [];
      return this.directory;
    } catch (e) {
      console.warn('Failed loading provider directory:', e);
      this.directory = [];
      return [];
    }
  }

  async addFromDirectory(entry) {
    // Skip if the provider already exists
    const existing = await this.storage.getProvider(entry.id);
    if (existing) return { added: false, reason: 'exists' };

    await this.addProvider({
      id: entry.id,
      name: entry.name,
      base_url: entry.base_url,
      website: entry.website || null,
      logo: entry.logo || null,
      models: entry.models || [],
      category: entry.category || 'other',
      is_custom: false
    });
    return { added: true };
  }

  async seedIfEmpty() {
    const existing = await this.storage.getProviders();

    if (existing.length === 0) {
      const defaults = await this.loadDefaultProviders();
      const seen = new Set();
      for (const provider of defaults) {
        // Guard against duplicate ids in the JSON file (ConstraintError)
        if (seen.has(provider.id)) continue;
        seen.add(provider.id);
        try {
          await this.storage.addProvider({ ...provider });
        } catch (e) {
          console.warn('Skipping provider during seed:', provider.id, e);
        }
      }
      return await this.storage.getProviders();
    }

    // Heal partial seeds: add missing defaults without overwriting user data
    if (this.defaultProviders.length > 0) {
      const existingIds = new Set(existing.map(p => p.id));
      for (const provider of this.defaultProviders) {
        if (!existingIds.has(provider.id)) {
          try {
            await this.storage.addProvider({ ...provider });
          } catch (e) {
            console.warn('Skipping provider during heal:', provider.id, e);
          }
        }
      }
      return await this.storage.getProviders();
    }

    return existing;
  }

  async getAllProviders(withKeys = false) {
    let providers = await this.storage.getProviders();

    if (withKeys) {
      const keys = await this.storage.getAPIKeys();
      // Group keys by provider_id
      const keysMap = {};
      keys.forEach(k => {
        if (!keysMap[k.provider_id]) keysMap[k.provider_id] = [];
        keysMap[k.provider_id].push(k);
      });
      providers = providers.map(p => ({
        ...p,
        keys: keysMap[p.id] || []
      }));
    }

    return providers;
  }

  async getProvider(id) {
    return await this.storage.getProvider(id);
  }

  async addProvider(provider) {
    const newProvider = {
      id: provider.id || this.generateId(provider.name),
      name: provider.name,
      logo: provider.logo || null,
      base_url: provider.base_url,
      models: provider.models || [],
      website: provider.website || null,
      category: provider.category || 'other',
      is_custom: !!provider.is_custom,
      created_at: new Date().toISOString()
    };
    await this.storage.addProvider(newProvider);
    return newProvider;
  }

  async updateProvider(id, data) {
    await this.storage.updateProvider(id, data);
  }

  async deleteProvider(id) {
    await this.storage.deleteProvider(id);
  }

  async getAPIKeys(providerId) {
    return await this.storage.getAPIKeys(providerId);
  }

  async addAPIKey(providerId, keyData) {
    const key = await this.encryptIfNeeded(keyData.key);
    await this.storage.addAPIKey({
      provider_id: providerId,
      name: keyData.name,
      key,
      status: keyData.status || 'active',
      notes: keyData.notes || '',
      expiry: keyData.expiry || null
    });
  }

  /** Re-encrypt all plaintext keys (called after enabling encryption). */
  async encryptAllKeys(password) {
    const keys = await this.storage.getAPIKeys();
    let count = 0;
    for (const k of keys) {
      if (!isEncrypted(k.key)) {
        const encrypted = await encryptWithPassword(password, k.key);
        await this.storage.updateAPIKey(k.id, { key: encrypted });
        count++;
      }
    }
    return count;
  }

  /** Decrypt all keys back to plaintext (called after disabling encryption). */
  async decryptAllKeys(password) {
    const keys = await this.storage.getAPIKeys();
    let count = 0;
    for (const k of keys) {
      if (isEncrypted(k.key)) {
        const { decryptWithPassword } = await import('./crypto.js');
        const plain = await decryptWithPassword(password, k.key);
        await this.storage.updateAPIKey(k.id, { key: plain });
        count++;
      }
    }
    return count;
  }

  async countUnencrypted() {
    const keys = await this.storage.getAPIKeys();
    return keys.filter(k => !isEncrypted(k.key)).length;
  }

  countEncrypted() {
    // Synchronous best-effort count for settings UI via cached flag
    return this._lastEncryptedCount ?? null;
  }

  async refreshEncryptionStats() {
    const keys = await this.storage.getAPIKeys();
    this._lastEncryptedCount = keys.filter(k => isEncrypted(k.key)).length;
    return { encrypted: this._lastEncryptedCount, total: keys.length };
  }

  async encryptIfNeeded(plainKey) {
    if (this.crypto?.encrypt) {
      try {
        return await this.crypto.encrypt(plainKey);
      } catch (e) {
        console.warn('Encryption failed, storing plaintext:', e);
      }
    }
    return plainKey;
  }

  async deleteAPIKey(id) {
    await this.storage.deleteAPIKey(id);
  }

  async getAPIKeyById(id) {
    return await this.storage.getAPIKey(id);
  }

  async searchKeys(query) {
    const providers = await this.getAllProviders(true);
    if (!query) return providers;

    const lower = query.toLowerCase();
    return providers.filter(p =>
      (p.name || '').toLowerCase().includes(lower) ||
      (p.base_url || '').toLowerCase().includes(lower) ||
      (p.keys || []).some(k =>
        (k.name || '').toLowerCase().includes(lower) ||
        (k.key || '').toLowerCase().includes(lower)
      )
    );
  }

  generateId(name) {
    return (name?.toLowerCase() || 'provider')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + Date.now().toString(36).slice(-4);
  }
}

// Utility functions for UI rendering
export const formatKey = (key, visible = false) => {
  if (visible) return key;
  if (!key || key.length < 12) return '••••••••';
  return key.slice(0, 8) + '•••' + key.slice(-4);
};

export const maskKey = (key) => {
  if (!key || key.length < 12) return '••••••••••••';
  return key.slice(0, 6) + '•'.repeat(Math.min(key.length - 10, 24)) + key.slice(-4);
};

export const getKeyStatusColor = (status) => {
  const colors = {
    active: '#22c55e',
    inactive: '#94a3b8',
    expired: '#ef4444',
    revoked: '#f59e0b'
  };
  return colors[status] || '#94a3b8';
};

export function getProviderIcon(provider) {
  const initials = escapeHtml((provider.name || 'P').charAt(0).toUpperCase());
  const bg = getProviderColor(provider.id);
  const placeholder = `<div class="provider-icon-placeholder" style="background:${bg}">${initials}</div>`;
  if (provider.logo) {
    const safeUrl = escapeHtml(provider.logo);
    const alt = escapeHtml(provider.name || 'P');
    // On load error, swap the image for the letter placeholder
    return `<img src="${safeUrl}" alt="${alt}" data-fallback="${escapeHtml(placeholder)}" onerror="this.outerHTML=this.dataset.fallback" />`;
  }
  return placeholder;
}

export function getProviderColor(id) {
  const colors = {
    'openai': 'linear-gradient(135deg, #109286, #0b7b6b)',
    'anthropic': 'linear-gradient(135deg, #d97706, #b45200)',
    'google': 'linear-gradient(135deg, #3b82f6, #2563eb)',
    'groq': 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    'deepseek': 'linear-gradient(135deg, #ec4899, #db2777)',
    'mistral': 'linear-gradient(135deg, #06b6d4, #0284c7)',
    'openrouter': 'linear-gradient(135deg, #84cc16, #65a30d)',
    'default': 'linear-gradient(135deg, #6366f1, #4338ca)'
  };
  return colors[id] || colors.default;
}
