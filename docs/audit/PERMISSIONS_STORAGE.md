# Permission and Storage Maps

Date: 2026-10-27. Static source map for the current manifest and source tree. A call site shows API usage, not that Chrome grants the capability in every context.

## Manifest permission usage

| Manifest entry | Source call sites / purpose |
|---|---|
| Required `tabs` | `chrome.tabs.*` queries, navigation, state, suspend/restore, history snapshots, backup and sampling: `js/tgs.js`, `js/helpers/gsChrome.js`, `js/helpers/gsSession.js`, `js/helpers/gsBackup.js`, `js/helpers/gsMemorySampler.js`, and UI modules. Many calls need this permission to read tab URL/title or manipulate tabs. |
| Required `storage` | `chrome.storage.local/sync/session`: `js/helpers/gsStorage.js`, `js/serviceWorker.js`, `js/helpers/gsMemorySampler.js`, `js/tgs.js`; settings, migration/version markers, monitor cache, and startup state. |
| Required `history` | `js/tgs.js:1888-1892` registers `chrome.history.onVisited` and calls `chrome.history.deleteUrl` to remove suspended entries from browser history. |
| Required `unlimitedStorage` | No direct API call; permits larger extension-origin storage quotas used by IndexedDB (`js/helpers/gsIndexedDb.js`), particularly preview image data and session stores. Review against measured storage needs. |
| Required `contextMenus` | `js/tgs.js:1421-1514` creates/removes suspension context-menu items and handles clicks at `1514+`. |
| Required `cookies` | No remaining source call site after Phase 2 task 2.2 removed `gsChrome.cookiesGetAll/cookiesRemove` and the inherited `gsScrollPos*` migration. Permission removal remains pending Gate B/Phase 3. |
| Required `alarms` | Per-tab suspension deadlines and alarm handlers in `js/tgs.js:580,1898-1915`; backup schedule in `js/helpers/gsBackup.js:79-103`; sampler schedule in `js/helpers/gsMemorySampler.js:379-385`. |
| Required `favicon` | `js/helpers/gsFavicon.js:100-104,183` builds `chrome://favicon`/`_favicon` URLs to obtain tab icons; monitor views also use `_favicon` (`js/monitor.js:354`, `js/monitor-lab.js:315`). |
| Required `scripting` | `js/helpers/gsMessages.js:143-174` injects preview libraries/code; `js/helpers/gsTabCheckManager.js:511-531` injects tab checks; `js/helpers/gsMemorySampler.js:154` injects sampler code. |
| Required `offscreen` | `js/helpers/gsBackup.js:54-72` creates/checks/closes an offscreen document to turn a Blob into a downloaded text file. |
| Required `system.cpu` | `js/monitor.js:296-298` reads CPU samples for monitor estimates. |
| Required `system.memory` | `js/monitor.js:281` reads system memory for monitor estimates. |
| Optional `processes` | `js/monitor.js:66-109,852,1510-1515` reads process memory and subscribes to process updates when the user grants access; `js/helpers/debug.js:128` also has a process-updated diagnostic listener. |
| Optional `management` | `js/monitor.js:1128,1290-1300,1374-1402` requests permission, enumerates extensions with `getAll`, and toggles them with `setEnabled`. |

## Host access and content-script match patterns

| Manifest entry | Call sites / purpose |
|---|---|
| `host_permissions: http://*/*` | `js/contentscript.js` is injected at `document_start`; `js/helpers/gsTabCheckManager.js` and `gsMessages.js` inspect/check pages; `js/helpers/gsMemorySampler.js:154` injects the optional monitor sampler. Tab suspension and restore operate on these URLs through `js/tgs.js` and `js/helpers/gsTabSuspendManager.js`. |
| `host_permissions: https://*/*` | Same content-script, tab-check, suspension/restore, and sampler call paths as HTTP pages. |
| `host_permissions: file://*/*` | `js/contentscript.js` match, with file-scheme handling in `js/helpers/gsUtils.js:172,492`, `js/helpers/gsSession.js:36,456`, `js/helpers/gsTabCheckManager.js:298`, and suspension/restore paths. The user must enable the browser's “Allow access to file URLs” setting; no file-page runtime test was run. |
| `content_scripts.matches` (`http://*/*`, `https://*/*`, `file://*/*`) | All three patterns load `js/contentscript.js` at `document_start` per `manifest.json:14-25`. These are distinct from `host_permissions` and overlap the pages the extension handles. |

Manifest host access and content script matches cover `http://*/*`, `https://*/*`, and `file://*/*`; `js/contentscript.js` is declared at `document_start` across those pages. Broad HTTP/HTTPS access supports automatic tab inspection, form/scroll/battery/online state, and the monitor's all-tab sampler. `file://` access appears intended to let the same suspension/content checks include local documents, but that behavior was not browser-tested and Chrome requires the user to enable file access. The manifest also exposes suspended resources to `<all_urls>` in `web_accessible_resources`; the required consumer is unclear from static review. The source has no on-demand `activeTab`-only design. Narrowing access could break automatic checks and belongs at Gate B before any manifest change.

## Persistent data inventory

| Store | Data | Retention / deletion observed |
|---|---|---|
| `chrome.storage.local` `gsSettings` | Serialized extension options, including whitelist and backup frequency. | Persists until reset/extension removal; UI has reset behavior, but no unified wipe was verified. |
| `chrome.storage.sync` setting keys | Current source defaults sync ON (`gsSyncSettings = true`); option values are written when sync is enabled. Owner decision: make it opt-in and OFF by default, with a privacy note in Options. | Chrome may sync enabled settings to the user's account. This is browser behavior. |
| `chrome.storage.local` `schemaVersion` | Project-owned storage schema version, initialized to integer version 1 before settings initialization. | Updated only by explicit future schema steps; not a browsing-data store. |
| `chrome.storage.local` `gsVersion` and related version keys | Extension software version/session recovery state, distinct from `schemaVersion`. | No time expiry. |
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
| Downloads `.txt` files | Grouped full URL list for all tabs returned by `chrome.tabs.query({})`; no titles or screenshots. | Current source defaults to weekly (`gsBackupFrequency` 10080); files are not cleaned up by extension and no explicit incognito exclusion exists. Owner decision: default OFF and skip incognito; implementation is pending. |
| Browser history | Suspended extension URLs encode original URL/title/position in fragment. | Current `history.onVisited` cleanup deletes suspended entries. Owner decision is to remove that cleanup in a later phase; current behavior therefore differs from target. |

### Incognito scope

`manifest.json` declares `"incognito": "split"`. The sampler queries the context's tabs without `tab.incognito` filtering (`gsMemorySampler.js:418-428`), and the backup similarly queries all tabs visible in its context (`gsBackup.js:13-22`) without an explicit incognito check. Chrome's [incognito documentation](https://developer.chrome.com/docs/extensions/reference/manifest/incognito) says split mode gives each process only its own tabs, while [storage documentation](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies) says `chrome.storage.local` and `chrome.storage.sync` remain shared between regular and incognito processes. Therefore the source clearly permits sampling/persistence paths in the incognito context; exact end-to-end incognito storage effects were not browser-tested.
