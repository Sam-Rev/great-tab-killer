# Service-worker module graph hit review

**Review date:** 2026-10-29. The initial strict scan found 14 file/pattern hits (one per file and forbidden pattern; not 14 individual source occurrences). `node tools/check-guards.mjs` exits with status **1** when hits are present; it fails the guard rather than merely printing warnings.

| # | File and source location | Kind | Evidence | Action |
|---:|---|---|---|---|
| 1 | `js/tgs.js:1726` (`window.`) | Name only | The identifier is the `chrome.windows.onCreated` callback's `browserWindow` object; this is an extension API value, not the DOM global. | Renamed the callback value to `browserWindow`; no behavior change. |
| 2 | `js/helpers/gsUtils.js:244-245` (`window.`) | Name only | This is a `chrome.windows.get()` result used to poll tab loading. | Renamed the value to `createdWindow`; no behavior change. |
| 3 | `js/helpers/gsUtils.js:590-592` (`document.`) | Extension-page-only helper | `htmlEncode()` callers are `historyItems.js` and `gsSuspendedTab.js`; neither is called from the worker. | Replaced the DOM encoding trick with equivalent `&`, `<`, `>` escaping and added a no-`document` unit test. |
| 4 | `js/helpers/gsUtils.js:1` (`localStorage`) | Comment only | It was an unused global annotation; there is no Web Storage API access in the module. | Removed the annotation. |
| 5 | `js/helpers/gsStorage.js:99-117` (`localStorage`) | Name only | The callback argument is the object returned by `chrome.storage.local.get`, not `window.localStorage`. | Renamed it `localData` and updated the nearby comments. |
| 6 | `js/helpers/gsSession.js:103-106, 525-589, 720` (`window.`) | Name only; one string occurrence | Session matching uses `chrome.windows` records. Line 720 contains `restoring-window.html` in a string, not an API expression. | Renamed local values to `browserWindow`. The graph scanner masks strings/comments, so the resource name is not an exception. |
| 7 | `js/helpers/gsSession.js:1` (`localStorage`) | Comment only | It was an unused global annotation. | Removed the annotation. |
| 8 | `js/helpers/gsTabCheckManager.js:518` (`window.`) | Comment only | The line described an old page key listener; it was not executable code. | Reworded the comment to omit the token. |
| 9 | `js/helpers/gsTabCheckManager.js:1` (`localStorage`) | Comment only | It was an unused global annotation. | Removed the annotation. |
| 10 | `js/helpers/gsTabDiscardManager.js:1` (`localStorage`) | Comment only | It was an unused global annotation. | Removed the annotation. |
| 11 | `js/helpers/gsTabSuspendManager.js:572, 483, 552` (`window.`) | Injected-page-only code | `runInjectedTabTask` is passed only as the second argument to `gsMessages.executeCodeOnTab` at both call sites; that wrapper forwards it as `func` to `chrome.scripting.executeScript` at `gsMessages.js:166-169`. | Added the function-keyed exception in `security/service-worker-graph-allowlist.json`; the guard rejects other `window.` uses and any non-injection reference. |
| 12 | `js/helpers/gsTabSuspendManager.js:572, 483, 552` (`document.`) | Injected-page-only code | The same `runInjectedTabTask` handles the YouTube timestamp query and preview capture and is only passed to the injection wrapper; its body is never directly invoked by the worker. | Added the function-keyed exception in `security/service-worker-graph-allowlist.json`; the guard rejects other `document.` uses and any non-injection reference. |
| 13 | `js/helpers/gsBackup.js:60` (`document.`) | String only | The original debug message ended in `document...`; the ellipsis caused the textual false positive. | Removed the ellipsis; no runtime change. |
| 14 | `js/helpers/gsMemorySampler.js:64, 157-160` (`document.`) | Injected-page-only code | `collectFrameStats` is passed only as the `func` to `chrome.scripting.executeScript` with `allFrames: true`; its body is never directly invoked by the worker. | Added the function-keyed exception in `security/service-worker-graph-allowlist.json`; the guard rejects other `document.` uses and any non-injection reference. |

The guard scans executable module text while masking comments and quoted strings. Its three current exceptions are keyed by file, function, and exact pattern in `security/service-worker-graph-allowlist.json`. Each named function must be defined exactly once, have the allowlisted pattern inside it, and have every reference passed directly to an injection API; matching code elsewhere still fails.

**Original-hit counts by kind:** 4 name-only, 5 comment-only, 1 extension-page-only helper, 1 string-only false positive, and 3 injected-page-only code hits. The current guard reports the last 3 only.
