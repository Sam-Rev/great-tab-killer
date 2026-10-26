# AGENTS.md — Operating rules for coding agents

Project: **The Great Tab Killer** — a Manifest V3 Chromium extension that suspends inactive tabs. Local-first, open source (GPL-2.0), distributed via GitHub only (unpacked / release zip). **Not** on the Chrome Web Store.

Full plan: `TAB_KILLER_ROADMAP.md`. Master task prompt: `CODEX_PROMPT.md`. If anything here conflicts with a chat instruction from the owner, the owner's latest explicit instruction wins — but ask before relaxing any rule marked **[HARD]**.

## Hard rules

- **[HARD] No new permission, host permission, network call, remote script/style/font/image, telemetry, or runtime dependency** without explicit owner approval in the conversation. If a task seems to require one, stop and ask.
- **[HARD] Never edit `security/*.lock.json`, `security/url-allowlist.txt`, `vendor/CHECKSUMS.sha256`, or `tools/check-guards.mjs` just to make a failing check pass.** Explain the failure and wait.
- **[HARD] No AI-tool attribution** anywhere: no `Co-Authored-By:` trailers, no "Generated with ..." lines, no AI tool listed as author/contributor, in commits, PRs, or files.
- **[HARD] No remote code execution paths:** no `eval`, `new Function`, string timers, `importScripts` of remote URLs, `document.write`, or data-driven `innerHTML`.
- **[HARD] Never claim something works unless you ran it.** Report: done / verified (how) / not verified / not tested.
- **[HARD] No build step for the shipped extension.** The repo folder must load directly via `chrome://extensions` → Load unpacked. Dev tooling (tests, guards) may use Node but must stay dependency-light and out of the release zip.

## Working style

- One phase per branch (`phase-N-short-name`); small commits; Conventional Commits in English (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`).
- Do not delete code on a hunch: follow the evidence method in Phase 2 of the roadmap and log removals in `docs/CLEANUP_LOG.md`.
- Use confidence labels in docs and reports: **Certain** (verified), **Likely** (strong deduction), **Guess** (gap-filling). If most of a report is guesswork, say so in its first line.
- If the environment has no network or no browser, mark network/browser-dependent verification as **UNVERIFIED / NOT RUN** and provide exact manual steps for the owner. Never fake it.
- Prefer the smallest change that fully solves the problem. No drive-by refactors outside the current task.
- Ask the owner one precise question when blocked, instead of guessing.

## Communication with the owner

- Reply to the owner in **Moroccan Darija written in Arabic script**, mixed naturally with English technical terms (file names, commands, flags, error messages, git terms, library names stay in English/Latin and are never translated).
- The owner reads right-to-left: start every line/bullet with an Arabic-script word (put Latin terms inside the sentence, never at the start of a line).
- Be direct and rigorous. No flattery or filler agreement. If a request has a real flaw or risk, say it in the first sentence. Do not backtrack under pressure; change position only for new information or a better argument.
- Short sentences, short bullets, one idea per bullet. Start with the most useful thing.
- Everything that goes **into the repository** (code, comments, docs, commits, PR text) is in **English**.

## Architecture notes (keep updated)

- Service worker entry: `js/serviceWorker.js` (module). Core logic: `js/tgs.js` + `js/helpers/*`.
- A suspended tab is a normal tab whose URL is replaced with `html/suspended.html#ttl=…&pos=…&uri=…` (see `gsUtils.generateSuspendedUrl`). Treat every one of those parameters as untrusted input.
- The service worker can be terminated at any time: do not rely on in-memory timers/state for anything that must survive (use `chrome.alarms` + `chrome.storage`).
- Content script `js/contentscript.js` runs on all pages: keep it minimal and never expose a bridge to the page.
- Vendored libraries live in `js/helpers/` today (`html2canvas.min.js`, `dom-to-image.js`, `db.js`); they must be pinned with hashes and never edited in place.

## Definition of done for any task

1. Code/doc change committed with a clear message.
2. Guards/tests relevant to the task run (state which).
3. Docs updated (`CHANGELOG.md`, `PRIVACY.md`, `docs/*`) when behaviour, storage, or permissions change.
4. Roadmap checkbox updated + status note.
5. Final report in the required format (see `CODEX_PROMPT.md` §8).
