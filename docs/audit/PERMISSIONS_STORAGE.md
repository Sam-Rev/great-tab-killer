# Permission and Storage Maps

Date: 2026-10-27. Static source map for the current manifest and source tree. A call site shows API usage, not that Chrome grants the capability in every context.

## Manifest permission usage

| Manifest entry | Source call sites / purpose |
|---|---|
| `tabs` | `chrome.tabs.*` broadly used for tab querying, navigation, state, suspend/restore, session backup and recovery (`js/tgs.js`, `js/helpers/gsChrome.js`, `gsSession.js`, `gsBackup.js`, `gsMemorySampler.js`, UI modules). |
| `storage` | `chrome.storage.local/sync/session` (`gsStorage.js`, `serviceWorker.js`, `gsMemorySampler.js`, `tgs.js`). |
| `history` | `chrome.history.onVisited` and `deleteUrl` listener in `js/tgs.js` to remove suspended entries from browser history. |
| `unlimitedStorage` | No direct method call; allows larger extension-origin storage (IndexedDB/previews). Candidate to review based on measured data use. |
| `contextMenus` | Context menu create/update/remove/click handlers in `js/tgs.js` (search sites around `chrome.contextMenus`). |
| `cookies` | `js/helpers/gsChrome.js:10,26`; legacy migration in `js/helpers/gsIndexedDb.js:563-576` removes `gsScrollPos*` cookies. |
| `alarms` | `js/tgs.js` per-tab suspension and recurring metrics/backup/sampler alarms; `gsBackup.js:79-103`; `gsMemorySampler.js:379-385`. |
| `favicon` | `js/helpers/gsFavicon.js` reads `chrome://favicon` or `_favicon` resources for tab icons. |
| `scripting` | `js/helpers/gsMessages.js:149,167`, `gsTabCheckManager.js:512,527`, `gsMemorySampler.js:154` for injection into tabs/all frames. |
| `offscreen` | `js/helpers/gsBackup.js:57-72` creates/closes an offscreen page to download a backup Blob. |
| `system.cpu` | `js/helpers/gsMemorySampler.js` reads CPU info for resource estimates (verify exact API sites with `chrome.system.cpu`). |
| `system.memory` | `js/helpers/gsMemorySampler.js` reads system memory estimate input (`chrome.system.memory`). |
| Optional `processes` | Debug/monitor process APIs in `js/helpers/debug.js:128+` and `js/monitor.js`; optional permission must be distinguished from required manifest permissions. |
| Optional `management` | `js/monitor.js` lists/toggles installed extensions; `chrome.management.setEnabled` is present. |

Manifest host access and content script matches cover `http://*/*`, `https://*/*`, and `file://*/*`; `js/contentscript.js` is declared at `document_start` across those pages. Broad HTTP/HTTPS access supports automatic tab inspection, form/scroll/battery/online state, and the monitor's all-tab sampler. `file://` access appears intended to let the same suspension/content checks include local documents, but that behavior was not browser-tested and Chrome requires the user to enable file access. The manifest also exposes suspended resources to `<all_urls>` in `web_accessible_resources`; the required consumer is unclear from static review. The source has no on-demand `activeTab`-only design. Narrowing access could break automatic checks and belongs at Gate B before any manifest change.

## Persistent data inventory

| Store | Data | Retention / deletion observed |
|---|---|---|
| `chrome.storage.local` `gsSettings` | Serialized extension options, including whitelist and backup frequency. | Persists until reset/extension removal; UI has reset behavior, but no unified wipe was verified. |
| `chrome.storage.sync` setting keys | Synced option values when sync is enabled by current settings. | Chrome may sync to the user's account. Individual settings can be resaved locally. |
| `chrome.storage.local` `gsVersion` and related version keys | Version/migration state. | No time expiry. |
| `chrome.storage.local` `gsNotice` / recovery / metrics keys | Notice status, extension recovery state, and session metrics. | No general TTL; key-specific updates/deletes. |
| `chrome.storage.local` `gsMonitorMemCache` | Full tab URL → estimated bytes and timestamp. | Up to 800 entries; entries older than 7 days are removed only during cache update. No dedicated user wipe found. |
| `chrome.storage.local` `gsMonitorUsed` | Boolean indicating whether resource monitor has been opened. | Persists; no explicit expiry. |
| `chrome.storage.session` `gsStartupChecksCompletedVersion` | Version whose startup checks completed. | Browser session storage; not browsing content. |
| IndexedDB `tgs.gsPreviews` | Full page URL plus captured image data URL/base64 preview. | Trimmed by oldest IDs to 1000 on `trimDbItems`; no TTL. `clearGsDatabase()` does not clear this store. |
| IndexedDB `tgs.gsSuspendedTabInfo` | Original URL, title, favicon and tab/window state for suspended pages. | `trimDbItems()` caps at 1000 records; no fixed TTL. |
| IndexedDB `tgs.gsFaviconMeta` | URL/root URL, favicon URL and normalized image data. | `trimDbItems()` caps at 1300 records; no fixed TTL. |
| IndexedDB `tgs.gsCurrentSessions` | Window/tab session snapshots including URLs/titles. | `trimDbItems()` caps at 5 records. |
| IndexedDB `tgs.gsSavedSessions` | User-saved session names and tabs (including URLs/titles). | User-managed; clear/delete UI exists, no automatic TTL. |
| Extension-page `localStorage` | Monitor sort and auto-refresh preferences; other uses were searched. | Browser storage behavior; no central wipe. Not service-worker accessible. |
| Downloads `.txt` files | Grouped full URL list for all tabs returned by `chrome.tabs.query({})`; no titles or screenshots. | Backup default is weekly (`gsBackupFrequency` 10080); files are not cleaned up by extension. No explicit incognito exclusion. |
| Browser history | Suspended extension URLs encode original URL/title/position in fragment. | Current `history.onVisited` cleanup deletes suspended entries. Owner decision is to remove that cleanup in a later phase; current behavior therefore differs from target. |

### Incognito scope

`manifest.json` declares `"incognito": "split"`. The sampler queries the context's tabs without `tab.incognito` filtering (`gsMemorySampler.js:418-428`), and the backup similarly queries all tabs visible in its context (`gsBackup.js:13-22`) without an explicit incognito check. Chrome's [incognito documentation](https://developer.chrome.com/docs/extensions/reference/manifest/incognito) says split mode gives each process only its own tabs, while [storage documentation](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies) says `chrome.storage.local` and `chrome.storage.sync` remain shared between regular and incognito processes. Therefore the source clearly permits sampling/persistence paths in the incognito context; exact end-to-end incognito storage effects were not browser-tested.
