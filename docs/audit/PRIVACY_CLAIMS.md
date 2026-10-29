# Privacy claims evidence register

Status means the evidence source directly supports the statement; browser-managed behavior is marked unverified where it cannot be established from this repository.

| Claim | Evidence | Status |
|---|---|---|
| The extension's own code sends nothing to a project-operated server; sync and page-preview exceptions are disclosed. | `tools/check-guards.mjs:21-33, 418-425`; `manifest.json:43-48`; `js/helpers/gsStorage.js:187-190, 296-317`; `js/helpers/gsTabSuspendManager.js:531-567, 613-635`; `vendor/CHECKSUMS.sha256`; `vendor/README.md:1-12`. | Verified in code |
| No remote executable code is loaded by extension pages. | `manifest.json:47` extension-page CSP; `tools/check-guards.mjs:21-33, 430-434` (forbidden remote execution patterns and restrictive `connect-src` check). | Verified in code |
| Page previews are off by default. | `js/helpers/gsStorage.js:62-69`; `html/options.html:187-192`; `dev/tests/privacy-defaults.test.mjs`. | Verified by test |
| Enabled preview libraries run in the captured page and may request page-referenced resources. | `js/helpers/gsTabSuspendManager.js:531-567, 613-635`; `js/helpers/gsMessages.js:142-177`; pinned hashes in `vendor/CHECKSUMS.sha256`; capture library resource-loading code in `js/helpers/html2canvas.min.js` and `js/helpers/dom-to-image.js`. | Verified in code |
| Preview libraries are SHA-256 pinned; the guard checks the hashes and excludes their known network patterns only for those pinned paths. | `vendor/CHECKSUMS.sha256`; `vendor/README.md:1-12`; `tools/check-guards.mjs:8-19` and checksum verification in `checkRoot`. | Verified in code |
| Settings sync is disabled by default and sync reads/writes are conditional on opt-in. | `js/helpers/gsStorage.js:62-85, 99-105, 187-191, 296-317`; `dev/tests/privacy-defaults.test.mjs`. | Verified by test |
| Backup is disabled until explicit enable; its alarm is gated by enabled state. | `js/helpers/gsBackup.js:87-115, 123-135`; `dev/tests/privacy-defaults.test.mjs`. | Verified by test |
| Backup's one-time offer, frequency choice, URLs in a plain-text Downloads file, and incognito exclusion. | `js/helpers/gsBackup.js:14-57, 138-150`; `html/backup-setup.html`; `dev/tests/privacy-defaults.test.mjs`. | Verified in code |
| The monitor is on-demand; background sampling defaults off; system permissions are optional and requested from a click. | `js/helpers/gsMemorySampler.js:20-26, 383-395`; `js/monitor.js:196-247`; `manifest.json:32-47`. | Verified in code |
| Incognito tabs are excluded from sampler, previews, backups, and sessions. | `js/helpers/gsMemorySampler.js:292-310`; `js/helpers/gsTabSuspendManager.js:221, 294, 511`; `js/helpers/gsBackup.js:17-18`; `js/helpers/gsSession.js:102-120`; `dev/tests/privacy-defaults.test.mjs`. | Verified by test |
| Local settings include preferences, whitelist, schema/app version and recovery state. | `js/helpers/gsStorage.js:7-38, 42-86, 284-293, 320-385`. | Verified in code |
| Local state includes sampler cache, sampling opt-in and local session metrics. | `js/helpers/gsMemorySampler.js:20-26, 349-376, 383-395`; `js/helpers/gsStorage.js:35-38, 389-423`; `js/helpers/gsSession.js:791-835`. | Verified in code |
| Focused/stationary tab and window IDs are stored locally. | `js/tgs.js:126-143`. | Verified in code |
| Startup check version is stored in Chrome session storage. | `js/serviceWorker.js:13-57`. | Verified in code |
| The monitor stores sort and auto-refresh preferences in extension-page localStorage. | `js/monitor.js:19-20, 924-978`. | Verified in code |
| IndexedDB stores previews as full URL plus image. | `js/helpers/gsIndexedDb.js:8-14, 103-118`. | Verified in code |
| IndexedDB stores suspended-tab metadata including URL and title. | `js/helpers/gsIndexedDb.js:121-140`; caller `js/helpers/gsTabSuspendManager.js:511-529`. | Verified in code |
| IndexedDB stores favicon metadata associated with page URLs. | `js/helpers/gsIndexedDb.js:170-190`; schema at `:53-61`. | Verified in code |
| IndexedDB current and saved session stores contain window/tab snapshots. | `js/helpers/gsIndexedDb.js:63-82, 213-245`; `js/helpers/gsSession.js:102-120`. | Verified in code |
| Startup cleanup caps previews and suspended-tab data at 1,000, favicon records at 1,300, and current sessions at 5; there is no TTL for these stores. | `js/helpers/gsIndexedDb.js:452-523`; `js/helpers/gsSession.js:271-295` (cleanup invocation). | Verified in code |
| Saved sessions have no general count cap or TTL; individual history items can be deleted. | `js/helpers/gsIndexedDb.js:73-82, 431-449`; no saved-session pruning in `trimDbItems` (`:452-523`); `js/history.js:35-57`. | Verified in code |
| Full tab URLs are stored in local session/suspension records; full preview URLs and images have a count cap but no TTL. | `js/helpers/gsIndexedDb.js:103-118, 121-140, 213-245, 452-523`. | Verified in code |
| Sampler cache retains at most 800 URL keys; entries older than seven days are pruned when the cache is updated. | `js/helpers/gsMemorySampler.js:20-23, 349-376`. | Verified in code |
| There is no single action that wipes all extension data. | `js/helpers/gsIndexedDb.js:431-449`; history UI deletion in `js/history.js:35-57`; no global wipe path found in source. | Verified in code |
| Owner-approved local retention and incomplete-wipe findings are deferred to v0.2.0. | `TAB_KILLER_ROADMAP.md:38-40`; `docs/DECISIONS.md:44-46`. | Verified in code |
| Individual current/saved session history records can be deleted in the extension history page; downloaded `.txt` backups can be deleted by the user in Downloads. | `js/history.js:35-57`; `js/helpers/gsIndexedDb.js:431-449`; `js/helpers/gsBackup.js:53-80`. | Verified in code |
| Suspended extension URLs are not deleted from browser history by this extension; exact browser retention and post-uninstall behavior are browser-managed. | `manifest.json:32-47` has no `history` permission; source scan found no `chrome.history` calls. Browser retention behavior was not tested. | Unverified |
| Chrome's retention of synced settings after disabling sync or uninstall is not established by extension code. | `js/helpers/gsStorage.js:296-317` writes sync state; no sync clear on disable/uninstall found. Browser service behavior was not tested. | Unverified |
| `tabs` supports suspension, restoration, saved sessions, and monitor tab inspection. | `manifest.json:32-48`; call sites include `js/helpers/gsTabSuspendManager.js`, `js/helpers/gsSession.js`, and `js/helpers/gsMemorySampler.js`. | Verified in code |
| `storage` stores extension settings and state. | `manifest.json:32-48`; `js/helpers/gsStorage.js`, `js/helpers/gsMemorySampler.js`, `js/serviceWorker.js`. | Verified in code |
| `unlimitedStorage` supports extension IndexedDB records. | `manifest.json:32-48`; `js/helpers/gsIndexedDb.js:7-27`. | Verified in code |
| `contextMenus` adds extension context-menu actions. | `manifest.json:32-48`; `js/tgs.js` context-menu setup. | Verified in code |
| `alarms` schedules suspension and optional backup/sampler jobs. | `manifest.json:32-48`; `js/tgs.js:1739-1769`; `js/helpers/gsBackup.js:87-115`; `js/helpers/gsMemorySampler.js:383-400`. | Verified in code |
| `favicon` supports browser favicon retrieval. | `manifest.json:32-48`; `js/helpers/gsFavicon.js:100-160, 292-320`. | Verified in code |
| `scripting` supports user-triggered tab injections such as preview capture and sampling. | `manifest.json:32-48`; `js/helpers/gsMessages.js:142-177`. | Verified in code |
| `offscreen` supports local text-file backup download through an offscreen document. | `manifest.json:32-48`; `js/helpers/gsBackup.js:58-80`; `html/offscreen.html`. | Verified in code |
| `system.cpu` and `system.memory` are optional and used for monitor system totals only after click-granted access. | `manifest.json:43-47`; `js/monitor.js:196-247`; `dev/tests/monitor-permissions.test.mjs`. | Verified in code |
| `http://*/*`, `https://*/*`, and `file://*/*` host patterns and content-script matches enable supported page operations. | `manifest.json:13-25, 50-54`; `docs/audit/PERMISSIONS_STORAGE.md`. | Verified in code |
| No web-accessible resources are declared, and the manifest does not set `update_url` or `externally_connectable`. | `manifest.json` and `security/permissions.lock.json`; WAR absence enforced by manifest-lock comparison in `tools/check-guards.mjs`. | Verified by test |
| Local session metrics are counts only and are not transmitted as telemetry. | `js/tgs.js:1739-1769`; `js/helpers/gsSession.js:791-835`; guard network rules in `tools/check-guards.mjs:21-33, 418-434`. | Verified in code |
| Whether the browser clears all local extension storage on uninstall is not verified, so PRIVACY.md makes no cleanup promise. | No uninstall cleanup code or browser uninstall-retention test exists. | Unverified |
