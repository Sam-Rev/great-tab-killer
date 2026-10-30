# Vendored libraries: Phase 3 pinning

These checksums pin the vendored files at their current paths under `js/helpers/`. `tools/check-guards.mjs` verifies every hash, requires all three excluded source files to be listed, and fails if an unpinned file appears in `vendor/`. Do not edit a vendor file or checksum without owner approval.

| File | Name / version | Source | License status | SHA-256 |
|---|---|---|---|---|
| `js/helpers/html2canvas.min.js` | html2canvas `1.0.0-alpha.10` | [npm package](https://www.npmjs.com/package/html2canvas/v/1.0.0-alpha.10); official project: [html2canvas](https://html2canvas.hertzen.com) | MIT, confirmed from header and package metadata | `c2cd181c1c75e6add0fd6cd08c08831dec0cd32356697b7d1bfa0ebec577bb5c` |
| `js/helpers/dom-to-image.js` | dom-to-image `2.6.0`, locally patched | [upstream repository](https://github.com/tsayen/dom-to-image), version 2.6.0 | MIT, confirmed from upstream README and package metadata | `274d6fba08b86c206235ca4b82c8717befcc50248e7078598f093e873d60c01c` |
| `js/helpers/db.js` | db.js `0.15.0` | [Upstream tag](https://github.com/aaronpowell/db.js/tree/0.15.0); version matches the bundled source's internal version string | MIT declared by upstream package metadata; [upstream license text](https://github.com/aaronpowell/db.js/blob/0.15.0/LICENSE.md) verified | `1a5288a8c7a700a52cd4a6451c7ee1f7560721b05b939b040ebe4597f5c7ff19` |

The previous Phase 1 comparison found html2canvas's normalized Terser output identical to the official same-version artifact; runtime equivalence remains unverified. The dom-to-image local changes match its documented `toCanvas` export/helper and error handling patch. The db.js upstream identity, version, and license are verified, but exact equivalence of the bundled source was not checked. Both screenshot libraries contain `XMLHttpRequest` paths for image capture, so the guard excludes only these three hash-pinned paths from first-party forbidden-pattern scanning. The hash check still runs on every guard invocation.

## Phase 1 comparison evidence

- The local html2canvas file differs byte-for-byte from the official npm `1.0.0-alpha.10` `dist/html2canvas.min.js` (official SHA-256 `745d277f4148a4bddc9805d16e31048935cc9885da561cae4329fe2c2006bb89`) because it is expanded/formatted. Terser 5.39.0 with matching compression/mangling options produced identical normalized output (SHA-256 `9d948037534f3f5a78453d385bd54d6a487e61ecdd9d56f461d89b55ff6d1eb6`). This does not establish runtime equivalence.
- The local dom-to-image `2.6.0` fork differs from upstream to expose `toCanvas` and adjust promise rejection handling; its upstream source SHA-256 was `4f0d3f817e9a14331eb1ee861d02452ff66317e7fb79dc85f68905558fc1f685`.

## Remaining vendor follow-up

- Browser-test screenshot capture and its resource behavior; not run as part of Phase 3.6.
