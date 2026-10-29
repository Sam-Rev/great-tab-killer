# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - Unreleased

### Added
- Project legal, contribution, and key-management documentation.
- A neutral placeholder icon for the extension and project pages.
- One-time local session-backup setup page with enable and frequency controls.

### Changed
- Rebranded the extension as The Great Tab Killer.
- Reset the manifest version to `0.1.0`.
- Favicon metadata now uses the browser favicon cache and falls back to the extension default; it no longer fetches `tabs.Tab.favIconUrl` directly.
- Settings sync and automatic session backup are off until explicitly enabled; incognito tabs are excluded from persistent sessions, previews, backups, and sampler measurements.
- Suspension skips stale, missing, and unsupported page URLs; background recovery and favicon fetch failures are handled without unhandled promise rejections.
- Fresh-install setup uses only static service-worker imports; the service-worker module guard also rejects page-only globals and Web Storage APIs.
- Recovery timestamps with missing or malformed storage fail closed without an uncaught error. The periodic local metrics-reset alarm is named `updateSessionMetricsJob`; it records local suspended/total tab counts only.

### Removed
- The third-party uninstall survey URL and upstream fundraising links.
