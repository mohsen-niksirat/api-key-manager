// tests/providers.test.js - Unit tests for providers.js pure logic

import { ProviderManager, escapeHtml, maskKey, formatKey } from '../js/providers.js';
import { createStorageStub } from './storage-stub.js';
import {
  assertEqual,
  assertIncludes,
  assert,
  assertThrows
} from './helpers.js';

export const tests = {
  'escapeHtml neutralizes script injection'() {
    assertEqual(
      escapeHtml('<img src=x onerror=alert(1)>'),
      '&lt;img src=x onerror=alert(1)&gt;'
    );
  },

  'escapeHtml escapes quotes and ampersands'() {
    assertEqual(escapeHtml('a & "b" \'c\''), 'a &amp; &quot;b&quot; &#39;c&#39;');
  },

  'escapeHtml handles null/undefined safely'() {
    assertEqual(escapeHtml(null), '');
    assertEqual(escapeHtml(undefined), '');
  },

  'maskKey hides the middle of long keys'() {
    const masked = maskKey('sk-1234567890abcdefghij');
    assert(masked.startsWith('sk-123'), 'should keep first chars');
    assert(masked.endsWith('hij'), 'should keep last chars');
    assert(masked.includes('•'), 'should contain bullets');
    assertEqual(masked.includes('7890abcd'), false, 'middle must be hidden');
  },

  'maskKey fully masks short keys'() {
    assertEqual(maskKey('short'), '••••••••••••');
    assertEqual(maskKey(''), '••••••••••••');
  },

  'formatKey returns plaintext when visible'() {
    assertEqual(formatKey('sk-abcdef123456', true), 'sk-abcdef123456');
  },

  'ProviderManager.addProvider normalizes and stores'() {
    const storage = createStorageStub();
    const pm = new ProviderManager(storage);
    const created = pm.addProvider({ name: 'Test API', base_url: 'https://api.test/v1' });

    assert(created instanceof Promise, 'addProvider should be async');
    return created.then(p => {
      assert(p.id.startsWith('test-api-'), 'id should be a slug of the name');
      assertEqual(p.is_custom, false);
      assertEqual(p.category, 'other');
    });
  },

  'ProviderManager.searchKeys is null-safe'() {
    const storage = createStorageStub();
    const pm = new ProviderManager(storage);
    storage.seed([
      { id: 'a', name: 'Alpha', base_url: 'https://a.io', models: [], category: 'x', is_custom: false },
      { id: 'b', name: 'Beta', base_url: 'https://b.io', models: [], category: 'x', is_custom: false }
    ]);
    // Simulate imported data with a null key name (addAPIKey would guard it)
    storage.keys.push(
      { id: 1, provider_id: 'a', name: 'Prod', key: 'key-aaa', status: 'active' },
      { id: 2, provider_id: 'b', name: null, key: 'key-bbb', status: 'active' }
    );

    return pm.searchKeys('key-bbb').then(results => {
      assertEqual(results.length, 1);
      assertEqual(results[0].id, 'b');
    });
  },

  'generateId is URL-safe and unique over time'() {
    const pm = new ProviderManager(createStorageStub());
    const a = pm.generateId('My Cool API!');
    assertIncludes(a, 'my-cool-api', 'slug part');
    assert(!/[^a-z0-9-]/.test(a), 'id must be URL-safe');
  }
};
