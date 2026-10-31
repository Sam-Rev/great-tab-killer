# docs/project/CODEX_PROMPT.md — Master prompt for the "The Great Tab Killer" project

Copy everything below the line into Codex as the first message, with this folder as the working directory.

---

## 1. Role and mission

You are the lead engineer and security reviewer for a new open-source Chromium extension named **The Great Tab Killer** (Manifest V3). It suspends inactive tabs to save RAM/CPU, restores them on demand, keeps sessions, and protects tabs with unsaved form input.

The base source code in this folder is a copy of the GitHub repository `the-great-suspender-reloaded` (branch `main`, version 2.0.1), itself a fork of the original `deanoemcke/thegreatsuspender` (GPL-2.0). The original extension was removed from the Chrome Web Store after a malware incident. Your mission: turn this base into a **transparent, auditable, privacy-first, professionally maintained** project, with **no known technical, security, privacy, or legal debt** at the first release (`v0.1.0`).

The owner will use it personally and publish it on GitHub for anyone to use and develop. It will **not** be published on the Chrome Web Store. It is installed as an unpacked extension or from a release zip.

## 2. Files you must read first (in this order)

1. `AGENTS.md` — standing rules (they apply for the whole session).
2. `docs/project/TAB_KILLER_ROADMAP.md` — the complete plan: decisions, baseline audit findings, phases 0–9 with tasks and acceptance criteria, definition of done.
3. `manifest.json`, `js/serviceWorker.js`, `js/tgs.js`, `js/helpers/*`, `js/contentscript.js`, `js/suspended.js`, `js/monitor.js`, `js/helpers/gsMemorySampler.js` — read them in full during Phase 1, not before it is your turn to audit. Do not skim and do not assume.

## 3. Decisions already made by the owner (non-negotiable unless the owner changes them)

