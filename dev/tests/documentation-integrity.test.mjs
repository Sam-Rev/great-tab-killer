import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

function tableColumns(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).length;
}

test('all Markdown tables in privacy and security docs have consistent column counts', async () => {
  for (const relative of ['PRIVACY.md', 'SECURITY.md']) {
    const contents = await readFile(new URL(`../../${relative}`, import.meta.url), 'utf8');
    const lines = contents.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      if (!/^\s*\|.*\|\s*$/.test(lines[index])) continue;
      const block = [];
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
        block.push({ line: index + 1, text: lines[index] });
        index++;
      }
      index--;
      const expected = tableColumns(block[0].text);
      for (const row of block) {
        assert.equal(tableColumns(row.text), expected, `${relative}:${row.line} has a different column count`);
      }
    }
  }
});

test('release placeholder checker passes when checked files have no owner placeholders', async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import('node:fs/promises');
  const { spawnSync } = await import('node:child_process');
  const os = await import('node:os');
  const root = await mkdtemp(path.join(os.tmpdir(), 'tgs-release-ready-'));
  try {
    await mkdir(path.join(root, 'docs'));
    for (const file of ['PRIVACY.md', 'SECURITY.md', 'README.md', 'docs/INSTALL.md']) {
      await writeFile(path.join(root, file), 'No unresolved placeholders.\n');
    }
    const script = fileURLToPath(new URL('../../tools/check-release-ready.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /check passed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('release placeholder checker reports every matching location and fails', async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import('node:fs/promises');
  const { spawnSync } = await import('node:child_process');
  const os = await import('node:os');
  const root = await mkdtemp(path.join(os.tmpdir(), 'tgs-release-ready-'));
  try {
    await mkdir(path.join(root, 'docs'));
    await writeFile(path.join(root, 'PRIVACY.md'), 'clean\n');
    await writeFile(path.join(root, 'SECURITY.md'), 'contact <OWNER: repository URL>\n');
    await writeFile(path.join(root, 'README.md'), 'Owner: <OWNER: handle>\nsecond <OWNER: email>\n');
    await writeFile(path.join(root, 'docs/INSTALL.md'), 'clean\n');
    const script = fileURLToPath(new URL('../../tools/check-release-ready.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /SECURITY\.md:1/);
    assert.match(result.stderr, /README\.md:1/);
    assert.match(result.stderr, /README\.md:2/);
    assert.match(result.stderr, /3 unresolved owner placeholder/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
