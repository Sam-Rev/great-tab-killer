# Owner decisions

All items below are FINAL owner decisions. Do not reopen or reinterpret them unless the owner changes them explicitly.

## Project and distribution

- Product name: The Great Tab Killer. Forked GPL-2.0 code remains GPL-2.0; no custom license.
- Distribution is GitHub only, as unpacked files or a release ZIP; never the Chrome Web Store.
- Extension ID is fixed by manifest `key`: `odolpeeackiejlhdfpakabidhggghnlo`. Never put the private key in the repository.
- Do not push unless asked. Use merge commits; no squash or history rewriting. `local-0.1.0` is local only; `v0.1.0` is reserved for public release.
- No AI-tool attribution anywhere, including `Co-Authored-By` or “Generated with” lines.

## Permissions and compatibility

- Removed permanently: `history`, `cookies`, `management`, and `processes`, including their code.
- `system.cpu` and `system.memory` are optional; request them only from a user click. Monitor estimates must work without them.
- Host patterns, content-script matches, and CSP stay unchanged until task 3.11.
- `minimum_chrome_version` is 116, required by `runtime.getContexts()`.
- Final `web_accessible_resources` state: absent; extension pages and extension-initiated injections use their own resources without WAR.

## Privacy defaults

- Shipped code has no telemetry, remote code, or network calls. Nothing leaves the machine.
- Settings sync is opt-in and OFF by default.
- Session backup is opt-in and OFF by default. Offer it once on the setup page with **Enable backups** and **Not now**; create its alarm only after Enable. Never enable it automatically at install.
- Resource monitor and background sampling are OFF by default.
- Exclude incognito tabs from sampler, previews, backups, and saved sessions.
- Suspended pages remain in browser history; do not add a history-cleanup listener.

## Removed or changed code

- Do not restore the notice system, external messaging (`onMessageExternal`), cookie migration, inherited legacy migrations, management UI, processes UI, donation pages, or third-party uninstall URL.
- This project starts at `schemaVersion` 1; do not restore inherited migrations.
- `migrateForeignSuspendedTabs` must not run automatically. A manual, validated, user-confirmed conversion flow is planned as task 7.7 in v0.2.0; until then it stays dormant.

## Branding

- Logo v2 is final; simplified 16/32 px icons are approved.
- Show the logo on the suspended page. Keep the original site's favicon on the suspended tab.

## Scope

- v0.1.0 scope: fix runtime errors, A-21, privacy defaults (done), safe DOM sinks (3.7), URL validation (3.8), narrow `web_accessible_resources` (3.11), description text (9.15), short `PRIVACY.md` and `SECURITY.md`, and release engineering.
- Owner-approved v0.2.0 risks: A-10, A-13, A-14, A-15 (retention and complete wipe), A-22 (queue durability), tasks 9.1, 9.2, 9.3, 9.6, 9.7, Tab Groups, export/import, privacy dashboard, and task 7.7.

## Guards and process

- Never weaken the guard, permission lock, URL allowlist, or vendor checksums to pass a check.
- Allowlist entries require explicit owner approval, keyed by file, enclosing function, and exact pattern, with a one-line reason.
- If guard or tests fail, stop and report; do not merge or tag.
- Keep dev tooling out of shipped files. No new runtime dependency or permission without owner approval.

## Testing and communication

- The automated Chrome 156 clean-profile smoke test is documented in `docs/TESTING.md`.
- Brave and Chrome's internal Errors page are owner-manual checks; report anything not independently verified.
- Use English and concise reports, at most 15 lines. Do not reread large files already summarized; prefer `git diff --stat` and targeted searches.
