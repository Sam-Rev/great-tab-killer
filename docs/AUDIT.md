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

The extension is local-first by design and the manifest has no update URL. The audit did not find a fixed remote telemetry endpoint or remote code loader in shipped first-party source. It did find several data-driven HTML sinks, persistent full-URL storage, a sampler and backup path without explicit incognito exclusion, a broad external-message action surface, and overly broad web-accessible resources. Open findings remain unchanged in source during this documentation-only phase; the ledger also records completed Phase 0 fixes.

The owner-provided roadmap has a measured Phase 9 baseline that changes the later work inventory. A key mismatch is task 9.14: the current `gsBackup.js` already uses “The Great Tab Killer” in its backup header and filename, so that rename item was completed in Phase 0. Its weekly default, missing incognito exclusion, accumulating Downloads files, missing privacy/UI disclosure and raw logs remain outstanding.

## Owner decisions recorded after the initial audit

These are approved design directions, not implemented source changes and not Gate A approval. The source findings below remain open until implementation and verification.

- Session backup default is OFF; a one-time local notice will explain the plain-text Downloads file and offer controls to enable it and select a frequency. Incognito tabs must be skipped.
- Drop inherited old-project data-format migrations; initialize new storage at an explicit schema version and version future changes from this project.
- Retain `migrateForeignSuspendedTabs()` as a redesigned, user-confirmed conversion flow with strict URL validation, preview, same-tab conversion, count-only logs, hostile-hash tests, and install guidance.
- Settings sync is opt-in and OFF by default, with a privacy note in Options and `PRIVACY.md`.
- Brave is the primary browser. The two-folder extension-ID check remains open for manual verification via `brave://extensions`.
- The logo/icon work is committed separately on `phase-0-legal-branding` as `ee1b2e9`; that branch is not merged. The owner-provided logo license remains unconfirmed.

## Findings and per-finding detail

