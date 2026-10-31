# v0.1.0 release readiness plan

This audit was updated on `phase-5-release` from `main` at `1f588ab` on 2026-10-30. The public repository is `https://github.com/Sam-Rev/great-tab-killer`; the owner reports it is empty and nothing has been pushed. The local release ZIP and checksum were prepared; no tag or GitHub release was created.

## Scope status

| v0.1.0 item | Status | Evidence and remaining work |
|---|---|---|
| Missing `tabProperties.url` runtime error | Partial | Fixed to fail safely: suspension validates the live URL and IndexedDB rejects missing URLs (`js/helpers/gsTabSuspendManager.js:510-512`; `js/helpers/gsIndexedDb.js:121-125`). The trigger was not reproduced in a clean profile; a competing suspender is a likely cause, but unverified. |
| `Failed to fetch` runtime error | Partial | Fixed to fail safely: favicon request failures are caught and tested (`dev/tests/privacy-defaults.test.mjs`, `favicon fetch rejection is delivered to its caller`); Chrome 156 clean-profile smoke did not reproduce it. The original trigger was not reproduced in a clean profile; a competing suspender is a likely cause, but unverified (see `docs/TESTING.md:97`). |
| `Failed to parse gsExtensionRecovery` | Done | Missing/malformed recovery state fails safely; `dev/tests/storage-schema.test.mjs` covers both cases. |
| A-21 service-worker `window.setTimeout` | Done | The worker path uses global `setTimeout` (`js/tgs.js:95`); `dev/tests/service-worker-globals.test.mjs` checks the worker module graph. Audit A-21 is Fixed in source. |
| Task 3.10 privacy defaults | Partial | Planned follow-up: task 3.10's manual incognito verification. Sync and backup default off; sampling, preview, backup and session paths filter incognito; `dev/tests/privacy-defaults.test.mjs` covers code wiring. No real incognito-window test has been run; Chrome shares local and sync storage across incognito contexts. |
| Task 3.7 safe DOM sinks | Done | DOM sink inventory: `docs/audit/DOM_SINK_REVIEW.md`; hostile fragment/title probe is in the Chrome smoke. Phase 3 sink commits include `ce1a120`. |
| Task 3.8 URL validation | Done | Shared HTTP(S)/file policy and fragment/import tests: `dev/tests/safe-navigation-url.test.mjs`; Phase 3 sink commit `ce1a120`. |
| Task 3.11 web-accessible resources | Done | `web_accessible_resources` is absent; A-25 is Fixed. Web-origin probe and favicon/suspend/restore evidence are in `docs/TESTING.md`; removal commits `6d84040`, `e17c21b`, `9cf3c6b`, `bb5ceec`. |
| Task 9.15 extension description | Done | English string is neutral; non-English description keys fall back to English. Commit `55e67f0`; 55 locale JSON files validated and unused-key scan found 0 candidates. |
| `PRIVACY.md` and evidence register | Done | `PRIVACY.md` and `docs/audit/PRIVACY_CLAIMS.md` document storage, defaults, permissions, history, content-script data and limits. Browser-specific claims remain explicitly Unverified. |
| `SECURITY.md` | Partial | The repository URL is now set to `https://github.com/Sam-Rev/great-tab-killer`; task 6.2 policy text is present. The owner still needs to confirm GitHub private vulnerability reporting is enabled for the repository before publishing. |
| GPL-2.0 `LICENSE` | Done | Tracked `LICENSE` is the complete GNU GPL version 2 text. No custom license is added; it was not edited. The owner-directed brand policy states explicitly that it does not restrict GPL code rights. |
| `NOTICE` | Partial | SAM REV copyright and separated branding text are present. Task 9.12: db.js 0.15.0 MIT metadata and license text are verified from upstream; exact equivalence of the bundled copy remains unverified. |
| `BRANDING.md` | Done | States the GPL code grant separately from reserved name/logo use, lists shipped owner-created artwork, permits unmodified official-release redistribution, and makes no registration or endorsement claim. |
| Vendored-library pins | Partial | `vendor/CHECKSUMS.sha256` and the guard pin html2canvas, dom-to-image, and db.js. A-20 is owner-accepted: html2canvas's normalized output matches the official artifact; runtime equivalence remains unverified. db.js metadata/license are recorded in `NOTICE` and `vendor/README.md`; exact source equivalence remains **UNVERIFIED** (task 9.12). |
| Unverified icon font | Done | Removed both font files and the font stylesheet; the three UI icon types, checkbox marks, and dropdown chevron use original CSS-drawn shapes. No font license or outline is included. |
| `README.md` and `docs/INSTALL.md` | Done | Public repository links, supported browser/testing scope, privacy defaults, known risks, unpacked installation, checksum verification, update/uninstall, and migration order are documented. |
| Release ZIP and checksum | Done | The release archive uses a literal allowlist and normalized names, sizes, timestamps, CRC32 values, permissions, and ZIP metadata. Two local builds can be compared byte-for-byte, but zlib versions can change DEFLATE bytes across machines. The CI release job's published archive and checksum are authoritative; archive tests verify root manifest, exact allowlist, excluded paths, and manifest references. |
| CI and release workflows | Partial | `.github/workflows/ci.yml` and `release.yml` use only verified `actions/checkout` v4.2.2 SHA `11bd71901bbe5b1630ceea73d27597364c9af683`; workflows were not run per instruction. |
| Guard and tests | Done | `node tools/check-guards.mjs` passed; Node suite 68/68; Python package tests 3/3; `node tools/check-release-ready.mjs` passed. |
| Chrome clean-profile smoke | Done | Chrome 156.0.8078.79 passed against both repository and extracted ZIP. Each run opened welcome/setup once, suspended/restored five local tabs, reported zero extension errors, and found none of the three prior error signatures. Brave/incognito UI checks remain owner-manual. |
| Public v0.1.0 release | Missing | No tag, GitHub release, or push was made; these remain for the owner-approved publication step (roadmap task 9.9). |

