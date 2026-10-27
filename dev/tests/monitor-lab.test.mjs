import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEstimate, summarizeProcesses, processTotal, median, MIB, formatBytes, collectPageSignals } from '../js/monitor-lab.js';

const frame = (frameId = 0, overrides = {}) => ({ frameId, result: {
  href: 'https://example.com/', origin: 'https://example.com', sampledAt: 1000,
  heapUsed: 100 * MIB, heapTotal: 140 * MIB, nodes: 1000, attributes: 500,
  visibleImageBytes: 0, otherImageBytes: 0, canvasPixelsBytes: 0,
  videos: [], audioPlaying: 0, iframeElements: 0, errors: [],
  ...overrides,
} });

test('missing main-frame heap is unknown, while a measured zero is valid', () => {
  assert.equal(buildEstimate([]), null);
  assert.equal(buildEstimate([frame(1)]), null);
  assert.equal(buildEstimate([frame(0, { heapUsed: null })]), null);
  assert.ok(buildEstimate([frame(0, { heapUsed: 0, heapTotal: 0 })]));
  assert.equal(formatBytes(null), '—');
  assert.notEqual(formatBytes(0), '—');
});

test('shared or separate child heaps are not blindly summed, regardless of origin', () => {
  const main = frame(0, { iframeElements: 1 });
  const sameHeap = buildEstimate([main, frame(1)]);
  const giantOtherHeap = buildEstimate([main, frame(1, { origin: 'https://other.com', heapUsed: 3e9, heapTotal: 4e9 })]);
  assert.equal(sameHeap.bytes, giantOtherHeap.bytes);
  assert.equal(giantOtherHeap.frames[1].result.heapUsed, 3e9);
  assert.equal(giantOtherHeap.parts[0].bytes, 100 * MIB);
});

test('downloaded bytes never become RAM and free heap is not counted twice', () => {
  const m = buildEstimate([frame(0, { resources: { script: { bytes: 1e12 }, cssFont: { bytes: 1e12 } } })]);
  assert.equal(m.parts.find((p) => p.name === 'Загруженные скрипты').bytes, 0);
  assert.equal(m.parts[1].bytes, 10 * MIB);
  assert.ok(m.bytes < 150 * MIB);
  const odd = buildEstimate([frame(0, { heapTotal: 20 * MIB })]);
  assert.equal(odd.parts[1].bytes, 0);
});

test('video estimate responds to decoding state and actual dimensions, not element count', () => {
  const base = buildEstimate([frame()]).bytes;
  const unloaded = buildEstimate([frame(0, { videos: Array.from({ length: 20 }, () => ({ width: 1920, height: 1080, readyState: 0 })) })]);
  assert.equal(unloaded.bytes, base);
  const active = buildEstimate([frame(0, { videos: [{ width: 1920, height: 1080, readyState: 4, playing: true }] })]);
  const paused = buildEstimate([frame(0, { videos: [{ width: 1920, height: 1080, readyState: 4, playing: false }] })]);
  assert.equal(active.bytes - base, 4 * (paused.bytes - base));
  assert.ok(active.bytes - base < 25 * MIB);
});

test('partial measurements are flagged and coefficient bounds contain the estimate', () => {
  const m = buildEstimate([frame(0, { iframeElements: 3, truncated: true })]);
  assert.equal(m.partial, true);
  assert.equal(m.missingFrames, 3);
  assert.ok(m.low <= m.bytes && m.bytes <= m.high);
  assert.equal(m.bytes, m.parts.reduce((sum, p) => sum + p.bytes, 0));
});

test('process memory is deduplicated by process, not by task, and sharing is explicit', () => {
  const snapshot = {
    1: { privateMemory: 200 * MIB, tasks: [{ tabId: 5 }, { tabId: 5 }, { tabId: 6 }], osProcessId: 123 },
    2: { privateMemory: 50 * MIB, tasks: [{ tabId: 5 }] },
  };
  const data = summarizeProcesses(snapshot);
  assert.equal(data.get(5).bytes, 250 * MIB);
  assert.equal(data.get(6).bytes, 200 * MIB);
  assert.equal(data.get(5).processes.length, 2);
  assert.equal(data.get(5).shared, true);
  assert.equal(processTotal(snapshot), 250 * MIB);
});

test('missing process metrics stay unknown; zero and non-tab tasks are handled', () => {
  const data = summarizeProcesses({ a: { privateMemory: 0, tasks: [{ tabId: 1 }] }, b: { tasks: [{ tabId: 2 }, { title: 'worker' }] } });
  assert.equal(data.get(1).bytes, 0);
  assert.equal(data.get(2).bytes, null);
  assert.equal(data.get(2).shared, true);
  assert.equal(processTotal({ b: { tasks: [] } }), null);
  assert.equal(processTotal({}), null);
});

test('median resists a single noisy sample', () => {
  assert.equal(median([100, 9999, 102]), 102);
  assert.equal(median([100, 102]), 101);
  assert.equal(median([null, undefined, NaN]), null);
});

test('collector is self-contained for Chrome injection', () => {
  // Parsing outside its module catches accidental closure dependencies at
  // execution; use a minimal empty-document environment rather than a browser.
  const run = new Function('performance', 'location', 'document', 'NodeFilter', `return (${collectPageSignals.toString()})();`);
  const result = run({ now: () => 0, memory: { usedJSHeapSize: 0, totalJSHeapSize: 0 }, getEntriesByType: () => [] },
    { href: 'https://example.com', origin: 'https://example.com' }, { createTreeWalker: () => ({ nextNode: () => null }) }, { SHOW_ALL: -1 });
  assert.equal(result.nodes, 0);
  assert.equal(result.heapUsed, 0);
  assert.deepEqual(result.errors, []);
});