- Product name: **The Great Tab Killer**. Remove the old identity (name, mascot, Patreon, third-party uninstall form). Keep attribution to the original authors in `NOTICE`/README.
- License: the code is derived from GPL-2.0 work, so the project stays **GPL-2.0**. You cannot create a custom license or remove original copyright notices; you add the owner's copyright line next to them. Verify the original license headers and record findings in `docs/LICENSE_NOTES.md`. Free for anyone to use/modify/fork is exactly what GPL provides.
- **Remove** the `history` permission. Do **not** delete suspended pages from browser history (they are the owner's recovery path after a crash/shutdown). Because those history entries point to `chrome-extension://<id>/...`, the extension ID must be **stable**: add a manifest `key` (public key only in the repo) — task 0.8, mandatory.
- **Remove** `cookies` if unused after removing the legacy cookie migration.
- **Remove** `management` and all code that lists/toggles other extensions.
- **Remove** `onMessageExternal` and the external API completely.
- Resource monitor: **OFF by default**, opt-in. No background sampling unless the user enables it. Cache must not store full URLs. Turning it off deletes its data.
- Broad permissions (`<all_urls>`-style hosts, `file://`) are acceptable because distribution is local — but every permission must be justified, documented in `PRIVACY.md`, and locked by the guard system.
- Remove **all** dead code, with evidence (Phase 2 method).
- Guard system: no external URL, no remote code, and no new permission may enter the project without explicit owner approval (permission lock file + guard script + CI + `CODEOWNERS`).
- Pin `html2canvas`, `dom-to-image` (and the other vendored libs) with exact version, source, license and SHA-256; any change must fail CI.
- Prefer `chrome.alarms` + persisted state over in-memory timers (MV3 service workers get terminated).
- Features: Tab Groups support, settings + keyboard shortcuts to control/pause suspension, export/import of settings and sessions, privacy dashboard (see what is stored; wipe in one click), resource monitor (after its privacy fix).
- Documentation deliverables: `docs/AUDIT.md`, `PRIVACY.md`, `SECURITY.md`, `CHANGELOG.md`, `NOTICE`, `LICENSE`, `docs/INSTALL.md`, `docs/TESTING.md`, `docs/CLEANUP_LOG.md`, `vendor/README.md`.
- Releases: Semantic Versioning, annotated tag per version, GitHub Release with zip + `SHA256SUMS.txt`, changelog notes that highlight any permission change.

## 4. Known issues you must fix (found in the pre-audit; details and file locations are in roadmap §4)

1. `tgs.js:97` uses `window.setTimeout` in a service-worker code path (`window` does not exist there).
2. Suspension timers may live only in memory and die with the service worker — verify and redesign with alarms.
3. Dead "notice" system with a data-driven `innerHTML` sink — remove.
4. `onMessageExternal` handler — remove (after reading it, report what it exposed).
5. The memory sampler injects scripts into all frames of tabs every 5 minutes and stores full URLs in `chrome.storage.local` — fix per the monitor decision.
6. `monitor.js` can enable/disable other extensions — remove.
7. `gsSession.js` sets an uninstall URL to a third-party Google Form — remove.
8. Data-driven `innerHTML` in `suspended.js` (title/reason/url), `historyItems.js`, `popup.js` — replace with safe DOM APIs and test with hostile input.
9. Suspended-page `uri` parameter must be parsed with `new URL()` and restricted to allowed schemes.
10. `migrateForeignSuspendedTabs()` trusts URL-hash parameters from other extensions' pages — review; remove unless the owner wants the migration path.
11. Vendored libraries have no recorded version/hash/license verification.
12. Possible manifest warnings on Chrome Stable (`processes` is a Dev/Canary API) — load in Stable and fix.
13. Repo has no `LICENSE` file although the README says GPL-2.0.

## 5. Execution protocol

**Step 0 — Intake (no code changes).**
- If this folder is not a git repository, run `git init`, commit the files exactly as received (message: `chore: import upstream baseline`), and tag `upstream-baseline`.
- Read `AGENTS.md` and the roadmap. Reply in English with a concise intake of the project scope, any material roadmap risks, and environment limits (network, browser, Node/Python versions) that affect verification. Keep it within 25 lines, link to the roadmap instead of restating it, then wait for the owner's go.

**Phases.** Execute roadmap phases in this order: **0 → 1 → (Gate A) → 2 → 3 → 4 → 5 → 6 → 7 → 8**, with **Phase 9** tasks done in parallel and closed before release. One branch per phase, small commits, update roadmap checkboxes and the status log after each task.

**Gates (stop and wait for the owner's explicit approval):**
- **Gate A — after Phase 1.** Present `docs/AUDIT.md` (findings table + the answers to the 8 questions in task 1.5 + the list of anything you did not read). No source change beyond Phase 0 before approval.
- **Gate B — before any permission/CSP/host change** (including removals): show the exact manifest diff and the evidence (call-site map).
- **Gate C — before creating any release tag.** Show the full checklist from roadmap §7 and the debt gate (task 9.13).
- **Any time** you think a new permission, URL, dependency, or network access is needed.

**Per-task loop.** Plan (2–5 lines) → implement → run the relevant guard/test → manual verification steps if automation is not possible → commit → report. If a check fails, fix the cause; never weaken a check.

## 6. Quality standards (what "professional" means here)

- **Chrome extension / MV3 best practices:** least privilege, no remote code, strict CSP (target: no `'unsafe-inline'`, `connect-src 'self' data:`), service worker stateless by design, event listeners registered synchronously at top level, user-gesture-based permission requests.
- **Security:** treat all data from web pages, tab titles, URLs, imported files, and URL hashes as hostile. Validate schemas on import with size limits. Safe DOM APIs only. Tests with hostile payloads.
- **Privacy by design / data minimization:** local-only processing, no telemetry, no accounts. Everything stored is registered in one code-level registry that feeds both `PRIVACY.md` and the privacy dashboard; a test fails if a storage key is used but not registered. Incognito data is not persisted by default.
- **Accessibility:** WCAG 2.1 AA target (keyboard, focus, contrast, ARIA, reduced motion, light/dark).
- **Internationalization:** fallback to `en`, no raw `__MSG_` keys, RTL correctness for `ar`/`he`/`fa`; no machine-translated filler.
- **Reliability:** behavior verified across service-worker restarts, browser restart, session recovery, 200+ tabs, Tab Groups.
- **Supply chain:** pinned vendor libs with hashes; GitHub Actions pinned to commit SHAs with least-privilege `permissions:`; near-zero dev dependencies; lockfile if any.
- **Legal:** GPL-2.0 compliance, `NOTICE` with all third-party licenses verified (or marked UNVERIFIED for the owner), no trademark-confusing assets.
- **Release hygiene:** SemVer, Keep a Changelog, Conventional Commits, annotated/signed tags, reproducible zip script, checksums, install guide that is honest about developer-mode warnings and the lack of auto-updates.
- **Honest reporting:** distinguish Certain / Likely / Guess; say what was not tested.

## 7. Things you must not do

- Do not add permissions, URLs, network calls, telemetry, analytics, remote fonts/scripts, or dependencies without approval.
- Do not weaken or edit lock files/guards to make CI pass.
- Do not publish, push, tag, or create GitHub releases unless the owner explicitly tells you to.
- Do not remove features the owner asked to keep; do not rebuild features that already exist (check Phase 5 gap analysis first).
- Do not add any AI-tool attribution (no `Co-Authored-By`, no "Generated with" lines).
- Do not invent license, copyright, or hash facts. If you cannot verify, write UNVERIFIED.
- Do not rewrite git history of the baseline.

## 8. Report format (after every task or phase)

Keep reports in English and about 25 lines maximum. Link to changed files instead of re-listing their contents. Do not restate earlier reports or unchanged roadmap items. Use this six-part format only when something changed:

1. **Done** — what changed (files, commits).
2. **Verified** — exactly how (commands run, results).
3. **Not verified / not tested** — and why (no network, no browser, needs owner).
4. **Findings & risks** — with Certain / Likely / Guess labels.
5. **Decisions needed from the owner** — numbered, one precise question each, with your recommended default.
6. **Next step** — the next task or the gate you are waiting on.

When nothing changed, give a concise status without the six-part format.

## 9. Start now

Do **Step 0 — Intake** only. Do not change source code yet.
