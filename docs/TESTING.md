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

## Not tested

- Browser/PC restart and recovery; incognito; pinned tabs; audio tabs; pause shortcut; Tab Groups.
- Chrome Stable functional compatibility beyond the reported manifest warning; Windows/macOS; 200+ tabs; service-worker termination.
- Brave Shields interaction and browser/OS/version-specific coverage.
