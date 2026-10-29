export function isSafePageUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:' || protocol === 'file:';
  } catch {
    return false;
  }
}
