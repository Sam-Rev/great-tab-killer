# Phase 2 Cleanup Log

Branch: `phase-2-cleanup`. Every source removal is recorded with its evidence and source commit hash. The evidence register below was prepared before the first removal. Manifest permissions are intentionally unchanged in Phase 2; permission removal is reserved for Gate B/Phase 3.

## Pre-removal evidence register

| Task | Candidate files/symbols and call-graph evidence | Decision / protected behavior | Status / source commit(s) |
|---|---|---|---|
| 2.1 | `js/notice.js` sent `requestNotice`/`clearNotice`; `html/notice.html` was opened only from `tgs.js` when `_noticeToDisplay` was truthy. Repository-wide search found no assignment to `_noticeToDisplay`. `setNoticeVersion` was called only by notice UI and legacy update handling. | Removed dormant notice UI, message cases, storage key/helpers and interval; backup behavior stayed out of scope. | Complete — source commit `d04aaa1` |
| 2.2 | `gsChrome.cookiesGetAll/cookiesRemove` were called only by the `<6.31` cookie migration in `gsIndexedDb.performMigration()`. | Removed the cookie migration/wrappers; the manifest `cookies` permission remains until Phase 3. | Complete — source commit `c45dc31` |
| 2.3 | `gsIndexedDb.performMigration()` was called only from `gsSession.handleUpdate()` and contained inherited `<6.13` saved-session rewrites; `<6.31` cookie cleanup was removed in 2.2. `gsStorage` had an inherited undefined-sync-setting compatibility branch and no project schema version. | Removed inherited session conversions and compatibility branch; added local `schemaVersion: 1`, set IndexedDB version to 1, and added fresh/current/future schema tests. Retained current-project session recovery and settings defaults. | Complete — source commit `3c4b6dc` |
| 2.4 | No HTML/manifest/module imported `js/helpers/debug.js`; profiler DOM IDs had no HTML owner. Its `getDebugInfo` request had no sender except that helper; its dispatcher/function/export were otherwise unreferenced. | Removed profiler helper, dedicated debug-info message path, and unused debug toggles; normal warning/error logging and monitor UI remain. | Complete — source commit `71c64a1` |
| 2.5 | `thanks.html` was reached only by the old donation-success URL branch in `tgs.js`; donation popup messages/settings were only used by suspended-page donation code. `update.html` and `changelog.html` participate in update recovery; `broken.html` is the startup-failure route; `permissions.html` prompts for file access; `about.html` and `changelog.html` are linked in navigation. `updated.html` had no caller. | Removed donation-only route, popup code, setting and page; removed unreferenced `updated.html`/`updated.js`; rewrote changelog, update, permissions and broken-startup copy. Preserved session-history UI. | Complete — source commits `d7615f4`, `9b8353c` |
| 2.6 | `GOOGLE_S2_URL` fallback and commented captureVisibleTab path had no active references; popup and Options monitor fragments were commented while their active monitor page remained; obsolete debug/status rendering, logger alternatives, whitelist check, and restart-confirmation blocks were also inactive. | Removed the obsolete code fragments only; active monitor, tab capture implementation, current status rendering, and explanatory comments remain. | Complete — source commit `b226346` |
| 2.7 | `migrateForeignSuspendedTabs()` was invoked only by `runtime.onInstalled` when reason was `install`; the function had no other caller. | Removed only the automatic listener. The function body remains intact and dormant for task 7.7. | Complete — source commit `34161dc` |
| 2.8 | `tools/list-unused-locale-keys.mjs` scans HTML, JS, and the manifest; it preserves generated monitor key families. It found 37 unused keys across 55 locales, then 11 monitor-extension keys after task 2.12. The final scan reports zero candidates. | Removed only keys with no static reference; kept dynamic status/action/impact prefixes. Source/tool commit `10ef16c`; post-2.12 monitor locale commit `c129ebb`. | Complete |
| 2.9 | `scripts/` contained `mem_watch.py` and `memlab/*`; `tests/` contained three Node tests. No package manifest or CI workflow referenced their old paths. Relative test imports and `mem_watch.py` root path required updates. | Moved all files to `dev/scripts/` and `dev/tests/`; fixed relative paths and documented new locations. Move commit `995b2fd`; remaining test path fix `bae402f`. | Complete |
| 2.10 | `js/tgs.js` history cleanup listener was the only `chrome.history.onVisited`/`deleteUrl` call site. `html/history.html` and `js/history*.js` use IndexedDB and provide the extension session-history UI. | Removed the browser-history listener; preserved session-history UI. Manifest `history` stays until Gate B/Phase 3. Source commit `4704137`. | Complete |
| 2.11 | `js/tgs.js` `externalMessageRequestListener()` was registered only by `addMessageListeners()`; repository search found no internal caller. It exposed `suspend`/`unsuspend` for active or supplied tab IDs. | Removed handler and registration, updated audit/threat-model records; no manifest change was needed. Source commit `34dc4b8`. | Complete |
| 2.12 | `js/monitor.js` management calls were confined to its extension table, `refreshExtensions()`, grant flow, and toggle action; `html/monitor.html` owned that UI. No other source module used the API. | Removed the table, grant/toggle logic, monitor refresh calls, and extension-only messages. Optional `management` manifest entry stays until Gate B/Phase 3. Source commit `469c09a`; final locale cleanup `c129ebb`. | Complete |

