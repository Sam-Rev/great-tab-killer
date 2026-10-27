# Phase 1 Static Scan Results

Date: 2026-10-27
Scope: checked-in project files on `phase-1-audit`; generated from source inspection and targeted `rg` scans. No source files were changed.

## Dangerous sinks

| Location | Use | Classification | Assessment |
|---|---|---|---|
| `js/suspended.js:196-197` | `request.title` assigned to two `innerHTML` sinks | Data-driven | **Certain, High**: a web-controlled tab title is rendered as HTML in the extension page. |
| `js/suspended.js:257-258` | `cleanUrl(request.url)` into `innerHTML`; raw URL into `href` | Data-driven | **Likely, High**: original tab URL is untrusted; HTML parsing can create markup and href scheme is not checked here. |
| `js/suspended.js:294` | `request.reason` into `innerHTML` | Data-driven message field | **Likely, Medium**: observed callers currently provide internal reason strings, but the receiver does not constrain/sanitize the field. |
| `js/suspended.js:271,277` | Command name / localized shortcut prompt into template HTML | Chrome shortcut value or bundled locale string | **Likely, Low**: values originate in extension settings/Chrome command metadata and local translations, not webpage input; safe DOM rendering is still preferable. |
| `js/shortcuts.js:44-49` | Command description and formatted shortcut into template HTML | Chrome command metadata / bundled locale string | **Likely, Low**: no webpage input identified, but values are not escaped at this sink. Prefer text nodes. |
| `js/historyItems.js:66` | `titleText` into `innerHTML` | Data-driven | **Certain, High**: saved/imported session name is rendered as markup. |
| `js/notice.js:20` | Notice text into `innerHTML` | Data-driven sink in dormant notice flow | **Certain, Medium**: `requestNotice` has no confirmed assignment to its value in the scanned code; dormant status does not make the sink safe if reactivated. |
| `js/historyItems.js:234` | `gsUtils.htmlEncode(text || '')` into `innerHTML` | Escaped text | **Certain, Info**: helper escapes text before insertion. |
| `js/history.js:82,212-214` | Clear containers with empty string | Clearing only | **Certain, Info**: no data interpolation. |
| `js/shortcuts.js:44` | Builds shortcut list with template markup | Chrome command name inserted in markup | **Likely, Low**: value is from `chrome.commands.getAll()`; no untrusted webpage source identified. Prefer DOM/text APIs. |
| `js/helpers/debug.js:56,61,65,134` | Debug table and profiler HTML | Generated extension diagnostics | **Likely, Low**: tab title is encoded at `debug.js:22`; status fields reviewed are browser values/enums. Keep debug output escaped. |
| `js/helpers/gsUtils.js:622` | `htmlEncode` uses a temporary element and reads its encoded `innerHTML` | Encoding helper | **Certain, Info**: this is the output encoding routine, not a sink for interpreting attacker input as HTML. |
| `js/popup.js:223` | `statusDetail` into `innerHTML` | Localized/status-derived HTML | **Likely, Low**: reviewed construction uses fixed status/localized strings; no web-controlled value identified. |
| `js/updated.js:40` | Manifest version into `innerHTML` | Static version string | **Certain, Info**. |
| `js/monitor-lab.js:307,353,398` | Table and inspector templates | Dynamic title/result values escaped with `escapeHTML`; other values fixed numbers/enums | **Likely, Low**: escaping is present at reviewed interpolation points; page is experimental. |
| `js/monitor-lab.js:488` | Fixed empty-state markup | Static template | **Certain, Info**. |
| `js/changelog.js:54,56` | Localized changelog strings into HTML | Static repository translations | **Likely, Low**: values come from bundled locale files, not a remote source. |
| `js/helpers/gsUtils.js:426` | Localized `data-i18n` content | Static repository translations | **Likely, Low**: repository-owned locale strings; the helper intentionally supports markup. |
| `js/suspended.js:24,87` | Clone fixed templates | Static template cloning | **Certain, Info**: no dynamic HTML string is inserted at these sites. |
| `scripts/memlab/dashboard.html:298,313,353,378,394,407,428,451,509,532` | Local developer dashboard `innerHTML` | Dev-only; interpolated values are escaped at relevant text insertion points or built from fixed/typed data | **Likely, Low**: not included in shipped extension. |

