# Install The Great Tab Killer

The Great Tab Killer is distributed from the [GitHub Releases page](https://github.com/Sam-Rev/great-tab-killer/releases) as a ZIP. It is not available in the Chrome Web Store.

## Download and verify

1. Download `great-tab-killer-v0.1.0.zip` and `SHA256SUMS.txt` from the same release.
2. Verify the ZIP checksum before extracting it.

   Linux, with both files in the current directory:

   ```sh
   sha256sum -c SHA256SUMS.txt
   ```

   macOS, with both files in the current directory:

   ```sh
   shasum -a 256 -c SHA256SUMS.txt
   ```

   Windows Command Prompt:

   ```bat
   certutil -hashfile great-tab-killer-v0.1.0.zip SHA256
   ```

   Compare the displayed hash to the `great-tab-killer-v0.1.0.zip` entry in `SHA256SUMS.txt`. The release ZIP and checksum are not cryptographically signed. A checksum downloaded beside the ZIP can detect accidental corruption, but cannot detect a compromised GitHub release page or account.

The builder normalizes the file list, paths, sizes, timestamps, CRC32 values,
permissions, and ZIP metadata. DEFLATE output can vary with the zlib version,
so separate machines can produce different ZIP hashes from the same source.
Use the SHA-256 published with the release artifact; the CI release job's
published archive and checksum are authoritative.

## Load the extension

1. Create a new, empty folder (for example, `great-tab-killer`) and extract the ZIP into it. The ZIP contains `manifest.json` at its root, so the extracted folder itself is the folder to load.
2. In Chrome, open `chrome://extensions` (in Brave, open `brave://extensions`). Enable **Developer mode**.
3. Select **Load unpacked**, choose the new folder containing `manifest.json`, and confirm the extension appears.

Chromium browsers may show warnings because this is an unpacked extension loaded in Developer mode. This project is not listed in the Chrome Web Store. Use Chromium version 116 or newer.

## Optional browser access

- **Allow access to file URLs:** enable this in the extension's details only if you want to suspend local `file://` pages. The extension validates file URLs, but cannot open them unless the browser grants this access.
- **Allow in Incognito:** enable this only if you want the extension to run in Incognito. Its code filters Incognito tabs from sampler data, previews, backups, and saved sessions. This behavior was verified by code inspection and tests, not by a real Incognito-window run; see the manual checklist in [TESTING.md](TESTING.md).

## First run and backup

The extension opens its welcome page and a local backup setup page on first run. Session backup is off by default. The setup page explains that enabling it writes a plain-text file containing open regular-tab URLs to Downloads, and lets you enable backup and choose a frequency. **Not now** dismisses the one-time offer. The backup alarm is created only after you choose **Enable backups**.

## Update

Download the next release ZIP and verify its checksum. Choose either update method:

- **Keep the existing installation data:** delete the old folder's contents, extract the new ZIP into that same folder, then select **Reload** on the browser's extensions page. Reload keeps extension data.
- **Use a new folder:** extract the new ZIP into a new folder, remove the old extension entry on the browser's extensions page, then select **Load unpacked** and choose the new folder. The extension ID is fixed by the manifest key in either method.

Storage cleanup after **Remove** is browser-managed; do not rely on it to clear data. In one manual test (Chrome 156 on Linux, unpacked extension), settings and flags survived **Remove** followed by **Load unpacked** with the same extension ID, so the welcome page did not reopen. A one-click wipe is planned for v0.2.0 (accepted risks A-10 and A-13–A-15). Backup `.txt` files in Downloads and suspended entries in browser history are separate data locations.

The extension ID is fixed by the public manifest key in either method. For the storage and deletion limits, see [PRIVACY.md](../PRIVACY.md).

## Move from another suspender

Unsuspend all tabs in the old suspender first, then disable or remove it before using The Great Tab Killer. Never run two tab suspenders at the same time. Automatic conversion of another extension's suspended tabs is not implemented; the validated, user-confirmed conversion flow is planned as task 7.7 for v0.2.0.

## Uninstall

Open the browser's extensions page, select **Remove** for The Great Tab Killer, and confirm. Backup `.txt` files already written to Downloads are outside extension storage and must be deleted there separately. Suspended entries already written to browser history may remain as long as the browser retains them.

Removing the extension does not promise to delete its settings, flags, IndexedDB records, or other browser-managed data. See [PRIVACY.md](../PRIVACY.md) for the observed Chrome 156 result and current deletion limits.
