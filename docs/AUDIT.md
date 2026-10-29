# Security and Privacy Audit (Phase 1)

**Audit date:** 2026-10-27
**Branch:** `phase-1-audit`
**Scope:** current Phase 0 source snapshot; static review only. Phase 1 changes documentation only.
**Confidence:** **Certain** means directly confirmed in source or authoritative documentation; **Likely** means a strong source-based deduction; **Guess** means browser/runtime behavior remains unverified.

## Severity rubric

- **Critical:** practical unauthenticated compromise of privileged extension control or broad sensitive-data exposure.
- **High:** substantial sensitive-data exposure or privileged impact with a plausible, low-prerequisite path.
- **Medium:** bounded security/privacy impact, or meaningful impact requiring user action or another extension.
- **Low:** limited impact, constrained input, or a weakly reachable issue with no demonstrated sensitive-data effect.
- **Info:** hardening or documentation gap without an established direct security impact.

Severity describes the evidenced impact and reachable path. **Certain/Likely/Guess** describes confidence, not severity.

## Executive summary

The extension is local-first by design and the manifest has no update URL. The audit did not find a fixed remote telemetry endpoint or remote code loader in shipped first-party source. Open findings include data-driven HTML sinks, persistent full-URL storage, and overly broad web-accessible resources. Phase 2/3 fixes and accepted v0.2.0 risks are tracked in the ledger alongside completed Phase 0 fixes.

The owner-provided roadmap has a measured Phase 9 baseline that changes the later work inventory. A key mismatch is task 9.14: `gsBackup.js` already uses “The Great Tab Killer” in its backup header and filename, so the rename was completed in Phase 0. Task 3.10 now makes backup opt-in, skips incognito tabs, and documents its Downloads output; enabled backup files still accumulate under user-managed Downloads retention, and raw backup debug logs remain outstanding.

The strict service-worker module-graph guard findings are individually classified with source evidence and actions in [docs/audit/SW_GRAPH_REVIEW.md](audit/SW_GRAPH_REVIEW.md). The scanner exits non-zero on unresolved hits; no exceptions have been added to an allowlist.

## Owner decisions recorded after the initial audit

These are approved design directions. Source status is recorded per finding below; Gate A approval is historical and does not authorize later phases.

- Session backup default is OFF; a one-time local notice will explain the plain-text Downloads file and offer controls to enable it and select a frequency. Incognito tabs must be skipped.
- Drop inherited old-project data-format migrations; initialize new storage at an explicit schema version and version future changes from this project.
- Retain `migrateForeignSuspendedTabs()` as a redesigned, user-confirmed conversion flow with strict URL validation, preview, same-tab conversion, count-only logs, hostile-hash tests, and install guidance.
- Settings sync is opt-in and OFF by default, with a privacy note in Options and `PRIVACY.md`.
- Brave is the primary browser. The two-folder extension-ID check remains open for manual verification via `brave://extensions`.
- The logo/icon work is committed separately on `phase-0-legal-branding` as `ee1b2e9`; that branch is not merged. The owner-provided logo license remains unconfirmed.

## Findings and per-finding detail

