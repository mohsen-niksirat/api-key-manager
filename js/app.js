// app.js - Main application logic

import { APIKeyStorage } from './storage.js';
import { ProviderManager, maskKey, getKeyStatusColor, getProviderIcon, escapeHtml } from './providers.js';
import {
  encryptWithPassword,
  decryptWithPassword,
  isEncrypted,
  makeVerifier,
  verifyPassword
} from './crypto.js';

class App {
  constructor() {
    this.storage = new APIKeyStorage();
    this.providerManager = new ProviderManager(this.storage);
    this.activeProvider = null;
    this.editMode = false;
    this.masterPassword = null;
    this.encryptEnabled = false;
  }

  async init() {
    await this.storage.init();
    await this.providerManager.seedIfEmpty();
    this.bindEvents();
    await this.loadSettings();
    await this.initEncryption();
    await this.loadProviders();
    this.registerServiceWorker();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.warn('Service worker registration failed:', err);
      });
    }
  }

  bindEvents() {
    document.getElementById('btnAddProvider')?.addEventListener('click', () => this.openModal('modalAddProvider'));
    document.getElementById('btnBrowseDirectory')?.addEventListener('click', () => this.openDirectory());
    document.getElementById('btnImport')?.addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile')?.addEventListener('change', (e) => this.handleImport(e));
    document.getElementById('btnExport')?.addEventListener('click', () => this.exportData());
    document.getElementById('btnDownload')?.addEventListener('click', () => this.downloadData());
    document.getElementById('btnSettings')?.addEventListener('click', () => this.openSettings());
    document.getElementById('globalSearch')?.addEventListener('input', (e) => this.handleSearch(e.target.value));
    document.getElementById('btnClearSearch')?.addEventListener('click', () => this.clearSearch());
    document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
    document.getElementById('directorySearch')?.addEventListener('input', (e) => this.renderDirectory(e.target.value));

    // Close modals via backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal(modal.id);
      });
    });

    // Global delegated handlers for inline onclick fallbacks (event.stopPropagation)
    window.addEventListener('click', (e) => {
      const stopper = e.target.closest('[data-stop]');
      if (stopper) e.stopPropagation();
    });
  }

  async loadProviders() {
    const providers = await this.providerManager.getAllProviders(true);
    this.renderProviders(providers);
  }

  renderProviders(providers) {
    const container = document.getElementById('providersContainer');
    if (!container) return;

    if (!providers.length) {
      container.innerHTML = '<div class="empty-state-full">No providers. Add one to get started!</div>';
      return;
    }

    container.innerHTML = providers.map(p => this.renderProviderCard(p)).join('');

    container.querySelectorAll('.provider-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          this.viewProvider(card.dataset.provider);
        }
      });
    });
  }

  renderProviderCard(provider) {
    const safeId = escapeHtml(provider.id);
    const name = escapeHtml(provider.name || 'Untitled');
    const baseUrl = escapeHtml(provider.base_url || '');
    const keyCount = provider.keys?.length || 0;
    const activeKeys = provider.keys?.filter(k => k.status === 'active').length || 0;

    let body = `<div class="provider-body"><div class="no-keys" data-stop onclick="app.addKeyToProvider('${safeId}')">No keys yet →</div></div>`;
    if (keyCount > 0) {
      const previews = provider.keys.slice(0, 2).map(k =>
        `<div class="key-preview" data-stop onclick="app.viewProvider('${safeId}')">${maskKey(k.key)}</div>`
      ).join('');
      const more = keyCount > 2 ? `<div class="key-preview">+${keyCount - 2} more</div>` : '';
      body = `
        <div class="provider-body">
          <div class="provider-stats">
            <span class="stat-badge active">${activeKeys} active</span>
            <span class="stat-badge">Total: ${keyCount}</span>
          </div>
          <div class="keys-preview">${previews}${more}</div>
        </div>`;
    }

    return `
      <div class="provider-card" data-provider="${safeId}">
        <div class="provider-header">
          ${getProviderIcon(provider)}
          <div class="provider-info">
            <h3>${name}</h3>
            <span class="provider-base-url">${baseUrl}</span>
          </div>
        </div>
        ${body}
      </div>
    `;
  }

  openModal(id) {
    // Close any currently open modal (except the one we're opening)
    document.querySelectorAll('.modal.open').forEach(m => {
      if (m.id !== id) m.classList.remove('open');
    });

    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('open');
      const firstInput = modal.querySelector('input, textarea, select');
      firstInput?.focus();
      return true;
    }
    return false;
  }

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('open');
      this.editMode = false;
      this.activeProvider = null;
    }
  }

  async viewProvider(id) {
    const provider = await this.providerManager.getProvider(id);
    if (!provider) return;

    this.activeProvider = provider;
    this.editMode = false;
    const keys = await this.providerManager.getAPIKeys(id);

    const modal = document.getElementById('modalProviderDetail');
    const body = modal.querySelector('.modal-body');

    // Reset edit toggle
    const editToggle = document.getElementById('editModeToggle');
    if (editToggle) {
      editToggle.textContent = '✏️ Edit';
      editToggle.classList.remove('editing');
    }

    body.innerHTML = this.renderProviderDetail(provider, keys);
    this.openModal('modalProviderDetail');
  }

  renderProviderDetail(provider, keys) {
    const safeId = escapeHtml(provider.id);
    const name = escapeHtml(provider.name || 'Untitled');
    const baseUrl = escapeHtml(provider.base_url || '');

    const keysList = keys.length > 0 ? keys.map(k => {
      const statusColor = getKeyStatusColor(k.status);
      const keyName = escapeHtml(k.name || 'Unnamed Key');
      const isEnc = isEncrypted(k.key);
      const lockBadge = isEnc ? '<span class="key-lock" title="Encrypted at rest">🔒</span>' : '';
      const keyValue = maskKey(k.key);
      const notes = k.notes ? `<div class="key-notes">${escapeHtml(k.notes)}</div>` : '';
      const expiry = k.expiry ? `<div class="key-expiry">Expires: ${new Date(k.expiry).toLocaleDateString()}</div>` : '';
      return `
        <div class="key-row" data-key-id="${escapeHtml(k.id)}">
          <div class="key-info">
            <div class="key-name">${keyName} ${lockBadge}</div>
            <div class="key-value">${keyValue}</div>
            ${notes}${expiry}
          </div>
          <div class="key-status" style="background: ${statusColor}20; color: ${statusColor}">${escapeHtml(k.status || 'active')}</div>
          <button class="icon-btn" onclick="app.copyKey(${Number(k.id)})" title="Copy key">📋</button>
          <button class="icon-btn danger" onclick="app.deleteKey(${Number(k.id)})" title="Delete key">🗑️</button>
        </div>
      `;
    }).join('') : '<div class="empty-state">No keys for this provider</div>';

    const models = provider.models || [];
    const modelsList = models.length > 0 ?
      `<div class="models-section">
        <h4>Models</h4>
        <div class="models-tags">${models.map(m => {
          const model = escapeHtml(m);
          return `<span class="model-tag" title="Click to copy" onclick="app.copyToClipboard('${model.replace(/'/g, '&#39;')}')">${model} 📋</span>`;
        }).join('')}</div>
        <div class="actions-row">
          <button class="btn btn-secondary btn-sm" onclick="app.copyToClipboard('${baseUrl.replace(/'/g, '&#39;')}')">
            📋 Copy Base URL
          </button>
          ${provider.website ? `<button class="btn btn-secondary btn-sm" onclick="app.openWebsite('${escapeHtml(provider.website).replace(/'/g, '&#39;')}')">🔗 Website</button>` : ''}
        </div>
      </div>` : '';

    return `
      <div class="provider-detail">
        <div class="provider-detail-header">
          ${getProviderIcon(provider)}
          <div class="provider-detail-info">
            <h2>${name}</h2>
            <span class="provider-detail-base" onclick="app.copyToClipboard('${baseUrl.replace(/'/g, '&#39;')}')" title="Click to copy base URL" style="cursor: pointer;">${baseUrl} 📋</span>
          </div>
        </div>

        ${modelsList}

        <div class="keys-section">
          <div class="keys-header">
            <h3>API Keys (${keys.length})</h3>
            <div>
              <button class="btn btn-primary btn-sm" onclick="app.addKeyToProvider('${safeId}')">
                + Add Key
              </button>
              <button class="btn btn-secondary btn-sm" onclick="app.deleteProvider('${safeId}')">
                🗑️ Delete Provider
              </button>
            </div>
          </div>
          <div class="keys-list">${keysList}</div>
        </div>
      </div>
    `;
  }

  toggleEditMode() {
    if (!this.activeProvider) return;
    this.openEditProvider(this.activeProvider.id);
  }

  async openEditProvider(id) {
    const provider = await this.providerManager.getProvider(id);
    if (!provider) return;

    const modal = document.getElementById('modalEditProvider');
    const form = modal.querySelector('form');
    form.dataset.providerId = provider.id;
    form.querySelector('input[name="name"]').value = provider.name || '';
    form.querySelector('input[name="base_url"]').value = provider.base_url || '';
    form.querySelector('input[name="models"]').value = (provider.models || []).join(', ');
    form.querySelector('input[name="website"]').value = provider.website || '';
    form.querySelector('input[name="logo"]').value = provider.logo || '';
    this.openModal('modalEditProvider');
  }

  async saveProviderEdits() {
    const modal = document.getElementById('modalEditProvider');
    const form = modal.querySelector('form');
    const id = form.dataset.providerId;
    if (!id) return;

    const name = form.querySelector('input[name="name"]').value.trim();
    const baseUrl = form.querySelector('input[name="base_url"]').value.trim();
    if (!name || !baseUrl) {
      this.showToast('Please fill in required fields', 'error');
      return;
    }

    const models = form.querySelector('input[name="models"]').value
      .split(',').map(s => s.trim()).filter(Boolean);
    const website = form.querySelector('input[name="website"]').value.trim() || null;
    const logo = form.querySelector('input[name="logo"]').value.trim() || null;

    try {
      await this.providerManager.updateProvider(id, { name, base_url: baseUrl, models, website, logo });
      modal.classList.remove('open');
      form.reset();
      this.loadProviders();
      if (this.activeProvider?.id === id) {
        this.viewProvider(id);
      }
      this.showToast('Provider updated');
    } catch (err) {
      console.error('Error updating provider:', err);
      this.showToast('Failed to update provider: ' + err.message, 'error');
    }
  }

  addKeyToProvider(providerId) {
    const modal = document.getElementById('modalAddKey');
    if (!modal) return;
    modal.dataset.providerId = providerId;
    modal.querySelector('form').reset();
    this.openModal('modalAddKey');
  }

  async saveKey() {
    const modal = document.getElementById('modalAddKey');
    const providerId = modal.dataset.providerId;
    const form = modal.querySelector('form');

    const key = form.querySelector('input[name="key"]').value.trim();
    const name = form.querySelector('input[name="name"]').value.trim();
    const expiry = form.querySelector('input[name="expiry"]').value;

    if (!key || !providerId) {
      this.showToast('Please enter a key', 'error');
      return;
    }

    try {
      await this.providerManager.addAPIKey(providerId, {
        name,
        key,
        notes: '',
        expiry: expiry ? new Date(expiry).toISOString() : null
      });

      modal.classList.remove('open');
      form.reset();
      this.loadProviders();
      if (this.activeProvider?.id === providerId) {
        this.viewProvider(providerId);
      }
      this.showToast('Key added');
    } catch (err) {
      console.error('Error saving key:', err);
      this.showToast('Failed to save key: ' + err.message, 'error');
    }
  }

  async copyKey(id) {
    const key = await this.providerManager.getAPIKeyById(id);
    if (key) {
      await this.copyToClipboard(key.key);
    }
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Copied to clipboard');
    } catch (e) {
      // Fallback for non-secure contexts (e.g. plain http:// LAN access)
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        this.showToast('Copied to clipboard');
      } catch (err) {
        this.showToast('Copy failed', 'error');
      }
      ta.remove();
    }
  }

  openWebsite(url) {
    window.open(url, '_blank', 'noopener');
  }

  async deleteKey(id) {
    if (!confirm('Delete this key?')) return;
    await this.providerManager.deleteAPIKey(id);
    this.showToast('Key deleted');
    if (this.activeProvider) {
      this.viewProvider(this.activeProvider.id);
    }
    this.loadProviders();
  }

  async deleteProvider(id) {
    const provider = await this.providerManager.getProvider(id);
    if (!confirm(`Delete provider "${provider?.name}" and all its keys?`)) return;

    await this.providerManager.deleteProvider(id);
    this.closeModal('modalProviderDetail');
    this.loadProviders();
    this.showToast('Provider deleted');
  }

  async saveProvider() {
    const modal = document.getElementById('modalAddProvider');
    const form = modal.querySelector('form');
    const name = form.querySelector('input[name="name"]').value.trim();
    const baseUrl = form.querySelector('input[name="base_url"]').value.trim();
    const models = form.querySelector('input[name="models"]').value
      .split(',').map(s => s.trim()).filter(Boolean);
    const website = form.querySelector('input[name="website"]').value.trim();
    const logo = form.querySelector('input[name="logo"]').value.trim();

    if (!name || !baseUrl) {
      this.showToast('Please fill in required fields', 'error');
      return;
    }

    await this.providerManager.addProvider({
      name,
      base_url: baseUrl,
      models,
      website,
      logo,
      is_custom: true,
      category: 'custom'
    });

    modal.classList.remove('open');
    form.reset();
    this.loadProviders();
    this.showToast('Provider added');
  }

  async exportData() {
    const data = await this.storage.exportData();
    const modal = document.getElementById('modalExport');
    modal.querySelector('textarea').value = JSON.stringify(data, null, 2);
    this.openModal('modalExport');
  }

  async downloadData() {
    const data = await this.storage.exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `api-keys-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Backup downloaded');
  }

  async handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || !Array.isArray(data.providers)) {
        throw new Error('Invalid file format');
      }

      const providerCount = data.providers.length;
      if (!confirm(`Import ${providerCount} providers? This will overwrite existing data.`)) {
        return;
      }

      await this.storage.importData(data);
      this.showToast('Data imported successfully');
      this.loadProviders();
    } catch (err) {
      this.showToast('Invalid file format: ' + err.message, 'error');
    } finally {
      e.target.value = '';
    }
  }

  async openSettings() {
    const theme = await this.storage.getSetting('theme') || 'theme-dark';
    const autoSave = await this.storage.getSetting('autoSave');
    const modal = document.getElementById('modalSettings');
    modal.querySelector('#themeSelect').value = theme;
    modal.querySelector('#autoSave').checked = autoSave !== false;
    modal.querySelector('#encryptToggle').checked = this.encryptEnabled;
    this.openModal('modalSettings');
  }

  toggleEncryptFromSettings(checkbox) {
    if (checkbox.checked && !this.encryptEnabled) {
      checkbox.checked = false;
      this.openEncryptModal();
    } else if (!checkbox.checked && this.encryptEnabled) {
      checkbox.checked = true;
      this.openEncryptModal();
    }
  }

  // ---------- Encryption ----------

  async initEncryption() {
    const verifier = await this.storage.getSetting('masterVerifier');
    this.encryptEnabled = !!verifier;
    this.providerManager.crypto = {
      encrypt: async (plain) => {
        if (!this.encryptEnabled || !this.masterPassword) return plain;
        return encryptWithPassword(this.masterPassword, plain);
      }
    };

    if (this.encryptEnabled && !this.masterPassword) {
      this.openEncryptModal();
    }
    this.updateEncryptStatus();
  }

  async openEncryptModal() {
    const setup = document.getElementById('formEncryptSetup');
    const unlock = document.getElementById('formEncryptUnlock');
    const actions = document.getElementById('encryptActions');

    if (this.encryptEnabled) {
      setup.hidden = true;
      unlock.hidden = false;
      actions.hidden = false;
    } else {
      setup.hidden = false;
      unlock.hidden = true;
      actions.hidden = true;
    }
    this.updateEncryptStatus();
    this.openModal('modalEncrypt');
  }

  async updateEncryptStatus() {
    const el = document.getElementById('encryptStatus');
    if (!el) return;
    if (!this.encryptEnabled) {
      el.innerHTML = '<span class="status-off">○ Encryption is off — keys are stored in plain text.</span>';
      return;
    }
    const unlocked = !!this.masterPassword;
    const { encrypted, total } = await this.providerManager.refreshEncryptionStats();
    el.innerHTML = unlocked
      ? `<span class="status-on">● Unlocked — ${encrypted}/${total} keys encrypted.</span>`
      : `<span class="status-locked">🔒 Locked — ${encrypted}/${total} keys encrypted. Enter password to unlock.</span>`;
  }

  async setupEncryption() {
    const form = document.getElementById('formEncryptSetup');
    const password = form.querySelector('input[name="password"]').value;
    const confirm = form.querySelector('input[name="confirm"]').value;

    if (password.length < 8) {
      this.showToast('Password must be at least 8 characters', 'error');
      return;
    }
    if (password !== confirm) {
      this.showToast('Passwords do not match', 'error');
      return;
    }

    try {
      this.showToast('Encrypting keys…');
      const count = await this.providerManager.encryptAllKeys(password);
      const verifier = await makeVerifier(password);
      await this.storage.saveSetting('masterVerifier', verifier);
      this.masterPassword = password;
      this.encryptEnabled = true;

      form.reset();
      this.closeModal('modalEncrypt');
      this.loadProviders();
      this.showToast(`Encryption enabled — ${count} key(s) encrypted`);
    } catch (err) {
      console.error('Encryption setup failed:', err);
      this.showToast('Failed to enable encryption: ' + err.message, 'error');
    }
  }

  async unlockEncryption() {
    const form = document.getElementById('formEncryptUnlock');
    const password = form.querySelector('input[name="password"]').value;
    const verifier = await this.storage.getSetting('masterVerifier');

    if (await verifyPassword(password, verifier)) {
      this.masterPassword = password;
      form.reset();
      this.closeModal('modalEncrypt');
      this.showToast('Encryption unlocked');
      this.updateEncryptStatus();
    } else {
      this.showToast('Wrong password', 'error');
    }
  }

  async disableEncryption() {
    if (!confirm('Disable encryption and store all keys in plain text?')) return;

    const form = document.getElementById('formEncryptUnlock');
    let password = this.masterPassword;

    if (!password) {
      password = form.querySelector('input[name="password"]').value;
      const verifier = await this.storage.getSetting('masterVerifier');
      if (!(await verifyPassword(password, verifier))) {
        this.showToast('Wrong password', 'error');
        return;
      }
    }

    try {
      const count = await this.providerManager.decryptAllKeys(password);
      await this.storage.saveSetting('masterVerifier', null);
      this.masterPassword = null;
      this.encryptEnabled = false;
      this.closeModal('modalEncrypt');
      this.loadProviders();
      this.showToast(`Encryption disabled — ${count} key(s) decrypted`);
    } catch (err) {
      console.error('Decryption failed:', err);
      this.showToast('Failed to decrypt: ' + err.message, 'error');
    }
  }

  // ---------- Provider Directory ----------

  async openDirectory() {
    this.openModal('modalDirectory');
    await this.renderDirectory('');
  }

  async renderDirectory(filter = '') {
    const list = document.getElementById('directoryList');
    if (!list) return;

    const directory = await this.providerManager.loadDirectory();
    const existing = await this.providerManager.getAllProviders();
    const existingIds = new Set(existing.map(p => p.id));

    const lower = (filter || '').toLowerCase();
    const items = directory.filter(p =>
      !lower ||
      (p.name || '').toLowerCase().includes(lower) ||
      (p.category || '').toLowerCase().includes(lower) ||
      (p.base_url || '').toLowerCase().includes(lower)
    );

    if (!items.length) {
      list.innerHTML = '<div class="empty-state">No providers match your filter.</div>';
      return;
    }

    list.innerHTML = items.map(p => {
      const added = existingIds.has(p.id);
      const safeId = escapeHtml(p.id);
      return `
        <div class="directory-item">
          ${getProviderIcon(p)}
          <div class="directory-info">
            <div class="directory-name">${escapeHtml(p.name)} <span class="directory-category">${escapeHtml(p.category || '')}</span></div>
            <div class="directory-url">${escapeHtml(p.base_url)}</div>
          </div>
          ${added
            ? '<span class="directory-added">✓ Added</span>'
            : `<button class="btn btn-primary btn-sm" onclick="app.addFromDirectory('${safeId}')">+ Add</button>`}
        </div>
      `;
    }).join('');
  }

  async addFromDirectory(id) {
    const directory = await this.providerManager.loadDirectory();
    const entry = directory.find(p => p.id === id);
    if (!entry) return;

    const result = await this.providerManager.addFromDirectory(entry);
    if (result.added) {
      this.showToast(`${entry.name} added`);
      this.loadProviders();
      this.renderDirectory(document.getElementById('directorySearch')?.value || '');
    } else {
      this.showToast('Provider already exists', 'error');
    }
  }

  // ---------- Search ----------

  clearSearch() {
    const input = document.getElementById('globalSearch');
    if (input) {
      input.value = '';
      input.focus();
    }
    this.loadProviders();
  }

  async loadSettings() {
    const theme = await this.storage.getSetting('theme');
    this.applyTheme(theme || 'theme-dark');
    // Reflect system theme changes live when theme=system
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      this.storage.getSetting('theme').then(t => {
        if (t === 'theme-system') this.applyTheme('theme-system');
      });
    });
  }

  applyTheme(theme) {
    if (theme === 'theme-system') {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      document.body.className = prefersLight ? 'theme-light' : 'theme-dark';
    } else if (theme === 'theme-light' || theme === 'theme-dark') {
      document.body.className = theme;
    }
  }

  async saveSettings() {
    const modal = document.getElementById('modalSettings');
    const theme = modal.querySelector('#themeSelect').value;
    const autoSave = modal.querySelector('#autoSave').checked;

    await this.storage.saveSetting('theme', theme);
    await this.storage.saveSetting('autoSave', autoSave);

    this.applyTheme(theme);
    modal.classList.remove('open');
    this.showToast('Settings saved');
  }

  async toggleTheme() {
    const next = document.body.classList.contains('theme-dark') ? 'theme-light' : 'theme-dark';
    this.applyTheme(next);
    await this.storage.saveSetting('theme', next);
  }

  async handleSearch(query) {
    const clearBtn = document.getElementById('btnClearSearch');
    if (clearBtn) clearBtn.hidden = !query;
    if (!query.trim()) {
      await this.loadProviders();
      return;
    }
    const results = await this.providerManager.searchKeys(query);
    this.renderProviders(results);
  }

  showToast(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 2000);
    }, 100);
  }
}

// Initialize app
window.app = new App();
window.addEventListener('load', () => {
  app.init().then(() => {
    app.showToast('API Key Manager loaded');
  }).catch(err => {
    console.error('Init error:', err);
    app.showToast('Failed to load', 'error');
  });
});
