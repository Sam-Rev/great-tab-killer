#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const files = [
  'PRIVACY.md',
  'SECURITY.md',
  'README.md',
  'docs/INSTALL.md',
];
const root = process.cwd();
const matches = [];

for (const relative of files) {
  let contents;
  try {
    contents = await readFile(path.join(root, relative), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') continue;
    throw error;
  }
  contents.split(/\r?\n/).forEach((line, index) => {
    let offset = 0;
    while ((offset = line.indexOf('<OWNER:', offset)) !== -1) {
      matches.push(`${relative}:${index + 1}: ${line.trim()}`);
      offset += '<OWNER:'.length;
    }
  });
}

if (matches.length) {
  console.error(`Release readiness failed: ${matches.length} unresolved owner placeholder(s):`);
  for (const match of matches) console.error(match);
  process.exitCode = 1;
} else {
  console.log('Release placeholder check passed.');
}
