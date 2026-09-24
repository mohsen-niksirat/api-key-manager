// tests/helpers.js - Assertion helpers (zero-dependency)

export function assert(condition, message = 'Assertion failed') {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertNotEqual(actual, unexpected, message) {
  if (actual === unexpected) {
    throw new Error(message || `Expected value to differ from ${JSON.stringify(unexpected)}`);
  }
}

export function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(message || `Expected ${b}, got ${a}`);
  }
}

export function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(message || `Expected "${String(haystack).slice(0, 100)}" to include "${needle}"`);
  }
}

export function assertThrows(fn, message) {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error(message || 'Expected function to throw');
}

export async function assertThrowsAsync(fn, message) {
  try {
    await fn();
  } catch (e) {
    return e;
  }
  throw new Error(message || 'Expected async function to throw');
}

export function createSuite(hook) {
  // Returns the `test` function used by test files: test('name', fn)
  return function test(name, fn) {
    return hook(name, fn);
  };
}
