import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  createSuspendedFragment,
  isAllowedNavigationUrl,
  parseImportedSessionText,
  parseSuspendedFragment,
  MAX_NAVIGATION_URL_LENGTH,
} from '../../js/helpers/safeNavigationUrl.js';

test('navigation URL policy permits HTTP, HTTPS and file only', () => {
  for (const url of ['http://example.test/a', 'https://example.test/', 'file:///tmp/a.html']) {
    assert.equal(isAllowedNavigationUrl(url), true, url);
  }
  for (const url of [
    'javascript:alert(1)', 'data:text/html,x', 'blob:https://example.test/id',
    'about:blank', 'chrome://settings', 'chrome-extension://abc/page',
    'ftp://example.test/file', 'not a URL', 'https://x.test/\nheader',
    `https://x.test/${'a'.repeat(MAX_NAVIGATION_URL_LENGTH)}`,
  ]) assert.equal(isAllowedNavigationUrl(url), false, url.slice(0, 60));
});

test('suspended fragment encodes each field and validates decoded original URLs', () => {
  const title = '<img src=x onerror=alert(1)>';
  const source = 'https://example.test/a?x=1&y=%2F#part';
  const fragment = createSuspendedFragment({title, scrollPos: '7&9', uri: source});
  assert.ok(fragment.includes(encodeURIComponent(title)));
  assert.deepEqual(parseSuspendedFragment(`chrome-extension://id/html/suspended.html${fragment}`), {
    ttl: title, pos: '7&9', uri: source,
  });
  assert.equal(createSuspendedFragment({uri: 'javascript:alert(1)'}), null);
  assert.equal(parseSuspendedFragment('#ttl=%3Cimg%3E&pos=0&uri=javascript%3Aalert(1)'), null);
  assert.equal(parseSuspendedFragment('#ttl=%ZZ&pos=0&uri=https%3A%2F%2Fx.test').ttl, '%ZZ');
  assert.equal(parseSuspendedFragment('#ttl=x&pos=0&uri=https%3A%2F%2Fx.test%ZZ'), null);
  assert.equal(parseSuspendedFragment(`#ttl=x&pos=0&uri=${encodeURIComponent(`https://x.test/${'a'.repeat(MAX_NAVIGATION_URL_LENGTH)}`)}`), null);
  assert.equal(parseSuspendedFragment('#ttl=%3Cimg%3E&pos=0&uri=https://x.test/%ZZ').uri, 'https://x.test/%ZZ');
  assert.equal(parseSuspendedFragment('#ttl=x\u0001&pos=0&uri=https%3A%2F%2Fx.test'), null);
});

test('legacy raw suspended fragments remain readable', () => {
  assert.deepEqual(parseSuspendedFragment('chrome-extension://id/suspended.html#ttl=Old%20title&pos=12&uri=https://example.test/a?x=1&y=2'), {
    ttl: 'Old title', pos: '12', uri: 'https://example.test/a?x=1&y=2',
  });
  assert.equal(parseSuspendedFragment('chrome-extension://id/suspended.html#ttl=t&pos=0&uri=https://x.test/?q=one%26two').uri, 'https://x.test/?q=one%26two');
});

test('import parser keeps allowed lines and counts rejected URL lines', () => {
  const result = parseImportedSessionText([
    'https://good.test/one', 'javascript:alert(1)', 'data:text/html,x', '',
    'file:///tmp/two', 'chrome://settings', 'https://good.test/three',
  ].join('\n'));
  assert.deepEqual(result.entries, [
    {url: 'https://good.test/one', windowIndex: 0},
    {url: 'file:///tmp/two', windowIndex: 1},
    {url: 'https://good.test/three', windowIndex: 1},
  ]);
  assert.equal(result.skipped, 3);
});
