// URL policy shared by the service worker and extension pages.
export const MAX_NAVIGATION_URL_LENGTH = 16384;

export function isAllowedNavigationUrl(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_NAVIGATION_URL_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'file:';
  } catch {
    return false;
  }
}

function decodePart(value) {
  try { return decodeURIComponent(value); }
  catch { return null; }
}

// New links encode each field separately. Legacy fragments stored uri raw,
// after ttl and pos; preserve that format while accepting current URLs.
export function parseSuspendedFragment(urlString) {
  if (typeof urlString !== 'string' || urlString.length > MAX_NAVIGATION_URL_LENGTH * 6 + 1024) return null;
  const hashIndex = urlString.indexOf('#');
  if (hashIndex < 0) return null;
  const fragment = urlString.slice(hashIndex + 1);
  const raw = {};
  const uriIndex = fragment.startsWith('uri=') ? 0 : fragment.indexOf('&uri=');
  let fields = fragment;
  if (uriIndex >= 0) {
    const valueStart = uriIndex + (fragment.startsWith('uri=') ? 4 : 5);
    raw.uri = fragment.slice(valueStart);
    fields = fragment.slice(0, uriIndex).replace(/[&]$/, '');
  }
  for (const pair of fields.split('&')) {
    if (!pair) continue;
    const split = pair.indexOf('=');
    if (split < 0) continue;
    raw[pair.slice(0, split)] = pair.slice(split + 1);
  }
  const decoded = {};
  for (const key of ['ttl', 'pos', 'uri', 'url']) {
    if (raw[key] === undefined) continue;
    const legacyRawUri = key === 'uri' && /^(?:https?:\/\/|file:)/i.test(raw[key]);
    decoded[key] = legacyRawUri ? raw[key] : decodePart(raw[key]);
    // Legacy URI values were concatenated raw. A literal percent sign may
    // therefore not form a valid escape sequence; retain it only if the
    // complete raw value already validates as an allowed navigation URL.
    if (decoded[key] === null) {
      if (key === 'uri' && isAllowedNavigationUrl(raw[key])) decoded[key] = raw[key];
      else if (key === 'ttl' || key === 'pos') decoded[key] = raw[key];
      else return null;
    }
    if (/[\u0000-\u001f\u007f]/.test(decoded[key])) return null;
  }
  // A legacy raw uri may contain separators; only treat it as complete when
  // it is a valid allowed URL. Encoded current-build values decode normally.
  if (decoded.uri && !isAllowedNavigationUrl(decoded.uri)) return null;
  if (!decoded.uri && decoded.url && !isAllowedNavigationUrl(decoded.url)) return null;
  return decoded;
}

export function createSuspendedFragment({ title = '', scrollPos = '0', uri }) {
  if (!isAllowedNavigationUrl(uri)) return null;
  const safeTitle = String(title).slice(0, MAX_NAVIGATION_URL_LENGTH).replace(/([\uD800-\uDBFF])(?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD');
  const safeUri = new URL(uri).href;
  return `#ttl=${encodeURIComponent(safeTitle)}&pos=${encodeURIComponent(String(scrollPos))}&uri=${encodeURIComponent(safeUri)}`;
}

export function parseImportedSessionText(text) {
  const entries = [];
  let skipped = 0;
  let windowIndex = 0;
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line) {
      if (entries.length && entries[entries.length - 1].windowIndex === windowIndex) windowIndex++;
      continue;
    }
    if (!isAllowedNavigationUrl(line)) {
      skipped++;
      continue;
    }
    entries.push({url: line, windowIndex});
  }
  return {entries, skipped};
}
