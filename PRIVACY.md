# Privacy

The Great Tab Killer processes tab URLs locally to suspend and restore tabs, maintain session history, cache previews and favicons, and estimate memory use. It does not send browsing data to a project server.

Settings sync is off by default. If enabled, settings are stored through the browser profile's sync storage. Session backup is also off by default. If enabled, the extension writes a plain-text file containing open regular-tab URLs to Downloads at the selected frequency. Incognito tabs are excluded from backups, sampler measurements, previews, and saved session records.

Full URLs and preview images are stored locally with count caps; some stores have no TTL. The sampler cache is capped at 800 entries and pruned after seven days when updated. Previews are capped at 1000 entries with no TTL; suspended-tab metadata and favicon records are count-limited with no fixed TTL. The extension does not yet provide one action that wipes every local store. Backup text files are outside extension storage; delete them from Downloads.
