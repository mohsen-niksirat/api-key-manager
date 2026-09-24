// tests/keytester.test.js - Key tester logic (no network calls)

import { authStyleFor, buildTestRequest, interpretResponse } from '../js/keytester.js';
import { assertEqual, assert, assertIncludes } from './helpers.js';

const openaiProvider = { id: 'openai', base_url: 'https://api.openai.com/v1' };
const anthropicProvider = { id: 'anthropic', base_url: 'https://api.anthropic.com' };
const googleProvider = { id: 'google', base_url: 'https://generativelanguage.googleapis.com/v1beta' };
const key = { id: 1, name: 'K', key: 'sk-test-abc123' };

export const tests = {
  'authStyleFor detects Anthropic'() {
    assertEqual(authStyleFor(anthropicProvider), 'anthropic');
  },

  'authStyleFor detects Google'() {
    assertEqual(authStyleFor(googleProvider), 'google');
  },

  'authStyleFor defaults to bearer (OpenAI-compatible)'() {
    assertEqual(authStyleFor(openaiProvider), 'bearer');
    assertEqual(authStyleFor({ id: 'x', base_url: 'https://api.groq.com/openai/v1' }), 'bearer');
  },

  'bearer request carries Authorization header'() {
    const { url, options } = buildTestRequest(openaiProvider, key);
    assertEqual(url, 'https://api.openai.com/v1/chat/completions');
    assertEqual(options.headers.Authorization, 'Bearer sk-test-abc123');
    const body = JSON.parse(options.body);
    assertEqual(body.messages[0].role, 'user');
  },

  'anthropic request uses x-api-key header and /v1/messages path'() {
    const { url, options } = buildTestRequest(anthropicProvider, key);
    assertEqual(url, 'https://api.anthropic.com/v1/messages');
    assertEqual(options.headers['x-api-key'], 'sk-test-abc123');
    assert(options.headers['anthropic-version'], 'version header present');
  },

  'google request puts key in query param'() {
    const { url } = buildTestRequest(googleProvider, key);
    assertIncludes(url, 'key=sk-test-abc123');
    assertIncludes(url, ':generateContent');
  },

  'model override is respected'() {
    const { url } = buildTestRequest(googleProvider, key, 'gemini-2-ultra');
    assertIncludes(url, 'models/gemini-2-ultra:generateContent');

    const bearer = buildTestRequest(openaiProvider, key, 'custom-model');
    assertIncludes(JSON.parse(bearer.options.body).model, 'custom-model');
  },

  async 'interpretResponse: 200 ok'() {
    const r = await interpretResponse({ ok: true, status: 200, text: async () => '{}' });
    assertEqual(r.ok, true);
  },

  async 'interpretResponse: 401 invalid'() {
    const r = await interpretResponse({ ok: false, status: 401, text: async () => '' });
    assertEqual(r.ok, false);
    assertIncludes(r.detail, 'Invalid');
  },

  async 'interpretResponse: 429 counts as valid but rate limited'() {
    const r = await interpretResponse({ ok: false, status: 429, text: async () => '' });
    assertEqual(r.ok, true, 'rate limit implies the key authenticated fine');
    assertIncludes(r.detail, 'rate');
  },

  async 'interpretResponse: 402 valid but no credit'() {
    const r = await interpretResponse({ ok: false, status: 402, text: async () => '' });
    assertEqual(r.ok, true);
  },

  async 'interpretResponse: 5xx treated as provider-side'() {
    const r = await interpretResponse({ ok: false, status: 503, text: async () => '' });
    assertEqual(r.ok, true, 'server errors are not key failures');
  },

  async 'interpretResponse: 404 endpoint issue'() {
    const r = await interpretResponse({ ok: false, status: 404, text: async () => '' });
    assertEqual(r.ok, false);
    assertIncludes(r.detail, 'not found');
  }
};
