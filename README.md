# The Great Tab Killer

The Great Tab Killer is a local-first Chromium extension that suspends inactive tabs and restores them when you return to them. It is distributed on GitHub as an unpacked extension or release ZIP; it is **not** on the Chrome Web Store.

## Features

- Suspend inactive tabs and restore them later.
- Keep sessions, whitelist sites, and protect tabs with unsaved form input.
- Optional page previews, session backup, settings sync, and resource monitoring.

## Requirements and testing

Use a Chromium-based browser version 116 or newer. Automated clean-profile testing has been run only on Chrome 156. Brave has had limited manual testing. Edge and other browsers have not been tested.

## Install

Install the release ZIP by following [the installation guide](docs/INSTALL.md). This extension is not distributed through the Chrome Web Store.

## Privacy

Settings sync, session backup, page previews, and the resource monitor are off by default. The extension does not send data to a project-operated server. Read the [privacy policy](PRIVACY.md) for local storage, browser-history, sync, preview, and retention details.

## Known limits

- Accepted risks planned for v0.2.0: A-10, A-13, A-14, A-15, and A-22. Full URLs and previews can remain locally stored with count caps and no TTL; there is no one-step wipe for all extension data.
- The extension has no automatic update mechanism. Updates are installed manually from a new ZIP.
- The exact source-font licenses represented by `font/fontello.woff` and `font/fontello.woff2` remain **UNVERIFIED** because their Fontello project configuration and generated license file were not found. Upstream metadata declares MIT for `db.js` v0.15.0, but equivalence of the bundled file to that source is **UNVERIFIED**; see [NOTICE](NOTICE) for sources and limits.

## Development

Run the source checks with Node 22:

```sh
node tools/check-guards.mjs
node --test dev/tests/*.test.mjs
python3 -m unittest discover -s dev/tests -p 'test_*.py'
node tools/check-release-ready.mjs
```

The Chrome smoke test requires an already-installed Google Chrome:

```sh
node dev/tools/smoke-test.mjs
```

## License and credits

The source code is licensed under [GPL-2.0](LICENSE). The separate [branding policy](BRANDING.md) governs use of the product name and owner-created logo/icons; it does not change the code license. This project derives from The Great Suspender by Dean Oemcke and the GPL-2.0 The Great Suspender Reloaded fork; see [NOTICE](NOTICE) for inherited credits and third-party notices.
