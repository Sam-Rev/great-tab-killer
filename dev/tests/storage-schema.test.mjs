import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const storageSource = (await readFile(new URL('../../js/helpers/gsStorage.js', import.meta.url), 'utf8'))
  .replace(/^import .*;?\s*$/gm, '')
  .replace('export var gsStorage =', 'var gsStorage =') +
  '\nglobalThis.gsStorageForTest = gsStorage;';

function loadStorage(initial = {}) {
  const data = { ...initial };
  const chrome = {
    storage: {
      local: {
        async get(key) {
          const keys = Array.isArray(key) ? key : [key];
          return Object.fromEntries(keys.filter((name) => name in data).map((name) => [name, data[name]]));
        },
        async set(values) {
          Object.assign(data, values);
        },
      },
    },
  };
  const context = vm.createContext({ chrome, gsUtils: {}, gsSession: {} });
  vm.runInContext(storageSource, context);
  return { storage: context.gsStorageForTest, data };
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