| ID | Severity | Confidence | Location | Finding | Recommendation | Status |
|---|---|---|---|---|---|---|
| A-01 | Medium | Certain | `js/suspended.js` (`setTitle` handler and fragment-title fallback) | Untrusted tab titles now use `textContent` for the document title and visible title. | Keep text-only rendering; Chrome 156 smoke verified a hostile `<img...>` title remains text with no injected element. | Fixed in source (`ce1a120`) |
| A-02 | Medium | Likely | `js/suspended.js` (`setUrl` handler) | The original URL is displayed with `textContent`; `href` is assigned only after the shared URL policy accepts it. | Keep the HTTP(S)/file policy and text rendering. | Fixed in source (`ce1a120`) |
| A-03 | Low | Likely | `js/suspended.js` (`setReason` handler) | Message reason is rendered with `textContent`; non-string values become empty text. | Keep text-only rendering. | Fixed in source (`ce1a120`) |
| A-04 | Medium | Certain | `js/historyItems.js` (`createSessionHtml`, `createEl`) | Saved session title and generated text nodes use DOM text, not HTML parsing. | Keep text-only rendering for session names. | Fixed in source (`ce1a120`) |
| A-05 | Low | Certain | `js/tgs.js` (Phase 2 task 2.11) | The external `suspend`/`unsuspend` listener and handler were removed; no current source `onMessageExternal` listener remains. | Keep a regression check that external messaging stays absent. | Fixed in source (Phase 2, `34dc4b8`) |
| A-06 | Low | Likely | `js/tgs.js:1617-1758` | Internal runtime dispatcher has no universal sender validation. A `reportTabState` message can change the sender tab's `autoDiscardable` state; `savePreviewData` can store preview data. No direct page-to-extension message bridge was found. | Validate sender context, tab association, schema and per-action authority; retain the tab-local effect as bounded. | Open |
| A-07 | Medium | Likely | `js/helpers/safeNavigationUrl.js`; `js/helpers/gsUtils.js`; `js/suspended.js`; `js/tgs.js` | New fragments independently encode title, position, and URL; the parser keeps legacy raw fragments readable and accepts only HTTP(S)/file URLs before restore. WAR was removed and external framing was blocked in Chrome 156 (`6d84040`). | Keep encoding and allowlist tests. | Fixed in source (`ce1a120`) |
| A-08 | Medium | Likely | `js/serviceWorker.js:128-167` | Foreign suspended-tab migration trusts hash fields from tabs belonging to other extensions; URL/scheme validation is incomplete. | Retain only with the owner-approved manual/confirmed flow, strict scheme checks, safe preview, same-tab conversion, count-only logs, tests and install guidance. | Open |
| A-09 | High | Certain | `js/helpers/gsMemorySampler.js:154,418-428` | Background sampler previously queried tabs without a `tab.incognito` exclusion and wrote full URL-keyed estimates to `storage.local`. | Keep sampler exclusion for incognito; URL-key retention is tracked under A-10. | Fixed in source (task 3.10) |
| A-10 | Medium | Certain | `js/helpers/gsMemorySampler.js:18-24,345-371` | Cache retains full URLs for up to 800 entries; seven-day expiry runs only when cache is updated. No dedicated user wipe was found. Medium because the exposure is bounded to a local cache with an eventual age cleanup, though stale records may persist. | Use hostname/hash, shorter TTL and a user-visible clear path. | Accepted risk for v0.1.0 (owner-approved), planned v0.2.0 |
| A-11 | High | Certain | `js/helpers/gsStorage.js`; `js/serviceWorker.js`; `js/helpers/gsBackup.js` | Backups can write a durable plain-text copy of open regular-tab URLs to Downloads. They now require explicit opt-in and exclude incognito tabs; saved files remain user-managed outside extension storage. | Keep the opt-in notice and document local Downloads-file retention. | Mitigated in source (task 3.10); downloaded files remain user-managed |
| A-12 | Low | Certain | `js/helpers/gsBackup.js:54-75` | Backup path logs each step and logs error stack to console. | Remove raw step logs; keep carefully bounded error reporting. | Open |
| A-13 | High | Certain | `js/helpers/gsIndexedDb.js:8-15,87-105` | `gsPreviews` stores full page URL and captured image data. It is capped at 1000 entries with no TTL. High because page content images plus URLs persist indefinitely until count trimming, a greater sensitivity and retention exposure than A-10's URL-only cache. | Provide explicit preview deletion and include it in global wipe/privacy registry. | Accepted risk for v0.1.0 (owner-approved), planned v0.2.0 |
| A-14 | Medium | Certain | `js/helpers/gsIndexedDb.js:391-423,453-503` | `clearGsDatabase()` does not clear preview, favicon or suspended-tab stores; trimming is count-based, not time-based. Medium because the incomplete wipe leaves local records behind but does not itself transmit them. | Ensure global clear covers every store and disclose retention. | Accepted risk for v0.1.0 (owner-approved), planned v0.2.0 |
| A-15 | Medium | Certain | `js/helpers/gsIndexedDb.js:44-62,453-489` | Suspended-tab metadata and favicon cache retain full URLs and image data, with count limits and no fixed TTL. Medium because it is persistent local metadata with bounded counts, but no age-based expiry. | Document, minimize and provide deletion/retention controls. | Accepted risk for v0.1.0 (owner-approved), planned v0.2.0 |
| A-16 | Medium | Certain | `js/helpers/safeNavigationUrl.js`; `js/historyUtils.js`; `js/historyItems.js`; `js/recovery.js`; `js/helpers/gsSession.js` | Imported lines are parsed with the shared URL policy; invalid lines are skipped and counted. Recovery, session restore, and history links validate before opening or linking. | Keep the shared policy at every session restore/open path; file URLs remain allowed. | Fixed in source (`ce1a120`) |
| A-17 | Low | Certain | `js/helpers/gsIndexedDb.js`; `js/helpers/gsChrome.js`; `manifest.json` | The inherited cookie migration and wrappers are removed, and Gate B removed the now-unused `cookies` permission. | Keep cookie access absent; the source guard covers forbidden permission regressions. | Fixed in source (Phase 3, `6d75469`) |
| A-18 | — | — | — | No A-18 finding text or evidence exists in the current audit history; the identifier was skipped during editing. It is explicitly reserved here rather than assigned an unsupported issue. | No action; do not infer a vulnerability from the numbering gap. | N/A |
| A-19 | Info | Certain | `html/notice.html`, `js/notice.js`, `js/tgs.js`, `js/helpers/gsStorage.js` (Phase 2 task 2.1) | The dormant notice page, message path, storage and scheduling code were removed after the evidence search found no assignment to `_noticeToDisplay`. | Keep the retired notice path absent. | Fixed in source (Phase 2, `d04aaa1`) |
| A-20 | Medium | Certain | `js/helpers/html2canvas.min.js:1770-1776,3451-3484,5820-5841`; `js/helpers/gsTabSuspendManager.js:514-523,579-594` | Vendored html2canvas contains resource-loading code; its byte mismatch is explained by formatting/minification, with identical Terser-normalized output. `db.js` provenance remains unestablished. html2canvas is injected into the target page's isolated content-script context for preview capture when that option is selected. | Preserve provenance comparison, pin hashes, and test capture with network blocked. | Open |
| A-21 | Medium | Certain | `js/tgs.js:97` | `window.setTimeout` occurred on a service-worker retry path where `window` is unavailable. | Use worker-global `setTimeout` and retain a static regression check. | Fixed in source (A-21 follow-up) |
| A-22 | Medium | Likely | `js/tgs.js:551-580,1898-1915`; `js/helpers/gsTabQueue.js:178-302` | Per-tab `chrome.alarms` already preserve suspension deadlines. Queue/in-flight state and some per-tab in-memory metadata do not survive worker termination; startup reconciliation may be inconsistent. | Keep per-tab suspension alarms; make queue/in-flight state durable and reconcile existing alarms on startup. | Accepted risk for v0.1.0 (owner-approved), planned v0.2.0 |
| A-23 | Medium | Certain | `js/helpers/gsStorage.js:79-95,286-302`; `html/options.html` | Settings sync previously defaulted ON and wrote option values to `chrome.storage.sync`; it now defaults OFF and Options discloses the browser-profile storage behavior. | Keep sync opt-in and disclose it in `PRIVACY.md`. | Fixed in source (task 3.10) |
| A-24 | Low | Certain | `js/helpers/gsSession.js`; `js/helpers/gsIndexedDb.js`; `js/helpers/gsStorage.js` | Inherited saved-session and settings compatibility conversions were removed; new storage initializes at explicit schema version 1. Cookie migration is recorded separately in A-17. | Keep future conversions explicit and versioned from the project schema. | Fixed in source (Phase 2, `3c4b6dc`) |
| A-25 | Medium | Likely | `manifest.json` (WAR absent); `js/helpers/gsMessages.js:143-157`; `js/helpers/gsTabSuspendManager.js:514-523` | Removed all WAR entries in `6d84040`. No web-page consumer exists: internal extension pages load their own images/scripts; `tabs.update` opens the extension page internally; `chrome.scripting.executeScript({files})` is extension-initiated; `_favicon` is consumed only by extension pages. Chrome 156 probe: web-page fetches and images for suspended.html, an icon, and `_favicon` all failed; iframe navigated to `chrome-error://chromewebdata/`, not the extension page. | Keep WAR absent and retain the guard and web-page smoke probe. | Fixed in source (`6d84040`) |
| A-26 | Low | Certain | `js/monitor.js`; `html/monitor.html`; `manifest.json` | Phase 2 removed the monitor UI and all `chrome.management` calls; Gate B removed the unused optional `management` permission. | Keep management API use and permission absent. | Fixed in source (Phase 3, `6d75469`) |
| A-27 | Low | Certain | `js/helpers/gsSession.js` (current source); `CHANGELOG.md:16` | Fixed in Phase 0: the third-party uninstall survey URL was removed; no `setUninstallURL` call remains in the source. | Retain a guard against external uninstall destinations. | Fixed |
| A-28 | Info | Certain | `js/helpers/gsBackup.js:32-51` | Fixed in Phase 0: backup labels no longer use the inherited product name. Task 3.10 separately made backup opt-in and added local disclosure. | Keep naming and backup privacy controls as distinct ledger changes. | Fixed |

