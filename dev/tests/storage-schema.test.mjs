import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const storageSource = (await readFile(new URL('../../js/helpers/gsStorage.js', import.meta.url), 'utf8'))
  .replace(/^import .*;?\s*$/gm, '')
  .replace('export var gsStorage =', 'var gsStorage =') +
  '\nglobalThis.gsStorageForTest = gsStorage;';

function loadStorage(initial = {}, failGet = false) {
  const data = { ...initial };
  const syncStats = { gets: 0, sets: 0 };
  const chrome = {
    storage: {
      local: {
        get(key, callback) {
          if (failGet) throw new Error('storage unavailable');
          const keys = Array.isArray(key) ? key : [key];
          const result = Object.fromEntries(keys.filter((name) => name in data).map((name) => [name, data[name]]));
          if (callback) callback(result);
          return Promise.resolve(result);
        },
        async set(values) {
          Object.assign(data, values);
        },
        async remove(key) {
          for (const name of Array.isArray(key) ? key : [key]) delete data[name];
        },
      },
      sync: {
        get(keys, callback) {
          syncStats.gets++;
          callback({});
        },
        set() { syncStats.sets++; },
      },
      onChanged: { addListener() {} },
    },
    extension: { inIncognitoContext: false },
  };
  const messages = [];
  const logs = [];
  const context = vm.createContext({ chrome, gsUtils: { error(...args) { messages.push(['error', ...args]); }, warning(...args) { messages.push(['warning', ...args]); }, log(...args) { logs.push(args); }, errorIfInitialised() {} }, gsSession: { setSynchedSettingsOnInit() {} } });
  vm.runInContext(storageSource, context);
  return { storage: context.gsStorageForTest, data, syncStats, messages, logs };
}

function assertJsonEqual(actual, expected) {
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)));
}

test('fresh storage initializes the project schema at version 1', async () => {
  const { storage, data } = loadStorage();
  assert.equal(await storage.initSchemaVersion(), 1);
  assert.equal(data.schemaVersion, 1);
});

test('current schema version is accepted without rewriting it', async () => {
  const { storage, data } = loadStorage({ schemaVersion: 1 });
  assert.equal(await storage.initSchemaVersion(), 1);
  assert.equal(data.schemaVersion, 1);
});

test('unsupported future schema versions fail explicitly', async () => {
  const { storage } = loadStorage({ schemaVersion: 2 });
  await assert.rejects(storage.initSchemaVersion(), /Unsupported storage schema version: 2/);
});

test('fresh settings default sync off and backup remains disabled without an enable flag', () => {
  const { storage } = loadStorage();
  const defaults = storage.getSettingsDefaults();
  assert.equal(defaults[storage.SYNC_SETTINGS], false);
  assert.equal(defaults[storage.BACKUP_FREQUENCY], '10080');
});

test('settings sync storage is not read on fresh local defaults', async () => {
  const { storage, syncStats } = loadStorage();
  await storage.initSettingsAsPromised();
  assert.equal(syncStats.gets, 0);
  assert.equal(syncStats.sets, 0);
});

test('invalid or unreadable extension recovery state fails closed', async () => {
  const { storage, messages } = loadStorage({ gsExtensionRecovery: '{broken' });
  assert.equal(await storage.fetchLastExtensionRecoveryTimestamp(), undefined);
  assert.equal(messages.some(([level]) => level === 'error'), false);
  const unreadable = loadStorage({}, true);
  assert.equal(await unreadable.storage.fetchLastExtensionRecoveryTimestamp(), undefined);
});

test('missing extension recovery state is a normal empty state', async () => {
  const { storage, messages } = loadStorage();
  assert.equal(await storage.fetchLastExtensionRecoveryTimestamp(), undefined);
  assert.deepEqual(messages, []);
});

test('missing stored JSON keys return defaults without logging', async () => {
  const { storage, messages, data } = loadStorage();
  assertJsonEqual(await storage.getSettings(), storage.getSettingsDefaults());
  assert.equal(await storage.fetchLastVersion(), '0.0.0');
  assert.equal(await storage.fetchLastExtensionRecoveryTimestamp(), undefined);
  assertJsonEqual(await storage.fetchSessionMetrics(), {});
  assert.deepEqual(messages, []);
  assert.equal(JSON.parse(data.gsSettings).gsSyncSettings, false);
});

test('null stored JSON keys are also treated as not set', async () => {
  const { storage, messages } = loadStorage({
    gsSettings: null,
    gsVersion: null,
    gsExtensionRecovery: null,
    gsSessionMetrics: null,
  });
  assertJsonEqual(await storage.getSettings(), storage.getSettingsDefaults());
  assert.equal(await storage.fetchLastVersion(), '0.0.0');
  assert.equal(await storage.fetchLastExtensionRecoveryTimestamp(), undefined);
  assertJsonEqual(await storage.fetchSessionMetrics(), {});
  assert.deepEqual(messages, []);
});

