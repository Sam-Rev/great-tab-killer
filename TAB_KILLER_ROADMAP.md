# The Great Tab Killer — Project Roadmap

> This file is the single source of truth for the project. It is written to be handed to Codex, Claude Code, or any other agent / developer so work can resume from any point.
> Language of the project: English (code, comments, commits, docs). Owner communicates in Moroccan Darija — answer the owner in Darija, but write everything that goes into the repo in English.

---

## 0. Rules of engagement for the agent

Read this section before touching anything.

1. **Work one phase at a time**, on its own branch (`phase-N-short-name`). Open a PR (or a local merge commit) per phase. Never mix phases.
2. **Never add a permission, a host permission, a network call, a remote script, a new dependency, or a telemetry of any kind without explicit owner approval.** If a task seems to need one, stop and ask.
3. **Verify before claiming.** After each task state clearly: what was done, what was verified (how), what was NOT tested. Never write "works" if it was not run.
4. **No AI-tool attribution anywhere** (owner preference). Do NOT add Claude, Codex, ChatGPT, Copilot, or any other AI tool as contributor/co-author. No `Co-Authored-By:` trailers. No "Generated with ..." lines — not in commits, not in PR descriptions, not in files.
5. Commit messages: English, Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`). Small commits, one concern each.
6. Do not delete code on a hunch. Dead code removal requires evidence (see Phase 2 method). Record every removal in `docs/CLEANUP_LOG.md`.
7. Keep the extension loadable as an **unpacked extension with no build step** (no npm required to run it). Dev tooling (tests, lint, CI scripts) may use Node, but the shipped folder must stay plain files.
8. If blocked or if two options are reasonable, ask the owner one precise question instead of guessing.
9. Confidence labels in audit docs: **Certain** (verified in code/test), **Likely** (strong deduction), **Guess** (gap-filling). Use them.

---

## 1. Project definition

**Name:** The Great Tab Killer
**What it is:** A Chromium (Manifest V3) extension that automatically suspends inactive tabs to save RAM/CPU, restores them on demand, keeps sessions, and protects tabs with unsaved form input.
**Origin:** Fork of `deanoemcke/thegreatsuspender` via "The Great Suspender Reloaded" (2025/2026 edition, version 2.0.1). The original was pulled from the Chrome Web Store after a malware incident; this fork exists to be a transparent, auditable, local-first replacement.

**Distribution model (decided by owner):**
- Public GitHub repository, open source, free for anyone to use, modify, fork.
- **Not** published on the Chrome Web Store.
- Installed by loading the folder as an unpacked extension (or from a release zip).
- Consequence: no automatic updates (no `update_url`). Releases, checksums, and a clear changelog are therefore mandatory (Phase 8).

**Goals**
- Fully auditable: no remote code, no external network access, minimal and documented permissions.
- Privacy-first: nothing leaves the machine; user can see and wipe everything stored.
- Reliable under MV3 (service worker can be killed at any time).
- Professional repo hygiene: license, security policy, CI guards, pinned vendor libs, tagged releases.

**Non-goals**
- No Chrome Web Store submission.
- No analytics, no crash reporting, no remote config, no "notice" system from a server.
- No build pipeline / bundler for the shipped extension.

---

## 2. Decisions already made by the owner

| # | Decision |
|---|----------|
| 1 | Rename to **The Great Tab Killer** (new branding, new icons, no "Great Suspender" identity) |
| 2 | Add a LICENSE file (see correction in §3.1) |
| 3 | Copyright for new work belongs to the project owner(s); published free on GitHub for anyone to develop |
| 4 | Settings to control *when* tabs get suspended + keyboard shortcuts to stop/pause suspension |
| 5 | Remove `cookies` and `history` permissions if they are not truly needed |
| 6 | Full detailed audit of the new project, written down for everyone to read |
| 7 | Broad permissions are acceptable (local distribution) — but still document each one (see §3.2) |
| 8 | Remove all dead code |
| 9 | Guard system: no external URL / no new permission can enter without explicit approval |
| 10 | Tagged releases for every version, with downloadable assets |
| 11 | `SECURITY.md` + `PRIVACY.md`: state exactly what is stored and whether anything is sent |
| 12 | Pin `html2canvas` and `dom-to-image` with hashes so any change is detected |
| 13 | Prefer `chrome.alarms` over in-memory timers |
| 14 | Feature: Tab Groups support |
| 15 | Feature: Export/Import of settings and sessions |
| 16 | Feature: Resource monitor (only after its privacy is verified) |
| 17 | Feature: Privacy dashboard (show what is stored, wipe in one click) |
| 18 | **Keep suspended pages in browser history** (never delete them) so they can be recovered after a crash/shutdown → remove the `history` permission and the `onVisited`/`deleteUrl` cleanup |
| 19 | Remove `management` entirely (including `management.setEnabled` in the monitor) |
| 20 | Remove `onMessageExternal` / the external "API for other extensions" entirely |
| 21 | Resource monitor is **OFF by default** (opt-in) |
| 22 | Every issue found in the pre-audit must be **fixed, not deferred**: "no known debt at v0.1.0" |
| 23 | The roadmap is executed by an AI coding agent (Codex) → `AGENTS.md` + `CODEX_PROMPT.md` define its operating rules |

---

## 3. Corrections and constraints the owner must know

### 3.1 License — you cannot invent a "special" license (Certain, as a legal-mechanics point; not legal advice)
- The code is derived from GPL-licensed work. The README says **GPL-2.0**. The repo currently has **no LICENSE file** (Certain — checked in the zip).
- A derivative must stay under the same license. The owner **cannot** relicense it under custom/permissive terms, and cannot remove the original authors' copyright notices.
- What the owner **can** do:
  - Add the GPL-2.0 `LICENSE` file (full text).
  - Add the owner's copyright line for the owner's own modifications, next to (not instead of) the original notices.
  - Add a `NOTICE`/`AUTHORS` file crediting: original author (Dean Oemcke), the Reloaded fork author, bundled libs (html2canvas — MIT, db.js — MIT, dom-to-image — MIT; **verify each**).
- "Free for anyone to take and develop" is exactly what GPL-2.0 already gives. No special license is needed.
- **Task:** check the license headers in the original repo files. If the original says "GPL-2.0-only", the fork cannot be "or-later". Record the finding in `docs/LICENSE_NOTES.md`. If it is unclear, ask the owner to consult a lawyer — do not guess.

### 3.2 Permissions are broad — document them anyway (Certain)
Current manifest requests: `tabs, storage, history, unlimitedStorage, contextMenus, cookies, alarms, favicon, scripting, offscreen`, plus host access to `http://*/*, https://*/*, file://*/*`, a content script on every page at `document_start`, and (in the source version) `system.cpu`, `system.memory`, optional `processes`, `management`.
Even though the owner accepts broad permissions, other people will install this from GitHub. Every permission must be justified in `PRIVACY.md` and enforced by the permission lock (Phase 3).

