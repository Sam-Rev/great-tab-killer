import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dynamicPrefixes = [
  'js_monitor_action_pending_',
  'js_monitor_ext_status_',
  'js_monitor_impact_',
  'js_monitor_status_',
];

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (/\.(?:html|js)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

const sourceFiles = [
  ...(await walk(path.join(root, 'html'))),
  ...(await walk(path.join(root, 'js'))),
  path.join(root, 'manifest.json'),
];
const source = (await Promise.all(sourceFiles.map((file) => readFile(file, 'utf8')))).join('\n');
const localeRoot = path.join(root, '_locales');
const localeDirs = (await readdir(localeRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const localeKeys = new Set();
for (const locale of localeDirs) {
  const messages = JSON.parse(await readFile(path.join(localeRoot, locale, 'messages.json'), 'utf8'));
  for (const key of Object.keys(messages)) localeKeys.add(key);
}

// Substring matching intentionally errs on the side of keeping a key if it
// appears inside a longer source token. Dynamic key families are preserved
// explicitly because their full suffixes are determined at runtime.
const unused = [...localeKeys].filter((key) => {
  if (dynamicPrefixes.some((prefix) => key.startsWith(prefix))) return false;
  return !source.includes(key);
}).sort();

process.stdout.write(`${unused.length} candidate keys across ${localeDirs.length} locales\n`);
process.stdout.write(unused.join('\n') + '\n');
