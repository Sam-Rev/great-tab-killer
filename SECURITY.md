# Security policy

## Supported release

Only the latest published release is supported. Install from the project's GitHub repository using the unpacked folder or release ZIP; this extension is not distributed through the Chrome Web Store and does not use an automatic update URL. Updates are manual. Review the release notes for permission changes. For a release ZIP, compute its SHA-256 (for example, `sha256sum <release.zip>`) and compare it with the matching entry in `SHA256SUMS.txt`; `sha256sum -c SHA256SUMS.txt` checks the listed files in the current directory.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository: `<OWNER: repository URL>`. The repository URL and private reporting availability must be confirmed by the owner before release. Do not include exploit details in public issues before coordination.

## Security controls and limits

- The manifest permission and host access fields are checked against `security/permissions.lock.json` by `node tools/check-guards.mjs`.
- Shipped-source checks reject selected unsafe execution, messaging, and network patterns. Run the guard locally; this repository currently has no CI workflow, so the guard is not represented as an automated CI check.
- Vendored capture libraries are pinned in `vendor/CHECKSUMS.sha256`. The guard verifies those hashes; their known capture-related network patterns are excluded from generic source scans only for those pinned files. When previews are enabled, these libraries execute in the captured page and may request resources already referenced by that page.
- `web_accessible_resources` is absent. The manifest has no `update_url` or `externally_connectable` field.
- The extension's own code does not send data to a project-operated server. Optional settings sync is handled by Chrome; optional page previews can cause page-origin resource requests as described in [PRIVACY.md](PRIVACY.md).
- In v0.1.0, the release ZIP and `SHA256SUMS.txt` are not cryptographically signed. A checksum published beside the ZIP can detect file corruption, but cannot prove the release page or checksum was not compromised.
- There is no CI workflow yet; checks are run locally.
- The origin and version of vendored `db.js` are **UNVERIFIED**. It is pinned by SHA-256 only.
- Broad `http://*/*`, `https://*/*`, and `file://*/*` host access means a code bug could affect a wide range of pages.
- Vulnerability reports are handled on a best-effort basis. There is no guaranteed response time.

## Accepted limitations

The owner has accepted local data-retention and incomplete global-wipe findings A-10, A-13, A-14, A-15, and durable queue finding A-22 for v0.1.0. They are documented in [PRIVACY.md](PRIVACY.md) and [the audit](docs/AUDIT.md), with planned follow-up in v0.2.0.
