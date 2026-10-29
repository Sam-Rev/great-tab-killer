import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';

test('extension and unpacked dev dashboard avoid dynamic HTML sinks', async () => {
  const paths = ['dev/scripts/memlab/dashboard.html', 'js/monitor.js'];
  for (const path of paths) {
    const source = await readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\.(?:innerHTML|outerHTML)\s*(?:\+?=)/, `${path} assigns HTML strings`);
    assert.doesNotMatch(source, /\.insertAdjacentHTML\s*\(/, `${path} inserts HTML strings`);
  }
  const dashboard = await readFile(new URL('../../dev/scripts/memlab/dashboard.html', import.meta.url), 'utf8');
  assert.match(dashboard, /node\.textContent\s*=/, 'dashboard should render dynamic values as text');
  assert.match(dashboard, /replaceChildren\(/, 'dashboard should build UI from DOM nodes');
});
