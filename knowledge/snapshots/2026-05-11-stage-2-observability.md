# Snapshot

Version: 1.2.3 stage 2 observability
Date: 2026-05-11

Stable systems:
- Electron main/renderer/preload architecture remains unchanged.
- BILLZ runtime logic remains in `billz-client.js` with lightweight structured logging added.
- AI Manager/OpenRouter flow remains unchanged except performance/error logging at IPC boundaries.
- WhatsApp Playwright flow remains unchanged except contact/send observability logs.
- Parser/search behavior remains unchanged.

Known issues:
- Git remote/branch promotion still needs setup.
- `npm install winston` reported existing npm audit vulnerabilities; no automatic fix was run to avoid dependency churn.
- Debug panel is lightweight and local-only; it is not a full monitoring platform.

Recent changes:
- Added `services/logger`.
- Added `services/diagnostics`.
- Added `config/feature-flags.json`, `config/logging-config.json`, and `config/diagnostics-config.json`.
- Added hidden debug panel opened with `Ctrl + Shift + D`.
- Added global process error logging.
- Updated `.gitignore`, changelog, monitoring docs, backup docs, and git workflow docs.

Rollback notes:
- Revert Stage 2 files and remove Winston dependency from `package.json`/`package-lock.json`.
- Remove debug IPC handlers from `main.js`, debug methods from `preload.js`, and debug panel code/styles from renderer files.
- Runtime feature logic should remain otherwise untouched.

Do not break:
- BILLZ.
- AI Manager and AI sandbox.
- WhatsApp sessions, collection, dedupe, sending.
- Parser and search ranking.
- Renderer/main communication through preload.
