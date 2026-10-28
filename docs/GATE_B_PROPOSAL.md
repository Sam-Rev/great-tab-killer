# Gate B: proposed permission manifest diff

Branch: `phase-3-hardening`, based on the local logo-v2 merge. **Proposal only:** `manifest.json` has not been edited. The owner-reported Stable warning is: `processes` requires Dev channel or newer; it was not independently reproduced here.

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
| Remove optional `processes` | `js/monitor.js:58-110,852,1091-1102` uses `chrome.processes` for precise per-process memory and requests it through the monitor button. Chrome documents this API as Dev-channel-only; moving it to optional does not address the owner-reported Stable warning because it is already optional. Removing it is the proposal that removes this Stable-only manifest warning. |
| Move `system.cpu` and `system.memory` to optional | `js/monitor.js:281,296-298` reads memory capacity and two CPU samples for monitor estimates. Chrome's permission reference lists both permissions, and the optional-permissions exclusions do not include them, so they may be declared in `optional_permissions`. After approval, monitor setup must request them from a user gesture and degrade cleanly when denied; the current page calls the APIs directly. |

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

**Not verified:** loading this proposed manifest in Chrome Stable or Brave, whether a particular Stable build accepts both optional `system.*` permissions at runtime, and the monitor's post-change permission flow. The proposed diff needs owner approval before any manifest or dependent source change.
