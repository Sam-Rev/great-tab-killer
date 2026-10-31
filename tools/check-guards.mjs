#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';

// Exclude non-shipped/development paths and the exact hash-pinned vendor files below.
const EXCLUDED_DIRS = new Set(['dev', 'docs', 'tools', 'assets', 'vendor', 'security', '.git']);
const EXCLUDED_FILES = new Set([
  // Hash-pinned; html2canvas logs only its version and renderer geometry.
  'js/helpers/html2canvas.min.js',
  // Hash-pinned; dom-to-image logs a stylesheet href and CSS access exception on blocked cross-origin rules.
  'js/helpers/dom-to-image.js',
  // Hash-pinned db.js vendor source; no console output.
  'js/helpers/db.js',
]);
const PINNED_VENDOR_FILES = new Set(EXCLUDED_FILES);
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
  const projection = {
    permissions: manifest.permissions,
    optional_permissions: manifest.optional_permissions,
    host_permissions: manifest.host_permissions,
    content_scripts_matches: (manifest.content_scripts || []).map((entry) => entry.matches),
    content_security_policy: manifest.content_security_policy,
    incognito: manifest.incognito,
    minimum_chrome_version: manifest.minimum_chrome_version,
    absent_fields: ['update_url', 'externally_connectable'],
  };
  if (Object.hasOwn(manifest, 'web_accessible_resources')) {
    projection.web_accessible_resources = manifest.web_accessible_resources;
  }
  return projection;
}

function webAccessibleResourceErrors(entries) {
  if (entries === undefined) return [];
  if (!Array.isArray(entries)) return ['manifest.json: web_accessible_resources must be an array'];
  const errors = [];
  for (const [index, entry] of entries.entries()) {
    for (const match of entry.matches || []) {
      if (match === '<all_urls>' || /:\/\/\*\//.test(match) || /:\/\/\*\./.test(match)) {
        errors.push(`manifest.json: web_accessible_resources[${index}] has broad match ${match}`);
      }
    }
    if ((entry.extension_ids || []).includes('*')) {
      errors.push(`manifest.json: web_accessible_resources[${index}] has wildcard extension_ids`);
    }
    for (const resource of entry.resources || []) {
      if (resource.includes('*')) {
        errors.push(`manifest.json: web_accessible_resources[${index}] has wildcard resource ${resource}`);
      }
    }
  }
  return errors;
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

// The service worker must use only browser-worker-safe static module code.
function maskCommentsAndStrings(source) {
  const output = source.split('');
  const blank = (start, end) => {
    for (let index = start; index < end; index++) {
      if (source[index] !== '\n' && source[index] !== '\r') output[index] = ' ';
    }
  };
  for (let index = 0; index < source.length;) {
    if (source[index] === '/' && source[index + 1] === '/') {
      let end = index + 2;
      while (end < source.length && source[end] !== '\n') end++;
      blank(index, end);
      index = end;
      continue;
    }
    if (source[index] === '/' && source[index + 1] === '*') {
      const close = source.indexOf('*/', index + 2);
      const end = close < 0 ? source.length : close + 2;
      blank(index, end);
      index = end;
      continue;
    }
    if (source[index] === '"' || source[index] === "'" || source[index] === '`') {
      const quote = source[index];
      let end = index + 1;
      while (end < source.length) {
        if (source[end] === '\\') { end += 2; continue; }
        if (source[end++] === quote) break;
      }
      blank(index, Math.min(end, source.length));
      index = end;
      continue;
    }
    index++;
  }
  return output.join('');
}

function findNamedFunctionSpans(source, functionName) {
  const escapedName = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declaration = new RegExp(`\\b(?:async\\s+)?function\\s+${escapedName}\\s*\\(`, 'g');
  const spans = [];
  for (const match of source.matchAll(declaration)) {
    let index = match.index + match[0].length;
    let parenDepth = 1;
    while (index < source.length && parenDepth) {
      if (source[index] === '(') parenDepth++;
      else if (source[index] === ')') parenDepth--;
      index++;
    }
    while (/\s/.test(source[index] || '')) index++;
    if (source[index] !== '{') continue;
    const bodyStart = index;
    let braceDepth = 1;
    index++;
    while (index < source.length && braceDepth) {
      if (source[index] === '{') braceDepth++;
      else if (source[index] === '}') braceDepth--;
      index++;
    }
    spans.push({ declarationIndex: match.index + match[0].lastIndexOf(functionName), start: bodyStart, end: index });
  }
  return spans;
}

function isInjectionReference(source, index) {
  const prefix = source.slice(Math.max(0, index - 300), index);
  const scriptCalls = [...prefix.matchAll(/chrome\.scripting\s*\.\s*executeScript\s*\(/g)];
  const scriptCall = scriptCalls.at(-1);
  if (scriptCall) {
    const beforeReference = prefix.slice(scriptCall.index + scriptCall[0].length);
    if (!/[;)]/.test(beforeReference) && /\bfunc\s*:\s*$/.test(beforeReference)) return true;
  }
  const wrapperCall = 'gsMessages.executeCodeOnTab(';
  const functionCall = prefix.lastIndexOf(wrapperCall);
  if (functionCall >= 0) {
    const beforeReference = prefix.slice(functionCall + wrapperCall.length);
    if (!/[;)]/.test(beforeReference) && /^[^,]+,\s*$/.test(beforeReference)) return true;
  }
  return false;
}