| ID | Severity | Confidence | Location | Finding | Recommendation | Status |
|---|---|---|---|---|---|---|
| A-01 | Medium | Certain | `js/suspended.js:194-198` | Web-controlled tab title is inserted with `innerHTML` in the extension suspended page. | Replace with `textContent`/safe DOM construction; add hostile-title test. | Open |
| A-02 | Medium | Likely | `js/suspended.js:256-259` | Original URL is parsed into HTML and assigned directly to `href`; no scheme allowlist at this sink. | Display as text, validate with `URL`, restrict schemes and ensure link intent. | Open |
| A-03 | Low | Likely | `js/suspended.js:285-295` | `request.reason` is inserted as HTML. Current callers appear internal, but receiver does not validate the message source/value. | Restrict reason enum and use safe rendering. | Open |
| A-04 | Medium | Certain | `js/historyItems.js:63-66` | Saved session title is rendered as HTML; imported/user-defined names can be attacker-controlled. | Render the title via `textContent`; test hostile names. | Open |
| A-05 | Low | Certain | `js/tgs.js` (Phase 2 task 2.11) | The external `suspend`/`unsuspend` listener and handler were removed; no current source `onMessageExternal` listener remains. | Keep a regression check that external messaging stays absent. | Fixed |
| A-06 | Low | Likely | `js/tgs.js:1617-1758` | Internal runtime dispatcher has no universal sender validation. A `reportTabState` message can change the sender tab's `autoDiscardable` state; `savePreviewData` can store preview data. No direct page-to-extension message bridge was found. | Validate sender context, tab association, schema and per-action authority; retain the tab-local effect as bounded. | Open |
| A-07 | Medium | Likely | `js/helpers/gsUtils.js:464-477`; `js/suspended.js:110-125,256-265` | Suspended URL fragment concatenates raw original URL and restores it without a universal scheme check. The current WAR declaration may allow web framing (A-25; browser behavior unverified). | Encode/decode parameters independently, parse `URL`, allow only `http:`, `https:` and owner-approved `file:`. | Open |
| A-08 | Medium | Likely | `js/serviceWorker.js:128-167` | Foreign suspended-tab migration trusts hash fields from tabs belonging to other extensions; URL/scheme validation is incomplete. | Retain only with the owner-approved manual/confirmed flow, strict scheme checks, safe preview, same-tab conversion, count-only logs, tests and install guidance. | Open |
| A-09 | High | Certain | `js/helpers/gsMemorySampler.js:154,418-428` | Background sampler queries tabs and injects into measurable pages; no `tab.incognito` exclusion. It writes full URL-keyed estimates to `storage.local`. High because sensitive browsing identifiers can be persisted from incognito contexts as well as regular tabs. | Disable by default, exclude incognito, minimize key data, add explicit wipe. | Open |
| A-10 | Medium | Certain | `js/helpers/gsMemorySampler.js:18-24,345-371` | Cache retains full URLs for up to 800 entries; seven-day expiry runs only when cache is updated. No dedicated user wipe was found. Medium because the exposure is bounded to a local cache with an eventual age cleanup, though stale records may persist. | Use hostname/hash, shorter TTL and a user-visible clear path. | Open |
| A-11 | High | Certain | `js/helpers/gsBackup.js:13-22,31-52,79-102` | Periodic plain-text Downloads backup includes every queried tab URL; default frequency is weekly; no incognito filter or cleanup. The filename/header are already rebranded. High because a durable plain-text copy is written outside extension storage without a retention limit. | Implement the approved OFF default, one-time local notice with enable/frequency controls, incognito exclusion, retention disclosure and privacy registry entry. | Open |
| A-12 | Low | Certain | `js/helpers/gsBackup.js:54-75` | Backup path logs each step and logs error stack to console. | Remove raw step logs; keep carefully bounded error reporting. | Open |
| A-13 | High | Certain | `js/helpers/gsIndexedDb.js:8-15,87-105` | `gsPreviews` stores full page URL and captured image data. It is capped at 1000 entries with no TTL. High because page content images plus URLs persist indefinitely until count trimming, a greater sensitivity and retention exposure than A-10's URL-only cache. | Provide explicit preview deletion and include it in global wipe/privacy registry. | Open |
| A-14 | Medium | Certain | `js/helpers/gsIndexedDb.js:391-423,453-503` | `clearGsDatabase()` does not clear preview, favicon or suspended-tab stores; trimming is count-based, not time-based. Medium because the incomplete wipe leaves local records behind but does not itself transmit them. | Ensure global clear covers every store and disclose retention. | Open |
| A-15 | Medium | Certain | `js/helpers/gsIndexedDb.js:44-62,453-489` | Suspended-tab metadata and favicon cache retain full URLs and image data, with count limits and no fixed TTL. Medium because it is persistent local metadata with bounded counts, but no age-based expiry. | Document, minimize and provide deletion/retention controls. | Open |
| A-16 | Medium | Certain | `js/historyUtils.js:69-86`; `js/recovery.js:153` | Imported session URL parsing accepts any line containing `://`, then recovery opens the stored URL without a strict scheme allowlist. | Validate URL syntax and allow only intended schemes. | Open |
| A-17 | Low | Certain | `js/helpers/gsIndexedDb.js` (Phase 2 task 2.2); `js/helpers/gsChrome.js` | The inherited cookie migration and helper wrappers have been removed; the `cookies` permission remains in the manifest until Gate B/Phase 3. | Remove the now-unused permission at Gate B. | Fixed |
| A-18 | — | — | — | No A-18 finding text or evidence exists in the current audit history; the identifier was skipped during editing. It is explicitly reserved here rather than assigned an unsupported issue. | No action; do not infer a vulnerability from the numbering gap. | N/A |
| A-19 | Info | Certain | `html/notice.html`, `js/notice.js`, `js/tgs.js`, `js/helpers/gsStorage.js` (Phase 2 task 2.1) | The dormant notice page, message path, storage and scheduling code were removed after the evidence search found no assignment to `_noticeToDisplay`. | Keep the retired notice path absent. | Fixed |
| A-20 | Medium | Certain | `js/helpers/html2canvas.min.js:1770-1776,3451-3484,5820-5841`; `js/helpers/gsTabSuspendManager.js:514-523,579-594` | Vendored html2canvas contains resource-loading code; its byte mismatch is explained by formatting/minification, with identical Terser-normalized output. `db.js` provenance remains unestablished. html2canvas is injected into the target page's isolated content-script context for preview capture when that option is selected. | Preserve provenance comparison, pin hashes, and test capture with network blocked. | Open |
| A-21 | Medium | Certain | `js/tgs.js:97` | `window.setTimeout` occurs on a service-worker code path where `window` is unavailable. | Replace with worker-compatible timer/alarm and add startup-path verification. | Open |
| A-22 | Medium | Likely | `js/tgs.js:551-580,1898-1915`; `js/helpers/gsTabQueue.js:178-302` | Per-tab `chrome.alarms` already preserve suspension deadlines. Queue/in-flight state and some per-tab in-memory metadata do not survive worker termination; startup reconciliation may be inconsistent. | Keep per-tab suspension alarms; make queue/in-flight state durable and reconcile existing alarms on startup. | Open |
| A-23 | Medium | Certain | `js/helpers/gsStorage.js:59,79-95,299-302` | Settings sync currently defaults ON (`gsSyncSettings = true`) and writes option values to `chrome.storage.sync`; Chrome may sync those values to the user's account. | Make sync opt-in and OFF by default; add the Options privacy note and document browser sync behavior in `PRIVACY.md`. | Open |
| A-24 | Low | Certain | `js/helpers/gsSession.js`; `js/helpers/gsIndexedDb.js`; `js/helpers/gsStorage.js` | Inherited saved-session and settings compatibility conversions have been removed; new storage initializes at explicit schema version 1. Cookie migration is recorded separately in A-17. | Keep future conversions explicit and versioned from the project schema. | Fixed |
| A-25 | Medium | Likely | `manifest.json:49-70`; `js/helpers/gsMessages.js:143-157`; `js/helpers/gsTabSuspendManager.js:514-523` | WAR exposes `html/suspended.html`, `/images/*`, and `js/*.js` resources to all web origins; `_favicon/*` is exposed to every extension ID. Sites can probe known resource URLs to fingerprint extension installation; suspended.html is likely frameable with attacker-crafted hash input, which would make A-02/A-07 website-reachable. | Remove WAR entries not needed by internal extension pages, `tabs.update`, or `scripting.executeScript`; narrow any proven external need. Probe from a web origin and extension, test framing/hostile hashes, and confirm suspension/capture/favicon still work. | Open |
| A-26 | Low | Certain | `manifest.json:45-48` | Phase 2 removed the monitor UI and all `chrome.management` calls. The unused optional `management` permission remains in the manifest until Gate B/Phase 3. Low because it is optional and no current source requests or uses it; remove it before release. | Remove the optional permission at Gate B/Phase 3. | Open |
| A-27 | Low | Certain | `js/helpers/gsSession.js` (current source); `CHANGELOG.md:16` | Fixed in Phase 0: the third-party uninstall survey URL was removed; no `setUninstallURL` call remains in the source. | Retain a guard against external uninstall destinations. | Fixed |
| A-28 | Info | Certain | `js/helpers/gsBackup.js:32-51` | Fixed in Phase 0: backup labels no longer use the inherited product name. The backup still writes URL-bearing text files; its approved default-off redesign remains A-11. | Keep the distinct naming fix separate from the remaining backup privacy work. | Fixed |

