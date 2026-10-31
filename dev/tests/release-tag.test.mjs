import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseNotesForTag } from '../../tools/check-release-tag.mjs';

const manifest = { version: '0.1.0' };
const changelog = `# Changelog

## [0.1.0] - 2026-10-31

### Added
- Release notes.
`;

test('v0.1.0 matches the manifest and returns dated non-empty release notes', () => {
  assert.match(releaseNotesForTag('v0.1.0', manifest, changelog), /Release notes\./);
});

test('a mismatched release version fails', () => {
  assert.throws(() => releaseNotesForTag('v0.1.1', manifest, changelog), /exactly match/);
});

test('a missing changelog section fails', () => {
  assert.throws(() => releaseNotesForTag('v0.1.0', manifest, '# Changelog\n'), /no dated section/);
});

test('a malformed tag fails', () => {
  assert.throws(() => releaseNotesForTag('release-0.1.0', manifest, changelog), /exactly match/);
});
