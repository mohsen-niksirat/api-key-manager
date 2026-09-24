// tests/runner.js - Minimal zero-dependency test runner
// Usage: node tests/runner.js  (or: npm test)

import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testsDir = __dirname;

let passed = 0;
let failed = 0;
const failures = [];

function colorize(text, code) {
  return process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text;
}

async function runAll() {
  const files = readdirSync(testsDir)
    .filter(f => f.endsWith('.test.js'))
    .sort();

  if (files.length === 0) {
    console.log(colorize('No test files found in tests/', '33'));
    process.exit(1);
  }

  for (const file of files) {
    const url = pathToFileURL(join(testsDir, file)).href;
    const mod = await import(url);

    // Convention: default export = suite runner(name, fn)
    // or named `tests` object: keys = test names, values = async fns
    if (typeof mod.default === 'function') {
      await mod.default(async (name, fn) => {
        await runOne(file, name, fn);
      });
    } else if (mod.tests && typeof mod.tests === 'object') {
      for (const [name, fn] of Object.entries(mod.tests)) {
        await runOne(file, name, fn);
      }
    }
  }

  console.log('\n' + colorize('━'.repeat(50), '90'));
  console.log(
    colorize(`  ✔ ${passed} passed`, '32') + '  ' +
    (failed ? colorize(`✘ ${failed} failed`, '31') : colorize('0 failed', '32'))
  );

  if (failed > 0) {
    console.log('\n' + colorize('Failures:', '31'));
    for (const f of failures) {
      console.log(colorize(`  ✘ ${f.name}`, '31'));
      console.log('    ' + f.error.split('\n').join('\n    '));
    }
    process.exit(1);
  }
  process.exit(0);
}

async function runOne(file, name, fn) {
  const start = performance.now();
  try {
    await fn();
    passed++;
    const ms = (performance.now() - start).toFixed(1);
    console.log(colorize(`  ✔`, '32') + ` ${name} ${colorize(`(${ms}ms)`, '90')}`);
  } catch (err) {
    failed++;
    failures.push({ name: `${file} › ${name}`, error: err.message || String(err) });
    console.log(colorize(`  ✘`, '31') + ` ${name}`);
  }
}

runAll().catch(err => {
  console.error(colorize('Runner crashed:', '31'), err);
  process.exit(1);
});
