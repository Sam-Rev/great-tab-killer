# v0.1.0 release readiness plan

This audit was rechecked on `phase-4-release-prep` from `main` at `0ec1633` on 2026-10-30. No release has been published. The owner creates the GitHub repository and performs all pushes. No tag or release artifact was created in this task.

## Scope status

| v0.1.0 item | Status | Evidence and remaining work |
|---|---|---|
| Missing `tabProperties.url` runtime error | Partial | `gsTabSuspendManager.saveSuspendData()` rejects missing/unsafe URLs (`js/helpers/gsTabSuspendManager.js:510-512`); `gsIndexedDb.addSuspendedTabInfo()` has a defensive check (`js/helpers/gsIndexedDb.js:121-125`). Clean-profile smoke had no occurrence. The original cross-extension trigger was not reproduced or proven. |
| `Failed to fetch` runtime error | Partial | Favicon failures are caught and tested (`dev/tests/privacy-defaults.test.mjs`, `favicon fetch rejection is delivered to its caller`); Chrome smoke had no occurrence. The original stack/source remains unknown (see `docs/TESTING.md:97`). |
| `Failed to parse gsExtensionRecovery` | Done | Missing/malformed recovery state fails safely; `dev/tests/storage-schema.test.mjs` covers both cases. |
| A-21 service-worker `window.setTimeout` | Done | The worker path uses global `setTimeout` (`js/tgs.js:95`); `dev/tests/service-worker-globals.test.mjs` checks the worker module graph. Audit A-21 is Fixed in source. |
| Task 3.10 privacy defaults | Partial | Sync and backup default off; sampling, preview, backup and session paths filter incognito; `dev/tests/privacy-defaults.test.mjs` covers code wiring. No real incognito-window test has been run; Chrome shares local and sync storage across incognito contexts. |
| Task 3.7 safe DOM sinks | Done | DOM sink inventory: `docs/audit/DOM_SINK_REVIEW.md`; hostile fragment/title probe is in the Chrome smoke. Phase 3 sink commits include `ce1a120`. |
| Task 3.8 URL validation | Done | Shared HTTP(S)/file policy and fragment/import tests: `dev/tests/safe-navigation-url.test.mjs`; Phase 3 sink commit `ce1a120`. |
| Task 3.11 web-accessible resources | Done | `web_accessible_resources` is absent; A-25 is Fixed. Web-origin probe and favicon/suspend/restore evidence are in `docs/TESTING.md`; removal commits `6d84040`, `e17c21b`, `9cf3c6b`, `bb5ceec`. |
| Task 9.15 extension description | Done | English string is neutral; non-English description keys fall back to English. Commit `55e67f0`; 55 locale JSON files validated and unused-key scan found 0 candidates. |
| `PRIVACY.md` and evidence register | Done | `PRIVACY.md` and `docs/audit/PRIVACY_CLAIMS.md` document storage, defaults, permissions, history, content-script data and limits. Browser-specific claims remain explicitly Unverified. |
| `SECURITY.md` | Partial | Policy and controls are documented. `<OWNER: repository URL>` remains intentionally unresolved; private reporting URL and availability must be supplied by owner before publication. |
| GPL-2.0 `LICENSE` | Done | Tracked `LICENSE` is the complete GNU GPL version 2 text. No custom license is added; it was not edited. The owner-directed brand policy states explicitly that it does not restrict GPL code rights. |
| `NOTICE` | Partial | SAM REV copyright and separated branding paragraphs have been appended without changing inherited notices. db.js and Fontello license evidence remains incomplete. |
| `BRANDING.md` | Done | States the GPL code grant separately from reserved name/logo use, lists shipped owner-created artwork, permits unmodified official-release redistribution, and makes no registration or endorsement claim. |
| Vendored-library pins | Partial | `vendor/CHECKSUMS.sha256` and guard pin html2canvas, dom-to-image, and db.js. Audit A-20 remains Open because db.js provenance/version is unverified and capture behavior still needs browser testing. Fontello provenance/license is also Unverified in `NOTICE`. |
| Guard and tests | Done | After this branch's safe cleanups, `node tools/check-guards.mjs` passed and the full Node suite passed 66/66 on 2026-10-30. |
| Chrome clean-profile smoke | Done | Chrome smoke passed on 2026-10-30: extension loaded, setup shown once, backups stayed off/alarm absent, five tabs suspended/restored, WAR web requests blocked, no prior runtime signatures, and extension errors were empty. Brave/incognito UI checks remain owner-manual. |
| Release packaging and install materials | Missing | `README.md` exists but was not edited here; `docs/INSTALL.md`, release ZIP, `SHA256SUMS.txt`, and public `v0.1.0` tag do not exist yet. |

