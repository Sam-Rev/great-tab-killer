import assert from 'node:assert/strict';
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
  };
  await mkdir(path.join(root, 'security'));
  await mkdir(path.join(root, 'js'));
  await mkdir(path.join(root, 'html'));
  await writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest));
  await writeFile(path.join(root, 'security/permissions.lock.json'), JSON.stringify(projectManifest(manifest)));
  await writeFile(path.join(root, 'security/url-allowlist.txt'), '# empty\n');
  await writeFile(path.join(root, 'js/main.js'), source);
  await writeFile(path.join(root, 'html/page.html'), '<script src="../js/main.js"></script><img src="../icon.png">');
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