### CSP and browser-verification limits for HTML/URL findings

The manifest extension-page CSP is `script-src 'self'; ... img-src 'self' data: chrome:; style-src 'self' 'unsafe-inline'`. **Certain from policy:** inline scripts, inline event handlers and `javascript:` script execution are disallowed by `script-src 'self'`; inline styles and `data:`/`chrome:` images are allowed by the respective directives. CSP does not make unsafe HTML construction safe, and it does not validate navigation targets. **Unverified:** no real-browser test exercised these sinks, CSP violations, navigation, or framing.

Policy semantics are corroborated by Chrome's [extension CSP documentation](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy). Chrome's [WAR documentation](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources) says web-accessible resources are available to matching web pages and can create fingerprinting/XSS exposure; it also says content scripts do not need WAR. Its [scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting) documents extension-initiated file injection, which is how the preview renderer is loaded.

| Finding | Current source effect | Unverified in browser |
|---|---|---|
| A-01 | Title is assigned with `textContent`; the hostile-title smoke probe found no injected element. | Other browser versions and UI rendering differences. |
| A-02 | Link text is text-only and `href` is set only for HTTP(S)/file. | Browser-specific navigation behavior for permitted file URLs. |
| A-03 | Message reason is text-only. | Whether an external actor can reach the internal message path; no source indicates such a caller. |
| A-04 | Saved session title/counts are constructed as text nodes. | Other browser versions; the Chrome 156 hostile title probe covered the suspended-page title, not every history UI layout. |
| A-07 | Fragment fields are independently encoded; every restored URL is checked by the shared policy. | The Chrome WAR probe confirmed the external iframe resolved to `chrome-error://chromewebdata/`; Chrome smoke covered a hostile title fragment. Other browser behavior remains unverified. |
| A-16 | Imports, recovery, links, and session restoration reject unsupported schemes; the mixed-line parser test verifies skipped-line counts. | Interactive import/recovery UI was not driven in the Chrome smoke test. |