## Completed removals

Each row records the candidate files/symbols, pre-removal evidence, protected behavior, and exact source commit hash. Task 2.8’s scanner reported zero candidates after cleanup. Phase 2 did not edit `manifest.json`.

### Task 2.8 locale-key evidence

Compared `_locales/en/messages.json` at `phase-0-legal-branding` with the Phase 2 result. These 48 keys were removed; the first 37 were removed by `10ef16c` and the remaining monitor-extension keys by `c129ebb`:

```text
html_changelog_rating_5stars, html_changelog_rating_feedback, html_changelog_rating_title,
html_monitor_col_extension, html_monitor_col_impact, html_monitor_col_pages,
html_monitor_ext_grant, html_monitor_ext_note, html_monitor_ext_title, html_monitor_note,
html_notice_important_notice, html_notice_title, html_options_suspend_seconds,
html_popup_dont_suspend_now, html_popup_monitor, html_suspended_donation_question,
html_suspended_tab_reload, html_suspended_tab_suspended, html_suspended_tab_whitelist_prefix,
html_suspended_tab_whitelist_suffix, html_thanks_header, html_thanks_sub_header,
html_thanks_title, html_updated_bug_fixes_header, html_updated_detail_header_prefix,
html_updated_detail_header_suffix, html_updated_great_suspender_updated,
html_updated_info_line1, html_updated_info_line2_prefix, html_updated_info_line2_suffix,
html_updated_new_features_header, html_updated_patch_message, html_updated_release_notes,
html_updated_title, html_updating_heading, html_updating_message, html_welcome_title,
js_monitor_ext_action_details, js_monitor_ext_action_disable, js_monitor_ext_action_enable,
js_monitor_ext_this, js_monitor_freed, js_monitor_pages_tooltip, js_monitor_tt_fixed_discarded,
js_monitor_tt_released, js_popup_suspended_pause, js_suspended_remove_from_whitelist,
js_update_confirm
```

At task 2.8 the scanner preserved these generated-key prefixes: `js_monitor_action_pending_`, `js_monitor_ext_status_`, `js_monitor_impact_`, and `js_monitor_status_`. A later source removal in task 2.12 removed the `ext_status_` and `impact_` generators along with the extension monitor UI; their remaining locale entries are still preserved by the scanner. Current generators are `action_pending_` and `status_` in `js/monitor.js`.

The current source contains 263 distinct statically referenced localization keys across HTML `__MSG_...__`, manifest placeholders, and literal `chrome.i18n.getMessage()` / `gsUtils.getMessage()` calls. All 263 exist in `_locales/en/messages.json`. All 18 entries in the four preserved key families also exist there. Result: **PASS; zero missing English keys**. This was checked by extracting those patterns and comparing them with the English message map.

Non-literal message-key flows found by searching all `js/` and `html/`:

