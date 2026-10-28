# Gate B: proposed permission manifest diff

Branch: `phase-3-hardening`, based on the local logo-v2 merge. **Gate B approved and applied** in commit `6d75469`. The owner-reported Stable warning was that `processes` requires Dev channel or newer; it was not independently reproduced here.

## Proposed exact manifest changes

```diff
  "permissions": [
    "tabs",
    "storage",
-   "history",
    "unlimitedStorage",
    "contextMenus",
-   "cookies",
    "alarms",
    "favicon",
    "scripting",
    "offscreen",
-   "system.cpu",
-   "system.memory"
  ],
  "optional_permissions": [
-   "processes",
-   "management"
+   "system.cpu",
+   "system.memory"
  ],
```

All other manifest fields remain unchanged, including version, host permissions, content-script matches, CSP, and web-accessible resources. This proposal removes `processes` rather than leaving it optional: it is already declared optional, yet the owner reports Chrome Stable still warns. Chrome's API reference marks `chrome.processes` as Dev-channel-only. The existing monitor's precise process feature would need to be removed or explicitly limited to Dev/Canary after Gate B; graceful fallback estimates remain available.

## Evidence for each proposed change

| Proposed change | Current source evidence and rationale |
|---|---|
| Remove required `history` | No `chrome.history` call remains after Phase 2 task 2.10. `html/history.html` and `js/history*.js` use the extension's IndexedDB session history, not the browser History API. |
| Remove required `cookies` | Phase 2 task 2.2 removed `gsChrome.cookiesGetAll/cookiesRemove` and their sole legacy migration caller. Current source has no `chrome.cookies` use. |
| Remove optional `management` | Phase 2 task 2.12 removed the monitor extension list, grant flow, and all `chrome.management` calls. |
| Remove optional `processes` | Before Gate B, `js/monitor.js` used `chrome.processes` for precise per-process memory and requested it from a monitor button. Chrome documents this API as Dev-channel-only; moving it to optional did not address the owner-reported Stable warning. Gate B removed those calls, controls, table values, and associated locale keys. |
| Move `system.cpu` and `system.memory` to optional | The monitor reads system memory and CPU in `js/monitor.js:156-173`. `containsSystemPermissions()` checks both optional permissions before enabling those calls; `requestSystemPermissionsFromClick()` requests them only in the `enableSystemStats` click listener (`js/monitor.js:196-243`). Denial or unavailable permission APIs leave estimate mode active. |

## Purpose of every proposed remaining permission

| Permission | Purpose and principal call sites |
|---|---|
| `tabs` | Inspect and control tabs for suspension, restore, events, session recovery, backup, and monitor. Principal modules: `js/tgs.js`, `js/helpers/gsChrome.js`, `js/helpers/gsSession.js`, `js/helpers/gsBackup.js`, `js/helpers/gsTabCheckManager.js`, `js/monitor.js`. |
| `storage` | Store settings, schema/version markers, recovery state, session metrics, and monitor cache. `js/helpers/gsStorage.js`, `js/serviceWorker.js`, `js/helpers/gsMemorySampler.js`, `js/tgs.js`. |
| `unlimitedStorage` | Raise extension-origin storage quotas for IndexedDB session, favicon, and preview records; `js/helpers/gsIndexedDb.js`. |
| `contextMenus` | Create and handle tab-suspension and whitelist menu commands; `js/tgs.js:1360-1515`. |
| `alarms` | Schedule per-tab suspension deadlines, session metrics, backup, and optional monitor sampling; `js/tgs.js`, `js/helpers/gsBackup.js`, `js/helpers/gsMemorySampler.js`. |
| `favicon` | Read browser favicon cache through `/_favicon/` to retain original site icons; `js/helpers/gsFavicon.js:100-103,145-155`. |
| `scripting` | Inject tab checks, preview capture libraries, and opt-in monitor sampling; `js/helpers/gsTabCheckManager.js:511-531`, `js/helpers/gsMessages.js:143-174`, `js/helpers/gsMemorySampler.js:154`. |
| `offscreen` | Create an offscreen document to turn a Blob into a downloadable plain-text backup; `js/helpers/gsBackup.js:53-75`. |
| Optional `system.cpu` | When the user enables system totals and grants the permission, read CPU samples; `js/monitor.js:171-173,196-243`. |
| Optional `system.memory` | When the user enables system totals and grants the permission, read total/available physical memory; `js/monitor.js:156,196-243`. |

## Unchanged host access

`http://*/*` and `https://*/*` remain for automatic content-script checks, tab suspension/restore, and script injection (`manifest.json:14-25,121-125`; `js/contentscript.js`, `js/helpers/gsTabCheckManager.js`, `js/helpers/gsMessages.js`, `js/helpers/gsTabSuspendManager.js`). `file://*/*` remains for local-page checks and suspension when the user enables file access (`js/helpers/gsUtils.js:134-145`, `js/helpers/gsTabCheckManager.js:298-300`). The same three patterns remain under `content_scripts.matches` and `host_permissions`.

## Compatibility evidence and limits