### WAR and optional management verification

**Certain:** `tabs.update` to an extension URL does not consume a web-accessible resource; `chrome.scripting.executeScript({files:[...]})` is initiated by the extension and is not a page fetch. Internal pages load their own image and JS resources. The `_favicon` URLs are built with `chrome.runtime.getURL()` in extension contexts (`gsFavicon.js`, monitor page, and monitor lab); no cross-extension consumer was found. WAR was removed in `6d84040`.

**Verified in Chrome 156:** a local web page tried `fetch()`, `<img>`, and `<iframe>` requests for `html/suspended.html`, `images/icon-16x16.png`, and `/_favicon/`. Fetch/image loads failed; the iframe resolved to `chrome-error://chromewebdata/`, and did not load the extension document. The same clean-profile run confirmed the extension's welcome/setup pages, hostile fragment handling, and five-tab suspend/restore flow still worked. Extension errors: none. Brave was not tested independently.

### Fixed in Phase 0 ledger

Rows A-27 and A-28 record completed Phase 0 removal/rename work as **Fixed** so the audit ledger distinguishes resolved issues from open source findings. The backup's data collection/default and incognito behavior remain Open under A-11.

### Corrections to the roadmap

The earlier Phase 4 proposal to replace per-tab suspension alarms with a recurring timer was incorrect: source already schedules `chrome.alarms` per tab. Keep those deadlines; Phase 4 should make queue/in-flight state durable and reconcile alarms at startup (A-22).