async function serviceWorkerGraphErrors(root) {
  const errors = [];
  const visited = new Set();
  const modules = new Map();
  const forbidden = [
    ['dynamic import(', /\bimport\s*\(/],
    ['window.', /\bwindow\s*\./],
    ['document.', /\bdocument\s*\./],
    ['localStorage', /\blocalStorage\b/],
    ['sessionStorage', /\bsessionStorage\b/],
  ];
  const entry = path.resolve(root, 'js/serviceWorker.js');
  let exceptions;
  try { exceptions = JSON.parse(await readFile(path.join(root, 'security/service-worker-graph-allowlist.json'), 'utf8')); }
  catch (error) { exceptions = []; errors.push(`security/service-worker-graph-allowlist.json could not be read: ${error.message}`); }
  if (!Array.isArray(exceptions)) {
    errors.push('security/service-worker-graph-allowlist.json must contain an array');
    exceptions = [];
  }
  const exceptionKeys = new Set();
  for (const item of exceptions) {
    const expectedKeys = ['file', 'function', 'pattern', 'reason'];
    if (!item || typeof item !== 'object' || !isDeepStrictEqual(Object.keys(item).sort(), expectedKeys) ||
        typeof item.file !== 'string' || typeof item.function !== 'string' || typeof item.pattern !== 'string' || typeof item.reason !== 'string') {
      errors.push('security/service-worker-graph-allowlist.json: each entry must contain exactly file, function, pattern, and reason');
      continue;
    }
    if (!['window.', 'document.'].includes(item.pattern) || !item.reason.trim()) {
      errors.push(`security/service-worker-graph-allowlist.json: invalid pattern/reason for ${item.file}:${item.function}`);
      continue;
    }
    const key = `${item.file}\0${item.function}\0${item.pattern}`;
    if (exceptionKeys.has(key)) errors.push(`security/service-worker-graph-allowlist.json: duplicate entry ${item.file}:${item.function}:${item.pattern}`);
    exceptionKeys.add(key);
  }
  async function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    let source;
    try { source = await readFile(file, 'utf8'); }
    catch (error) { errors.push(`${path.relative(root, file)}: service-worker import could not be read: ${error.message}`); return; }
    const relative = path.relative(root, file).split(path.sep).join('/');
    const executableSource = maskCommentsAndStrings(source);
    modules.set(relative, { source, executableSource });
    for (const [label, pattern] of forbidden) {
      const matcher = new RegExp(pattern.source, `${pattern.flags}g`);
      for (const match of executableSource.matchAll(matcher)) {
        const enclosingFunction = exceptions.find((item) => item.file === relative && item.pattern === label &&
          findNamedFunctionSpans(executableSource, item.function).some((span) => match.index > span.start && match.index < span.end));
        if (!enclosingFunction) errors.push(`${relative}: service-worker graph contains ${label}`);
      }
    }
    const imports = /(?:^|[;\n])\s*(?:import\s+(?:[^'";]*?\s+from\s*)?|export\s+[^'";]*?\s+from\s*)['"]([^'"]+)['"]/gm;
    for (const match of source.matchAll(imports)) {
      if (!match[1].startsWith('.')) continue;
      const dependency = path.resolve(path.dirname(file), match[1]);
      if (!dependency.startsWith(`${path.resolve(root)}${path.sep}`)) {
        errors.push(`${relative}: service-worker static import escapes project root: ${match[1]}`);
      } else {
        await visit(dependency);
      }
    }
  }
  await visit(entry);
  for (const item of exceptions) {
    const module = modules.get(item.file);
    if (!module) { errors.push(`service-worker allowlist entry is outside the static module graph: ${item.file}:${item.function}`); continue; }
    const functions = findNamedFunctionSpans(module.executableSource, item.function);
    if (functions.length !== 1) {
      errors.push(`service-worker allowlist function must be defined exactly once: ${item.file}:${item.function}`);
      continue;
    }
    const functionSpan = functions[0];
    const pattern = item.pattern === 'window.' ? /\bwindow\s*\./ : /\bdocument\s*\./;
    if (!pattern.test(module.executableSource.slice(functionSpan.start, functionSpan.end))) {
      errors.push(`service-worker allowlist pattern not found in function: ${item.file}:${item.function}:${item.pattern}`);
    }
    const escapedFunctionName = item.function.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const [relative, graphModule] of modules) {
      const references = [...graphModule.executableSource.matchAll(new RegExp(`\\b${escapedFunctionName}\\b`, 'g'))];
      for (const reference of references) {
        if (relative === item.file && reference.index === functionSpan.declarationIndex) continue;
        if (!isInjectionReference(graphModule.executableSource, reference.index)) {
          errors.push(`allowlisted function has a non-injection reference: ${relative}:${item.function}`);
        }
      }
    }
  }
  return errors;
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
  const trustedOrigin = /const\s+[A-Za-z_$][\w$]*\s*=\s*(?:new\s+URL\s*\(\s*)?chrome\.runtime\.getURL\s*\(/.test(local);
  const directOriginCheck = new RegExp(`if\\s*\\(\\s*${name}\\.origin\\s*!==\\s*[A-Za-z_$][\\w$]*\\s*\\)`).test(local);
  const helperOriginCheck = new RegExp(`if\\s*\\(\\s*!\\s*isExtensionOriginUrl\\s*\\(\\s*${name}\\.href\\s*,\\s*[A-Za-z_$][\\w$]*\\s*\\)`).test(local);
  const originCheck = directOriginCheck || helperOriginCheck;
  return constructed && trustedOrigin && originCheck;
}

async function verifyVendorChecksums(root) {
  const errors = [];
  const checksumPath = path.join(root, 'vendor/CHECKSUMS.sha256');
  let checksumText;
  try { checksumText = await readFile(checksumPath, 'utf8'); }
  catch (error) { return [`vendor/CHECKSUMS.sha256 could not be read: ${error.message}`]; }

  const checksums = new Map();
  for (const [index, line] of checksumText.split(/\r?\n/).entries()) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = /^([a-f\d]{64})\s+(.+)$/.exec(line.trim());
    if (!match) {
      errors.push(`vendor/CHECKSUMS.sha256:${index + 1}: malformed checksum entry`);
      continue;
    }
    if (checksums.has(match[2])) errors.push(`vendor/CHECKSUMS.sha256: duplicate path ${match[2]}`);
    checksums.set(match[2], match[1]);
  }
  for (const relative of PINNED_VENDOR_FILES) {
    if (!checksums.has(relative)) errors.push(`vendor/CHECKSUMS.sha256: excluded vendor file is not pinned: ${relative}`);
  }
  for (const [relative, expectedHash] of checksums) {
    const file = path.resolve(root, relative);
    if (file === path.resolve(root) || !file.startsWith(`${path.resolve(root)}${path.sep}`)) {
      errors.push(`vendor/CHECKSUMS.sha256: path escapes project root: ${relative}`);
      continue;
    }
    let bytes;
    try { bytes = await readFile(file); }
    catch (error) {
      errors.push(`vendor checksum path missing: ${relative}`);
      continue;
    }
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    if (actualHash !== expectedHash) errors.push(`${relative}: SHA-256 differs from vendor/CHECKSUMS.sha256`);
  }
  for (const relative of await walkVendorDirectory(path.join(root, 'vendor'))) {
    if (!checksums.has(relative)) errors.push(`vendor directory contains an unpinned file: ${relative}`);
  }
  return errors;
}

async function walkVendorDirectory(directory, root = path.resolve(directory, '..')) {
  const files = [];
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch { return files; }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkVendorDirectory(full, root));
    else {
      const relative = path.relative(root, full).split(path.sep).join('/');
      if (!['vendor/README.md', 'vendor/CHECKSUMS.sha256'].includes(relative)) files.push(relative);
    }
  }
  return files;
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
  errors.push(...webAccessibleResourceErrors(manifest.web_accessible_resources));
  if (!Array.isArray(lock.absent_fields) ||
      !isDeepStrictEqual([...lock.absent_fields].sort(), ['externally_connectable', 'update_url'])) {
    errors.push('security/permissions.lock.json: absent_fields must list update_url and externally_connectable');
  }
  let privacyText;
  try { privacyText = await readFile(path.join(root, 'PRIVACY.md'), 'utf8'); }
  catch (error) { errors.push(`PRIVACY.md could not be read for permission documentation checks: ${error.message}`); }
  if (privacyText !== undefined) {
    for (const permission of [...(manifest.permissions || []), ...(manifest.optional_permissions || [])]) {
      if (!privacyText.includes(`\`${permission}\``)) {
        errors.push(`manifest.json: permission ${permission} is not mentioned in PRIVACY.md`);
      }
    }
  }
  errors.push(...await verifyVendorChecksums(root));
  errors.push(...await serviceWorkerGraphErrors(root));
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
      const uncommented = maskCommentsAndStrings(source);
      if (/\b(?:window\s*\.\s*)?console\s*\.\s*(?:log|debug|info)\s*\(/.test(uncommented)) {
        errors.push(`${relative}: raw console.log/debug/info is forbidden`);
      }
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
