# Extension key notes

A dedicated RSA keypair was generated for the extension. The manifest contains only the base64-encoded public key. The extension ID derived from its DER public key using SHA-256 is `odolpeeackiejlhdfpakabidhggghnlo`.

The private key is stored outside the repository at `/home/samrev/.local/share/tab-killer/manifest-key.pem` with owner-only file permissions. Keep it backed up securely. It is needed only if the owner ever packages or publishes a CRX that must retain this extension ID. Never commit the private key.

The ID calculation and the presence of the manifest key have been verified locally. The owner reports that unpacked copies from two different folders had the same ID in Brave with Developer mode. This manual result was not independently rerun. Chrome comparison has not been tested.