### html2canvas same-version comparison

**Certain:** installed Terser 5.39.0 transiently via `npx` (no repository dependency or source change) and minified both the checked-in file and official npm `1.0.0-alpha.10` artifact with the same options. The normalized outputs have identical SHA-256 `9d948037534f3f5a78453d385bd54d6a487e61ecdd9d56f461d89b55ff6d1eb6`; the observed byte delta is formatting/minification only, with no token delta in this comparison. Thus no delta touches network, storage, or messaging. Both versions contain XHR/fetch resource-loading paths; no storage or extension messaging APIs were found in the compared html2canvas code. **Not verified:** runtime equivalence, browser capture behavior, and resource requests during real capture. The library is injected with `chrome.scripting.executeScript` into the target web page's isolated content-script world when preview capture is enabled; it is not injected into extension pages.

Detailed static classifications, permission/storage inventory and threat model are in [`docs/audit/STATIC_SCANS.md`](audit/STATIC_SCANS.md), [`docs/audit/PERMISSIONS_STORAGE.md`](audit/PERMISSIONS_STORAGE.md), and [`docs/audit/THREAT_MODEL.md`](audit/THREAT_MODEL.md). Vendor review is in [`vendor/README.md`](../vendor/README.md).

### Runtime error follow-up (phase-3-hardening)

- **`tabProperties.url not set` — inherited guard, likely inter-suspender race trigger. (Certain source evidence; exact owner event unverified.)** `addSuspendedTabInfo()` logs and returns when `tab.url` is empty; it does not throw. Upstream ZIP code has the same check and the same `performSuspension()` → `saveSuspendData()` call. `gsUtils.isSpecialTab()` deliberately treats suspended-like URLs as non-special, while strict matching recognizes only this extension's own page, so another suspender's replacement can enter this path. Suspension now re-fetches the tab before saving and rejects missing, changed, or non-http(s)/file URLs. The owner profile's exact event cannot be established without its tab/API snapshot.
- **`Failed to fetch` — inherited rejection-handling defect, not a Phase 2/3 fetch addition. (Certain source comparison; event origin unverified.)** The upstream ZIP already has the same favicon fetch and nested promise chain, then accepting remote `tab.favIconUrl` values. Commits `ccb4fbe` and `f688080` restricted the source to the browser favicon cache/extension origin; they did not introduce fetching. The chain did not propagate fetch/image-bitmap rejection to its caller. It now returns nested promises and forwards rejection, and a test exercises a failed local favicon fetch. The reported stack was unavailable, so another fetch site cannot be excluded.
- **`Failed to parse gsExtensionRecovery` — inherited malformed-storage condition, not caused by schema versioning. (Certain.)** The recovery key parser and timestamp writer are unchanged in the upstream ZIP; Phase 2's schema change did not modify them. The log means the stored value was not valid JSON; the source cannot identify how it got there. Parse/read failures now return `undefined` without an unhandled rejection or overwriting the value; tests cover malformed and unreadable storage.

## Task 1.5: explicit answers

