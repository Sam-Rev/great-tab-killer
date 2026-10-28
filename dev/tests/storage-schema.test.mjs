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
  const context = vm.createContext({ chrome, gsUtils: { error() {}, log() {}, errorIfInitialised() {} }, gsSession: { setSynchedSettingsOnInit() {} } });
  vm.runInContext(storageSource, context);
  return { storage: context.gsStorageForTest, data, syncStats };
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
  const { storage } = loadStorage({ gsExtensionRecovery: '{broken' });
  assert.equal(await storage.fetchLastExtensionRecoveryTimestamp(), undefined);
  const unreadable = loadStorage({}, true);
  assert.equal(await unreadable.storage.fetchLastExtensionRecoveryTimestamp(), undefined);
});
