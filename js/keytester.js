// keytester.js - API key testing (single + bulk) with provider-aware auth

/**
 * Determine the auth style for a provider based on its base_url.
 */
export function authStyleFor(provider) {
  const url = (provider?.base_url || '').toLowerCase();
  if (url.includes('api.anthropic.com')) return 'anthropic';
  if (url.includes('generativelanguage.googleapis.com')) return 'google';
  return 'bearer'; // OpenAI-compatible default
}

/**
 * Build the test request for a provider/key pair.
 * Returns { url, options } — ready for fetch().
 */
export function buildTestRequest(provider, apiKey, model) {
  const style = authStyleFor(provider);
  const baseUrl = (provider.base_url || '').replace(/\/+$/, '');
  const key = apiKey.key;

  switch (style) {
    case 'anthropic': {
      const body = {
        model: model || 'claude-3-5-haiku-20241022',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }]
      };
      return {
        url: baseUrl + '/v1/messages',
        options: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(body)
        }
      };
    }
    case 'google': {
      const modelPath = model || 'gemini-1.5-flash';
      return {
        url: `${baseUrl}/models/${modelPath}:generateContent?key=${encodeURIComponent(key)}`,
        options: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'hi' }] }],
            generationConfig: { maxOutputTokens: 1 }
          })
        }
      };
    }
    default: {
      const body = {
        model: model || 'gpt-4o-mini',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }]
      };
      return {
        url: baseUrl + '/chat/completions',
        options: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + key
          },
          body: JSON.stringify(body)
        }
      };
    }
  }
}

/**
 * Interpret a fetch response into a normalized test result.
 */
export async function interpretResponse(response) {
  const status = response.status;
  let bodyText = '';
  try { bodyText = await response.text(); } catch { /* ignore */ }

  if (response.ok) {
    return { ok: true, status, detail: 'Key is valid' };
  }

  // 401/403 → invalid key; 429 → valid but rate-limited; 4xx with body → inspect
  if (status === 401 || status === 403) {
    return { ok: false, status, detail: 'Invalid or unauthorized key' };
  }
  if (status === 429) {
    return { ok: true, status, detail: 'Key valid (rate limited)' };
  }
  if (status === 404) {
    return { ok: false, status, detail: 'Endpoint or model not found (check base URL / model)' };
  }
  if (status === 402) {
    return { ok: true, status, detail: 'Key valid but out of quota/credit' };
  }
  if (status >= 500) {
    return { ok: true, status, detail: 'Provider server error: key likely valid' };
  }

  return { ok: false, status, detail: 'HTTP ' + status };
}

const DEFAULT_TIMEOUT = 15000;

function withTimeout(options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    options: { ...options, signal: controller.signal },
    cancel: () => clearTimeout(timer)
  };
}

/**
 * Test one key against its provider.
 */
export async function testKey(provider, apiKey, { model, timeoutMs = DEFAULT_TIMEOUT } = {}) {
  const { url, options } = buildTestRequest(provider, apiKey, model);
  const { options: opts, cancel } = withTimeout(options, timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(url, opts);
    const result = await interpretResponse(response);
    return { ...result, ms: Math.round(performance.now() - started) };
  } catch (err) {
    const aborted = err.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      detail: aborted ? 'Timeout' : 'Network/CORS error (provider may block browser calls)',
      ms: Math.round(performance.now() - started)
    };
  } finally {
    cancel();
  }
}

/**
 * Build a GET /models request for a provider base_url and optional API key.
 */
export function buildModelsRequest(baseUrl, apiKey = '') {
  const cleanBase = (baseUrl || '').replace(/\/+$/, '');
  const style = authStyleFor({ base_url: cleanBase });
  const key = (apiKey || '').trim();

  if (style === 'google') {
    const url = key
      ? `${cleanBase}/models?key=${encodeURIComponent(key)}`
      : `${cleanBase}/models`;
    return { url, options: { method: 'GET' } };
  }

  if (style === 'anthropic') {
    const headers = { 'anthropic-version': '2023-06-01' };
    if (key) headers['x-api-key'] = key;
    const url = cleanBase.endsWith('/v1') ? `${cleanBase}/models` : `${cleanBase}/v1/models`;
    return { url, options: { method: 'GET', headers } };
  }

  const headers = {};
  if (key) headers['Authorization'] = 'Bearer ' + key;
  return { url: `${cleanBase}/models`, options: { method: 'GET', headers } };
}

/**
 * Extract model IDs from OpenAI, Anthropic, Google, or generic JSON responses.
 */
export function parseModelsResponse(payload) {
  if (!payload) return [];
  const rawList = Array.isArray(payload)
    ? payload
    : (Array.isArray(payload.data)
      ? payload.data
      : (Array.isArray(payload.models) ? payload.models : []));

  const ids = rawList.map(item => {
    if (typeof item === 'string') return item.trim();
    if (item && typeof item === 'object') {
      const id = item.id || item.name || item.model || '';
      return String(id).replace(/^models\//, '').trim();
    }
    return '';
  }).filter(Boolean);

  return [...new Set(ids)];
}

/**
 * Fetch available models from a provider's /models endpoint.
 */
export async function fetchModels(baseUrl, apiKey = '', { timeoutMs = DEFAULT_TIMEOUT } = {}) {
  const { url, options } = buildModelsRequest(baseUrl, apiKey);
  const { options: opts, cancel } = withTimeout(options, timeoutMs);
  try {
    const response = await fetch(url, opts);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = await response.json();
    return parseModelsResponse(json);
  } finally {
    cancel();
  }
}

/**
 * Test all keys of a provider (or a supplied list) with limited concurrency.
 * onProgress(done, total, result) is called after each test.
 */
export async function testAllKeys(provider, apiKeys, { model, concurrency = 3, timeoutMs, onProgress } = {}) {
  const results = new Array(apiKeys.length);
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < apiKeys.length) {
      const i = next++;
      const result = await testKey(provider, apiKeys[i], { model, timeoutMs });
      results[i] = { keyId: apiKeys[i].id, keyName: apiKeys[i].name, ...result };
      done++;
      onProgress?.(done, apiKeys.length, results[i]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, apiKeys.length) }, worker);
  await Promise.all(workers);
  return results;
}
