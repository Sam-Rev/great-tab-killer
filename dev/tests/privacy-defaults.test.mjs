import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import { excludeIncognitoTabs, isRegularTab } from '../../js/helpers/excludeIncognitoTabs.js';
import { isSafePageUrl } from '../../js/helpers/isSafePageUrl.js';

test('shared tab filter excludes incognito tabs', () => {
  assert.deepEqual(excludeIncognitoTabs([
    { id: 1, incognito: false },
    { id: 2, incognito: true },
    { id: 3 },
  ]).map((tab) => tab.id), [1, 3]);
  assert.equal(isRegularTab({ incognito: true }), false);
  assert.equal(isRegularTab({ incognito: false }), true);
});

test('incognito exclusions are wired to backup, sampler, preview, and session persistence', async () => {
  const read = (file) => readFile(new URL(file, import.meta.url), 'utf8');
  const [backup, sampler, suspend, session] = await Promise.all([
    read('../../js/helpers/gsBackup.js'),
    read('../../js/helpers/gsMemorySampler.js'),
    read('../../js/helpers/gsTabSuspendManager.js'),
    read('../../js/helpers/gsSession.js'),
  ]);
  assert.match(backup, /excludeIncognitoTabs\(tabs\)/);
  assert.match(sampler, /tabs = excludeIncognitoTabs\(tabs\)/);
  assert.match(suspend, /else if \(isRegularTab\(tab\)\)/);
  assert.match(suspend, /if \(!isRegularTab\(tab\)/);
  assert.match(session, /excludeIncognitoTabs\(window\.tabs\)/);
});

test('suspension source URLs allow only valid web and file pages', () => {
  assert.equal(isSafePageUrl('https://example.com/path'), true);
  assert.equal(isSafePageUrl('http://example.com'), true);
  assert.equal(isSafePageUrl('file:///tmp/page.html'), true);
  for (const url of ['', undefined, 'javascript:alert(1)', 'data:text/html,x', 'chrome-extension://other/html/suspended.html', 'not a URL']) {
    assert.equal(isSafePageUrl(url), false, String(url));
  }
});

test('backup startup is disabled until the local enable flag is true', async () => {
  let enabled = false;
  const localData = {};
  const cleared = [];
  const createdTabs = [];
  let queriedTabs = false;
  const chrome = {
    runtime: { getURL(path) { return `chrome-extension://test-id/${path}`; } },
    storage: { local: {
      async get(key) { return { [key]: localData[key] ?? (key === 'gsBackupEnabled' ? enabled : undefined) }; },
      async set(values) { Object.assign(localData, values); if ('gsBackupEnabled' in values) enabled = values.gsBackupEnabled; },
    } },
    alarms: { async clear(name) { cleared.push(name); }, async get() { return undefined; }, create() { throw new Error('unexpected alarm'); } },
    tabs: {
      query() { queriedTabs = true; },
      create(details, callback) { createdTabs.push(details); callback(); },
    },
  };
  let source = await readFile(new URL('../../js/helpers/gsBackup.js', import.meta.url), 'utf8');
  source = source.replace(/^import .*;?\s*$/gm, '').replace('export var gsBackup =', 'var gsBackup =') + '\nglobalThis.backupForTest = gsBackup;';
  const context = vm.createContext({ chrome, gsUtils: { log() {} }, gsStorage: { BACKUP_FREQUENCY: 'frequency', async getOption() { return '10080'; } }, console });
  vm.runInContext(source, context);
  await context.backupForTest.setupAlarm();
  await context.backupForTest.performBackup();
  await context.backupForTest.showFirstRunNotice();
  await context.backupForTest.showFirstRunNotice();
  assert.deepEqual(cleared, ['tgs-session-backup']);
  assert.equal(queriedTabs, false);
  assert.equal(createdTabs.length, 1);
  assert.match(createdTabs[0].url, /html\/backup-setup\.html$/);
});

test('favicon fetch rejection is delivered to its caller', async () => {
  let source = await readFile(new URL('../../js/helpers/gsFavicon.js', import.meta.url), 'utf8');
  source = source.replace(/^import .*;?\s*$/gm, '').replace('export var gsFavicon =', 'var gsFavicon =').replace('buildFaviconMetaFromChromeFaviconCache,', 'buildFaviconMetaData, buildFaviconMetaFromChromeFaviconCache,') + '\nglobalThis.faviconForTest = gsFavicon;';
  const context = vm.createContext({
    chrome: { runtime: { getURL: () => 'chrome-extension://test-id/' } },
    fetch: async () => { throw new TypeError('Failed to fetch'); },
    isExtensionOriginUrl: (url, root) => url.startsWith(root),
    URL, console,
  });
  vm.runInContext(source, context);
  await assert.rejects(
    context.faviconForTest.buildFaviconMetaData('chrome-extension://test-id/_favicon/?size=16'),
    /Failed to fetch/
  );
});