- `js/shortcuts.js:41`: `msgKey` from registered command metadata; command descriptions are manifest `__MSG_...__` keys.
- `js/monitor.js:382,397,520,750,841,851,1091,1093`: fixed note/action keys, status-family keys, conditional literal keys, and the process-API-dependent tooltip key.
- `js/helpers/gsUtils.js:386,391`: generic forwarding of a key and runtime substitution of keys parsed from static HTML placeholders.
- `js/monitor.js:648`: `js_monitor_action_pending_` plus the action suffix; `js/monitor.js:748-749`: `js_monitor_status_` plus the status suffix.
- No HTML or manifest `__MSG_` placeholder uses a non-literal argument. The only dynamic placeholder pattern is the `__MSG_(\w+)__` replacement in `js/helpers/gsUtils.js:397,405`.

### Dispatch and HTML-selector evidence checks

For each row, the pre-removal revision was searched in `js/`, `html/`, and `manifest.json` for the named message/function strings and selector IDs/data attributes. The search checked `chrome.runtime.sendMessage`/`tabs.sendMessage` payloads, `function`/`action` dispatch, and `getElementById`/HTML `id`/`data-*` references. No unlisted caller or UI consumer was found.

| Task | Dispatch / selector search result |
|---|---|
| 2.1 | `requestNotice` and `clearNotice` occurred only between `js/notice.js` and their `js/tgs.js` handlers; `gsNotice` was only the notice page/container selector. No other page or sender referenced them. |
| 2.2 | `cookiesGetAll`/`cookiesRemove` were used only by `performMigration()`; no message dispatch or HTML selector used the cookie migration. |
| 2.3 | `performMigration()` had one caller in `gsSession.handleUpdate()`; session-store use is current functionality, not a legacy message or UI dispatch. No HTML selector referenced the conversion code. |
| 2.4 | `{function: 'getDebugInfo'}` was sent only by `js/helpers/debug.js` to its `js/tgs.js` handler; profiler DOM IDs were local to the unreferenced helper and had no HTML owner. |
| 2.5 | Donation `action: 'donationPopupEvents'` originated only in `gsSuspendedTab.js` and was handled by `suspended.js`; donation bubble IDs belonged only to the removed suspended-page UI. `thanks.html` and `updated.html` had no remaining route/caller. |
| 2.6 | Searched every removed commented symbol and disabled fragment; no live dispatch was removed. Checked affected DOM IDs against HTML; active monitor behavior and its HTML-owned IDs were retained until task 2.12. |
| 2.7 | `migrateForeignSuspendedTabs()` had exactly one caller, the install branch of `runtime.onInstalled`; it had no message dispatch or HTML selector. |
| 2.8 | Searched all 48 removed key names in HTML, JS, and manifest; none remained as a static placeholder or literal message key. Checked generated keys separately as above. |
| 2.9 | Searched the extension JS/HTML/manifest for `scripts/`, `tests/`, and moved module names; no runtime import, message dispatch, or HTML selector depended on those developer-only paths. Updated the two Node tests' relative source paths and `mem_watch.py` repository root. |
| 2.10 | `chrome.history.onVisited`/`deleteUrl` was a direct listener with no message dispatch or HTML selector. IndexedDB-backed session history remained separate and was preserved. |
| 2.11 | `onMessageExternal` handled only `suspend`/`unsuspend`; the search found no internal sender or HTML selector for that external-only interface. |
| 2.12 | `initExtensionsSection()`, `refreshExtensions()`, and `toggleExtension()` formed the only management flow; `extGrant*`/`extTable*` IDs and `data-i18n` entries were confined to the removed section in `html/monitor.html`. No other page used them. |

## Phase 5b icon-asset cleanup

| Removed or replaced | Evidence | Action | Commit |
|---|---|---|---|
| Two bundled WOFF assets and the shared icon-font stylesheet; the stylesheet was referenced by Options, History, and Monitor, and its CSS selectors were used by the help marks, session toggles, checkbox marks, and select chevrons. | Replaced consumers with CSS-drawn shapes and removed the three asset paths from the literal release allowlist. `dev/tests/no-web-fonts.test.mjs` checks the shipped file list and CSS declarations. | Removed font assets and stylesheet; retained only the historical attribution note in `NOTICE`. | `3186a76` |
