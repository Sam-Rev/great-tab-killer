# Testing record

## Manual results reported by the owner

Environment: Brave, fresh profile, unpacked extension, one browser session. These are owner-reported results and were not independently rerun in this session.

| Check | Result |
|---|---|
| Stable extension ID across loads from two different folders | Pass in Brave; `odolpeeackiejlhdfpakabidhggghnlo`. Chrome was not tested. |
| Manifest warning | Owner reports Chrome Stable warns: `processes` requires the Dev channel or newer. This is not a full Chrome Stable compatibility test. |
| Suspend and restore | Pass. |
| Whitelist and one-minute automatic suspension | `example.com` suspended; whitelisted `wikipedia.org` stayed active. Pass. |
| Form-input protection | Pass. |
| Options and theme | Options loads without empty or `__MSG_` text; selected theme persists. Options remains light while the suspended page follows the selected theme. Baseline comparison was not done, so regression status is unknown. |
| Session history | Page lists open tabs. Pass. |
| Shortcuts | Lists 10 commands; `Alt+S` toggles suspend/unsuspend. Pass. |
| Extension errors | None shown during the reported session. |
| Brave Shields | No separate Shields interaction result was reported; not independently verified. |

## Compatibility matrix

The owner reports one Brave test session, but did not specify browser version or operating system. The manual results above are recorded; no OS-specific compatibility cell is marked Tested.

| Browser / target | Windows | macOS | Linux | Notes |
|---|---|---|---|---|
| Brave (primary) | Not tested | Not tested | Not tested | Owner-reported Brave session is not assigned to an OS cell because platform/version were not supplied. Task 0.8 ID comparison was in Brave only. |
| Chrome Stable, latest | Not tested | Not tested | Not tested | Owner separately reports the `processes` channel warning. |
| Chrome Stable, N-2 | Not tested | Not tested | Not tested | |
| Edge, current | Not tested | Not tested | Not tested | |

## Gate B manual checks still required

Run these in Brave with the unpacked extension after the Gate B changes:

- Install or reload the extension and confirm it loads with zero manifest warnings.
- Open `chrome-extension://odolpeeackiejlhdfpakabidhggghnlo/html/monitor.html`.
- Confirm no system-permission prompt appears on page load; click **Enable system totals** and confirm the prompt appears only then.
- Deny the prompt and confirm the tab estimates and monitor controls continue working in estimate mode with the neutral optional-permission message.
- Confirm background sampling is unchecked by default and the sampler alarm is absent until enabled; disable it and confirm the alarm is cleared.
- Confirm no errors appear in the extension Errors page or service worker console.
- Suspend a tab and confirm it shows the site's favicon; confirm the new icon is visible and recognizable in the toolbar and on `brave://extensions`.

These Gate B checks were not run in this environment.

## Not tested

- Browser/PC restart and recovery; incognito; pinned tabs; audio tabs; pause shortcut; Tab Groups.
- Chrome Stable functional compatibility beyond the reported manifest warning; Windows/macOS; 200+ tabs; service-worker termination.
- Brave Shields interaction and browser/OS/version-specific coverage.

# Clean Brave profile checklist — privacy defaults and runtime errors

Use a clean Brave profile with only this extension installed. Confirm:

- The first-run backup notice appears once; dismiss it, restart the browser, and confirm it does not appear again.
- No `tgs-session-backup` alarm exists until backups are enabled. Enable backups and choose a frequency; confirm the alarm appears.
- Options shows settings sync unchecked by default.
- Open five regular tabs, suspend and restore them normally, and confirm the Brave Errors page, extension Errors page, and service-worker console show none of: `tabProperties.url not set`, `Failed to fetch`, or `Failed to parse gsExtensionRecovery`.

Automated coverage verifies the local defaults, backup alarm gating, incognito tab filter, supported suspension URL schemes, recovery-state failure handling, and favicon fetch rejection propagation. Browser behavior remains a manual check.

## Chrome Stable clean-profile smoke test

Run with Node 22 and an already-installed Google Chrome Stable:

```sh
node dev/tools/smoke-test.mjs
```

The script starts Chrome with a temporary profile and remote debugging, blocks non-local host resolution, loads the unpacked extension through CDP `Extensions.loadUnpacked`, serves five local-only HTTP pages, then suspends and restores them. It checks the service-worker and extension-page console for errors, the one-time welcome tab, backup opt-in state, and backup alarm state. `CHROME_BIN` can select another already-installed Chrome executable. No browser is downloaded or installed.

**Run result (2026-10-29):** Chrome 156.0.8078.73 loaded extension ID `odolpeeackiejlhdfpakabidhggghnlo`. The `options.html?firstTime` tab appeared exactly once; notice flag was set; backup enabled was false and `tgs-session-backup` alarm was absent. Five local tabs suspended and restored. Collected extension console errors/exceptions: none. `tabProperties.url not set`: no; `Failed to fetch`: no; `Failed to parse gsExtensionRecovery`: no.

**Limits:** this does not inspect Chrome's internal `chrome://extensions` Errors page, test Brave, test a competing suspender, or exercise every site-specific preview/favicons path. Browser UI appearance and repeat-install behavior still need owner verification.

**Guard and test run (2026-10-29):** `node --test dev/tests/*.test.mjs` passed all 44 tests. `node tools/check-guards.mjs` exited 1 with 14 service-worker graph hits: `window.` in `js/tgs.js`, `gsUtils.js`, `gsSession.js`, `gsTabCheckManager.js`, `gsTabSuspendManager.js`; `document.` in `gsUtils.js`, `gsTabSuspendManager.js`, `gsBackup.js`, `gsMemorySampler.js`; `localStorage` in `gsUtils.js`, `gsStorage.js`, `gsSession.js`, `gsTabCheckManager.js`, `gsTabDiscardManager.js`. There were no graph hits for dynamic `import(` or `sessionStorage`. The scanner follows files by static imports and reports every matching file even where a function body is later injected into a tab; these source hits remain for owner review.

## Earlier runtime-error evidence

- **Missing `tabProperties.url` — trigger Certain; conflicting-extension attribution Likely, not proven.** The upstream baseline's `saveSuspendData()` persisted `tab.url` without validating it. Current suspension rejects tabs with missing/unsupported URLs, rechecks the live tab after asynchronous work, and `saveSuspendData()` skips unsafe/missing URLs. A competing suspender can replace a page during this flow, but the original report had no tab ID or full stack to prove that was the cause. Clean-profile smoke: no occurrence.
- **`Failed to fetch` — source Guess / unresolved.** The baseline already fetched favicons and vendored html2canvas could fetch page images. Commits `ccb4fbe` and `f688080` removed direct fetches of tab-provided favicon URLs and restricted the remaining favicon fetch to the extension's `chrome://favicon` resource; its caller catches fetch failures. Preview generation also catches canvas errors. With no stack, the old profile's source cannot be identified. Clean-profile smoke: no occurrence.
- **`Failed to parse gsExtensionRecovery` — inherited; schema-version regression ruled out (Certain).** The upstream baseline parsed the same JSON timestamp key written with `JSON.stringify`; Phase 2 schema versioning did not change that key or format. Missing state previously entered the parse-error branch. Missing values now return empty state quietly; malformed values warn and return empty state, without changing stored data. Covered by `dev/tests/storage-schema.test.mjs`. Clean-profile smoke: no occurrence.
