import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function loadWorkerGraph(file, seen = new Map()) {
  const absolutePath = path.resolve(file);
  if (seen.has(absolutePath)) return seen;
  const source = await readFile(absolutePath, 'utf8');
  seen.set(absolutePath, source);
  const specs = new Set();
  for (const match of source.matchAll(/^\s*import\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']/gm)) specs.add(match[1]);
  for (const match of source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) specs.add(match[1]);
  for (const specifier of specs) {
    if (!specifier.startsWith('.')) continue;
    const imported = fileURLToPath(new URL(specifier, pathToFileURL(absolutePath)));
    await loadWorkerGraph(imported, seen);
  }
  return seen;
}

function maskCommentsAndStrings(source) {
  const chars = [...source];
  let state = 'code';
  for (let i = 0; i < chars.length; i++) {
    const current = chars[i];
    const next = chars[i + 1];
    if (state === 'code' && current === '/' && next === '/') { state = 'line'; chars[i] = chars[i + 1] = ' '; i++; continue; }
    if (state === 'code' && current === '/' && next === '*') { state = 'block'; chars[i] = chars[i + 1] = ' '; i++; continue; }
    if (state === 'code' && ['"', "'", '`'].includes(current)) { state = current; chars[i] = ' '; continue; }
    if (state === 'line' && current === '\n') { state = 'code'; continue; }
    if (state === 'line') { if (current !== '\n') chars[i] = ' '; continue; }
    if (state === 'block' && current === '*' && next === '/') { chars[i] = chars[i + 1] = ' '; i++; state = 'code'; continue; }
    if (state !== 'code') {
      if (current === '\\') { chars[i] = ' '; if (i + 1 < chars.length) chars[++i] = chars[i] === '\n' ? '\n' : ' '; continue; }
      if (state === 'block') { if (current !== '\n') chars[i] = ' '; continue; }
      if (current === state) { chars[i] = ' '; state = 'code'; continue; }
      if (current !== '\n') chars[i] = ' ';
    }
  }
  return chars.join('');
}

test('worker-executed module graph avoids window and document globals', async () => {
  const graph = await loadWorkerGraph(path.join(projectRoot, 'js/serviceWorker.js'));
  const violations = [];
  for (const [file, source] of graph) {
    const code = maskCommentsAndStrings(source);
    // These are local browser-window data variables, extension-page helpers,
    // or functions serialized for execution in the tab's isolated world.
    const allowedPageFunctions = file.endsWith('gsTabSuspendManager.js')
      ? new Set(['runInjectedTabTask', 'generatePreviewImageCanvas'])
      : file.endsWith('gsMemorySampler.js') ? new Set(['collectFrameStats'])
      : file.endsWith('gsUtils.js') ? new Set(['htmlEncode', 'createWindowAndWaitForFinishLoading'])
      : file.endsWith('gsSession.js') ? new Set(['buildCurrentSession', 'matchCurrentWindowsWithLastSessionWindows'])
      : file.endsWith('tgs.js') ? new Set(['addChromeListeners']) : new Set();
    const matches = [...code.matchAll(/\b(?:window|document)\s*\.\s*[A-Za-z_$]/g)];
    for (const match of matches) {
      const prefix = code.slice(0, match.index);
      const declarations = [...prefix.matchAll(/(?:async\s+)?function\s+([\w$]+)\s*\(|([\w$]+)\s*:\s*(?:async\s*)?function\s*\(/g)];
      const containingFunction = declarations.at(-1)?.[1] || declarations.at(-1)?.[2];
      if (!allowedPageFunctions.has(containingFunction)) {
        violations.push(`${path.relative(projectRoot, file)}:${source.slice(0, match.index).split('\n').length}`);
      }
    }
  }
  assert.deepEqual(violations, [], `Unexpected worker globals: ${violations.join(', ')}`);
});
