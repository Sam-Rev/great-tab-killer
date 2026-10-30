# Owner decisions

All items below are FINAL owner decisions. Do not reopen or reinterpret them unless the owner changes them explicitly.

## Project and distribution

- Product name: The Great Tab Killer. Forked GPL-2.0 code remains GPL-2.0; no custom license.
- Distribution is GitHub only, as unpacked files or a release ZIP; never the Chrome Web Store.
- Extension ID is fixed by manifest `key`: `odolpeeackiejlhdfpakabidhggghnlo`. Never put the private key in the repository.
- Keep Git history as-is: no rewrite, squash, or filter. Docs may reference commit hashes. Future owner commits use `SAM REV` with a GitHub noreply address; the owner configures Git. Push only `main` and tag `v0.1.0`; never push `local-0.1.0` or `phase-*` branches, and never use `--tags` or `--all`.
- No AI-tool attribution anywhere, including `Co-Authored-By` or “Generated with” lines.

## Permissions and compatibility

- Removed permanently: `history`, `cookies`, `management`, and `processes`, including their code.
- `system.cpu` and `system.memory` are optional; request them only from a user click. Monitor estimates must work without them.
- Host patterns, content-script matches, and CSP stay unchanged until task 3.11.
- `minimum_chrome_version` is 116, required by `runtime.getContexts()`.
- Final `web_accessible_resources` state: absent; extension pages and extension-initiated injections use their own resources without WAR.

## Privacy defaults

- The extension's own code makes no network requests to project-run servers and sends no data to them. Chrome-managed settings sync can transfer settings when enabled. Page previews are off by default; when enabled, bundled capture libraries run inside the captured page and may re-request resources that page already references (images, fonts, and stylesheets) from that page's own servers.
- Page previews are created by the SHA-256-pinned capture libraries injected from `gsTabSuspendManager.js`; the guard excludes those files from first-party network-pattern scans only because the vendor hashes are checked.
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
- Public copyright and branding name: **SAM REV**. The owner created the logo artwork and generated icons in Photoshop.
- The owner accepts `BRANDING.md` and its corresponding `NOTICE` addition as written.
- Anyone may use, modify, and fork the code under GPL-2.0. The product name **The Great Tab Killer** and logo/icon artwork are reserved branding of SAM REV and are not part of the code's GPL grant. The branding policy does not restrict any right granted by GPL-2.0 for the code. Users distributing modified versions may not use this name or these logo/icons; they must replace them with their own. Unmodified redistribution of an official release with its original branding is allowed. No endorsement may be implied, and no trademark registration is claimed.

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
- Every claim in `PRIVACY.md` must have an evidence row in `docs/audit/PRIVACY_CLAIMS.md`.
- Use English and concise reports, at most 15 lines. Do not reread large files already summarized; prefer `git diff --stat` and targeted searches.