### Current audit items not accepted as v0.2.0 risks

The only findings still **Open** outside the owner-accepted v0.2.0 list are A-06 (internal runtime dispatcher lacks universal sender validation), A-08 (foreign suspended-tab migration remains dormant and its conversion flow is deferred to task 7.7), A-12 (backup path still logs step details/error stack), and A-20 (vendored capture/dependency provenance and runtime behavior follow-up). A-21 is Fixed in source. A-11 is Mitigated in source; generated backup text files remain user-managed. Accepted v0.2.0 findings are A-10, A-13, A-14, A-15, and A-22.

### Branding / GPL separation

The owner directed that restrictions be stated as conditions on use of SAM REV branding, not on GPL code rights. `BRANDING.md`, `NOTICE`, and `docs/DECISIONS.md` say the branding policy does not restrict any right granted by GPL-2.0 for the code. `LICENSE` was not edited; inherited copyright/license notices were retained unchanged. This is the owner's policy wording, not a legal conclusion or legal advice.

## Shipped-tree size audit

Method: tracked files only; exclude `dev/`, `docs/`, `tools/`, `assets/source/`, `.git/`, `tests/`, and Markdown other than `LICENSE` and `NOTICE`. This literal boundary includes repository metadata and security/vendor guard inputs, so it is conservative and not yet the final release-script file list. Untracked owner logo sources are excluded. Sizes are current working-tree bytes; the ZIP estimate uses Python's ZIP_DEFLATED level 9 and can vary by ZIP tool.

- **141 files; 2,303,999 bytes (2.20 MiB) uncompressed.** Estimated compressed archive: **673,480 bytes (657.7 KiB)**.
- `images/`: 198,567 bytes. `font/`: 6,408 bytes.
- Largest tracked file in this payload: `js/helpers/html2canvas.min.js` (281,609 bytes). No tracked payload file exceeds 1 MiB.
- Three untracked owner logo sources are each over 1 MiB and are excluded: `Tab_Killer_logo.png` (1,301,108 bytes), `Tab_Killer_logo_2.png` (1,147,323 bytes), and `Tab_Killer_logo 2.jpg` (1,082,937 bytes). They are now listed in `.gitignore`.

### 20 largest payload files

| Bytes | File |
|---:|---|
| 281,609 | `js/helpers/html2canvas.min.js` |
| 169,340 | `images/tab-killer-logo.png` |
| 58,372 | `js/tgs.js` |
| 45,103 | `js/monitor-lab.js` |
| 40,223 | `_locales/ru/messages.json` |
| 38,352 | `js/monitor.js` |
| 35,166 | `js/helpers/db.js` |
| 29,700 | `_locales/en/messages.json` |
| 29,567 | `_locales/th/messages.json` |
| 29,335 | `_locales/bn/messages.json` |
| 28,582 | `js/helpers/gsSession.js` |
| 28,200 | `js/helpers/dom-to-image.js` |
| 27,836 | `_locales/el/messages.json` |
| 27,075 | `_locales/uk/messages.json` |
| 26,692 | `_locales/bg/messages.json` |
| 26,424 | `js/helpers/gsUtils.js` |
| 25,699 | `_locales/sr/messages.json` |
| 25,370 | `_locales/kn/messages.json` |
| 24,889 | `_locales/ar/messages.json` |
| 24,371 | `_locales/fa/messages.json` |

### Locale folder sizes

