#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// Exclusions from shipped-source scanning:
// - dev/, docs/, tools/, assets/, vendor/, security/: development, documentation,
//   source assets, or policy inputs rather than executable extension files.
// - html2canvas.min.js and dom-to-image.js: vendored screenshot libraries;
//   known third-party XMLHttpRequest behavior is needed for image capture.
// - db.js: vendored IndexedDB shim; vendor provenance/checksum work is task 3.6.
const EXCLUDED_DIRS = new Set(['dev', 'docs', 'tools', 'assets', 'vendor', 'security', '.git']);
const EXCLUDED_FILES = new Set([
  'js/helpers/html2canvas.min.js',
  'js/helpers/dom-to-image.js',
  'js/helpers/db.js',
]);
const FORBIDDEN = [
  ['eval(', /\beval\s*\(/i],
  ['new Function', /\bnew\s+Function\b/i],
  ['importScripts', /\bimportScripts\s*\(/i],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['sendBeacon', /\bsendBeacon\s*\(/i],
  ['document.write', /\bdocument\s*\.\s*write\s*\(/i],
  ['onMessageExternal', /\bonMessageExternal\b/],
  ['onConnectExternal', /\bonConnectExternal\b/],
  ['externally_connectable', /\bexternally_connectable\b/],
  ['setUninstallURL', /\bsetUninstallURL\s*\(/i],
];

export function projectManifest(manifest) {
  return {
    permissions: manifest.permissions,
    optional_permissions: manifest.optional_permissions,
    host_permissions: manifest.host_permissions,
    content_scripts_matches: (manifest.content_scripts || []).map((entry) => entry.matches),
    web_accessible_resources: manifest.web_accessible_resources,
    content_security_policy: manifest.content_security_policy,
    incognito: manifest.incognito,
    absent_fields: ['update_url', 'externally_connectable'],
  };
}

async function walk(root, directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    const relative = path.relative(root, full).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) files.push(...await walk(root, full));
    } else if (/\.(?:js|html)$/.test(entry.name) && !EXCLUDED_FILES.has(relative)) {
      files.push(full);
    }
  }
  return files;
}

function extractFetchExpressions(source) {
  const expressions = [];
  const matcher = /\bfetch\s*\(/g;
  let match;
  while ((match = matcher.exec(source))) {
    let start = matcher.lastIndex;
    let depth = 1;
    let quote = null;
    let escaped = false;
    for (let i = start; i < source.length; i++) {
      const char = source[i];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
      if (char === '(') depth++;
      else if (char === ')' && --depth === 0) {
        expressions.push({ expression: source.slice(start, i).trim(), index: match.index });
        matcher.lastIndex = i + 1;
        break;
      }
    }
  }
  return expressions;
}

function isSafeFetch(expression, source, index) {
  if (/^chrome\.runtime\.getURL\s*\(/.test(expression)) return true;
  if (/^(?:"|')\.{0,2}\//.test(expression) || /^`\.{0,2}\//.test(expression)) return true;
  if (/^(?:"|')\//.test(expression) || /^`\//.test(expression)) return true;
  const match = /^([A-Za-z_$][\w$]*)\.href$/.exec(expression);
  if (!match) return false;
  const local = source.slice(Math.max(0, index - 900), index);
  const name = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const constructed = new RegExp(`const\\s+${name}\\s*=\\s*new\\s+URL\\s*\\(`).test(local);
  const trustedOrigin = /const\s+[A-Za-z_$][\w$]*\s*=\s*new\s+URL\s*\(\s*chrome\.runtime\.getURL\s*\(/.test(local);
  const originCheck = new RegExp(`if\\s*\\(\\s*${name}\\.origin\\s*!==\\s*[A-Za-z_$][\\w$]*\\s*\\)`).test(local);
  return constructed && trustedOrigin && originCheck;
}

function parseUrlAllowlist(content) {
  const entries = new Map();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const split = line.indexOf('\t');
    if (split < 0 || !line.slice(split + 1).trim()) continue;
    entries.set(line.slice(0, split).trim(), line.slice(split + 1).trim());
  }
  return entries;
}

function httpUrls(source) {
  return [...source.matchAll(/https?:\/\/[^\s"'`<>\\)]+/g)]
    .map((match) => match[0].replace(/[.,;:!?]+$/, ''));
}

function htmlRemoteSourceErrors(source, relative) {
  const errors = [];
  for (const tag of source.matchAll(/<(script|link|img)\b[^>]*>/gi)) {
    const name = tag[1].toLowerCase();
    const attribute = name === 'link' ? 'href' : 'src';
    const attr = new RegExp(`\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(tag[0]);
    if (!attr) continue;
    const value = attr[2].trim();
    if (/^(?:https?:)?\/\//i.test(value)) {
      errors.push(`${relative}: remote ${name} ${attribute} source: ${value}`);
    }
  }
  return errors;
}

export async function checkRoot(root) {
  const errors = [];
  let manifest;
  let lock;
  try {
    manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
    lock = JSON.parse(await readFile(path.join(root, 'security/permissions.lock.json'), 'utf8'));
  } catch (error) {
    return [`manifest/permissions lock could not be read: ${error.message}`];
  }
  for (const field of ['update_url', 'externally_connectable']) {
    if (Object.hasOwn(manifest, field)) errors.push(`manifest.json: ${field} must remain absent`);
  }
  if (!isDeepStrictEqual(projectManifest(manifest), lock)) {
    errors.push('manifest.json: protected permission/host/CSP/WAR fields differ from security/permissions.lock.json');
  }
  if (!Array.isArray(lock.absent_fields) ||
      !isDeepStrictEqual([...lock.absent_fields].sort(), ['externally_connectable', 'update_url'])) {
    errors.push('security/permissions.lock.json: absent_fields must list update_url and externally_connectable');
  }
  const csp = manifest.content_security_policy?.extension_pages || '';
  const connect = csp.split(';').map((part) => part.trim()).filter((part) => part.startsWith('connect-src '));
  if (connect.length !== 1 || connect[0] !== "connect-src 'self' data:") {
    errors.push("manifest.json: connect-src must be exactly 'self' data:");
  }

  let allowlist = new Map();
  try { allowlist = parseUrlAllowlist(await readFile(path.join(root, 'security/url-allowlist.txt'), 'utf8')); }
  catch (error) { errors.push(`security/url-allowlist.txt could not be read: ${error.message}`); }

  for (const file of await walk(root)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    const source = await readFile(file, 'utf8');
    for (const [label, pattern] of FORBIDDEN) {
      if (pattern.test(source)) errors.push(`${relative}: forbidden pattern ${label}`);
    }
    if (relative.endsWith('.js')) {
      for (const { expression, index } of extractFetchExpressions(source)) {
        if (!isSafeFetch(expression, source, index)) {
          errors.push(`${relative}: fetch() must use chrome.runtime.getURL() or a local relative path (found ${expression})`);
        }
      }
      for (const url of httpUrls(source)) {
        if (!allowlist.has(url)) errors.push(`${relative}: external URL literal lacks a documented exception: ${url}`);
      }
    } else {
      errors.push(...htmlRemoteSourceErrors(source, relative));
    }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = await checkRoot(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
  if (errors.length) {
    process.stderr.write(`Guard checks failed (${errors.length}):\n${errors.map((error) => `- ${error}`).join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('Guard checks passed.\n');
  }
}
