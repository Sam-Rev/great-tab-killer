# Privacy

The Great Tab Killer stores browser-tab data locally to suspend tabs, restore sessions, and provide optional tools. It does not contact or send data to a server operated by this project, and it does not load remote executable code. Page previews are disabled by default. If enabled, the bundled capture libraries run in the captured page and may re-request images, fonts, or stylesheets that the page already references from that page's servers. These page-origin requests are not sent to a project server. The libraries are SHA-256 pinned; the guard excludes their known network patterns only for those verified files.

## Defaults and choices

- Screen previews are off by default (`screenCapture: '0'`). If enabled in Options, the capture libraries are injected by `gsTabSuspendManager` into the page being captured; they may re-request page-referenced assets from that page's servers. This is page-origin activity, not a request to a project server.
- Settings sync is off by default. If enabled, settings are copied to `chrome.storage.sync` and may be transferred by Chrome across signed-in browser profiles.
- Session backup is off by default. It is offered once during setup and only starts after **Enable backups**. It writes a plain-text `.txt` file to Downloads containing the URLs of open regular tabs, grouped by window. Incognito tabs are excluded. Downloaded files are outside the extension's storage controls and are not automatically deleted.
- The monitor is on-demand, and background sampling is off by default. System totals require optional `system.cpu` and `system.memory` permissions granted from a user click; estimates remain available without them.
- Incognito tabs are excluded from sampler measurements, previews, backups, and saved sessions.

## Permissions

Manifest permissions and their purposes:

- `tabs` — inspect and manage tabs for suspension, restoration, session history, and monitor estimates.
- `storage` — store local settings and opt-in state, and use browser session storage for startup state.
- `unlimitedStorage` — support the local IndexedDB database, including preview images and sessions.
- `contextMenus` — add the extension's tab actions to the browser context menu.
- `alarms` — schedule suspension checks and enabled backup or sampling jobs.
- `favicon` — read browser-provided favicon data for tab icons.
- `scripting` — inject extension capture/measurement code into tabs when the feature is used.
- `offscreen` — create a local offscreen document to download a backup without a Downloads API permission.

Optional permissions:

- `system.cpu` and `system.memory` — show system totals in the resource monitor. They are requested only after clicking **Enable system totals**; if unavailable or denied, estimates continue to work.

Host access is declared for `http://*/*`, `https://*/*`, and `file://*/*`. It supports page inspection and extension operations on those pages, including optional preview capture. File URL access also requires the browser's separate “Allow access to file URLs” setting. The content script uses the same URL patterns.

## Data stored and retention

| Location | Data | Retention | Deletion today |
|---|---|---|
| `chrome.storage.local` | Settings (`gsSettings`), whitelist, schema/app versions, recovery timestamp, backup and notice flags, sampler opt-in/cache, session metrics, and focused/stationary tab and window IDs. | Sampler cache is capped at 800 URL entries; entries older than 7 days are pruned when the cache is updated. Other setting/state values have no general TTL. | Change settings in Options. No complete local-storage wipe is exposed. |
| `chrome.storage.sync` | Settings copied only when sync is enabled. | The extension does not clear synced settings when sync is disabled. Chrome's retention after disabling sync or uninstall is not verified. | Turn sync off in Options; removing existing synced values is not exposed by this extension. |
| `chrome.storage.session` | Version marker for completed startup checks. | Browser-managed session storage; no extension-defined TTL. | Browser-managed; no extension deletion control. |
| Extension-page `localStorage` | Resource monitor sort order and auto-refresh preference. | No extension-defined TTL. | No extension UI for clearing these preferences. |
| IndexedDB `tgs` / `gsPreviews` | Full page URL and preview image. | Startup cleanup caps this store at 1,000 records; no TTL. | No complete wipe or per-preview deletion UI. |
| IndexedDB `tgs` / `gsSuspendedTabInfo` | Suspended tab URL, title, date, favicon reference, pinned/index/window metadata. | Startup cleanup caps this store at 1,000 records; no TTL. | No complete wipe or per-record deletion UI. |
| IndexedDB `tgs` / `gsFaviconMeta` | Page URL and favicon metadata/image data. | Startup cleanup caps this store at 1,300 records; no TTL. | No complete wipe or per-record deletion UI. |
| IndexedDB `tgs` / `gsCurrentSessions` | Session snapshots, including regular-window tab URLs and titles. | Startup cleanup retains up to 5 current-session records; no TTL. | Delete individual history entries in the extension history page; no complete wipe. |
| IndexedDB `tgs` / `gsSavedSessions` | User-saved sessions and restore points, including tab URLs and titles. | No general cap or TTL is implemented. | Delete individual history entries in the extension history page; no complete wipe. |
| Downloads folder | Optional plain-text backup with URLs of open regular tabs, grouped by window. | Files are managed by the user and are not automatically deleted by the extension. | Delete the `.txt` file in Downloads. |

Full URLs and preview images remain locally stored subject to the listed count caps; these records do not have a TTL. There is not yet a single action that wipes all extension data. The owner has accepted these retention and complete-wipe limitations for v0.1.0; they are planned for v0.2.0. Session snapshots and sampler entries exclude incognito tabs. The extension does not request the browser history permission or delete browser history entries. Suspended pages therefore remain represented in browser history while the browser retains them. Browser history retention and extension-storage behavior after uninstall are browser-managed and not verified here.

To delete data today, remove individual session-history entries in the extension's history page, disable sync and backup in Options, and manually delete downloaded backup files and browser history entries as desired. There is no one-step wipe. Uninstalling removes the extension itself; whether the browser clears all local extension storage on uninstall is not verified, so this document makes no promise about that cleanup.

## Local metrics

The extension stores local counts of total and suspended tabs for its session metrics display/reset behavior. The metrics handler only updates this local state; it does not send counts or other telemetry to a project server. No `web_accessible_resources` are declared, and the manifest has no `update_url` or `externally_connectable` field.

## Evidence

See [the privacy claims evidence register](docs/audit/PRIVACY_CLAIMS.md) for file and test references and verification status for each statement above.
