import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const M = 1048576;
const source = (await readFile(new URL('../js/monitor.js', import.meta.url), 'utf8'))
  .replace(/^import .*;$/gm, '')
  .replace(/\}\)\(\);\s*$/, 'globalThis.monitorTest = { measureAllTabs, renderTabStats, buildTabActions, buildStatusChip, performTabAction, runTabAction, rowAfterAction, refresh, actions: _tabActions, getRows: () => _rows, setRows: rows => { _rows = rows; } }; })();');
function setup(processes) {
  const cells = new Map();
  const tabs = [
    { id: 1, url: 'https://live.test', title: 'Live' },
    { id: 2, url: 'ext:suspended', discarded: false },
    { id: 3, url: 'ext:suspended-discarded', discarded: true },
    { id: 4, url: 'https://cached.test', discarded: true },
    { id: 5, url: 'https://unknown.test', discarded: true },
    { id: 6, url: 'https://frozen.test', frozen: true },
  ];
  let sampled;
  const calls = [];
  const element = () => ({
    children: [], dataset: {}, listeners: {},
    appendChild(child) { this.children.push(child); return child; },
    setAttribute(key, value) { this[key] = value; },
    addEventListener(key, handler) { this.listeners[key] = handler; },
    click() { return this.listeners.click?.({ stopPropagation() {} }); },
  });
  const context = vm.createContext({
    console, URL, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    localStorage: { setItem() {} },
    document: { querySelector: () => null, querySelectorAll: () => [], createElement: element, createElementNS: element, getElementById: id => { if (!cells.has(id)) cells.set(id, { classList: { add() {}, remove() {} }, style: {} }); return cells.get(id); } },
    gsUtils: {
      documentReadyAndLocalisedAsPromsied: () => ({ then() {} }),
      getMessage: key => key, warning() {}, error() {},
    },
    gsMemorySampler: {
      EST: { SUSPENDED_BYTES: 4 * M },
      isSuspendedTabUrl: url => url.startsWith('ext:'),
      isInjectableUrl: url => url.startsWith('https:'),
      isMeasurableTab: t => t.url.startsWith('https:') && !t.discarded && !t.frozen,
      measureTabs: async list => { sampled = list.map(t => t.id); return new Map([[1, { memBytes: 320 * M, cpuPct: 8 }]]); },
      updateMemCache: async () => ({ 'https://cached.test': { b: 480 * M }, 'https://frozen.test': { b: 210 * M } }),
    },
    chrome: {
      runtime: { sendMessage: (message, done) => {
        calls.push(message);
        const tab = tabs.find(t => t.id === message.tab.id);
        if (tab) {
          tab.url = message.function === 'suspendTab' ? 'ext:suspended' : 'https://restored.test';
          tab.discarded = false;
        }
        done();
      } },
      tabs: { query: async () => tabs.map(t => ({ ...t })),
        get: async id => { const t = tabs.find(t => t.id === id); if (!t) throw new Error('Tab closed'); return { ...t }; },
        update: async (id, changes) => { calls.push({ id, ...changes }); const t = tabs.find(t => t.id === id); if (t) Object.assign(t, changes, { discarded: false, frozen: false }); },
        discard: async id => { calls.push({ discard: id }); const t = tabs.find(t => t.id === id); t.discarded = true; return { ...t }; },
      },
      windows: { getAll: async () => [{ id: 1 }], update: () => {} },
      processes: processes ? { getProcessInfo: (ids, memory, cb) => cb(processes) } : undefined,
    },
  });
  vm.runInContext(source, context);
  return { ...context.monitorTest, cells, calls, chrome: context.chrome, sampler: context.gsMemorySampler, tabs, sampled: () => sampled };
}

test('placeholder remains 4 MB; discard retains history without reporting savings', async () => {
  const app = setup();
  const rows = await app.measureAllTabs();
  assert.deepEqual(Array.from(app.sampled()), [1]);
  assert.equal(rows[1].memBytes, 4 * M);
  assert.equal(rows[2].memBytes, 4 * M);
  assert.equal(rows[3].memBytes, 480 * M);
  assert.equal(rows[3].memMethod, 'historical');
  assert.equal(rows[4].memBytes, null);
  assert.equal(rows[5].memBytes, 210 * M);
  app.setRows(rows); app.renderTabStats();
  assert.equal(app.cells.get('statTabsMem').textContent, '~538 js_monitor_mb');
  assert.ok(app.cells.get('statTabsMemSub').textContent.includes('js_monitor_history_excluded: 1'));
});

test('Chrome comparison never overwrites main estimates, placeholder or history', async () => {
  const app = setup({
    a: { type: 'renderer', privateMemory: 200 * M, tasks: [{ tabId: 1 }, { tabId: 2 }, { tabId: 2 }] },
    b: { type: 'renderer', privateMemory: 50 * M, tasks: [{ tabId: 4 }] },
    c: { type: 'renderer', privateMemory: 0, tasks: [{ tabId: 5 }] },
  });
  const rows = await app.measureAllTabs();
  assert.equal(rows[0].memBytes, 320 * M);
  assert.equal(rows[0].chromeMemBytes, 100 * M);
  assert.equal(rows[1].memBytes, 4 * M);
  assert.equal(rows[1].chromeMemBytes, 100 * M);
  assert.equal(rows[3].memBytes, 480 * M);
  assert.equal(rows[3].chromeMemBytes, 50 * M);
  assert.equal(rows[4].chromeMemBytes, 0);
  assert.equal(rows[5].chromeMemBytes, null);
});


