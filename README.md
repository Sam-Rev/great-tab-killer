# The Great Tab Killer

![The Great Tab Killer logo](images/tab-killer-logo.png)

The Great Tab Killer is a local-first Chromium extension that suspends inactive tabs to reduce their resource use and restores them when requested. It is distributed as source for unpacked installation and as GitHub release archives; it is not distributed through the Chrome Web Store.

## Install

For a local development install, open chrome://extensions/, enable Developer mode, choose **Load unpacked**, and select this repository folder (the folder containing manifest.json). Chrome may ask you to allow access to file URLs if you want the extension to operate on local files.

## Project status

The project is under audit and preparation for its first release. The current manifest version is 0.1.0; it is not yet a published release. The repository folder loads directly as an unpacked extension and has no build step.

## Privacy and security

The extension is intended to process data locally. The privacy and security documentation is being prepared from the code audit and will be published before the first release.

## License and attribution

This project is distributed under GPL-2.0-only. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [docs/LICENSE_NOTES.md](docs/LICENSE_NOTES.md). The code derives from [The Great Suspender](https://github.com/deanoemcke/thegreatsuspender) and [The Great Suspender Reloaded](https://github.com/tim-dim-ext/The-Great-Suspender-Reloaded). Their authors and bundled third-party components retain their respective rights.

## Branding asset

The project logo is owner-provided artwork. Its license is not yet confirmed; see `NOTICE` and the source copies under `assets/source/`.
