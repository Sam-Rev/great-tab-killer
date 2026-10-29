# Agent operating rules

## Before any task

- Read `docs/DECISIONS.md` first.
- Never change a FINAL decision.
- Work on one task at a time.
- Do not merge, tag, push, or edit allowlists unless the task explicitly says so.
- If a task conflicts with a decision or is ambiguous, stop and ask one question with 2–3 options and a recommended default.
- Do not invent a different approach.

## Hard rules

- Never edit security locks, allowlists, vendor checksums, or guards just to make a failing check pass. Explain the failure and stop.
- Never add remote execution, data-driven `innerHTML`, or a shipped build step.
- Never claim a check passed unless it was run. Clearly label what was verified, not verified, or not tested.
- Dev tooling must stay dependency-light and out of the shipped extension.

## Working rules

- Use small Conventional Commits in English. Do not delete code without evidence; record removals in `docs/CLEANUP_LOG.md`.
- Use **Certain**, **Likely**, and **Guess** confidence labels in findings and reports.
- If browser or network verification is unavailable, say **UNVERIFIED / NOT RUN** and provide exact manual steps.
- Prefer the smallest complete change. Do not make unrelated edits.
- Do not reread large files already reviewed unless needed; use targeted searches and existing audit citations.
- Keep repository content and owner communication in English and concise.

## Architecture notes

- Service worker entry: `js/serviceWorker.js`; core: `js/tgs.js` and `js/helpers/*`.
- Suspended-page URL parameters are untrusted input.
- Service workers can stop at any time; persistent timing/state uses alarms and storage.
- Content scripts on web pages stay minimal and expose no page bridge.
- Vendored libraries in `js/helpers/` are pinned and never edited in place.
