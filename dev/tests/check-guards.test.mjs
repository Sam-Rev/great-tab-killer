import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkRoot, projectManifest } from '../../tools/check-guards.mjs';

async function fixture(source = 'const response = await fetch(chrome.runtime.getURL("data.json"));') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tgs-guards-'));
  const manifest = {
    permissions: ['tabs'],
    optional_permissions: [],
    host_permissions: [],
    content_scripts: [{ matches: [] }],
    web_accessible_resources: [],
    content_security_policy: { extension_pages: "script-src 'self'; connect-src 'self' data:" },
    incognito: 'split',
    minimum_chrome_version: '116',
  };
  await mkdir(path.join(root, 'security'));
  await mkdir(path.join(root, 'js'));
  await mkdir(path.join(root, 'js/helpers'), { recursive: true });
  await mkdir(path.join(root, 'html'));
  await mkdir(path.join(root, 'vendor'));
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest));
  await writeFile(path.join(root, 'security/permissions.lock.json'), JSON.stringify(projectManifest(manifest)));
  await writeFile(path.join(root, 'security/url-allowlist.txt'), '# empty\n');
  await writeFile(path.join(root, 'js/main.js'), source);
  await writeFile(path.join(root, 'html/page.html'), '<script src="../js/main.js"></script><img src="../icon.png">');
  const pinned = [
    'js/helpers/html2canvas.min.js',
    'js/helpers/dom-to-image.js',
    'js/helpers/db.js',
  ];
  const checksumLines = [];
  for (const relative of pinned) {
    const bytes = Buffer.from(`fixture:${relative}`);
    await writeFile(path.join(root, relative), bytes);
    checksumLines.push(`${createHash('sha256').update(bytes).digest('hex')}  ${relative}`);
  }
  await writeFile(path.join(root, 'vendor/CHECKSUMS.sha256'), `${checksumLines.join('\n')}\n`);
  return root;
}

test('guard accepts a matching manifest and local extension fetch', async () => {
  const root = await fixture();
  try { assert.deepEqual(await checkRoot(root), []); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test('guard rejects a permission change from the lock', async () => {
  const root = await fixture();
  try {
    const manifestPath = path.join(root, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.permissions.push('history');
    await writeFile(manifestPath, JSON.stringify(manifest));
    assert.match((await checkRoot(root)).join('\n'), /differ from security\/permissions\.lock/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('guard rejects minimum Chrome version drift from the lock', async () => {
  const root = await fixture();
  try {
    const manifestPath = path.join(root, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.minimum_chrome_version = '115';
    await writeFile(manifestPath, JSON.stringify(manifest));
    assert.match((await checkRoot(root)).join('\n'), /differ from security\/permissions\.lock/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('guard rejects forbidden code and remote fetches', async () => {
  const root = await fixture('eval("x"); fetch("https://example.com/data.json");');
  try {
    const errors = (await checkRoot(root)).join('\n');
    assert.match(errors, /forbidden pattern eval\(/);
    assert.match(errors, /fetch\(\) must use/);
    assert.match(errors, /external URL literal lacks/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('guard rejects remote HTML image and a weakened connect-src', async () => {
  const root = await fixture();
  try {
    await writeFile(path.join(root, 'html/page.html'), '<img src="https://example.com/a.png">');
    const manifestPath = path.join(root, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.content_security_policy.extension_pages = "script-src 'self'; connect-src https:";
    await writeFile(manifestPath, JSON.stringify(manifest));
    const errors = (await checkRoot(root)).join('\n');
    assert.match(errors, /remote img src/);
    assert.match(errors, /connect-src must be exactly/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('guard rejects a changed pinned vendor file', async () => {
  const root = await fixture();
  try {
    await writeFile(path.join(root, 'js/helpers/db.js'), 'modified');
    assert.match((await checkRoot(root)).join('\n'), /SHA-256 differs/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('guard rejects an unpinned file in the excluded vendor directory', async () => {
  const root = await fixture();
  try {
    await writeFile(path.join(root, 'vendor/new-library.js'), '/* not pinned */');
    assert.match((await checkRoot(root)).join('\n'), /vendor directory contains an unpinned file/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