### CSP and browser-verification limits for HTML/URL findings

The manifest extension-page CSP is `script-src 'self'; ... img-src 'self' data: chrome:; style-src 'self' 'unsafe-inline'`. **Certain from policy:** inline scripts, inline event handlers and `javascript:` script execution are disallowed by `script-src 'self'`; inline styles and `data:`/`chrome:` images are allowed by the respective directives. CSP does not make unsafe HTML construction safe, and it does not validate navigation targets. **Unverified:** no real-browser test exercised these sinks, CSP violations, navigation, or framing.

Policy semantics are corroborated by Chrome's [extension CSP documentation](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy). Chrome's [WAR documentation](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources) says web-accessible resources are available to matching web pages and can create fingerprinting/XSS exposure; it also says content scripts do not need WAR. Its [scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting) documents extension-initiated file injection, which is how the preview renderer is loaded.

| Finding | Certain source/policy effect | Unverified in browser |
|---|---|---|
| A-01 | Attacker-influenced title reaches `innerHTML`; CSP blocks inline script/event-handler execution in the extension page. HTML/UI mutation remains possible. | Whether a particular payload causes meaningful deception or any browser-specific effect. |
| A-02 | URL text reaches `innerHTML` and `href`; inline script and `javascript:` execution are blocked by extension-page CSP. Other navigations are not scheme-validated here. | Whether target schemes navigate from the link in each supported browser. |
| A-03 | Message reason reaches `innerHTML`; inline script/event handlers are blocked by CSP. | Whether attacker control can reach this message path in a browser; current callers appear internal. |
| A-04 | Saved title reaches `innerHTML`; CSP blocks inline script/event handlers, while HTML can still alter displayed UI. | Practical spoofing/interaction impact for hostile imported titles. |
| A-07 | Raw hash URL is restored with `location.replace`; CSP blocks executing `javascript:` in the extension document, but does not constitute a target-scheme allowlist. A-25 provides a web-page framing path. | Whether Chrome/Brave permits each crafted navigation or frame scenario. |
| A-16 | Recovery calls `tabs.create` with the imported URL; extension-page `script-src` does not constrain navigation performed by the extension API. | Which special schemes `tabs.create` accepts in supported browsers. |

### WAR and optional management verification

**Certain:** `tabs.update` to an extension URL does not consume a web-accessible resource; `chrome.scripting.executeScript({files:[...]})` is initiated by the extension and is not a page fetch. Internal pages load their own `/images/*` and JS resources. The `_favicon` URLs are built with `chrome.runtime.getURL()` in extension contexts (`gsFavicon.js`, monitor page, and monitor lab); no cross-extension consumer was found. Therefore the current broad WAR declarations have no established internal need. The `extension_ids: ["*"]` grants every extension the special favicon resource; no such consumer was found.

