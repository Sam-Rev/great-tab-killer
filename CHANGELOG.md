# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-10-30

### Added
- Evidence-backed privacy and security policies; the extension description is now neutral across locales.
- Project legal, contribution, and key-management documentation.
- Final project logo and generated extension icons.
- One-time local session-backup setup page with enable and frequency controls.
- A literal release-file allowlist, deterministic ZIP builder, and SHA-256 manifest.
- README, unpacked-install guide, and GitHub CI/release workflow definitions.

### Changed
- Added the shared logo header to session history and keyboard shortcuts.
- Replaced icon-font glyphs with original CSS-drawn shapes and removed the font files.
- Backup diagnostics no longer log step details or exception text that may contain URLs or titles.
- Privacy and security documentation now covers browser-history fragments, content-script data, incognito storage behavior, and release-integrity limits.
- Removed unnecessary `web_accessible_resources`; extension assets are no longer exposed to web pages or other extensions.
- Suspended URL fragments and session recovery now validate navigation URLs; untrusted page and session text is rendered with DOM text nodes.
- Rebranded the extension as The Great Tab Killer.
- Reset the manifest version to `0.1.0`.
- Favicon metadata now uses the browser favicon cache and falls back to the extension default; it no longer fetches `tabs.Tab.favIconUrl` directly.
- Settings sync and automatic session backup are off until explicitly enabled; incognito tabs are excluded from persistent sessions, previews, backups, and sampler measurements.
- Suspension skips stale, missing, and unsupported page URLs; background recovery and favicon fetch failures are handled without unhandled promise rejections.
- Fresh-install setup uses only static service-worker imports; the service-worker module guard also rejects page-only globals and Web Storage APIs.
- Recovery timestamps with missing or malformed storage fail closed without an uncaught error. The periodic local metrics-reset alarm is named `updateSessionMetricsJob`; it records local suspended/total tab counts only.
- The first-run backup setup page shares the Options stylesheet and branded header; **Not now** records the one-time notice state, while backup remains disabled until **Enable backups** is clicked.

### Removed
- The third-party uninstall survey URL and upstream fundraising links.
