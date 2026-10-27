# Vendored Libraries: Phase 1 Review

Hashes below were calculated from the current checked-in files on 2026-10-27. Official npm release tarballs for the versioned libraries were downloaded to `/tmp` for comparison; no dependency was added to the repository.

| File | Header identity | License | SHA-256 | Provenance / review |
|---|---|---|---|---|
| `js/helpers/html2canvas.min.js` | `html2canvas 1.0.0-alpha.10` | MIT (header and package metadata) | `c2cd181c1c75e6add0fd6cd08c08831dec0cd32356697b7d1bfa0ebec577bb5c` | Header points to [html2canvas](https://html2canvas.hertzen.com). Compared with official npm `1.0.0-alpha.10` `dist/html2canvas.min.js` (SHA-256 `745d277f4148a4bddc9805d16e31048935cc9885da561cae4329fe2c2006bb89`): **not byte-identical**; checked-in file is expanded/formatted while release is minified. Semantic equivalence was not verified. Grep found XHR and `fetch` resource-loading paths; no `eval` or `new Function` match. |
| `js/helpers/dom-to-image.js` | `dom-to-image-2.6.0`; local comments say patched to expose `toCanvas` and fix a promise rejection | MIT (official project README and package metadata) | `274d6fba08b86c206235ca4b82c8717befcc50248e7078598f093e873d60c01c` | [Official upstream](https://github.com/tsayen/dom-to-image). Compared with official npm `2.6.0` `src/dom-to-image.js` (SHA-256 `4f0d3f817e9a14331eb1ee861d02452ff66317e7fb79dc85f68905558fc1f685`): differences match the documented `toCanvas` export/helper and `onerror` patch. Contains XHR for resource inlining; no `eval` or `new Function` match. |
| `js/helpers/db.js` | **UNVERIFIED**: no upstream name/version header present; bundled API is an IndexedDB wrapper | **UNVERIFIED** from this file's header (no license/version header found) | `1a5288a8c7a700a52cd4a6451c7ee1f7560721b05b939b040ebe4597f5c7ff19` | Project-local provenance/version must be recovered from upstream repository history or owner records. No `eval`, `new Function`, XHR, fetch, WebSocket, EventSource, or sendBeacon match in scan. |

The official dom-to-image repository identifies its project and MIT license; the local version banner identifies 2.6.0. Its upstream README describes embedding external page images and fonts for rendering. The checked-in fork's `XMLHttpRequest` resource-inliner therefore has network behavior bounded by the page/resource origin and browser security policy; no fixed remote service endpoint was found.

## Owner follow-up

- Recover and verify the provenance/license for `db.js`.
- Confirm whether the expanded html2canvas file is a formatting-only transformation; byte comparison alone cannot establish semantic equivalence.
- Recover and verify the provenance/license for `db.js`.