1. **What does `externalMessageRequestListener` accept? Can another extension suspend/unsuspend tabs, read tab URLs, or read session data through it?** **Certain:** accepts `action: "suspend"` or `"unsuspend"`; optional numeric `tabId`, otherwise targets the active tab (`js/tgs.js:1761-1813`). Another extension can request those actions. The handler returns status/error strings but does not expose tab URLs or session data.
2. **Can a crafted suspended URL cause script execution or navigation to `javascript:`/`data:`/`chrome://` targets?** **Certain:** URL hash fields are concatenated/read without a universal scheme allowlist; `title`, `url`, and `reason` reach HTML sinks. **Likely:** hostile markup can reach extension-origin HTML parsing. **Guess:** whether script executes or Chrome permits each special-scheme navigation was not verified in a browser. No such execution is claimed.
3. **Which timers drive suspension? Do they survive service-worker termination?** **Certain:** each tab gets a `chrome.alarms` deadline (`tgs.js:580`) handled by `onAlarm` (`1898-1915`), which Chrome persists beyond worker lifetime. `GsTabQueue` and debounce/focus timers use in-memory `setTimeout` (`gsTabQueue.js:178-302`, `tgs.js:551,1076-1087`). **Likely:** alarms can fire after worker wake, but queue state/cleanup and early-start initialization are not durable; no restart test was run. The invalid `window.setTimeout` retry was replaced with worker-global `setTimeout` under A-21.
4. **Does anything write full URLs to storage? Where, how long, can the user wipe it?** **Certain:** yes: monitor cache (`storage.local`, up to 800 entries, age >7 days removed on later update); IndexedDB previews, suspended metadata, favicons and sessions; `gsSettings` whitelist/config; browser history suspended URL fragments; Downloads `.txt` backups. Preview count cap is 1000 without TTL. `clearGsDatabase()` misses preview/favicon/suspended-info stores. There is no verified single user wipe of all these data. See storage map.
5. **Does sampler inject into incognito tabs? What is stored from incognito?** **Certain from current source:** sampler measurement, backup, preview persistence, and saved session construction now exclude tabs marked `incognito`. **Not verified:** Brave/Chrome runtime behavior or storage isolation, because no browser test was run.
6. **What happens to screenshots/previews (IndexedDB) — retention and deletion?** **Certain:** `tgs.gsPreviews` stores original URL plus image data URL, trims oldest IDs above 1000, has no TTL, and is not cleared by `clearGsDatabase()`. No complete preview wipe path was verified.
7. **Is `migrateForeignSuspendedTabs()` safe?** **Likely: no, not sufficiently validated.** Startup migration reads `ttl`, `pos`, and `uri` from another extension's URL hash; it checks basic presence but does not establish a safe target scheme. The owner has decided to retain and redesign this path under task 2.7, including confirmation and strict validation. Static review only; no crafted-tab runtime test.
8. **What exactly does `contentscript.js` expose to the page?** **Certain:** no page `window` bridge, `postMessage` listener, injected global API, or page-callable callback was found. It observes page state and exchanges messages through the extension runtime in the isolated content-script context. Page DOM can still influence data it observes.

## What was read and not read

**Read in full for task 1.1:** `manifest.json`; `js/serviceWorker.js`; `js/tgs.js`; all non-vendored `js/helpers/*.js` (including `gsMemorySampler.js`); `js/contentscript.js`; `js/suspended.js`; `js/popup.js`; `js/options.js`; all `js/history*.js`; `js/recovery.js`; `js/update.js`; `js/updated.js`; `js/changelog.js`; `js/monitor.js`; `js/monitor-lab.js`; every `html/*.html`; every file under `scripts/**`; every file under `tests/**`.

**Not read line-by-line:** the three vendored library bodies. They were scanned for the listed dynamic execution/network APIs and reviewed at headers/relevant call sites for task 1.4. No runtime execution/browser tests or extension load were performed. The owner-supplied logo was visually reviewed and its dimensions/transparency inspected; its license is unconfirmed. Generated icons on the separate Phase 0 branch were checked for PNG metadata chunks.

## Verification limits

- **Environment:** Node `v22.23.1`, Python `3.14.8`, Google Chrome Stable `156.0.8078.47` is installed. No Chromium or Chrome for Testing executable was found on `PATH`.
- **Automated tests:** not run; Phase 1 is audit/documentation only. The repository's tests are Node UI tests, not extension-load tests.
- **Extension loading:** not run. If later required, prefer Chromium or Chrome for Testing with extension support. Branded Chrome's `--load-extension` path may be ignored; the existing CDP harness describes `Extensions.loadUnpacked`, but it was not executed. No claim is made that Chrome loaded the extension.
- **Network-dependent vendor verification:** official npm artifacts for the named html2canvas/dom-to-image versions were compared. With Terser 5.39.0 and identical compression/mangling options, html2canvas produces identical normalized output (SHA-256 `9d948037534f3f5a78453d385bd54d6a487e61ecdd9d56f461d89b55ff6d1eb6`); runtime equivalence remains unverified. The dom-to-image diff matches the two local patches. `db.js` provenance remains UNVERIFIED.
- **No source changes, tests, or browser checks were made on `phase-1-audit`.** The separate Phase 0 logo commit is not merged.