Chrome's permission docs list `optional_permissions` as the runtime-granted field and identify the permissions that cannot be optional; `system.cpu` and `system.memory` are not in that exclusion list. The `processes` API reference labels its availability “Dev channel,” so optional declaration is already present in this manifest but does not make the API available in Stable. Sources: [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions), [Permissions API](https://developer.chrome.com/docs/extensions/reference/api/permissions), [Permissions list](https://developer.chrome.com/docs/extensions/reference/permissions-list), [Processes API](https://developer.chrome.com/docs/extensions/reference/api/processes), [System CPU API](https://developer.chrome.com/docs/extensions/reference/api/system/cpu), [System Memory API](https://developer.chrome.com/docs/extensions/reference/api/system/memory).

**Not verified:** loading the updated manifest in Chrome Stable or Brave, whether a particular Stable build accepts both optional `system.*` permissions at runtime, and the monitor's post-change permission flow.

## Addendum: minimum Chrome version

**Applied `minimum_chrome_version`: `116`.** `manifest.json` and `security/permissions.lock.json` now agree; `tools/check-guards.mjs` compares this field. The highest required API version found is `chrome.runtime.getContexts()` (Chrome 116), used by backup creation in `js/helpers/gsBackup.js` and also feature-checked in `js/helpers/gsMemorySampler.js`.

| API/member used | Evidence and effect |
|---|---|
| `chrome.runtime.getContexts()` | Chrome 116+; now used to detect the existing offscreen document before creating one. This sets the floor. [Runtime API](https://developer.chrome.com/docs/extensions/reference/api/runtime), [Offscreen API older-version guidance](https://developer.chrome.com/docs/extensions/reference/api/offscreen#before-chrome-116-check-if-an-offscreen-document-is-open) |
| `chrome.offscreen.createDocument/closeDocument` | Offscreen API is Chrome 109+ MV3; below the 116 floor. [Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen) |
| `chrome.scripting` | Chrome 88+ MV3. [Scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting) |
| `chrome.action` | Chrome 88+ MV3. [Action API](https://developer.chrome.com/docs/extensions/reference/api/action) |
| `chrome.tabs` | The core Tabs API is available in the MV3 baseline; current calls use longstanding query/update/discard/events. The `tab.frozen` field (Chrome 132+) is optional and treated as false when absent, so it does not raise the floor. [Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs) |
| `chrome.storage.session` | Chrome 102+ MV3, and the service worker checks for its presence before using it. [Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) |
| `chrome.system.cpu.getInfo` / `chrome.system.memory.getInfo` | Chrome 91+; both are optional and user-granted. [CPU API](https://developer.chrome.com/docs/extensions/reference/api/system/cpu), [Memory API](https://developer.chrome.com/docs/extensions/reference/api/system/memory) |
| `chrome.alarms` | Current `create()` Promise support is Chrome 111+ and `get()` is Chrome 91+; both are below the floor. The project uses one-minute or longer delays/periods. A legacy 0.33-minute suspension setting is normalized to one minute. No sub-minute alarm is used, so Chrome 120's 30-second alarm change does not set the floor. [Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms), [Chrome 120 alarm update](https://developer.chrome.com/blog/chrome-120-beta-whats-new-for-extensions/) |
| `chrome.contextMenus` | Current create/remove/click-listener use predates MV3 88; no newer minimum is documented for the members used. [Context Menus API](https://developer.chrome.com/docs/extensions/reference/api/contextMenus) |
| `chrome.permissions` | `contains()` and click-handler `request()` use callbacks; no later minimum than the MV3 88 baseline is documented. [Permissions API](https://developer.chrome.com/docs/extensions/reference/api/permissions) |
| Favicon permission and `/_favicon/` | The official guide describes the permission and `runtime.getURL()` endpoint without a newer minimum; below the 116 floor. [Fetching favicons](https://developer.chrome.com/docs/extensions/how-to/ui/favicons) |
| `chrome.commands`, `chrome.runtime` (except `getContexts`), `chrome.windows`, `chrome.storage.local/sync`, and remaining core APIs | The current members used have no later minimum documented than the general MV3 baseline, Chrome 88. [MV3 baseline](https://developer.chrome.com/docs/extensions/develop/migrate), [Extension API reference](https://developer.chrome.com/docs/extensions/reference/api) |

The minimum-version review also confirmed the backup default is still weekly: `gsStorage.js` seeds `gsBackupFrequency` as `10080`, and service-worker startup calls `gsBackup.setupAlarm()`. That privacy fix remains open under A-11/task 3.10 by owner direction. This version floor is based on current source and Chrome documentation, not a browser run. Other Gate B manifest fields remain unchanged.

## Guard scan exclusions

`tools/check-guards.mjs` excludes `dev/`, `docs/`, `tools/`, `assets/`, `vendor/`, and `security/` because they are development/documentation/policy inputs rather than shipped extension runtime source. It excludes the three vendored paths `js/helpers/html2canvas.min.js`, `js/helpers/dom-to-image.js`, and `js/helpers/db.js` from first-party source-pattern scans; all three are pinned in `vendor/CHECKSUMS.sha256`, verified by the guard, and reviewed in `vendor/README.md`. The screenshot libraries contain `XMLHttpRequest` paths; `db.js` remains of unverified provenance. Any unpinned file in `vendor/` fails the guard.