test('corrupt settings warn with key only and heal to defaults', async () => {
  const secret = 'https://private.example/path';
  const { storage, data, messages } = loadStorage({ gsSettings: `{ "gsWhitelist":"${secret}"` });
  assertJsonEqual(await storage.getSettings(), storage.getSettingsDefaults());
  assert.deepEqual(messages.map(([level, ...args]) => [level, ...args]), [
    ['warning', 'gsStorage', 'Invalid stored JSON for gsSettings; resetting to default'],
  ]);
  assertJsonEqual(JSON.parse(data.gsSettings), storage.getSettingsDefaults());
  assert.equal(JSON.stringify(messages).includes(secret), false);
});

test('valid settings are returned without warning or rewrite', async () => {
  const settings = { gsWhitelist: 'private.example', gsSyncSettings: false };
  const encoded = JSON.stringify(settings);
  const { storage, data, messages } = loadStorage({ gsSettings: encoded });
  assertJsonEqual(await storage.getSettings(), settings);
  assert.equal(data.gsSettings, encoded);
  assert.deepEqual(messages, []);
});

test('version getter defaults, warns and repairs corrupted values, and accepts valid values', async () => {
  const missing = loadStorage();
  assert.equal(await missing.storage.fetchLastVersion(), '0.0.0');
  assert.deepEqual(missing.messages, []);

  const corrupt = loadStorage({ gsVersion: 'sensitive-invalid-version-value' });
  assert.equal(await corrupt.storage.fetchLastVersion(), '0.0.0');
  assert.equal(corrupt.data.gsVersion, JSON.stringify('0.0.0'));
  assert.deepEqual(corrupt.messages, [['warning', 'gsStorage', 'Invalid stored JSON for gsVersion; resetting to default']]);
  assert.equal(JSON.stringify(corrupt.messages).includes('sensitive-invalid-version-value'), false);

  const valid = loadStorage({ gsVersion: JSON.stringify('0.1.0') });
  assert.equal(await valid.storage.fetchLastVersion(), '0.1.0');
  assert.deepEqual(valid.messages, []);
});

test('recovery getter defaults, warns and removes corrupted values, and accepts valid values', async () => {
  const missing = loadStorage();
  assert.equal(await missing.storage.fetchLastExtensionRecoveryTimestamp(), undefined);
  assert.deepEqual(missing.messages, []);

  const corrupt = loadStorage({ gsExtensionRecovery: 'secret-invalid-recovery-value' });
  assert.equal(await corrupt.storage.fetchLastExtensionRecoveryTimestamp(), undefined);
  assert.equal('gsExtensionRecovery' in corrupt.data, false);
  assert.deepEqual(corrupt.messages, [['warning', 'gsStorage', 'Invalid stored JSON for gsExtensionRecovery; resetting to default']]);
  assert.equal(JSON.stringify(corrupt.messages).includes('secret-invalid-recovery-value'), false);

  const valid = loadStorage({ gsExtensionRecovery: JSON.stringify(123456) });
  assert.equal(await valid.storage.fetchLastExtensionRecoveryTimestamp(), 123456);
  assert.deepEqual(valid.messages, []);
});

test('session metrics getter defaults, warns and repairs corrupted values, and accepts valid values', async () => {
  const missing = loadStorage();
  assertJsonEqual(await missing.storage.fetchSessionMetrics(), {});
  assert.deepEqual(missing.messages, []);

  const corrupt = loadStorage({ gsSessionMetrics: 'secret-invalid-metrics-value' });
  assertJsonEqual(await corrupt.storage.fetchSessionMetrics(), {});
  assert.equal(corrupt.data.gsSessionMetrics, JSON.stringify({}));
  assert.deepEqual(corrupt.messages, [['warning', 'gsStorage', 'Invalid stored JSON for gsSessionMetrics; resetting to default']]);
  assert.equal(JSON.stringify(corrupt.messages).includes('secret-invalid-metrics-value'), false);

  const metrics = { suspendedTabCount: 3, totalTabCount: 10 };
  const valid = loadStorage({ gsSessionMetrics: JSON.stringify(metrics) });
  assertJsonEqual(await valid.storage.fetchSessionMetrics(), metrics);
  assert.deepEqual(valid.messages, []);
});

test('settings initialization never sends stored settings or whitelist data to error logging', async () => {
  const secret = 'owner-private.example';
  const invalid = loadStorage({ gsSettings: `{"gsWhitelist":"${secret}",}` });
  await invalid.storage.initSettingsAsPromised();
  assert.equal(invalid.messages.some(([level]) => level === 'error'), false);
  assert.equal(JSON.stringify(invalid.messages).includes(secret), false);
  assert.equal(JSON.stringify(invalid.logs).includes(secret), false);
  assert.equal(JSON.parse(invalid.data.gsSettings).gsWhitelist, '');

  const valid = loadStorage({ gsSettings: JSON.stringify({ gsWhitelist: secret, gsSyncSettings: false }) });
  await valid.storage.initSettingsAsPromised();
  assert.equal(JSON.stringify(valid.logs).includes(secret), false);

  const fresh = loadStorage();
  await fresh.storage.initSettingsAsPromised();
  assert.equal(fresh.messages.some(([level]) => level === 'error'), false);
});