test('all tab states keep four action slots; unavailable discard is disabled', () => {
  const app = setup();
  for (const [status, flags, resume, disabled] of [
    ['normal', {}, false, false],
    ['active', { active: true }, false, true],
    ['suspended', {}, true, false],
    ['suspended', { discarded: true }, true, true],
    ['discarded', { discarded: true }, true, true],
    ['frozen', { frozen: true }, true, false],
  ]) {
    const actions = app.buildTabActions({ status, tab: { id: 10, url: 'https://test', ...flags } }).children;
    assert.deepEqual(Array.from(actions, b => b.dataset.action), ['goto', resume ? 'unsuspend' : 'suspend', 'discard', 'close']);
    assert.equal(actions[2].disabled, disabled);
    if (disabled) actions[2].click();
  }
  assert.equal(app.calls.length, 0, 'disabled discard must never invoke the API');
  const special = app.buildTabActions({ status: 'special', tab: { url: 'chrome://settings' } }).children;
  assert.equal(special[1].disabled, true);
});

test('resume routes placeholders through TGS and native sleeping tabs through activation', async () => {
  const app = setup();
  const initial = await app.measureAllTabs();
  app.setRows(initial);
  await app.buildTabActions(initial[1]).children[1].click();
  await app.buildTabActions(initial[3]).children[1].click();
  await app.buildTabActions(initial[5]).children[1].click();
  assert.equal(app.calls[0].function, 'unsuspendTab');
  assert.equal(app.calls[0].tab.id, 2);
  assert.equal(app.calls[1].id, 4);
  assert.equal(app.calls[1].active, true);
  assert.equal(app.calls[2].id, 6);
  assert.equal(app.calls[2].active, true);
});

test('normal status is labelled Running in English and Работает in Russian', async () => {
  for (const [lang, label] of [['en', 'Running'], ['ru', 'Работает']]) {
    const messages = JSON.parse(await readFile(new URL('../_locales/' + lang + '/messages.json', import.meta.url)));
    assert.equal(messages.js_monitor_status_normal.message, label);
  }
});


test('queued suspension stays pending after acknowledgement, then updates only its row', async () => {
  const app = setup();
  const rows = await app.measureAllTabs();
  app.setRows(rows);
  app.chrome.runtime.sendMessage = (message, done) => { app.calls.push(message); done(); };
  const work = app.runTabAction('suspend', rows[0].tab);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(app.actions.get(1).pending, true);
  assert.equal(app.getRows()[0].memBytes, 320 * M, 'acknowledgement alone must not claim 4 MB');
  await app.runTabAction('suspend', rows[0].tab);
  assert.equal(app.calls.length, 1, 'second click must not enqueue another action');
  app.tabs[0].url = 'ext:suspended';
  await work;
  assert.equal(app.getRows()[0].memBytes, 4 * M);
  assert.equal(app.getRows()[0].status, 'suspended');
  assert.equal(app.actions.get(1).done, true);
  assert.deepEqual(Array.from(app.getRows(), r => r.tab.id), [1, 2, 3, 4, 5, 6]);
  assert.equal(app.getRows()[1], rows[1], 'unaffected rows keep their identity');
  assert.equal(app.cells.get('refreshBtn').disabled, false);
});

test('discard preserves the pre-discard estimate and failure leaves the old value retryable', async () => {
  const app = setup();
  const rows = await app.measureAllTabs(); app.setRows(rows);
  await app.runTabAction('discard', rows[0].tab);
  assert.equal(app.getRows()[0].memBytes, 320 * M);
  assert.equal(app.getRows()[0].memMethod, 'historical');
  app.chrome.tabs.discard = async () => { throw new Error('Not allowed by Chrome'); };
  await app.runTabAction('discard', rows[1].tab);
  assert.equal(app.getRows()[1].memBytes, 4 * M);
  assert.equal(app.actions.get(2).error, 'Not allowed by Chrome');
  assert.equal(app.actions.get(2).pending, undefined);
  assert.equal(app.cells.get('refreshBtn').disabled, false);
});

test('a full refresh started before an action cannot overwrite the completed row', async () => {
  const app = setup();
  const rows = await app.measureAllTabs(); app.setRows(rows);
  let resolveSample;
  app.sampler.measureTabs = () => new Promise(resolve => { resolveSample = resolve; });
  const refresh = app.refresh();
  while (!resolveSample) await Promise.resolve();
  await app.runTabAction('suspend', rows[0].tab);
  resolveSample(new Map([[1, { memBytes: 900 * M }]]));
  await refresh;
  assert.equal(app.getRows()[0].memBytes, 4 * M);
  assert.equal(app.getRows()[0].status, 'suspended');
  assert.equal(app.cells.get('refreshBtn').disabled, false);
});