| Locale | Bytes | Locale | Bytes | Locale | Bytes |
|---|---:|---|---:|---|---:|
| `am` | 18,506 | `ar` | 24,889 | `bg` | 26,692 |
| `bn` | 29,335 | `ca` | 20,669 | `cs` | 20,508 |
| `da` | 20,369 | `de` | 20,911 | `el` | 28,200 |
| `en` | 29,700 | `en_AU` | 20,075 | `en_GB` | 20,075 |
| `en_US` | 20,074 | `es` | 21,720 | `es_419` | 21,720 |
| `et` | 20,186 | `fa` | 24,371 | `fi` | 21,226 |
| `fil` | 20,071 | `fr` | 22,009 | `gu` | 20,258 |
| `he` | 22,626 | `hi` | 20,229 | `hr` | 20,480 |
| `hu` | 21,664 | `id` | 20,351 | `it` | 21,399 |
| `ja` | 23,111 | `kn` | 25,370 | `ko` | 21,075 |
| `lt` | 20,881 | `lv` | 20,644 | `ml` | 20,351 |
| `mr` | 20,233 | `ms` | 20,065 | `nl` | 20,636 |
| `no` | 20,108 | `pl` | 20,894 | `pt_BR` | 20,849 |
| `pt_PT` | 21,122 | `ro` | 21,253 | `ru` | 40,223 |
| `sk` | 20,632 | `sl` | 20,048 | `sr` | 25,699 |
| `sv` | 20,372 | `sw` | 17,362 | `ta` | 20,390 |
| `te` | 20,305 | `th` | 29,567 | `tr` | 21,066 |
| `uk` | 27,075 | `vi` | 22,022 | `zh_CN` | 19,596 |
| `zh_TW` | 19,462 | | | | |

### Zero-reference scan and deletion decision

The scan checked resource paths/basenames against `manifest.json`, shipped HTML, CSS, JS, and locale JSON; dynamic module and locale paths were treated conservatively. It found no unreferenced runtime image, font, HTML, CSS, JavaScript, or locale file.

Files with no application-source reference are intentional inputs/metadata, not deletion candidates: `manifest.json` is the extension entry point; `security/permissions.lock.json`, `security/service-worker-graph-allowlist.json`, `security/url-allowlist.txt`, and `vendor/CHECKSUMS.sha256` are consumed by `tools/check-guards.mjs`; `.gitignore` and `.github/CODEOWNERS` serve repository tooling; `LICENSE` and `NOTICE` are distribution/legal notices. No shipped runtime file was deleted. Removing locales/fonts/images would change behavior or coverage and is left for owner decision; the measurable savings are represented by their per-folder/file sizes above.

## Repository hygiene

- Before cleanup, one tracked documentation line exposed a local private-key path and account name in `docs/KEY_NOTES.md`. It was generalized in commit `90f0a4b`; a tracked-file rescan found no machine-specific local paths or owner account name. No tracked e-mail address or API-key/token pattern was found.
- `git log` shows two distinct author/committer identities: the owner display name with a local-only address, and `Project Owner` with another local-only address. Neither uses the requested public name and GitHub noreply address. Current counts are obtained with `git log --format='%an <%ae> | %cn <%ce>' | sort | uniq -c`; exact local account identifiers are reported to the owner, not copied into tracked release docs.
- No `.pem` or private-key-named file is tracked. `manifest.json` contains the extension's base64 public key only; the external private key path was removed from tracked docs. `LICENSE` is GPL-2.0. `NOTICE` retains inherited attributions and third-party entries unchanged; SAM REV copyright and branding paragraphs are appended after those notices.
- History identity choices for the owner, with no action taken: **A)** keep local identities public (transparent history, but exposes `localhost` addresses and inconsistent author name); **B)** publish a new single “initial import” commit authored as SAM REV while keeping full history private (clean public identity, but loses public change provenance/bisectability); **C)** rewrite existing authors before the first push (preserves commit graph/content but changes every affected hash and carries history-rewrite/collateral-risk). No history was rewritten.

## Ordered work before publication

| Order | Work | Owner / agent |
|---:|---|---|
| 1 | Create the GitHub repository; enable 2FA, private vulnerability reporting, branch protection, and secret scanning. Hide the personal e-mail and configure GitHub noreply for future commits. Decide history option A/B/C. | Owner |
| 2 | Supply the repository URL to replace `<OWNER: repository URL>` and confirm private reporting is enabled after repository creation. | Owner |
| 3 | Add or revise `README.md` and create `docs/INSTALL.md`; document manual unpacked install, file URL access, update/checksum procedure, and safe migration order. | Agent, after owner supplies repository details |
| 4 | Add CI workflow for guard and tests. Verify each GitHub Action's full commit SHA from its real GitHub repository, grant least-privilege workflow permissions, and stop for owner input if any SHA cannot be verified. | Agent |
| 5 | Add a release script using an explicit shipped-file list; build the ZIP and `SHA256SUMS.txt`, then verify the archive and file list. | Agent |
| 6 | Run final clean-profile verification and review the completed release artifacts and notes. | Agent prepares; owner reviews |
| 7 | Create/publish the `v0.1.0` tag and GitHub release only after owner approval. | Owner approval; agent can prepare local tag/artifacts when explicitly asked |
