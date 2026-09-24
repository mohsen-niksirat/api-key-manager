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
import { I18n } from './i18n.js';
import { testKey, testAllKeys } from './keytester.js';

const BACKUP_PREFIX = 'AKM-ENCRYPTED-BACKUP:v1:';

class App {
  constructor() {
    this.storage = new APIKeyStorage();
    this.providerManager = new ProviderManager(this.storage);
    this.activeProvider = null;
    this.editMode = false;
    this.masterPassword = null;
    this.encryptEnabled = false;
    this.i18n = new I18n(I18n.detectLang());
    this.visibleKeys = new Set(); // key ids currently revealed via eye toggle
    this.pendingEncryptedImport = null;
    this.listFilter = 'all';
    this.listSort = 'pinned';
  }

  /** Translate helper bound to the current language. */
  t(key, params) {
    return this.i18n.t(key, params);
  }

  async init() {
    await this.storage.init();
    await this.providerManager.seedIfEmpty();
    const savedLang = await this.storage.getSetting('language');
    this.i18n.setLang(savedLang || I18n.detectLang());
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
    document.getElementById('langSelect')?.addEventListener('change', (e) => this.changeLanguage(e.target.value));
    document.getElementById('langSelectSettings')?.addEventListener('change', (e) => this.changeLanguage(e.target.value));
    document.getElementById('btnTrash')?.addEventListener('click', () => this.openTrash());
    document.getElementById('sortSelect')?.addEventListener('change', (e) => {
      this.listSort = e.target.value;
      this.loadProviders();
    });
    document.getElementById('filterChips')?.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      this.listFilter = chip.dataset.filter;
      document.querySelectorAll('#filterChips .chip').forEach(c => c.classList.toggle('active', c === chip));
      this.loadProviders();
    });

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

  // ---------- i18n ----------

  changeLanguage(lang) {
    this.i18n.setLang(lang);
    this.storage.saveSetting('language', lang);
    this.applyLanguage();
  }

  applyLanguage() {
    this.i18n.applyToDOM();
    const langSelect = document.getElementById('langSelect');
    const langSelectSettings = document.getElementById('langSelectSettings');
    if (langSelect) langSelect.value = this.i18n.getLang();
    if (langSelectSettings) langSelectSettings.value = this.i18n.getLang();
    document.title = this.t('appTitle');
    this.loadProviders();
    if (document.getElementById('modalDirectory')?.classList.contains('open')) {
      this.renderDirectory(document.getElementById('directorySearch')?.value || '');
    }
  }

  async loadProviders() {
    const query = document.getElementById('globalSearch')?.value || '';
    const providers = await this.providerManager.listProviders({
      query,
      filter: this.listFilter,
      sort: this.listSort
    });
    this.renderProviders(providers);
  }

  renderProviders(providers) {
    const container = document.getElementById('providersContainer');
    if (!container) return;

    if (!providers.length) {
      container.innerHTML = `<div class="empty-state-full">${escapeHtml(this.t('noProviders'))}</div>`;
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

    let body = `<div class="provider-body"><div class="no-keys" data-stop onclick="app.addKeyToProvider('${safeId}')">${escapeHtml(this.t('noKeysYet'))}</div></div>`;
    if (keyCount > 0) {
      const previews = provider.keys.slice(0, 2).map(k =>
        `<div class="key-preview" data-stop onclick="app.viewProvider('${safeId}')">${maskKey(k.key)}</div>`
      ).join('');
      const more = keyCount > 2 ? `<div class="key-preview">+${keyCount - 2} ${escapeHtml(this.t('more'))}</div>` : '';
      body = `
        <div class="provider-body">
          <div class="provider-stats">
            <span class="stat-badge active">${activeKeys} ${escapeHtml(this.t('active'))}</span>
            <span class="stat-badge">${escapeHtml(this.t('total'))}: ${keyCount}</span>
          </div>
          <div class="keys-preview">${previews}${more}</div>
        </div>`;
    }

    const models = provider.models || [];
    const modelChips = models.length
      ? `<div class="card-models">${models.slice(0, 3).map(m =>
          `<span class="model-chip" data-stop onclick="app.copyToClipboard('${escapeHtml(m).replace(/'/g, '&#39;')}')" title="${escapeHtml(this.t('toastCopied'))}">${escapeHtml(m)}</span>`
        ).join('')}${models.length > 3 ? `<span class="model-chip more">+${models.length - 3}</span>` : ''}</div>`
      : '';

    const pinBtn = `<button class="pin-btn ${provider.pinned ? 'pinned' : ''}" data-stop
      onclick="app.togglePin('${safeId}')" title="${escapeHtml(provider.pinned ? this.t('unpin') : this.t('pin'))}">${provider.pinned ? '📌' : '📍'}</button>`;

    return `
      <div class="provider-card ${provider.pinned ? 'is-pinned' : ''}" data-provider="${safeId}">
        <div class="provider-header">
          ${getProviderIcon(provider)}
          <div class="provider-info">
            <h3>${name} ${provider.pinned ? '<span class="pin-flag">📌</span>' : ''}</h3>
            <span class="provider-base-url" data-stop onclick="app.copyToClipboard('${baseUrl.replace(/'/g, '&#39;')}')" title="${escapeHtml(this.t('copyBaseUrl'))}">${baseUrl} 📋</span>
          </div>
          ${pinBtn}
        </div>
        ${modelChips}
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
      editToggle.textContent = this.t('edit');
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
      const keyName = escapeHtml(k.name || this.t('unnamedKey'));
      const isEnc = isEncrypted(k.key);
      const lockBadge = isEnc ? `<span class="key-lock" title="${escapeHtml(this.t('encryptedAtRest'))}">🔒</span>` : '';
      const revealed = this.visibleKeys.has(Number(k.id));
      const keyValue = escapeHtml(revealed ? k.key : maskKey(k.key));
      const eyeBtn = `
        <button class="icon-btn eye-btn" onclick="app.toggleKeyVisibility(${Number(k.id)})" title="${escapeHtml(revealed ? this.t('hideKey') : this.t('showKey'))}">${revealed ? '🙈' : '👁️'}</button>`;
      const notes = k.notes ? `<div class="key-notes">${escapeHtml(k.notes)}</div>` : '';
      const expiry = k.expiry ? `<div class="key-expiry">${escapeHtml(this.t('expires'))}: ${new Date(k.expiry).toLocaleDateString()}</div>` : '';
      return `
        <div class="key-row ${revealed ? 'key-revealed' : ''}" data-key-id="${escapeHtml(k.id)}">
          <div class="key-info">
            <div class="key-name">${keyName} ${lockBadge}</div>
            <div class="key-value">${keyValue}</div>
            ${notes}${expiry}
          </div>
          <div class="key-status" style="background: ${statusColor}20; color: ${statusColor}">${escapeHtml(k.status || 'active')}</div>
          ${eyeBtn}
          <button class="icon-btn" onclick="app.testSingleKey(${Number(k.id)})" title="${escapeHtml(this.t('testThisKey'))}">🧪</button>
          <button class="icon-btn" onclick="app.copyKey(${Number(k.id)})" title="${escapeHtml(this.t('copyKey'))}">📋</button>
          <button class="icon-btn danger" onclick="app.deleteKey(${Number(k.id)})" title="${escapeHtml(this.t('deleteKey'))}">🗑️</button>
        </div>
      `;
    }).join('') : `<div class="empty-state">${escapeHtml(this.t('noKeysForProvider'))}</div>`;

    const models = provider.models || [];
    const modelsList = models.length > 0 ?
      `<div class="models-section">
        <h4>${escapeHtml(this.t('models'))}</h4>
        <div class="models-tags">${models.map(m => {
          const model = escapeHtml(m);
          return `<span class="model-tag" title="Click to copy" onclick="app.copyToClipboard('${model.replace(/'/g, '&#39;')}')">${model} 📋</span>`;
        }).join('')}</div>
        <div class="actions-row">
          <button class="btn btn-secondary btn-sm" onclick="app.copyToClipboard('${baseUrl.replace(/'/g, '&#39;')}')">
            ${escapeHtml(this.t('copyBaseUrl'))}
          </button>
          ${provider.website ? `<button class="btn btn-secondary btn-sm" onclick="app.openWebsite('${escapeHtml(provider.website).replace(/'/g, '&#39;')}')">${escapeHtml(this.t('website'))}</button>` : ''}
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
            <h3>${escapeHtml(this.t('apiKeys'))} (${keys.length})</h3>
            <div>
              ${keys.length > 0 ? `<button class="btn btn-secondary btn-sm" onclick="app.openKeyTester('${safeId}')">${escapeHtml(this.t('testAllKeys'))}</button>` : ''}
              <button class="btn btn-primary btn-sm" onclick="app.addKeyToProvider('${safeId}')">
                ${escapeHtml(this.t('addKey'))}
              </button>
              <button class="btn btn-secondary btn-sm" onclick="app.deleteProvider('${safeId}')">
                ${escapeHtml(this.t('deleteProvider'))}
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

  /** Reveal/hide the full key value for one row. */
  toggleKeyVisibility(id) {
    id = Number(id);
    if (this.visibleKeys.has(id)) {
      this.visibleKeys.delete(id);
    } else {
      this.visibleKeys.add(id);
    }
    // Re-render just the detail modal if open
    if (this.activeProvider && document.getElementById('modalProviderDetail')?.classList.contains('open')) {
      this.viewProvider(this.activeProvider.id);
    }
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
      this.showToast(this.t('toastFillRequired'), 'error');
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
      this.showToast(this.t('toastProviderUpdated'));
    } catch (err) {
      console.error('Error updating provider:', err);
      this.showToast(this.t('toastProviderUpdated'), 'error');
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
      this.showToast(this.t('toastEnterKey'), 'error');
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
      this.showToast(this.t('toastKeyAdded'));
    } catch (err) {
      console.error('Error saving key:', err);
      this.showToast(err.message, 'error');
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
      this.showToast(this.t('toastCopied'));
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
        this.showToast(this.t('toastCopied'));
      } catch (err) {
        this.showToast(this.t('toastCopyFailed'), 'error');
      }
      ta.remove();
    }
  }

  openWebsite(url) {
    window.open(url, '_blank', 'noopener');
  }

  async deleteKey(id) {
    if (!confirm(this.t('confirmDeleteKey'))) return;
    await this.providerManager.softDeleteAPIKey(id);
    this.visibleKeys.delete(Number(id));
    this.showToast(this.t('toastTrashed'));
    if (this.activeProvider) {
      this.viewProvider(this.activeProvider.id);
    }
    this.loadProviders();
  }

  async deleteProvider(id) {
    const provider = await this.providerManager.getProvider(id);
    if (!confirm(this.t('confirmDeleteProvider', { name: provider?.name || '' }))) return;

    await this.providerManager.softDeleteProvider(id);
    this.closeModal('modalProviderDetail');
    this.loadProviders();
    this.showToast(this.t('toastTrashed'));
  }

  // ---------- Pin ----------

  async togglePin(id) {
    const pinned = await this.providerManager.togglePin(id);
    this.showToast(pinned ? this.t('pinned') : this.t('unpin'));
    this.loadProviders();
  }

  // ---------- Recycle bin ----------

  async openTrash() {
    this.openModal('modalTrash');
    await this.renderTrash();
  }

  async renderTrash() {
    const list = document.getElementById('trashList');
    if (!list) return;

    const { providers, keys } = await this.providerManager.getTrash();
    if (!providers.length && !keys.length) {
      list.innerHTML = `<div class="empty-state">${escapeHtml(this.t('trashEmpty'))}</div>`;
      return;
    }

    const providerSection = providers.length ? `
      <h4 class="trash-section-title">${escapeHtml(this.t('deletedProviders'))} (${providers.length})</h4>
      ${providers.map(p => `
        <div class="trash-item">
          ${getProviderIcon(p)}
          <div class="trash-info">
            <div class="trash-name">${escapeHtml(p.name || p.id)}</div>
            <div class="trash-date">${p.deleted_at ? new Date(p.deleted_at).toLocaleString() : ''}</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="app.restoreProvider('${escapeHtml(p.id)}')">♻️ ${escapeHtml(this.t('restore'))}</button>
          <button class="btn btn-danger btn-sm" onclick="app.purgeProvider('${escapeHtml(p.id)}')">${escapeHtml(this.t('deleteKey'))}</button>
        </div>
      `).join('')}` : '';

    const keysSection = keys.length ? `
      <h4 class="trash-section-title">${escapeHtml(this.t('deletedKeys'))} (${keys.length})</h4>
      ${keys.map(k => `
        <div class="trash-item">
          <div class="provider-icon-placeholder">🔑</div>
          <div class="trash-info">
            <div class="trash-name">${escapeHtml(k.name || this.t('unnamedKey'))}</div>
            <div class="trash-date">${k.deleted_at ? new Date(k.deleted_at).toLocaleString() : ''}</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="app.restoreKey(${Number(k.id)})">♻️ ${escapeHtml(this.t('restore'))}</button>
          <button class="btn btn-danger btn-sm" onclick="app.purgeKey(${Number(k.id)})">${escapeHtml(this.t('deleteKey'))}</button>
        </div>
      `).join('')}` : '';

    list.innerHTML = providerSection + keysSection;
  }

  async restoreProvider(id) {
    await this.providerManager.restoreProvider(id);
    this.showToast(this.t('toastRestored'));
    this.loadProviders();
    this.renderTrash();
  }

  async restoreKey(id) {
    await this.providerManager.restoreAPIKey(id);
    this.showToast(this.t('toastRestored'));
    this.loadProviders();
    this.renderTrash();
  }

  async purgeProvider(id) {
    const provider = await this.providerManager.getProvider(id);
    if (!confirm(this.t('confirmPurge', { name: provider?.name || id }))) return;
    await this.providerManager.purgeProvider(id);
    this.renderTrash();
    this.loadProviders();
  }

  async purgeKey(id) {
    await this.providerManager.purgeAPIKey(id);
    this.renderTrash();
    this.loadProviders();
  }

  async emptyTrash() {
    if (!confirm(this.t('confirmEmptyTrash'))) return;
    await this.providerManager.emptyTrash();
    this.showToast(this.t('toastEmptied'));
    this.renderTrash();
    this.loadProviders();
  }

  // ---------- Key tester ----------

  async openKeyTester(providerId) {
    const provider = await this.providerManager.getProvider(providerId);
    if (!provider) return;
    const keys = await this.providerManager.getAPIKeys(providerId);
    if (!keys.length) return;

    const body = document.getElementById('keyTestBody');
    const modelOptions = (provider.models || []).map(m =>
      `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');

    body.innerHTML = `
      <div class="keytest-provider">${getProviderIcon(provider)} <strong>${escapeHtml(provider.name)}</strong></div>
      <div class="form-group keytest-controls">
        <label>${escapeHtml(this.t('testModel'))}</label>
        <select id="keyTestModel">
          <option value="">—</option>
          ${modelOptions}
        </select>
      </div>
      <div class="keytest-actions">
        <button class="btn btn-primary" onclick="app.runBulkKeyTest('${escapeHtml(providerId)}')">${escapeHtml(this.t('testAll'))} (${keys.length})</button>
      </div>
      <div id="keyTestResults" class="keytest-results">
        <p class="form-hint">${escapeHtml(this.t('corsHint'))}</p>
      </div>
    `;
    this.openModal('modalKeyTest');
  }

  async testSingleKey(keyId) {
    const key = await this.providerManager.getAPIKeyById(keyId);
    if (!key) return;
    const provider = await this.providerManager.getProvider(key.provider_id);
    if (!provider) return;

    // Ensure the test modal is visible with a spinner row for this key
    await this.openKeyTester(key.provider_id);
    const results = document.getElementById('keyTestResults');
    results.innerHTML = `
      <div class="keytest-row testing-row" id="singleTestRow">
        <span class="keytest-name">${escapeHtml(key.name || this.t('unnamedKey'))}</span>
        <span class="keytest-status pending">⏳ ${escapeHtml(this.t('testing'))}</span>
      </div>`;

    const result = await testKey(provider, key);
    const row = document.getElementById('singleTestRow');
    if (row) {
      row.className = `keytest-row ${result.ok ? 'pass' : 'fail'}`;
      row.innerHTML = `
        <span class="keytest-name">${escapeHtml(key.name || this.t('unnamedKey'))}</span>
        <span class="keytest-status ${result.ok ? 'pass' : 'fail'}">${result.ok ? '✅' : '❌'} ${escapeHtml(result.detail)} <small>${result.ms}ms</small></span>`;
    }
  }

  async runBulkKeyTest(providerId) {
    const provider = await this.providerManager.getProvider(providerId);
    if (!provider) return;
    const keys = await this.providerManager.getAPIKeys(providerId);
    if (!keys.length) return;

    const model = document.getElementById('keyTestModel')?.value || undefined;
    const results = document.getElementById('keyTestResults');

    results.innerHTML = keys.map(k => `
      <div class="keytest-row testing-row" id="test-row-${Number(k.id)}">
        <span class="keytest-name">${escapeHtml(k.name || this.t('unnamedKey'))}</span>
        <span class="keytest-status pending">⏳ ${escapeHtml(this.t('testing'))}</span>
      </div>`).join('');

    await testAllKeys(provider, keys, {
      model,
      onProgress: (done, total, r) => {
        const row = document.getElementById(`test-row-${Number(r.keyId)}`);
        if (!row) return;
        row.className = `keytest-row ${r.ok ? 'pass' : 'fail'}`;
        row.innerHTML = `
          <span class="keytest-name">${escapeHtml(r.keyName || this.t('unnamedKey'))}</span>
          <span class="keytest-status ${r.ok ? 'pass' : 'fail'}">${r.ok ? '✅' : '❌'} ${escapeHtml(r.detail)} <small>${r.ms}ms</small></span>`;
      }
    });
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
      this.showToast(this.t('toastFillRequired'), 'error');
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
    this.showToast(this.t('toastProviderAdded'));
  }

  async exportData() {
    const data = await this.storage.exportData();
    const modal = document.getElementById('modalExport');
    modal.querySelector('textarea').value = JSON.stringify(data, null, 2);
    this.openModal('modalExport');
  }

  // ---------- Backup (encrypted or plain) ----------

  /** 💾 button opens the encrypted-backup flow. */
  async downloadData() {
    const form = document.getElementById('formBackup');
    form.reset();
    // Pre-fill with master password if encryption is unlocked
    if (this.encryptEnabled && this.masterPassword) {
      form.querySelector('input[name="password"]').value = this.masterPassword;
    }
    document.getElementById('backupDecryptSection').hidden = true;
    form.hidden = false;
    this.openModal('modalBackup');
  }

  async downloadEncryptedBackup() {
    const form = document.getElementById('formBackup');
    const password = form.querySelector('input[name="password"]').value;

    if (password.length < 8) {
      this.showToast(this.t('toastPwShort'), 'error');
      return;
    }

    try {
      const data = await this.storage.exportData();
      const cipher = await encryptWithPassword(password, JSON.stringify(data));
      this.saveBackupFile(BACKUP_PREFIX + cipher, 'application/octet-stream', '.akmbak');
      this.showToast(this.t('toastEncryptedBackup'));
      this.closeModal('modalBackup');
    } catch (err) {
      console.error('Encrypted backup failed:', err);
      this.showToast(err.message, 'error');
    }
  }

  async downloadPlainBackup() {
    const data = await this.storage.exportData();
    this.saveBackupFile(JSON.stringify(data, null, 2), 'application/json', '.json');
    this.showToast(this.t('toastBackupDownloaded'));
  }

  saveBackupFile(content, mime, ext) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-keys-backup-${new Date().toISOString().split('T')[0]}${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();

      // Encrypted backup?
      if (text.startsWith(BACKUP_PREFIX)) {
        this.pendingEncryptedImport = text.slice(BACKUP_PREFIX.length);
        const form = document.getElementById('formBackup');
        form.reset();
        form.hidden = true;
        document.getElementById('backupDecryptSection').hidden = false;
        this.openModal('modalBackup');
        document.getElementById('backupDecryptPassword')?.focus();
        return;
      }

      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.providers)) {
        throw new Error('Invalid file format');
      }

      await this.confirmAndImport(data);
    } catch (err) {
      this.showToast(this.t('toastInvalidFile') + ': ' + err.message, 'error');
    } finally {
      e.target.value = '';
    }
  }

  cancelEncryptedImport() {
    this.pendingEncryptedImport = null;
    this.closeModal('modalBackup');
  }

  async confirmEncryptedImport() {
    if (!this.pendingEncryptedImport) return;
    const password = document.getElementById('backupDecryptPassword').value;

    try {
      const json = await decryptWithPassword(password, this.pendingEncryptedImport);
      const data = JSON.parse(json);
      if (!data || !Array.isArray(data.providers)) {
        throw new Error('Invalid backup structure');
      }
      this.pendingEncryptedImport = null;
      await this.confirmAndImport(data);
      this.showToast(this.t('toastBackupDecrypted'));
    } catch (err) {
      this.showToast(this.t('toastWrongPw'), 'error');
    }
  }

  async confirmAndImport(data) {
    const count = data.providers.length;
    if (!confirm(this.t('confirmImport', { n: count }))) return;

    await this.storage.importData(data);
    this.showToast(this.t('toastImported'));
    this.loadProviders();
  }

  async openSettings() {
    const theme = await this.storage.getSetting('theme') || 'theme-dark';
    const autoSave = await this.storage.getSetting('autoSave');
    const modal = document.getElementById('modalSettings');
    modal.querySelector('#themeSelect').value = theme;
    modal.querySelector('#langSelectSettings').value = this.i18n.getLang();
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
      el.innerHTML = `<span class="status-off">${escapeHtml(this.t('encryptStatusOff'))}</span>`;
      return;
    }
    const unlocked = !!this.masterPassword;
    const { encrypted, total } = await this.providerManager.refreshEncryptionStats();
    const text = unlocked
      ? this.t('encryptStatusUnlocked', { n: encrypted, t: total })
      : this.t('encryptStatusLocked', { n: encrypted, t: total });
    const cls = unlocked ? 'status-on' : 'status-locked';
    el.innerHTML = `<span class="${cls}">${escapeHtml(text)}</span>`;
  }

  async setupEncryption() {
    const form = document.getElementById('formEncryptSetup');
    const password = form.querySelector('input[name="password"]').value;
    const confirm = form.querySelector('input[name="confirm"]').value;

    if (password.length < 8) {
      this.showToast(this.t('toastPwShort'), 'error');
      return;
    }
    if (password !== confirm) {
      this.showToast(this.t('toastPwMismatch'), 'error');
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
      this.showToast(this.t('toastEncEnabled', { n: count }));
    } catch (err) {
      console.error('Encryption setup failed:', err);
      this.showToast(this.t('toastEncFail') + ': ' + err.message, 'error');
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
      this.showToast(this.t('toastEncUnlocked'));
      this.updateEncryptStatus();
    } else {
      this.showToast(this.t('toastWrongPw'), 'error');
    }
  }

  async disableEncryption() {
    if (!confirm(this.t('confirmDisableEnc'))) return;

    const form = document.getElementById('formEncryptUnlock');
    let password = this.masterPassword;

    if (!password) {
      password = form.querySelector('input[name="password"]').value;
      const verifier = await this.storage.getSetting('masterVerifier');
      if (!(await verifyPassword(password, verifier))) {
        this.showToast(this.t('toastWrongPw'), 'error');
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
      this.showToast(this.t('toastEncDisabled', { n: count }));
    } catch (err) {
      console.error('Decryption failed:', err);
      this.showToast(this.t('toastDecryptFail') + ': ' + err.message, 'error');
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
      list.innerHTML = `<div class="empty-state">${escapeHtml(this.t('noMatch'))}</div>`;
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
            ? `<span class="directory-added">${escapeHtml(this.t('added'))}</span>`
            : `<button class="btn btn-primary btn-sm" onclick="app.addFromDirectory('${safeId}')">${escapeHtml(this.t('addAction'))}</button>`}
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
      this.showToast(this.t('toastAddedProvider', { name: entry.name }));
      this.loadProviders();
      this.renderDirectory(document.getElementById('directorySearch')?.value || '');
    } else {
      this.showToast(this.t('toastAlreadyExists'), 'error');
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
    this.applyLanguage();
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
    this.showToast(this.t('toastSettingsSaved'));
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
    app.showToast(app.t('toastLoaded'));
  }).catch(err => {
    console.error('Init error:', err);
    app.showToast('Failed to load', 'error');
  });
});
