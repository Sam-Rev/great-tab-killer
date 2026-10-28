# Vendored libraries: Phase 3 pinning

These checksums pin the vendored files at their current paths under `js/helpers/`. `tools/check-guards.mjs` verifies every hash, requires all three excluded source files to be listed, and fails if an unpinned file appears in `vendor/`. Do not edit a vendor file or checksum without owner approval.

| File | Name / version | Source | License status | SHA-256 |
|---|---|---|---|---|
| `js/helpers/html2canvas.min.js` | html2canvas `1.0.0-alpha.10` | [npm package](https://www.npmjs.com/package/html2canvas/v/1.0.0-alpha.10); official project: [html2canvas](https://html2canvas.hertzen.com) | MIT, confirmed from header and package metadata | `c2cd181c1c75e6add0fd6cd08c08831dec0cd32356697b7d1bfa0ebec577bb5c` |
| `js/helpers/dom-to-image.js` | dom-to-image `2.6.0`, locally patched | [upstream repository](https://github.com/tsayen/dom-to-image), version 2.6.0 | MIT, confirmed from upstream README and package metadata | `274d6fba08b86c206235ca4b82c8717befcc50248e7078598f093e873d60c01c` |
| `js/helpers/db.js` | IndexedDB wrapper; name/version **UNVERIFIED** | **UNVERIFIED**; provenance must be recovered from repository history or owner records | **UNVERIFIED**; no license/version header was found | `1a5288a8c7a700a52cd4a6451c7ee1f7560721b05b939b040ebe4597f5c7ff19` |

The previous Phase 1 comparison found html2canvas's normalized Terser output identical to the official same-version artifact; runtime equivalence remains unverified. The dom-to-image local changes match its documented `toCanvas` export/helper and error handling patch. Both screenshot libraries contain `XMLHttpRequest` paths for image capture, so the guard excludes only these three hash-pinned paths from first-party forbidden-pattern scanning. The hash check still runs on every guard invocation.

## Remaining vendor follow-up

- Recover and verify the identity, version, source and license for `db.js`.
- Browser-test screenshot capture and its resource behavior; not run as part of Phase 3.6.
