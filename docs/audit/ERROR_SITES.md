# Error-site review

Reviewed shipped application JavaScript in `tools/release-files.txt`; excluded `html/monitor-lab.html` / `js/monitor-lab.js` (developer-only) and pinned vendor libraries. Call-site line numbers refer to this revision. Missing storage keys are normal first-run state. Corrupt JSON warnings name only the storage key; the raw value is never passed to a logger.

## Expected lifecycle conditions

| File:line | Trigger | Expected or real | Action |
|---|---|---|---|
| `js/helpers/gsStorage.js:117-125,271-280` | `gsSettings` missing on first run; incomplete settings receive defaults. | Expected | Return defaults and save the merged settings without an error or warning. Present invalid JSON warns once through `:15` with the key only, then defaults are saved. |
| `js/helpers/gsStorage.js:317-333` | `gsVersion` missing on first install or malformed. | Expected | Return `0.0.0` silently when missing; warn by key and rewrite the default when malformed. |
| `js/helpers/gsStorage.js:348-365` | `gsExtensionRecovery` missing or malformed. | Expected | Missing returns `undefined` silently; malformed warns by key only and removes the invalid value. |
| `js/helpers/gsStorage.js:372-383` | `gsSessionMetrics` missing or malformed. | Expected | Missing returns `{}` silently; malformed warns by key only and rewrites `{}`. |
| `js/helpers/gsIndexedDb.js:123-125` | A tab lacks a URL when suspension metadata is saved (stale/replaced tab). | Expected | Skip the record; warning includes only the tab ID. |
| `js/helpers/gsIndexedDb.js:172-174` | Favicon metadata has no URL. | Expected | Skip the record and warn without a URL. |
| `js/helpers/gsSuspendedTab.js:104-108` | Connectivity message has no receiving content script. | Expected | Warning only, with tab ID. |
| `js/helpers/gsSession.js:781-784` | Recovery page closes before its list update message arrives. | Expected | Warning only, with tab ID. |
| `js/helpers/gsUtils.js:589-592,608-611` | Tab query/message races with a tab closing or navigating. | Expected | Downgraded to warnings; log tab ID only. |
| `js/suspended.js:218-229` | Unload-state messages race with tab navigation/closure. | Expected | Downgraded to warnings; log tab ID only. |
| `js/tgs.js:1107-1111` | Options page closes before settings initialization message completes. | Expected | Downgraded to warning; log tab ID only. |

Nine prior error-level call sites for lifecycle/data-availability races were changed to warnings. The four JSON getters now handle expected missing state without logging. No queue-race path was error-level in this revision; queue failures already use warnings.

Startup also compares the persisted `gsVersion` with the worker-session completion marker before skipping checks (`js/serviceWorker.js:63-68`). If local storage was cleared during the same browser session, startup runs the first-install path instead of trusting a stale session marker. The smoke test exercises both a worker restart and an extension reload after clearing local storage.

## Remaining error-level sites

These conditions can indicate failed operations or unavailable state; they remain error-level. Log arguments are fixed context strings, operation names, storage keys, or numeric tab/window IDs; exception objects and tab/settings records are not passed.

| File:line | Trigger | Expected or real | Action |
|---|---|---|---|
| `js/helpers/gsIndexedDb.js:95,117,139,154,189,204,243,257,290,334,353,373,396,448,521` | Database query, write, clear, trim, or removal operation failed. | Real | Keep errors; use a bounded `Database operation failed` message, without records or URL/title data. |
| `js/helpers/gsStorage.js:274,288,306,338,358,368,377,397` | Storage API read/write failure for settings, sync, version, recovery, or metrics. | Real | Keep errors; report only the storage key/operation, never its value. |
| `js/helpers/gsSuspendedTab.js:69` | Browser could not read the suspension shortcut. | Real | Keep error with fixed message; no browser error object is included. |
| `js/helpers/gsSession.js:329` | Update flow has neither a restore point nor a last session. | Real | Keep error; this signals missing recovery data. |
| `js/helpers/gsBackup.js:76` | Backup operation failed. | Real | Keep bounded static console error; no exception, URLs, or titles. |
| `js/contentscript.js:147` | Content-script initialization failed and will be retried. | Real | Keep a static console error; omit exception contents. |
| `js/monitor.js:916` | Monitor refresh failed. | Real | Keep error with a fixed message; no tab data or exception text. |
| `js/popup.js:21,238,265,275,285,295,305,315,325,335` | Active-tab status or a user-triggered background action failed. | Real | Keep error-level action labels; omit browser error objects and page data. |
| `js/serviceWorker.js:102,106,110,120,158` | Background initialization/startup or dormant conversion operation failed. | Real | Keep error-level fixed operation labels; omit exception contents. |

There are 43 remaining operational error call sites in the groups above. `js/helpers/gsUtils.js:68-70,90` is logger plumbing, not a separate trigger. A full source search found no remaining error/warning call passing a `Tab` object, stored settings object, or whitelist value. `gsUtils.errorIfInitialised` has no call sites.
