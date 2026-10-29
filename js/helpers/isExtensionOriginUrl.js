export function isExtensionOriginUrl(candidateUrl, extensionRootUrl) {
  try {
    const candidate = new URL(candidateUrl);
    const extensionRoot = new URL(extensionRootUrl);
    return candidate.protocol === 'chrome-extension:' &&
      extensionRoot.protocol === 'chrome-extension:' &&
      candidate.host === extensionRoot.host;
  } catch (error) {
    return false;
  }
}
