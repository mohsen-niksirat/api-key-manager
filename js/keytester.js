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
    return { ok: true, status, detail: 'Provider server error — key likely valid' };
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
