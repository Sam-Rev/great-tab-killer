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
5. **Session backups → OFF by default.** On first run, show a one-time local extension-page notice explaining that enabled backups write plain-text files containing open-tab URLs to Downloads. Provide controls to enable backups and choose a frequency. Never back up incognito tabs. The Phase 0 rename to The Great Tab Killer is complete.
6. **Legacy data migrations → DROP inherited format conversions.** This is a new project with a new extension ID and empty storage. Remove data-format migrations inherited from the original extension, including old settings/IndexedDB formats and the legacy cookie migration. Start new storage at an explicit schema version and version all future schema changes from day one; do not confuse fresh schema initialization/versioning with conversions of old-project data.
7. **Foreign suspended tabs → KEEP, but stop unattended migration.** Phase 2 task 2.7 only removes the automatic install-time invocation; it does not delete or redesign `migrateForeignSuspendedTabs()`. Build the owner-confirmed manual conversion in new task 7.7, after Phase 3 task 3.8 provides URL-validation helpers.
8. **Settings sync → OFF by default.** Keep sync as an opt-in setting and show a clear privacy note in Options. Document that Chrome may sync these settings to the user's account in `PRIVACY.md`.
9. **Project logo → use the owner-provided `Tab_Killer_logo.png`.** Preserve the original at `assets/source/Tab_Killer_logo.png`; identify it in `NOTICE` as an owner-provided asset whose license is to be confirmed. Icon-generation tooling is development-only and must not add a shipped/runtime dependency.
10. **Primary browser → Brave.** Include Brave in the compatibility matrix and verify the stable extension ID through `brave://extensions`, developer-mode installation, and that Shields do not interfere with extension pages.

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
- [x] **0.4 Branding.** Replace `images/sus-*.png`, `patron.png`, extension icons with new/neutral assets (owner supplies, or generate simple placeholders and flag them). Remove the Patreon link/image. Acceptance: no reference to the old mascot or Patreon. Owner logo/icons committed as `ee1b2e9` on `phase-0-legal-branding`; not merged.
- [ ] **0.5 Remove the third-party uninstall URL** (`gsSession.js` `setUninstallURL`). Acceptance: no `setUninstallURL` call to any external form; no external URL left except documentation `<a>` links (and those must open with `rel="noopener noreferrer"`).
- [ ] **0.6 Version reset.** `manifest.json` version → `0.1.0`. Add `CHANGELOG.md` (Keep a Changelog format). Acceptance: version consistent across manifest, README, changelog.
- [ ] **0.7 `.gitignore`, `CODEOWNERS`, `CONTRIBUTING.md`, PR template** with a checklist item: "Does this PR add a permission, URL, or dependency? If yes, explain".
- [ ] **0.8 Stable extension ID (mandatory, see §5.1).** Add a `key` field to `manifest.json` so the extension ID stays the same no matter which folder it is loaded from. Generate a dedicated keypair for this project; commit **only the public key** (`key` value). Keep the private key OUT of the repo (owner stores it; document in `docs/KEY_NOTES.md` that it is needed only if the owner ever packs/publishes a CRX). Owner manual acceptance: in Brave, load the extension from two different folders via `brave://extensions` with Developer mode enabled; confirm the ID matches and record it in `docs/KEY_NOTES.md`. Keep this task open until the owner reports the result.
- [ ] **0.9 Agent files.** Keep `AGENTS.md` and `CODEX_PROMPT.md` at repo root (or `docs/agent/`); they are part of the project's governance. Neither ships in the release zip.

### Phase 1 — Security & code audit (deliverable: `docs/AUDIT.md`)

Goal: a public, detailed, honest audit of the project as it stands. Every finding gets: ID, severity (Critical/High/Medium/Low/Info), confidence (Certain/Likely/Guess), file:line, description, recommendation, status.

