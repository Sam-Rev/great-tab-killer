# Extension key notes

A dedicated RSA keypair was generated for the extension. The manifest contains only the base64-encoded public key. The extension ID derived from its DER public key using SHA-256 is `odolpeeackiejlhdfpakabidhggghnlo`.

The private key is stored outside the repository at `/home/samrev/.local/share/tab-killer/manifest-key.pem` with owner-only file permissions. Keep it backed up securely. It is needed only if the owner ever packages or publishes a CRX that must retain this extension ID. Never commit the private key.

The ID calculation and the presence of the manifest key have been verified locally. Loading copies from two different directories in Chrome has not yet been tested. Manual check: copy this extension folder to two different directory paths; load the first in Chrome through chrome://extensions/ with Developer mode enabled and record its ID; remove it, load the second path, and compare the IDs. They should both be odolpeeackiejlhdfpakabidhggghnlo before relying on history recovery across folder changes.
