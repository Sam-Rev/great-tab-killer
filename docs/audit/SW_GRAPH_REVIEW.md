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
| 11 | `js/helpers/gsTabSuspendManager.js:597, 607` (`window.`) | Injected-page-only code | The `window.innerHeight` reads are inside `generatePreviewImageCanvasViaContentScript`, passed to `gsMessages.executeCodeOnTab` and executed in the tab's isolated world. | No allowlist entry added. These exact lines remain for owner approval before any exception. |
| 12 | `js/helpers/gsTabSuspendManager.js:511, 598, 599, 600, 601, 602, 609, 615, 616, 627` (`document.`) | Injected-page-only code | The DOM reads are inside `fetchYouTubeTimestampContentScript` and `generatePreviewImageCanvasViaContentScript`, passed for execution in the tab's isolated world. | No allowlist entry added. These exact lines remain for owner approval before any exception. |
| 13 | `js/helpers/gsBackup.js:60` (`document.`) | String only | The original debug message ended in `document...`; the ellipsis caused the textual false positive. | Removed the ellipsis; no runtime change. |
| 14 | `js/helpers/gsMemorySampler.js:74, 76, 79, 87, 93, 97` (`document.`) | Injected-page-only code | `collectFrameStats` is passed as the `func` to `chrome.scripting.executeScript` with `allFrames: true`; these DOM reads execute in each target frame. | No allowlist entry added. These exact lines remain for owner approval before any exception. |

The guard scans executable module text while masking comments and quoted strings; this prevents names and debug text from being mistaken for browser-global API access. The `window.` and `localStorage` comment/name-only hits above were cleaned up. Current guard output is recorded in `docs/TESTING.md`; page-context expressions are not allowlisted and are listed for owner approval.

**Original-hit counts by kind:** 4 name-only, 5 comment-only, 1 extension-page-only helper, 1 string-only false positive, and 3 injected-page-only code hits. The current guard reports the last 3 only.