- [x] **1.1 Read everything.** Read in full: `manifest.json`, `js/serviceWorker.js`, `js/tgs.js`, all `js/helpers/*.js` (except vendored libs, which get 1.4), `js/contentscript.js`, `js/suspended.js`, `js/popup.js`, `js/options.js`, `js/history*.js`, `js/recovery.js`, `js/update.js`, `js/updated.js`, `js/changelog.js`, `js/monitor.js`, `js/monitor-lab.js`, `js/helpers/gsMemorySampler.js`, all `html/*.html`, `scripts/**`, `tests/**`.
- [x] **1.2 Static scans, results saved to `docs/audit/`:**
  - Dangerous sinks: `eval`, `new Function`, `setTimeout("string")`, `document.write`, `innerHTML`/`outerHTML`/`insertAdjacentHTML` (each use classified: static template vs data-driven), `dangerouslySet*`, `javascript:` URLs.
  - Network: `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `navigator.sendBeacon`, `<img src>`/`<script src>`/`<link href>` with remote URLs, `chrome.tabs.create({url: ...})` with remote URLs.
  - Messaging: every `chrome.runtime.onMessage`, `onMessageExternal`, `onConnect*`, `postMessage` handler → list accepted message types, who can send them, what they can trigger, and whether `sender` is validated.
  - Storage: every `chrome.storage.*`, `localStorage`, IndexedDB store → key names, what data, retention, size.
  - Permission usage map: for each manifest permission → every call site. Any permission with zero call sites is a removal candidate.
  - Host access: why `file://` and `<all_urls>`-style matches are needed; whether the content script could use a narrower `matches` or on-demand injection (`activeTab`/`scripting`).
