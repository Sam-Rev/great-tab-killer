import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const allowlist = new URL('../../tools/release-files.txt', import.meta.url);

test('release tree ships no font files or font-face CSS', async () => {
  const files = (await readFile(allowlist, 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  assert.deepEqual(
    files.filter((file) => /\.(?:woff2?|ttf|otf)$/i.test(file)),
    [],
    'release allowlist contains a web-font file'
  );

  for (const file of files.filter((entry) => entry.endsWith('.css'))) {
    const css = await readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(css, /@font-face\b/i, `${file} declares a web font`);
  }
});
