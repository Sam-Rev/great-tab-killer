# DOM HTML sink review

Scope: extension JavaScript and HTML outside `dev/` and vendored libraries. The pre-change inventory at `39d0b0c` contained 22 `innerHTML`/`outerHTML`/`insertAdjacentHTML` matches. No `outerHTML` or `insertAdjacentHTML` call sites were found.

| Classification | File and call sites | Evidence/action |
|---|---|---|
| Fixed (9) | `js/suspended.js`: preview template clone, toast template clone, two title writes, URL display, two hotkey variants, reason | Replaced HTML insertion with cloned static template content or DOM text/construction. URL `href` now requires the shared URL policy. |
| Fixed (4) | `js/history.js`: session-content clear and three initial container clears | Replaced `innerHTML = ''` with `replaceChildren()`. |
| Fixed (2) | `js/historyItems.js`: session heading and shared `createEl` text | Built the count as a `<small>` node; all dynamic content uses `textContent`. Tab links require an allowed URL. |
| Fixed (4) | `js/monitor-lab.js`: rows, inspector, experiment results, empty state | Rebuilt UI with `createElement`, `textContent`, attributes, and child nodes. |
| Fixed (1) | `js/popup.js`: status detail | Builds translated text plus a DOM-created action link. |
| Fixed (1) | `js/shortcuts.js`: command description and shortcut rows | Builds each row with `textContent`. |
| Static i18n (1) | `js/helpers/gsUtils.js` `localiseHtml` | Kept per instruction: it resolves static `data-i18n` keys from the extension's bundled locale catalogs and supports intentional localized markup. It does not receive tab/session values. |
| Fixed (10, development dashboard) | `dev/scripts/memlab/dashboard.html:298, 313, 353, 378, 394, 407, 428, 451, 509, 532` | Although under `dev/` and not linked from extension UI or declared as WAR, the file is present in the unpacked project tree. Replaced all data-driven HTML strings with DOM construction/text nodes in `e47a237`. |

**Totals:** 31 data-driven HTML sink occurrences fixed across shipped-page code and the development dashboard; 1 static i18n renderer retained. Suspended-page static templates are cloned, so no template-to-`innerHTML` assignments remain.
