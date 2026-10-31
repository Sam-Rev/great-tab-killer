#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function releaseNotesForTag(tag, manifest, changelog) {
  const version = manifest && manifest.version;
  if (typeof version !== 'string' || tag !== `v${version}`) {
    throw new Error(`tag must exactly match manifest version v${version || '<missing>'}`);
  }

  const header = new RegExp(
    `^## \\[${escapeRegExp(version)}\\] - (\\d{4}-\\d{2}-\\d{2})\\s*$`,
    'm',
  );
  const match = header.exec(changelog);
  if (!match) throw new Error(`CHANGELOG.md has no dated section for ${version}`);

  const date = match[1];
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new Error(`CHANGELOG.md has an invalid release date for ${version}`);
  }

  const bodyStart = match.index + match[0].length;
  const nextSection = /^##\s+/m.exec(changelog.slice(bodyStart));
  const bodyEnd = nextSection ? bodyStart + nextSection.index : changelog.length;
  const notes = changelog.slice(bodyStart, bodyEnd).trim();
  if (!notes) throw new Error(`CHANGELOG.md section for ${version} is empty`);
  return `${notes}\n`;
}

function main() {
  const tag = process.argv[2];
  if (!tag) throw new Error('usage: node tools/check-release-tag.mjs <tag>');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const changelog = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  process.stdout.write(releaseNotesForTag(tag, manifest, changelog));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