- [x] **1.3 Threat model section.** Cover at least: malicious web page → content script messages; malicious/other extension → `onMessageExternal`; crafted suspended-page URL hash (`ttl`, `uri`, `pos` parameters) → XSS/open-redirect/`javascript:`/`data:` URL injection (check `gsUtils.getOriginalUrl`, `suspended.js` `innerHTML = request.title`, `reason`); data stored locally (URLs, titles, screenshots/favicons in IndexedDB) → what an attacker with local access gets; supply chain (vendored libs); update path (none → releases).
- [x] **1.4 Vendored libs review.** For `html2canvas.min.js`, `dom-to-image.js`, `db.js`: identify exact upstream name + version (from header), compute SHA-256, compare to the official release if network is available (else mark "unverified — needs owner check"), grep for network calls/`eval`. Record in `vendor/README.md` (Phase 3 uses it).
- [x] **1.5 Specific questions the audit must answer in writing:**
  1. What does `externalMessageRequestListener` accept? Can another extension suspend/unsuspend tabs, read tab URLs, or read session data through it?
  2. Can a crafted `suspended.html#...uri=...` URL cause script execution or navigation to `javascript:`/`data:`/`chrome://` targets?
  3. Which timers drive suspension? Do they survive service-worker termination?
  4. Does anything write full URLs to storage? Where, how long, can the user wipe it?
  5. Does the sampler inject into incognito tabs? (Manifest has `"incognito": "split"`.) What is stored from incognito?
  6. What happens to screenshots/previews (IndexedDB) — retention and deletion?
  7. Is `migrateForeignSuspendedTabs()` safe (it trusts the URL hash of other extensions' pages)?
  8. What exactly does `contentscript.js` expose to the page? (It should expose nothing; confirm no `window` bridge.)
- [x] **1.6 Report.** Write `docs/AUDIT.md` with an executive summary, a findings table, per-finding detail, and a "what was NOT audited / not tested" section. Acceptance: every finding has file:line + confidence label; every item in §4 "not yet read" is now read or explicitly listed as unread.

### Phase 2 — Dead-code cleanup

**Method (mandatory, so nothing alive gets deleted):**
1. Build a call graph: for each exported function/handler, grep for call sites and message-type strings across `js/` and `html/`.
2. Mark a candidate "dead" only if: zero references **and** not reachable via `chrome.runtime.sendMessage({ function: '...' })`-style string dispatch **and** not referenced from HTML `id`/`data-*`.
3. Delete in small commits (one concern per commit). After each commit: load the unpacked extension and run the smoke test (Phase 8.5), or the automated tests if available.
4. Log each removal in `docs/CLEANUP_LOG.md`: file, symbol, evidence, commit hash.

**Known candidates (verify with the method above):**
- [x] 2.1 Remove dormant notice system: `js/notice.js`, `html/notice.html`, `requestNotice`/`clearNotice`/`_noticeToDisplay`, notice tab-opening/message cases, notice storage helpers, and `noticeCheckInterval`. Evidence and commit: `docs/CLEANUP_LOG.md`.
- [x] 2.2 Remove the inherited `<6.31` cookie migration and `gsChrome.cookiesGetAll/cookiesRemove` wrappers. `cookies` remains in `manifest.json` until Phase 3/Gate B. Evidence and commit: `docs/CLEANUP_LOG.md`.
- [x] 2.3 Drop inherited data-format migrations and establish new schema versioning. Remove old-project conversions from `gsIndexedDb.js` and the inherited undefined-sync-setting compatibility branch in `gsStorage.js`. Initialize local storage at `schemaVersion: 1` and IndexedDB at version 1; future schema changes must add forward steps. Fresh, existing, and unsupported-future schema checks pass. Evidence and commit: `docs/CLEANUP_LOG.md`.
- [x] 2.4 Remove unreferenced `js/helpers/debug.js` profiler and its sole `getDebugInfo` message path. Normal warning/error logging and monitor behavior remain. Evidence and commit: `docs/CLEANUP_LOG.md`.
- [x] 2.5 Remove donation-only UI/routes and rewrite stale project pages. Kept the live update/recovery, broken-startup, file-permission, about, changelog, and session-history flows; removed unused `updated.html`/`updated.js` and obsolete donation route/UI. Evidence and commits: `docs/CLEANUP_LOG.md`.
- [x] 2.6 Remove obsolete commented implementations and disabled UI fragments after reference review. Kept explanatory comments that describe active behavior. Evidence and commit: `docs/CLEANUP_LOG.md`.
- [x] 2.7 Stop unattended foreign-tab migration. Removed only the automatic `onInstalled` invocation of `migrateForeignSuspendedTabs()`; the helper remains intact and dormant for task 7.7 after task 3.8. Evidence and commit: `docs/CLEANUP_LOG.md`.
- [x] 2.8 Unused locale keys (strings no longer referenced after removals). Write a small script to list keys unused in any `html`/`js` and remove them from all locale files in one commit. Completed with a conservative cross-file scanner; zero candidates remain after removal. Evidence and commit: `docs/CLEANUP_LOG.md`. Do **not** machine-translate new strings: new keys go to `en` and get fallback behavior in other locales.
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

### Phase 4 — MV3 reliability (durable queue and alarm reconciliation) and bug fixes

- [ ] **4.1 Inventory timers.** Inventory `setTimeout/setInterval` in `tgs.js` and helpers. Preserve the existing per-tab `chrome.alarms` suspension deadlines; classify only transient debouncing/retries and other work that must survive worker restarts.
- [ ] **4.2 Durable queue state.** Keep per-tab suspension alarms. Persist queue and in-flight state so service-worker termination cannot lose pending work, then reconcile stored state with existing alarms during startup. Do not replace per-tab suspension alarms with a recurring timer.
- [ ] **4.3 Fix `window.setTimeout`** in `tgs.js` (service worker context). Search for **all** `window.` / `document.` usage reachable from the service worker (`tgs.js`, `gsStorage.js`, `gsSession.js`, helpers imported by `serviceWorker.js`). Add a lint rule/test that the service worker module graph has no `window`/`document`/`localStorage`.
- [ ] **4.4 Worker restart test.** Manually/automatically terminate the service worker (`chrome://serviceworker-internals` or DevTools) and confirm suspension countdowns still fire. Report honestly if only tested manually.
- [ ] **4.5 Resolve every `TODO` in the code**: fix, convert to a GitHub issue, or delete with justification.
- [ ] **4.6 Startup & upgrade logic.** Simplify `ensureStartupChecks` / session recovery now that migrations may be removed; ensure first-run, update, and browser-restart paths each have a test or documented manual check.

**Correction from Phase 1 audit (A-22):** the initial timer proposal was based on an incomplete read. Source already uses per-tab `chrome.alarms` for suspension deadlines. Phase 4 covers durable queue/in-flight state and startup alarm reconciliation, not suspension-timer redesign.

### Phase 5 — Settings and shortcuts (owner item 4)

First **audit what exists** (the extension already has timeout/whitelist/battery/charging/form-input/audio/pinned options and 10 keyboard commands). Then fill gaps instead of rebuilding.

- [ ] **5.1 Gap analysis** in `docs/SETTINGS_GAP.md`: current settings vs desired list.
- [ ] **5.2 Settings to guarantee** (add if missing): suspend-after timeout (never / 30 s … hours / custom minutes); do-not-suspend rules for pinned tabs, tabs playing audio, tabs with unsaved forms, active tab in each window, tabs in a group, tabs on power/charging; domain allow/deny list with wildcard support and a "test this URL" field; "pause suspension for X minutes/until browser restart" global control; per-tab pause (temp whitelist).
- [ ] **5.3 Shortcuts.** Ensure there are shortcuts for: suspend current tab, pause/resume suspension for this tab, pause/resume suspension globally, suspend/unsuspend selected tabs/window/all. Note: Chrome allows only 4 suggested default shortcuts per extension; the rest are user-assigned at `chrome://extensions/shortcuts` — document it and show a button in Options that opens that page.
- [ ] **5.4 Options UX.** Keep it simple; settings changes apply immediately; reset-to-defaults button; settings validated on load.
- [ ] **5.5 Settings sync privacy.** Keep `chrome.storage.sync` available only as an explicit opt-in, default OFF. Show a clear Options privacy note explaining that Chrome may sync enabled settings to the user's account; cover the same behavior in `PRIVACY.md` (6.1).

### Phase 6 — Privacy documents and privacy-by-default behavior

- [ ] **6.1 `PRIVACY.md`** — must state, accurately and from the Phase 1 audit:
  - Everything is processed locally; **nothing is sent anywhere** (and the guard script/CI enforces no network code).
  - A table: every stored item → where (`chrome.storage.local/sync/session`, IndexedDB store name, `localStorage`) → content → purpose → retention → how to delete. Include: settings, whitelist, sessions (URLs/titles), tab previews/screenshots (IndexedDB `gsPreviews`, keyed by URL), favicon cache, monitor cache (if kept), scroll positions, **suspended-page entries that remain in browser history (decision §5.1)**, and **backup `.txt` files written to the Downloads folder (task 9.14)**.
  - `chrome.storage.sync` is OFF by default and opt-in only: say that Chrome itself may sync enabled settings to the user's Google account — this is browser behavior, not this extension sending data. Describe the Options privacy note and local-only default.
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
- [ ] **7.7 Convert tabs from another suspender extension.** Depends on Phase 3 task 3.8 URL validation. Trigger from an Options button and a one-time first-install offer. Detect only other-extension `chrome-extension://<id>/...` suspended pages with expected `ttl`, `pos`, and `uri`. Accept only `http:`, `https:`, and `file:` when file access is available; refuse all other schemes. Safely preview title and hostname; require explicit confirmation; convert the same tab with `tabs.update`, preserving scroll position. Log counts only. Add hostile-hash tests. Document in `docs/INSTALL.md`: install new extension, convert, disable old extension, then enable new suspension; never run both simultaneously. State that another extension ID's settings cannot be read.

### Phase 8 — Release engineering

- [ ] **8.1 Versioning:** Semantic Versioning. `manifest.json` `version` is the single source of truth; the guard script checks it equals the latest `CHANGELOG.md` entry and the git tag.
- [ ] **8.2 Release zip:** reproducible script `tools/make-release.sh` (or `.mjs`) that zips only the shipped extension files (exclude `docs/`, `tools/`, `tests/`, `scripts/`, `assets/source/`, `.git*`, `.DS_Store`, `_metadata/`), outputs `great-tab-killer-vX.Y.Z.zip` and `SHA256SUMS.txt`. Strip macOS junk (`.DS_Store` currently exists in `_locales/`).
- [ ] **8.3 GitHub Actions** (`.github/workflows/`):
  - `ci.yml` on every push/PR: run `tools/check-guards.mjs`, lint, unit tests, manifest validation.
  - `release.yml` on tag `v*`: run all checks, build the zip, generate checksums, create a GitHub Release with the zip + `SHA256SUMS.txt` + changelog section as notes. Pin third-party Actions to full commit SHAs.
- [ ] **8.4 Tagging policy:** every released version gets an annotated tag `vX.Y.Z` and a GitHub Release. The release notes list: changes, **any permission change (highlighted)**, upgrade notes.
- [ ] **8.5 Smoke test checklist** (manual, in `docs/TESTING.md`; automate what is possible): install unpacked → welcome page → suspend a tab → restore it → whitelist a domain → form-input protection (type in a text field, tab must not be suspended) → pause shortcut → Tab Groups → export/import → privacy dashboard wipe → restart browser → session recovery → service-worker kill test.
- [ ] **8.6 `docs/INSTALL.md`** with honest steps: download release zip → verify checksum → unzip → `brave://extensions` (primary) or `chrome://extensions` → Developer mode → Load unpacked → (optional) allow file URLs / incognito → how to update (replace folder, reload) → warning about dev-mode banners. Document the migration order: install the new extension with automatic suspension paused, convert eligible tabs, disable the old extension, then enable suspension in the new extension and later remove the old one. Never run both suspenders at the same time. Explain that settings belonging to another extension ID cannot be read.
- [ ] **8.7 README rewrite:** what it is, screenshot, features, install, privacy summary (link to `PRIVACY.md`), security summary, license, credits to the original project and the fork it derives from.

---

### Phase 9 — Quality standards ("no known debt")

These tasks make the project meet common standards and user expectations. They run in parallel with Phases 4–8 and must be closed before v0.1.0.

- [ ] **9.1 CSP tightening.** Measured baseline (Certain, grep on `main`): `<style>` blocks in `html/changelog.html`, `html/monitor.html`, `html/monitor-lab.html`; one `style=""` attribute in `changelog.html`; two `style=` strings inside JS templates in `js/monitor-lab.js` (lines ~283 and ~398); no `cssText`/`setAttribute('style')` in JS; 69 `.style.*` property assignments (Likely allowed under a strict `style-src`, because CSSOM property writes are not governed by inline-style CSP — **verify in Chrome**). Plan: move those blocks to `.css` files and classes, remove `'unsafe-inline'` from `style-src`, then load every extension page with DevTools open and fix every CSP violation. `changelog.html` is a removal candidate (Phase 2.5) and `monitor-lab` may move out of the shipped set (7.4), which shrinks the work. Severity note: this is defense-in-depth hardening, not an active vulnerability.
- [ ] **9.2 Accessibility (WCAG 2.1 AA as the target).** Measured baseline (Certain): ARIA is already used in places (12 `aria-label`, `aria-live`, `aria-sort`, `role="dialog"`); 8 `<img>` in `html/*.html` have no `alt` (mascot images → purely decorative: use `alt=""` or remove with the rebrand; `gsPreviewImg`/`gsTopBarImg` on `suspended.html` need a deliberate decision); `prefers-reduced-motion` handled only in the two monitor pages; **no** `prefers-color-scheme` handling found in `styles/` or `html/` — the extension uses its own `gsTheme` option (`light`/`dark`, default `light`) instead. Tasks: keyboard-only pass on popup/options/suspended/history, visible focus, contrast in both themes, add `reduced-motion` to the main stylesheet, consider a `system` theme value that follows `prefers-color-scheme` (owner decision; default stays `light`), run an automated checker (axe) and record results. Report anything not checked.
- [ ] **9.3 i18n and RTL.** Measured baseline (Certain): code that sets `dir="rtl"` exists (`gsUtils.js` ~450, `suspended.js` ~224), so RTL is partially handled; but 17 of 18 HTML pages have no `lang` attribute (only `monitor-lab.html` has `lang="ru"`), and the CSS uses physical properties heavily (`styles/style.css`: 55 matches for margin/padding/float/text-align/left/right; `styles/suspended.css`: 9), which will not mirror automatically in RTL (Likely — needs a visual check in `ar`, `he`, `fa`). Tasks: set `<html lang>` from the active locale on every page; convert physical to logical properties (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `text-align: start`) or add explicit `[dir=rtl]` overrides; screenshot-compare LTR vs RTL for popup, options, suspended, history; add a locale-integrity check (same key set or documented fallback to `en`; no raw `__MSG_...__`). `monitor-lab.*` is hard-coded in Russian outside the i18n system → translate through `_locales`, or exclude it from the release (7.4). New strings go to `en` only; do not machine-translate.
- [ ] **9.4 Incognito policy.** Measured baseline (Certain): manifest has `"incognito": "split"`; code checks `inIncognitoContext` in `gsSession.js` (skips startup/session handling), `gsStorage.js` (forces settings-sync off), `tgs.js` (context menu), and UI pages (hides incompatible items). **Not found:** any incognito check around preview/screenshot writes (`gsTabSuspendManager.js` → `gsIndexedDb.addPreviewImage(tab.url, ...)`) — so whether previews of incognito tabs are persisted is **unknown** (Guess: split mode gives incognito its own ephemeral storage, which would limit the impact; verify in Chrome). Chrome also only runs extensions in incognito if the user enables "Allow in Incognito". Owner decision (default recommended): the extension keeps working in incognito but **never persists** previews, sessions, backups or monitor data from incognito tabs. Add an explicit guard + a manual test.
- [ ] **9.5 Logging policy.** Measured baseline (Certain): `gsUtils.js` has `debugInfo = false` and `debugError = true`, so errors print to the console in release builds; nothing was found that persists logs. `gsBackup.js` has unconditional `console.log` debug steps ('Step 0…Step 4') that run in release, and `suspended.js` passes the whole tab object to `gsUtils.error`. Tasks: route every console output through `gsUtils` with levels; default = errors only, no URLs/titles (log tab ids and error codes); remove the raw `console.log` calls; add a dev-only flag (not user-visible, off in releases) for verbose logs; add a guard that flags raw `console.log` in shipped JS.
- [ ] **9.6 Performance budget.** Measure and record in `docs/PERFORMANCE.md`: service-worker cold start time, steady-state memory of the extension itself, time to suspend/restore a tab, behavior with 200+ tabs. Set thresholds; flag regressions. Report only what was measured.
- [ ] **9.7 Compatibility matrix** in `docs/TESTING.md`: Chrome Stable (latest and N-2), Brave (primary browser), and Edge on Windows/macOS/Linux — mark each cell Tested / Not tested. Do not claim untested cells. Brave-specific checks: load through `brave://extensions` with Developer mode, verify Task 0.8's same-ID check across two folders, and confirm Shields do not interfere with extension pages.
- [ ] **9.8 Repository security.** Branch protection on `main` (required status checks, no force-push), signed tags, GitHub Actions with least-privilege `permissions:` (default read-only), all third-party Actions pinned to full commit SHAs, no `pull_request_target`, secrets scanning enabled, Dependabot/alerts for dev tooling (keep dev dependencies near zero; lockfile committed if any). Document what the agent could not enable itself (these are GitHub settings the owner must switch on).
- [ ] **9.9 Release integrity.** `SHA256SUMS.txt` for every release; signed tag; if available, GitHub artifact attestation/provenance for the release zip (verify the current Action and its pinning before using it). Document verification steps in `docs/INSTALL.md`.
- [ ] **9.10 Update path without network.** The extension must not check for updates over the network. An "About" page may show the installed version and a plain link to the Releases page that opens only when the user clicks it.
- [ ] **9.11 Data lifecycle.** Verify that uninstalling the extension leaves no data in the extension's own storage (Chrome removes it), and that "Delete all data" in the privacy dashboard clears every registered store, including IndexedDB previews and backups created by `gsBackup.js`.
- [ ] **9.12 Dependency & license inventory** in `NOTICE`/`vendor/README.md`: every bundled third-party file with name, version, license, hash, upstream URL. Anything unverifiable is labelled **UNVERIFIED** and listed for the owner.
- [ ] **9.13 Debt gate.** Before tagging v0.1.0, `docs/AUDIT.md` must show every finding as Fixed / Won't fix (with owner-approved reason) / Accepted risk (owner-approved). No finding may remain "Open".
- [ ] **9.14 Session backup files (Certain).** `gsBackup.js` writes a **plain-text `.txt` file containing non-incognito open-tab URLs, grouped by window, into Downloads**. Current code defaults to weekly (`gsBackupFrequency = 10080`); owner decision: default OFF. On first run, show a one-time local-only extension page explaining the backup contents and destination, with controls to enable backups and select a frequency. Keep the completed Phase 0 product-name rename. Tasks: set default OFF and register alarms only when enabled; skip incognito tabs explicitly; never include titles/screenshots; disclose that files are not deleted automatically; include the Downloads file in the privacy registry; remove raw backup `console.log` steps. The notice must not make a network call.

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

**Phase 0 follow-up note (2026-10-27):** the owner-updated roadmap reset Phase 0 checkboxes 0.1–0.7 and 0.9 and cleared its prior status row, while commit `62d42b7` contains the earlier Phase 0 work. Do not infer those changes were undone. Task 0.4 is now complete on `phase-0-legal-branding` in commit `ee1b2e9`; that branch has not been merged. Task 0.8 remains open for the owner's manual two-folder ID verification in Brave.

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
> Execute Phase 2 using the mandatory evidence method. Follow the resolved owner decisions in section 5 for tasks 2.2, 2.3, and 2.7. For task 2.7, only stop automatic invocation; defer the conversion redesign to task 7.7 after task 3.8. Show the evidence table before any removal and do not change permissions before Gate B.

**Phase 3**
> Execute Phase 3. Never edit `security/*.lock.json` or the URL allowlist to make a failing guard pass; if a guard fails, tell me why and wait for my approval.

**Phase 4+**
> Execute Phase N from the roadmap, same rules as before. At the end, update the checkboxes in `TAB_KILLER_ROADMAP.md` and append a short status note under the phase.

---

## 9. Status log (agent: append here)

| Date | Phase/Task | Status | Verified how | Not tested |
|------|------------|--------|--------------|------------|
| 2026-10-27 | Phase 1 (1.1–1.6) | Complete; stopped at Gate A | Full task 1.1 file reads; source scans; docs/audit and vendor hash/provenance review | Browser/runtime tests, extension load, upstream artifact byte comparison; await owner Gate A approval |
| 2026-10-27 | Phase 0 (0.4) | Complete on `phase-0-legal-branding`; not merged | Pillow 12.3.0 script; generated sizes and PNG chunk checks; visual inspection at 16/32/48/128 px | Brave/Chrome load and runtime icon presentation; owner logo license confirmation |
| 2026-10-27 | Owner decisions | Recorded; Gate A still pending | Updated section 5, affected tasks, and audit recommendations | No Phase 2 implementation; owner review of revised `docs/AUDIT.md` pending |