**Likely:** a site that knows or discovers the extension ID can probe exposed resources and distinguish installation; WAR makes suspended.html available to web frames, where its hash input is attacker-controlled. **Guess:** actual cross-browser frame behavior and probe observability need browser verification. Test by requesting each listed resource and framing suspended.html from an ordinary web origin with hostile `ttl`/`pos`/`uri`; then verify own extension suspension, script injection, monitor favicon rendering, and capture still work after narrowing/removal. No such browser test was run.

### Fixed in Phase 0 ledger

Rows A-27 and A-28 record completed Phase 0 removal/rename work as **Fixed** so the audit ledger distinguishes resolved issues from open source findings. The backup's data collection/default and incognito behavior remain Open under A-11.

### Corrections to the roadmap

The earlier Phase 4 proposal to replace per-tab suspension alarms with a recurring timer was incorrect: source already schedules `chrome.alarms` per tab. Keep those deadlines; Phase 4 should make queue/in-flight state durable and reconcile alarms at startup (A-22).

### html2canvas same-version comparison

**Certain:** installed Terser 5.39.0 transiently via `npx` (no repository dependency or source change) and minified both the checked-in file and official npm `1.0.0-alpha.10` artifact with the same options. The normalized outputs have identical SHA-256 `9d948037534f3f5a78453d385bd54d6a487e61ecdd9d56f461d89b55ff6d1eb6`; the observed byte delta is formatting/minification only, with no token delta in this comparison. Thus no delta touches network, storage, or messaging. Both versions contain XHR/fetch resource-loading paths; no storage or extension messaging APIs were found in the compared html2canvas code. **Not verified:** runtime equivalence, browser capture behavior, and resource requests during real capture. The library is injected with `chrome.scripting.executeScript` into the target web page's isolated content-script world when preview capture is enabled; it is not injected into extension pages.

Detailed static classifications, permission/storage inventory and threat model are in [`docs/audit/STATIC_SCANS.md`](audit/STATIC_SCANS.md), [`docs/audit/PERMISSIONS_STORAGE.md`](audit/PERMISSIONS_STORAGE.md), and [`docs/audit/THREAT_MODEL.md`](audit/THREAT_MODEL.md). Vendor review is in [`vendor/README.md`](../vendor/README.md).

## Task 1.5: explicit answers

1. **What does `externalMessageRequestListener` accept? Can another extension suspend/unsuspend tabs, read tab URLs, or read session data through it?** **Certain:** accepts `action: "suspend"` or `"unsuspend"`; optional numeric `tabId`, otherwise targets the active tab (`js/tgs.js:1761-1813`). Another extension can request those actions. The handler returns status/error strings but does not expose tab URLs or session data.
2. **Can a crafted suspended URL cause script execution or navigation to `javascript:`/`data:`/`chrome://` targets?** **Certain:** URL hash fields are concatenated/read without a scheme allowlist; `title`, `url`, and `reason` reach HTML sinks. **Likely:** hostile markup can reach extension-origin HTML parsing. **Guess:** whether script executes or Chrome permits each special-scheme navigation was not verified in a browser. No such execution is claimed.
3. **Which timers drive suspension? Do they survive service-worker termination?** **Certain:** each tab gets a `chrome.alarms` deadline (`tgs.js:580`) handled by `onAlarm` (`1898-1915`), which Chrome persists beyond worker lifetime. `GsTabQueue` and debounce/focus timers use in-memory `setTimeout` (`gsTabQueue.js:178-302`, `tgs.js:551,1076-1087`). **Likely:** alarms can fire after worker wake, but queue state/cleanup and early-start initialization are not durable; no restart test was run. The `window.setTimeout` retry at `tgs.js:97` is invalid in a worker context.
4. **Does anything write full URLs to storage? Where, how long, can the user wipe it?** **Certain:** yes: monitor cache (`storage.local`, up to 800 entries, age >7 days removed on later update); IndexedDB previews, suspended metadata, favicons and sessions; `gsSettings` whitelist/config; browser history suspended URL fragments; Downloads `.txt` backups. Preview count cap is 1000 without TTL. `clearGsDatabase()` misses preview/favicon/suspended-info stores. There is no verified single user wipe of all these data. See storage map.
5. **Does sampler inject into incognito tabs? What is stored from incognito?** **Certain:** it queries tabs and does not inspect `tab.incognito`; split mode gives each process its own tab context. Chrome documents that local/sync storage are shared across regular/incognito processes. **Likely:** when the incognito extension context is enabled, it can sample and persist incognito URLs/estimates into shared local storage; backups also have no explicit exclusion. **Not verified:** actual Chrome runtime behavior or exact stored records, because no browser test was run.
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
