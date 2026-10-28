# Contributing

Thanks for helping improve The Great Tab Killer. Keep changes focused and explain user-visible behavior, privacy impact, and verification in your pull request.

## Project constraints

- Keep the shipped extension loadable directly as an unpacked folder without a build step.
- Do not add permissions, host permissions, network access, remote assets, telemetry, or runtime dependencies without explicit approval from the project owner.
- Treat page content, URLs, titles, and imported data as untrusted.
- Preserve upstream copyright and license notices.
- Use English for repository content and Conventional Commits for commit messages.

## Security file review

- Changes to any file under `security/` require explicit project-owner approval before merge. This includes `permissions.lock.json` and `url-allowlist.txt`; do not change either to make a guard pass.

## Pull requests

Use the pull request template. Include the relevant guard or test results and list checks that could not be run.
