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
| `favicon` | Read browser favicon cache through `chrome://favicon` and `/_favicon/` to retain original site icons; `js/helpers/gsFavicon.js:100-104,183`. |
| `scripting` | Inject tab checks, preview capture libraries, and opt-in monitor sampling; `js/helpers/gsTabCheckManager.js:511-531`, `js/helpers/gsMessages.js:143-174`, `js/helpers/gsMemorySampler.js:154`. |
| `offscreen` | Create an offscreen document to turn a Blob into a downloadable plain-text backup; `js/helpers/gsBackup.js:54-72`. |
| Optional `system.cpu` | When the user enables monitor access, estimate CPU activity from samples; `js/monitor.js:296-298`. |
| Optional `system.memory` | When the user enables monitor access, read total/available physical memory; `js/monitor.js:281`. |

## Unchanged host access

`http://*/*` and `https://*/*` remain for automatic content-script checks, tab suspension/restore, and script injection (`manifest.json:14-25,121-125`; `js/contentscript.js`, `js/helpers/gsTabCheckManager.js`, `js/helpers/gsMessages.js`, `js/helpers/gsTabSuspendManager.js`). `file://*/*` remains for local-page checks and suspension when the user enables file access (`js/helpers/gsUtils.js:134-145`, `js/helpers/gsTabCheckManager.js:298-300`). The same three patterns remain under `content_scripts.matches` and `host_permissions`.

## Compatibility evidence and limits

Chrome's permission docs list `optional_permissions` as the runtime-granted field and identify the permissions that cannot be optional; `system.cpu` and `system.memory` are not in that exclusion list. The `processes` API reference labels its availability “Dev channel,” so optional declaration is already present in this manifest but does not make the API available in Stable. Sources: [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions), [Permissions API](https://developer.chrome.com/docs/extensions/reference/api/permissions), [Permissions list](https://developer.chrome.com/docs/extensions/reference/permissions-list), [Processes API](https://developer.chrome.com/docs/extensions/reference/api/processes), [System CPU API](https://developer.chrome.com/docs/extensions/reference/api/system/cpu), [System Memory API](https://developer.chrome.com/docs/extensions/reference/api/system/memory).

**Not verified:** loading the updated manifest in Chrome Stable or Brave, whether a particular Stable build accepts both optional `system.*` permissions at runtime, and the monitor's post-change permission flow.

## Addendum: proposed minimum Chrome version (owner approval pending)

**Proposed `minimum_chrome_version`: `150`.** Do not add this field to `manifest.json` until the owner approves it.

The limiting API member currently used is `chrome.offscreen.hasDocument()` in `js/helpers/gsBackup.js:59`, whose official API reference says Chrome 150+. The extension also uses `chrome.offscreen.createDocument()` and `closeDocument()` (Chrome 109+), `chrome.scripting` and `chrome.action` (Chrome 88+ MV3), and `chrome.storage.session` (Chrome 102+). Thus the direct `hasDocument()` call raises the effective minimum above the other identified APIs. `chrome.runtime.getContexts()` is used only behind a feature check in `js/helpers/gsMemorySampler.js:414`, so that optional path does not raise the minimum. The current source scan found no unguarded API with a documented minimum above Chrome 150.

Evidence: [Offscreen API availability and `hasDocument()`](https://developer.chrome.com/docs/extensions/reference/api/offscreen) (109+ API, `hasDocument()` 150+); [Scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting) (88+ MV3); [Action API](https://developer.chrome.com/docs/extensions/reference/api/action) (88+ MV3); [Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) (`storage.session` 102+); [Runtime API](https://developer.chrome.com/docs/extensions/reference/api/runtime) (`getContexts()` 116+).

The version recommendation is documentation only. Manifest version, hosts, content-script matches, CSP, and WAR were left unchanged in Gate B. This is source/API-reference evidence, not a runtime compatibility test.

## Guard scan exclusions

`tools/check-guards.mjs` excludes `dev/`, `docs/`, `tools/`, `assets/`, `vendor/`, and `security/` because they are development/documentation/policy inputs rather than shipped extension runtime source. It excludes the three vendored paths `js/helpers/html2canvas.min.js`, `js/helpers/dom-to-image.js`, and `js/helpers/db.js` from first-party source-pattern scans; these are third-party libraries reviewed separately in `vendor/README.md`. The screenshot libraries contain `XMLHttpRequest` paths, while `db.js` is an IndexedDB shim. No vendored files were edited.