### Current audit items not accepted as v0.2.0 risks

The audit debt gate is now satisfied: A-06 and A-20 are Accepted risks for v0.1.0 (owner-approved), A-08 is Mitigated as dormant pending task 7.7 in v0.2.0, and A-12 is Fixed in source (`14422ea`). No finding remains Open. A-11 is Mitigated in source; generated backup text files remain user-managed. Accepted v0.2.0 findings are A-10, A-13, A-14, A-15, and A-22.

### Branding / GPL separation

The owner directed that restrictions be stated as conditions on use of SAM REV branding, not on GPL code rights. `BRANDING.md`, `NOTICE`, and `docs/DECISIONS.md` say the branding policy does not restrict any right granted by GPL-2.0 for the code. `LICENSE` was not edited; inherited copyright/license notices were retained unchanged. This is the owner's policy wording, not a legal conclusion or legal advice.

## Shipped-tree size audit

Actual packaging follows the exact `tools/release-files.txt` allowlist; it excludes `dev/`, `docs/`, `tools/`, `tests/`, `assets/source/`, `.git*`, the developer-only monitor lab, and owner root logo files. The ZIP includes the extension runtime tree plus `LICENSE`, `NOTICE`, and `BRANDING.md`.

- **131 files; 2,227,769 bytes (2.12 MiB) uncompressed.** Compressed ZIP: **643,540 bytes (628.5 KiB)**.
- `images/`: 198,567 bytes. No font files are shipped.
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
- Owner decision: keep Git history unchanged (option A); do not rewrite, squash, or filter. One imported upstream baseline commit remains authored as `Project Owner <owner@localhost>`; its hash is reported in this task's completion report. Future owner commits use `SAM REV` with a GitHub noreply address, configured by the owner.
- No `.pem` or private-key-named file is tracked. `manifest.json` contains the extension's base64 public key only; the external private key path was removed from tracked docs. `LICENSE` is GPL-2.0. `NOTICE` retains inherited attributions and third-party entries unchanged; SAM REV copyright and branding paragraphs are appended after those notices.
- Push policy: only `main` and tag `v0.1.0` may ever be pushed. Never push `local-0.1.0` or any `phase-*` branch; never use `--tags` or `--all`. No push is authorized by this task.

## Ordered work before publication

| Order | Work | Owner / agent |
|---:|---|---|
| 1 | Confirm repository security settings (private vulnerability reporting, branch protection, secret scanning) and owner GitHub noreply config. | Owner; unverified |
| 2 | Repository URL decision and placeholder replacement; confirm private vulnerability reporting. | URL replacement done: `https://github.com/Sam-Rev/great-tab-killer`; owner must confirm private reporting is enabled. |
| 3 | README and unpacked-install instructions, including file URL access, checksum procedure, update and migration order. | Done on `phase-5-release` |
| 4 | CI and release workflow definitions; verify the single external Action SHA and least-privilege permissions. | Done; checkout v4.2.2 SHA verified from upstream tag. Workflows not run. |
| 5 | Build ZIP and `SHA256SUMS.txt` from a literal allowlist; test contents and reproducibility. | Done: archive tests compare sorted names, sizes, fixed timestamps, CRC32 values, normalized permissions and ZIP metadata. Cross-machine byte identity is not guaranteed because DEFLATE output may vary by zlib version; publish the CI release job's archive hash. |
| 6 | Run clean-profile smoke against repository and extracted ZIP; owner reviews release materials. | Done on Chrome 156.0.8078.79 for both paths; owner review remains. |
| 7 | Create/publish tag `v0.1.0` and GitHub release only after explicit owner approval. | Owner approval; not done in this task |