Searches found no shipped `eval(`, `new Function`, string-form timer, `document.write`, `outerHTML`, `insertAdjacentHTML`, `dangerouslySet*`, or literal `javascript:` URL. `new Function` occurs in `tests/monitor-lab.test.mjs:89` only. These are source scans, not runtime proof.

## Network and URL construction

| Location | API / URL | Assessment |
|---|---|---|
| `js/helpers/gsFavicon.js:345` | `fetch(url)` | **Certain**: fetches favicon resources selected from tab/favicon data. Extension-page CSP includes `connect-src 'self' data:`; runtime behavior and CSP enforcement were not tested. |
| `js/helpers/gsUtils.js:399` | `fetch(chrome.runtime.getURL(...))` | **Certain**: reads the extension's bundled locale JSON. |
| `js/helpers/dom-to-image.js:480-486` | `XMLHttpRequest` | Vendored image/font inliner can request resources referenced by the DOM being captured; see `vendor/README.md`. |
| `js/helpers/html2canvas.min.js:1770-1776,3451-3484,5820-5841,6387` | XHR/fetch resource loading | Vendored renderer has resource-loading paths; observed call sites do not establish a fixed remote endpoint. |
| `scripts/memlab/dashboard.html:252` | `fetch` local dashboard API | Dev-only memory lab server, bound to loopback by its source; not shipped extension code. |
| `scripts/memlab/bench_urls.txt` | Public benchmark URLs | Test inputs only; benchmark was not run. |

No `WebSocket`, `EventSource`, or `sendBeacon` call was found in project JavaScript/HTML. Remote URLs in source were documentation links or benchmark inputs; the reviewed HTML link paths are click-driven. `chrome.tabs.create` sites mostly open extension pages or Chrome settings; `js/recovery.js:153` opens imported session URLs. Imported URL parsing checks for `://` but does not enforce an allowed scheme, so scheme validation remains an audit finding.

## Message handlers

| Listener | Accepted actions / source | Sender validation | Effects |
|---|---|---|---|
| `js/tgs.js:1617` runtime `onMessage` | Internal function-dispatch requests, plus content-script `reportTabState` and `savePreviewData` | **No general sender-origin validation**; branches validate selected fields only | Tab state changes, suspend/unsuspend, preview persistence, settings/session operations, status/debug responses. Content-script-originated values must be treated as hostile. |
| `js/tgs.js:1761` `onMessageExternal` | `suspend`, `unsuspend`; optional numeric `tabId`, otherwise active tab | No `sender.id` allowlist | Another extension can request suspension/restoration. Does not return tab URL or session contents. |
| `js/contentscript.js:41` runtime listener | Extension-to-content actions: request info/battery/scroll; ignore forms; temporary whitelist | Runtime extension messaging only; no page `window` bridge | Reads page state and sends limited reports to extension. |
| `js/suspended.js:154` runtime listener | `ping`, unsuspend, session id, title/URL/reason/theme/preview/scroll/command updates, localization and visibility | No sender check | Mutates the extension suspended page; several fields feed HTML sinks listed above. |
| `js/offscreen.js:3` runtime listener | `tgs-download` with `content` and `filename` | No sender check | Creates a text Blob and triggers anchor download. Expected caller is the extension service worker backup feature. |
| `js/options.js:310` and `js/recovery.js:174` | `initSettings`, `removeTabFromList` | No explicit sender check | Initializes options / updates recovery UI. |
| `js/updated.js:10` | Sends `updateData` to the worker; not itself a receiver | N/A | Internal update flow. |

No `onConnect*` or page `postMessage` bridge was found in shipped source. Content-script messages are not equivalent to an exposed page bridge, but a compromised page may influence the content script's observed DOM and messages.

## Checks run

- `rg` scans over shipped JS/HTML and scripts for dangerous sinks, network APIs, message listeners, storage APIs, permission APIs, and URL creation.
- Read results and relevant surrounding source manually; classified each dynamic HTML sink above.
- No extension-loading test or project test suite was run in this phase.
