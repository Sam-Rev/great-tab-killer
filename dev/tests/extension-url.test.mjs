import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isExtensionOriginUrl } from '../../js/helpers/isExtensionOriginUrl.js';

test('favicon fetch accepts only the extension origin', () => {
  const root = 'chrome-extension://abcdefghijklmnop/';
  assert.equal(isExtensionOriginUrl('chrome-extension://abcdefghijklmnop/_favicon/?size=16', root), true);
  assert.equal(isExtensionOriginUrl('chrome-extension://differentextension/_favicon/?size=16', root), false);
  assert.equal(isExtensionOriginUrl('https://example.com/favicon.ico', root), false);
  assert.equal(isExtensionOriginUrl('not a URL', root), false);
});
