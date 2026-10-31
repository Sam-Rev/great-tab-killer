import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../../js/serviceWorker.js', import.meta.url), 'utf8');
const decision = source.match(/function shouldSkipStartupChecks\([^}]+\}/)?.[0];
assert.ok(decision, 'service worker startup decision helper is missing');
const context = vm.createContext({});
vm.runInContext(`${decision}\nglobalThis.shouldSkipStartupChecks = shouldSkipStartupChecks;`, context);

test('startup skips only when session and persisted version markers both agree', () => {
  const shouldSkip = context.shouldSkipStartupChecks;
  assert.equal(shouldSkip('0.1.0', '0.1.0', '0.1.0'), true, 'matching markers skip duplicate checks');
  assert.equal(shouldSkip('0.1.0', '0.1.0', undefined), false, 'missing local version must run first-install checks');
  assert.equal(shouldSkip('0.1.0', null, undefined), false, 'both missing markers must run first-install checks');
});