### 3.3 Distribution friction (Likely)
Unpacked/dev-mode extensions show warnings in Chromium and require "Developer mode". `file://` access also requires the user to toggle "Allow access to file URLs" manually. The install guide (Phase 8) must explain this honestly.

### 3.4 The Chrome Web Store build is not the same as this source (Certain)
The store build `2.0.1` (analyzed earlier) lacks the Resource monitor and the new `system.*` permissions that exist in the `main` source with the same version number. **This repo (`main`) is the base.** Reset the version (suggest `0.1.0`) because it is a new project.

---

## 4. Baseline audit findings (pre-audit, from the previous analysis)

These are starting facts. Phase 1 must confirm/extend them.

**Certain (verified in code)**
- No `eval`, `new Function`, `importScripts`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` in project code (excluding vendored libs, which still need a Phase 1 review).
- Extension-page CSP: `connect-src 'self' data:` — external fetches are blocked by CSP.
- Only `fetch` uses: loading its own `_locales/*/messages.json`, and favicon blobs (`gsFavicon.js`). The `google.com/s2/favicons` URL is commented out.
- `gsSession.js` sets an **uninstall URL** pointing to a third-party Google Form. Must be removed or replaced.
- `chrome.cookies` is used only in a legacy migration (`gsIndexedDb.js`, versions < 6.31) that deletes cookies named `gsScrollPos*`. Likely removable with the permission.
- `chrome.history` is used to delete suspended-page entries from history (`tgs.js`, `onVisited` → `deleteUrl`). This is a real feature (keeps history clean), so decide: keep (documented) or drop.
- The "notice" system (`notice.js`, `html/notice.html`, `requestNotice`, `_noticeToDisplay`): the value is never assigned anywhere → **dead code** (Certain). It also does `innerHTML = notice.text` — an XSS sink if it ever got wired up. Remove entirely.
- `contentscript.js` runs on all pages; it only reports scroll position and form-input state. It does listen to `window online/offline` events and sends messages.
- Monitor feature (`monitor.js`, `monitor-lab.js`, `gsMemorySampler.js`, `html/monitor*.html`, `scripts/`, `tests/`) is **not linked from the UI** (button commented out in `popup.js` and `options.html`) but is fully present and active in the service worker.

**Newly found in this pre-audit**
- **(Certain)** `gsMemorySampler.js` runs on a `chrome.alarms` period of **5 minutes** and calls `chrome.scripting.executeScript({ allFrames: true })` into tabs to measure DOM/heap stats. That is invasive background behavior and it runs from `serviceWorker.js` even though the UI entry is hidden.
- **(Certain)** The sampler caches `url → bytes` in `chrome.storage.local` (`gsMonitorMemCache`, up to 800 entries, 7-day TTL). That is **browsing-history-like data stored with full URLs**. Must become opt-in, store less (hostname or hashed key), and appear in the privacy dashboard.
- **(Certain)** `monitor.js` can call `chrome.management.setEnabled(...)` — i.e. enable/disable **other extensions**. This is scope creep with security weight. Recommendation: remove from v1 (owner decision, see §5).
- **(Certain)** `tgs.js` registers `chrome.runtime.onMessageExternal` ("API for other extensions"). `externally_connectable` is not set in the manifest, so by default other extensions (not web pages) can message it. The handler (`externalMessageRequestListener`) **has not been read yet** — Phase 1 must audit it. Default recommendation: remove or strict allowlist.
- **(Certain)** `tgs.js:97` uses `window.setTimeout` inside a service-worker code path. `window` does not exist in an MV3 service worker → that path would throw a `ReferenceError` if reached. **(Guess)** it is only reached on a slow-start retry loop, so it may have gone unnoticed. Fix with `setTimeout`/alarms and add a test.
- **(Certain)** `tgs.js` has 9 `setTimeout/setInterval/clearTimeout` call sites while also using `chrome.alarms` (4 `create`). Which timers drive the actual suspension countdown has **not** been verified. In MV3 in-memory timers die when the worker is terminated → inactive tabs may never get suspended, or get suspended late. (Likely issue; Phase 4.)
- **(Certain)** `tgs.js` code comments reference "TODO: Report chrome bug" in several places and `serviceWorker.js` has `// TODO: needs to be tested` on `migrateForeignSuspendedTabs()` (migrates tabs from *other* suspender extensions' pages: it reads `ttl/pos/uri` from other pages' URL hash). Review for safety and relevance.
- **(Certain)** Vendor libs have no recorded version/hash: `html2canvas.min.js` (281 KB), `dom-to-image.js` (27 KB), `db.js` (35 KB, project-local copy). No upstream comparison has been done (no network access in the previous environment).
- **Not yet read in full:** `tgs.js` (~1900 lines), `monitor.js` (1558 lines), `gsMemorySampler.js` (434 lines), `gsSession.js`, `gsTabSuspendManager.js`, `suspended.js`. Phase 1 reads all of them.

---

## 5. Resolved decisions and remaining open questions

### Resolved (owner answers)
1. **`history` permission → REMOVE it, keep suspended pages in history.** Rationale (owner): if the PC shuts down or the browser crashes, the suspended pages in history are the recovery path.
   - Remove `history` from `manifest.json`; remove the `chrome.history.onVisited` listener and the `deleteUrl` call in `tgs.js`.
   - `PRIVACY.md` must say: suspended-page entries stay in the browser history; each entry's URL contains the original page URL and title in the hash (same information as the original visit — nothing new is exposed, but the extension-page URLs will appear in history).
   - **Dependency (Likely; agent must verify against Chrome docs):** for an unpacked extension the ID is derived from the folder path unless the manifest has a `key`. If the ID changes, old history entries (`chrome-extension://<id>/html/suspended.html#...`) become dead links and the owner's recovery reason is defeated. → Task 0.8 (stable extension ID) is **mandatory**.
   - Do NOT remove the extension's own "session history" UI (`html/history.html`, `js/history*.js`); it is unrelated to the `history` permission (it reads IndexedDB sessions).
2. **`management` → REMOVE** (permission and every call site, incl. `monitor.js` `toggleExtension`/`refreshExtensions` UI that lists/toggles other extensions). Remove the matching locale strings.
3. **`onMessageExternal` → REMOVE** the listener, `externalMessageRequestListener`, any docs/strings about the external API. Confirm no internal code path depended on it.
4. **Monitor → OFF by default.** No background sampling alarm, no `executeScript`, no caching until the user enables it in Options. Request `system.cpu`/`system.memory` (and `processes`) only when the user enables it, if Chrome allows those as optional permissions (agent must verify; if not allowed as optional, keep required and document why).

### Remaining open (agent: propose a default, ask the owner, do not guess)
- a. `minimum_chrome_version` (suggest after testing; ≥ 120 if 30-second alarms are used — verify).
- b. License header strategy (default: `LICENSE` + `NOTICE`, SPDX identifiers in new files only).
- c. Product-name collision check for "The Great Tab Killer".
- d. Keep `file://*/*` host access? Default: yes, documented as opt-in by Chrome's own "Allow access to file URLs" toggle.

---

## 6. Phases

Each task has an ID, a description, and **Acceptance** criteria. Mark tasks `[x]` when done and verified.

### Phase 0 — Repo prep, legal, branding

- [ ] **0.1 Baseline snapshot.** Tag the starting commit `upstream-baseline`. Never edit history of this tag. Acceptance: tag exists.
- [ ] **0.2 License.** Add `LICENSE` (GPL-2.0 full text), `NOTICE`/`AUTHORS` (credits for original author, Reloaded author, bundled libs and their licenses), `docs/LICENSE_NOTES.md` (findings from §3.1). Acceptance: files present; each bundled lib has a license entry verified against its upstream (note: needs network — if the agent has none, mark as "unverified" and ask the owner).
- [ ] **0.3 Rename.** Replace the product name everywhere: `_locales/*/messages.json` (`ext_extension_name`, description, any "Great Suspender" strings), `html/*.html` titles, `README.md`, `manifest.json`. Keep the *attribution* to the origin in `NOTICE`/README. Acceptance: `grep -ri "great suspender" .` only returns attribution lines.
- [ ] **0.4 Branding.** Replace `images/sus-*.png`, `patron.png`, extension icons with new/neutral assets (owner supplies, or generate simple placeholders and flag them). Remove the Patreon link/image. Acceptance: no reference to the old mascot or Patreon.
- [ ] **0.5 Remove the third-party uninstall URL** (`gsSession.js` `setUninstallURL`). Acceptance: no `setUninstallURL` call to any external form; no external URL left except documentation `<a>` links (and those must open with `rel="noopener noreferrer"`).
- [ ] **0.6 Version reset.** `manifest.json` version → `0.1.0`. Add `CHANGELOG.md` (Keep a Changelog format). Acceptance: version consistent across manifest, README, changelog.
- [ ] **0.7 `.gitignore`, `CODEOWNERS`, `CONTRIBUTING.md`, PR template** with a checklist item: "Does this PR add a permission, URL, or dependency? If yes, explain".
- [ ] **0.8 Stable extension ID (mandatory, see §5.1).** Add a `key` field to `manifest.json` so the extension ID stays the same no matter which folder it is loaded from. Generate a dedicated keypair for this project; commit **only the public key** (`key` value). Keep the private key OUT of the repo (owner stores it; document in `docs/KEY_NOTES.md` that it is needed only if the owner ever packs/publishes a CRX). Acceptance: load the extension from two different folders → same ID; document the resulting ID in `docs/KEY_NOTES.md`. Verify against current Chrome docs and report honestly if behaviour differs.
- [ ] **0.9 Agent files.** Keep `AGENTS.md` and `CODEX_PROMPT.md` at repo root (or `docs/agent/`); they are part of the project's governance. Neither ships in the release zip.

### Phase 1 — Security & code audit (deliverable: `docs/AUDIT.md`)

Goal: a public, detailed, honest audit of the project as it stands. Every finding gets: ID, severity (Critical/High/Medium/Low/Info), confidence (Certain/Likely/Guess), file:line, description, recommendation, status.

- [ ] **1.1 Read everything.** Read in full: `manifest.json`, `js/serviceWorker.js`, `js/tgs.js`, all `js/helpers/*.js` (except vendored libs, which get 1.4), `js/contentscript.js`, `js/suspended.js`, `js/popup.js`, `js/options.js`, `js/history*.js`, `js/recovery.js`, `js/update.js`, `js/updated.js`, `js/changelog.js`, `js/monitor.js`, `js/monitor-lab.js`, `js/helpers/gsMemorySampler.js`, all `html/*.html`, `scripts/**`, `tests/**`.
- [ ] **1.2 Static scans, results saved to `docs/audit/`:**
  - Dangerous sinks: `eval`, `new Function`, `setTimeout("string")`, `document.write`, `innerHTML`/`outerHTML`/`insertAdjacentHTML` (each use classified: static template vs data-driven), `dangerouslySet*`, `javascript:` URLs.
  - Network: `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `navigator.sendBeacon`, `<img src>`/`<script src>`/`<link href>` with remote URLs, `chrome.tabs.create({url: ...})` with remote URLs.
  - Messaging: every `chrome.runtime.onMessage`, `onMessageExternal`, `onConnect*`, `postMessage` handler → list accepted message types, who can send them, what they can trigger, and whether `sender` is validated.
  - Storage: every `chrome.storage.*`, `localStorage`, IndexedDB store → key names, what data, retention, size.
  - Permission usage map: for each manifest permission → every call site. Any permission with zero call sites is a removal candidate.
  - Host access: why `file://` and `<all_urls>`-style matches are needed; whether the content script could use a narrower `matches` or on-demand injection (`activeTab`/`scripting`).
- [ ] **1.3 Threat model section.** Cover at least: malicious web page → content script messages; malicious/other extension → `onMessageExternal`; crafted suspended-page URL hash (`ttl`, `uri`, `pos` parameters) → XSS/open-redirect/`javascript:`/`data:` URL injection (check `gsUtils.getOriginalUrl`, `suspended.js` `innerHTML = request.title`, `reason`); data stored locally (URLs, titles, screenshots/favicons in IndexedDB) → what an attacker with local access gets; supply chain (vendored libs); update path (none → releases).
- [ ] **1.4 Vendored libs review.** For `html2canvas.min.js`, `dom-to-image.js`, `db.js`: identify exact upstream name + version (from header), compute SHA-256, compare to the official release if network is available (else mark "unverified — needs owner check"), grep for network calls/`eval`. Record in `vendor/README.md` (Phase 3 uses it).
- [ ] **1.5 Specific questions the audit must answer in writing:**
  1. What does `externalMessageRequestListener` accept? Can another extension suspend/unsuspend tabs, read tab URLs, or read session data through it?
  2. Can a crafted `suspended.html#...uri=...` URL cause script execution or navigation to `javascript:`/`data:`/`chrome://` targets?
  3. Which timers drive suspension? Do they survive service-worker termination?
  4. Does anything write full URLs to storage? Where, how long, can the user wipe it?
  5. Does the sampler inject into incognito tabs? (Manifest has `"incognito": "split"`.) What is stored from incognito?
  6. What happens to screenshots/previews (IndexedDB) — retention and deletion?
  7. Is `migrateForeignSuspendedTabs()` safe (it trusts the URL hash of other extensions' pages)?
  8. What exactly does `contentscript.js` expose to the page? (It should expose nothing; confirm no `window` bridge.)
- [ ] **1.6 Report.** Write `docs/AUDIT.md` with an executive summary, a findings table, per-finding detail, and a "what was NOT audited / not tested" section. Acceptance: every finding has file:line + confidence label; every item in §4 "not yet read" is now read or explicitly listed as unread.

### Phase 2 — Dead-code cleanup

**Method (mandatory, so nothing alive gets deleted):**
1. Build a call graph: for each exported function/handler, grep for call sites and message-type strings across `js/` and `html/`.
2. Mark a candidate "dead" only if: zero references **and** not reachable via `chrome.runtime.sendMessage({ function: '...' })`-style string dispatch **and** not referenced from HTML `id`/`data-*`.
3. Delete in small commits (one concern per commit). After each commit: load the unpacked extension and run the smoke test (Phase 8.5), or the automated tests if available.
4. Log each removal in `docs/CLEANUP_LOG.md`: file, symbol, evidence, commit hash.

**Known candidates (verify with the method above):**
- [ ] 2.1 Notice system: `js/notice.js`, `html/notice.html`, `requestNotice`/`clearNotice`/`_noticeToDisplay`, the `notice.html` tab-opening code in `tgs.js`, notice-related message cases and storage (`setNoticeVersion`), `noticeCheckInterval`.
- [ ] 2.2 Cookie migration in `gsIndexedDb.js` (versions < 6.31) + `gsChrome.cookiesGetAll/cookiesRemove` → then remove the `cookies` permission (Phase 3).
- [ ] 2.3 Other legacy migrations (`< 6.x`) in `gsIndexedDb.js`/`gsStorage.js` that apply to data formats no user of this fork can have. Since this is a **new project with a new storage schema start**, the owner may choose to drop all migrations from the old extension. Ask the owner first.
- [ ] 2.4 `js/helpers/debug.js` (profiler/debug tables) — remove or gate behind a build-free dev flag that is off in releases.
- [ ] 2.5 Original-project pages that no longer make sense: `html/update.html`, `updated.html`, `changelog.html` (with the rating/feedback links), `thanks.html`, `about.html` donation parts, `broken.html`, `permissions.html` — keep only what is functionally needed; rewrite texts.
- [ ] 2.6 Commented-out code blocks (e.g. `popup.js` monitor link, `options.html` monitor link, `GOOGLE_S2_URL` comment) — either finish the feature (Phase 7) or delete.
- [ ] 2.7 `migrateForeignSuspendedTabs()` — keep only if the owner wants a migration path from other suspender extensions; otherwise remove (also reduces attack surface).
- [ ] 2.8 Unused locale keys (strings no longer referenced after removals). Write a small script to list keys unused in any `html`/`js` and remove them from all locale files in one commit. Do **not** machine-translate new strings: new keys go to `en` and get fallback behavior in other locales.
- [ ] 2.9 `scripts/` (Python memlab) and `tests/` for the monitor: move to `dev/` or `tools/` and exclude from the release zip (Phase 8) — they are developer tooling, not part of the extension.
- [ ] 2.10 History cleanup listener: remove `chrome.history.onVisited` + `deleteUrl` in `tgs.js` (decision §5.1).
- [ ] 2.11 External messaging: remove `onMessageExternal`, `externalMessageRequestListener`, related strings/docs (decision §5.3).
- [ ] 2.12 Extension-management UI/logic in the monitor: remove `chrome.management.*`, the extensions list/toggle UI, and related locale keys (decision §5.2).

### Phase 3 — Hardening: permissions, guards, pinned libs

- [ ] **3.1 Minimize permissions** per the Phase 1 permission-usage map and the resolved decisions (§5): remove `cookies` (after 2.2), remove `history` (2.10), remove `management` (2.12). Move `system.cpu`/`system.memory`/`processes` to `optional_permissions` if Chrome allows it (verify), requested via `chrome.permissions.request` from a user gesture when the monitor is enabled. **Load the extension in Chrome Stable and record every manifest warning** (e.g. `processes` is a Dev/Canary-only API; Stable may warn or reject it) → fix so a clean Stable install shows no manifest errors/warnings. Consider narrowing the content script or host access only if no feature breaks (document the trade-off).
- [ ] **3.2 Permission lock file** `security/permissions.lock.json` containing the exact allowed sets: `permissions`, `optional_permissions`, `host_permissions`, `content_scripts[].matches`, `web_accessible_resources`, `content_security_policy`, `externally_connectable` (absent), `update_url` (absent), `incognito`.
- [ ] **3.3 Guard script** `tools/check-guards.mjs` (Node, no deps) that fails with a clear message when:
  - `manifest.json` differs from `security/permissions.lock.json` in any of the fields above;
  - any **forbidden pattern** appears in shipped files (everything except `vendor/` and `docs/`): `eval(`, `new Function`, `importScripts`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `document.write`, and `fetch(` whose argument is not `chrome.runtime.getURL(...)` or a local relative path;
  - any `http://` or `https://` URL appears in shipped JS (allowlist file `security/url-allowlist.txt` for documentation links in HTML only, each with a comment on why);
  - any `<script src>`/`<link href>`/`<img src>` points to a remote origin;
  - any file in the shipped set is missing from or changed vs `vendor/CHECKSUMS.sha256` (for vendored libs);
  - `connect-src` in the CSP is anything other than `'self' data:`.
- [ ] **3.4 Approval workflow.** Changing `security/*.lock.json` or the allowlist requires an owner review: add them to `CODEOWNERS` and mention in `CONTRIBUTING.md`. The agent must **never** edit these files to make a failing guard pass without explicit owner approval in the conversation.
- [ ] **3.5 Runtime check test.** An automated test that loads the extension (Playwright/Puppeteer with Chromium + `--load-extension`), blocks all network, exercises suspend/restore, and fails if any request leaves the `chrome-extension://` origin. (If the environment has no browser, document it as "not run" — do not claim it passed.)
- [ ] **3.6 Pin vendored libs.** Move the libs to `vendor/` (or keep paths and add `vendor/README.md`), with: exact name, version, upstream URL, license, SHA-256. `vendor/CHECKSUMS.sha256` is verified by the guard script and CI. Acceptance: modifying one byte of a vendored lib fails CI.
- [ ] **3.7 Safe DOM sinks.** Fix every data-driven `innerHTML` found in Phase 1 (e.g. `suspended.js` title/reason/url, `historyItems.js`, `popup.js`) to `textContent`/DOM construction or a strict sanitizer. Add tests with hostile titles/URLs (`<img src=x onerror=...>`, `javascript:`, very long strings).
- [ ] **3.8 Validate the suspended-page URL parameters.** `uri` must parse via `new URL()` and have an allowed scheme (`http:`, `https:`, `file:`); reject others. Cover with tests.
- [ ] **3.9 External messaging removed** (decision §5.3). Add a guard: the guard script fails if `onMessageExternal`, `onConnectExternal`, or `externally_connectable` appears anywhere.

### Phase 4 — MV3 reliability (timers → alarms) and bug fixes

- [ ] **4.1 Inventory timers.** List all `setTimeout/setInterval` in `tgs.js` and helpers; classify: (a) must survive worker restarts (suspension countdowns, session backups, monitor sampling) vs (b) short in-flight debouncing (OK to keep).
- [ ] **4.2 Design.** Persist "last activity timestamp per tab" in `chrome.storage.session` (or `local` if it must survive browser restart). One recurring alarm (e.g. every 1 minute — **verify** the minimum period for the targeted Chrome version; Chrome ≥ 120 allows 30 s) checks tabs against the user's timeout and queues suspensions. Avoid one-alarm-per-tab.
- [ ] **4.3 Fix `window.setTimeout`** in `tgs.js` (service worker context). Search for **all** `window.` / `document.` usage reachable from the service worker (`tgs.js`, `gsStorage.js`, `gsSession.js`, helpers imported by `serviceWorker.js`). Add a lint rule/test that the service worker module graph has no `window`/`document`/`localStorage`.
- [ ] **4.4 Worker restart test.** Manually/automatically terminate the service worker (`chrome://serviceworker-internals` or DevTools) and confirm suspension countdowns still fire. Report honestly if only tested manually.
- [ ] **4.5 Resolve every `TODO` in the code**: fix, convert to a GitHub issue, or delete with justification.
- [ ] **4.6 Startup & upgrade logic.** Simplify `ensureStartupChecks` / session recovery now that migrations may be removed; ensure first-run, update, and browser-restart paths each have a test or documented manual check.

### Phase 5 — Settings and shortcuts (owner item 4)

First **audit what exists** (the extension already has timeout/whitelist/battery/charging/form-input/audio/pinned options and 10 keyboard commands). Then fill gaps instead of rebuilding.

- [ ] **5.1 Gap analysis** in `docs/SETTINGS_GAP.md`: current settings vs desired list.
- [ ] **5.2 Settings to guarantee** (add if missing): suspend-after timeout (never / 30 s … hours / custom minutes); do-not-suspend rules for pinned tabs, tabs playing audio, tabs with unsaved forms, active tab in each window, tabs in a group, tabs on power/charging; domain allow/deny list with wildcard support and a "test this URL" field; "pause suspension for X minutes/until browser restart" global control; per-tab pause (temp whitelist).
- [ ] **5.3 Shortcuts.** Ensure there are shortcuts for: suspend current tab, pause/resume suspension for this tab, pause/resume suspension globally, suspend/unsuspend selected tabs/window/all. Note: Chrome allows only 4 suggested default shortcuts per extension; the rest are user-assigned at `chrome://extensions/shortcuts` — document it and show a button in Options that opens that page.
- [ ] **5.4 Options UX.** Keep it simple; settings changes apply immediately; reset-to-defaults button; settings validated on load.

### Phase 6 — Privacy documents and privacy-by-default behavior

- [ ] **6.1 `PRIVACY.md`** — must state, accurately and from the Phase 1 audit:
  - Everything is processed locally; **nothing is sent anywhere** (and the guard script/CI enforces no network code).
  - A table: every stored item → where (`chrome.storage.local/sync/session`, IndexedDB store name, `localStorage`) → content → purpose → retention → how to delete. Include: settings, whitelist, sessions (URLs/titles), tab previews/screenshots, favicon cache, monitor cache (if kept), scroll positions.
  - `chrome.storage.sync` (if used for settings): say that Chrome itself may sync it to the user's Google account — this is browser behavior, not this extension sending data. Offer a setting to keep settings local-only.
  - One line per permission: why needed, what it is used for, what it is **not** used for.
  - Incognito behavior (`"incognito": "split"`): what is stored.
- [ ] **6.2 `SECURITY.md`** — how to report vulnerabilities (private email or GitHub Security Advisories — owner provides the contact), supported versions, the project's security principles (no remote code, no network, pinned libs, permission lock), and how to verify a release (checksum steps).
- [ ] **6.3 Monitor privacy fix (prerequisite for Phase 7.4):** monitor **off by default** (decision §5.4); sampler alarm registered only while enabled; no background `executeScript` unless enabled; cache keyed by **hostname or hash**, never full URL; short TTL (e.g. 24 h) and hard cap; excluded for incognito tabs; `management` removed. Turning the monitor off must also delete its cached data.
- [ ] **6.4 Data minimization sweep.** Anywhere full URLs/titles are persisted, justify or reduce. Session history must be user-controllable (limit count, clear button).

### Phase 7 — Features

- [ ] **7.1 Tab Groups support.** Requires the `tabGroups` permission (**verify** the exact requirement against the Chrome docs; it must go through the permission-lock approval). Behavior: a setting "never suspend tabs in groups" and/or per-group rules; suspended tabs must stay in their group and keep group color/title; session save/restore must preserve groups. Tests: suspend/restore inside a group; group collapse; moving tabs between groups.
- [ ] **7.2 Export / Import.** JSON file with a `schemaVersion`, containing settings, whitelist/rules, and (optionally, user-selected) sessions. Import: strict schema validation, size limit, never `eval`, preview of what will change, confirmation before overwrite, backup of previous settings. Export via the existing offscreen/download path or an extension page `Blob` download. Warn the user that session exports contain URLs/titles.
- [ ] **7.3 Domain rules UI** (if not already covered in 5.2): per-domain timeout override.
- [ ] **7.4 Resource monitor** — only after 6.3. Wire it in the UI again (popup + options link), make it opt-in, document the estimate's limitations in the page (the code already contains a methodology note in Russian inside `monitor-lab.html` — translate or remove; keep UI language consistent with locales), and decide whether `monitor-lab` (experimental) ships or stays in `tools/`.
- [ ] **7.5 Privacy dashboard** (page in Options): live list of everything stored (from the table in `PRIVACY.md`) with counts/sizes, per-item "delete" and a global "delete all data" button. Must be generated from a **single registry in code** of storage keys/stores so documentation and dashboard cannot drift. Add a test that fails if a new storage key is used but not registered.
- [ ] **7.6 (Optional, ask owner)** Ideas to differentiate: per-window "focus mode", quick "suspend all except this", scheduled rules (work hours), stats page ("tabs suspended this week"), light/dark theme.

### Phase 8 — Release engineering

- [ ] **8.1 Versioning:** Semantic Versioning. `manifest.json` `version` is the single source of truth; the guard script checks it equals the latest `CHANGELOG.md` entry and the git tag.
- [ ] **8.2 Release zip:** reproducible script `tools/make-release.sh` (or `.mjs`) that zips only the shipped extension files (exclude `docs/`, `tools/`, `tests/`, `scripts/`, `.git*`, `.DS_Store`, `_metadata/`), outputs `great-tab-killer-vX.Y.Z.zip` and `SHA256SUMS.txt`. Strip macOS junk (`.DS_Store` currently exists in `_locales/`).
- [ ] **8.3 GitHub Actions** (`.github/workflows/`):
  - `ci.yml` on every push/PR: run `tools/check-guards.mjs`, lint, unit tests, manifest validation.
  - `release.yml` on tag `v*`: run all checks, build the zip, generate checksums, create a GitHub Release with the zip + `SHA256SUMS.txt` + changelog section as notes. Pin third-party Actions to full commit SHAs.
- [ ] **8.4 Tagging policy:** every released version gets an annotated tag `vX.Y.Z` and a GitHub Release. The release notes list: changes, **any permission change (highlighted)**, upgrade notes.
- [ ] **8.5 Smoke test checklist** (manual, in `docs/TESTING.md`; automate what is possible): install unpacked → welcome page → suspend a tab → restore it → whitelist a domain → form-input protection (type in a text field, tab must not be suspended) → pause shortcut → Tab Groups → export/import → privacy dashboard wipe → restart browser → session recovery → service-worker kill test.
- [ ] **8.6 `docs/INSTALL.md`** with honest steps: download release zip → verify checksum → unzip → `chrome://extensions` → Developer mode → Load unpacked → (optional) allow file URLs / incognito → how to update (replace folder, reload) → warning about dev-mode banners → **"unsuspend all tabs before removing/replacing any suspender extension or you may lose them"** (carried over from the original README).
- [ ] **8.7 README rewrite:** what it is, screenshot, features, install, privacy summary (link to `PRIVACY.md`), security summary, license, credits to the original project and the fork it derives from.

---

### Phase 9 — Quality standards ("no known debt")

These tasks make the project meet common standards and user expectations. They run in parallel with Phases 4–8 and must be closed before v0.1.0.

- [ ] **9.1 CSP tightening.** Current extension-page CSP includes `style-src 'self' 'unsafe-inline'`. Evaluate removing `'unsafe-inline'` (move inline styles/`style=` attributes to CSS classes or CSSOM). If impossible for a concrete reason, document the reason in `docs/AUDIT.md`.
- [ ] **9.2 Accessibility (WCAG 2.1 AA as the target).** Keyboard navigation for popup/options/suspended page, visible focus, `aria-label`s for icon buttons, sufficient color contrast (light/dark), respects `prefers-reduced-motion` and `prefers-color-scheme`. Verify with an automated checker (e.g. axe) where possible and document manual checks.
- [ ] **9.3 i18n and RTL.** The extension ships Arabic, Hebrew, Persian locales. Verify RTL layout (`dir`/`lang` set from the active locale, logical CSS properties) on popup, options, suspended page, history. New strings go to `en` first; missing keys must fall back to `en` and never show raw `__MSG_...__` keys. Add a locale-integrity check (same key set or documented fallback).
- [ ] **9.4 Incognito policy.** Decide and document (owner confirms): by default nothing from incognito is persisted (no sessions, no previews, no monitor cache). Check what `"incognito": "split"` implies for storage and for the suspended page. Add tests/manual steps.
- [ ] **9.5 Logging policy.** `gsUtils.log/warning/error`: logs are local-only, off by default in releases, and never include full URLs or page titles unless a developer flag is on. Never persist logs.
- [ ] **9.6 Performance budget.** Measure and record in `docs/PERFORMANCE.md`: service-worker cold start time, steady-state memory of the extension itself, time to suspend/restore a tab, behavior with 200+ tabs. Set thresholds; flag regressions. Report only what was measured.
- [ ] **9.7 Compatibility matrix** in `docs/TESTING.md`: Chrome Stable (latest and N-2), Brave, Edge on Windows/macOS/Linux — mark each cell Tested / Not tested. Do not claim untested cells.
- [ ] **9.8 Repository security.** Branch protection on `main` (required status checks, no force-push), signed tags, GitHub Actions with least-privilege `permissions:` (default read-only), all third-party Actions pinned to full commit SHAs, no `pull_request_target`, secrets scanning enabled, Dependabot/alerts for dev tooling (keep dev dependencies near zero; lockfile committed if any). Document what the agent could not enable itself (these are GitHub settings the owner must switch on).
- [ ] **9.9 Release integrity.** `SHA256SUMS.txt` for every release; signed tag; if available, GitHub artifact attestation/provenance for the release zip (verify the current Action and its pinning before using it). Document verification steps in `docs/INSTALL.md`.
- [ ] **9.10 Update path without network.** The extension must not check for updates over the network. An "About" page may show the installed version and a plain link to the Releases page that opens only when the user clicks it.
- [ ] **9.11 Data lifecycle.** Verify that uninstalling the extension leaves no data in the extension's own storage (Chrome removes it), and that "Delete all data" in the privacy dashboard clears every registered store, including IndexedDB previews and backups created by `gsBackup.js`.
- [ ] **9.12 Dependency & license inventory** in `NOTICE`/`vendor/README.md`: every bundled third-party file with name, version, license, hash, upstream URL. Anything unverifiable is labelled **UNVERIFIED** and listed for the owner.
- [ ] **9.13 Debt gate.** Before tagging v0.1.0, `docs/AUDIT.md` must show every finding as Fixed / Won't fix (with owner-approved reason) / Accepted risk (owner-approved). No finding may remain "Open".

---

## 7. Definition of done (v0.1.0)

- [ ] `LICENSE`, `NOTICE`, `PRIVACY.md`, `SECURITY.md`, `CHANGELOG.md`, `docs/AUDIT.md` present and accurate.
- [ ] No reference to the old name/mascot/Patreon except attribution.
- [ ] `grep` shows no remote URLs in shipped JS; CSP `connect-src 'self' data:`.
- [ ] Permission lock + guard script pass in CI; changing a permission without updating the lock fails CI.
- [ ] Vendor libs pinned with verified checksums.
- [ ] Dead code removed; `docs/CLEANUP_LOG.md` complete.
- [ ] Suspension survives service-worker restarts (tested and reported honestly).
- [ ] Settings/shortcuts covered per Phase 5; Tab Groups, export/import, privacy dashboard working; monitor is opt-in and private.
- [ ] Release `v0.1.0` tagged, zip + SHA256 attached.
- [ ] A final "not tested" list is written in `docs/TESTING.md`.
- [ ] `history`, `cookies`, `management` permissions removed; no `onMessageExternal`; manifest `key` set and ID stable across folders.
- [ ] Clean load in Chrome Stable with **zero** manifest warnings.
- [ ] Monitor is off by default and deletes its data when turned off.
- [ ] Phase 9 closed: a11y, RTL, incognito, logging, performance, compatibility matrix, repo security, release integrity, debt gate.

---

## 8. Starter prompts (copy-paste)

> The full master prompt is in `CODEX_PROMPT.md`; persistent agent rules are in `AGENTS.md`. The short prompts below are for starting or resuming a specific phase.

**Kickoff**
> Read `TAB_KILLER_ROADMAP.md` fully. Follow section 0 strictly. Do not start coding yet: summarize in 10 lines what you understood, list the open decisions from section 5 that block Phase 0–2, and ask me those questions. No Co-Authored-By trailers and no "Generated with Claude Code" lines anywhere.

**Phase 0**
> Execute Phase 0 on a branch `phase-0-legal-branding`. One commit per task. After finishing, report: what changed, what you verified and how, what you could not verify (for example, license text of bundled libs if you have no network).

**Phase 1**
> Execute Phase 1. Do not change any source code — audit only, output `docs/AUDIT.md` and `docs/audit/*`. Use confidence labels (Certain/Likely/Guess). Answer all 8 questions in 1.5 explicitly. List anything you did not read.

**Phase 2**
> Execute Phase 2 using the mandatory method. Show me the evidence table for each removal before deleting. Ask me about 2.3 and 2.7 first.

**Phase 3**
> Execute Phase 3. Never edit `security/*.lock.json` or the URL allowlist to make a failing guard pass; if a guard fails, tell me why and wait for my approval.

**Phase 4+**
> Execute Phase N from the roadmap, same rules as before. At the end, update the checkboxes in `TAB_KILLER_ROADMAP.md` and append a short status note under the phase.

---

## 9. Status log (agent: append here)

| Date | Phase/Task | Status | Verified how | Not tested |
|------|------------|--------|--------------|------------|
| — | — | — | — | — |
