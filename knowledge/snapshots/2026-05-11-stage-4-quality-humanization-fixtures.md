# Snapshot

Version: 1.2.3 stage 4 quality humanization fixtures
Date: 2026-05-11

Stable systems:
- Electron architecture remains unchanged.
- BILLZ, WhatsApp, parser/search integration remain incremental.
- No autonomous AI mode and no auto-reply behavior.
- OpenRouter flow remains user-triggered through AI Manager.

Known issues:
- Fixtures are lightweight smoke/regression checks, not a full test suite.
- Humanization quality still needs real conversation QA.
- Some legacy files still display encoding artifacts in terminal output.

Recent changes:
- Added `fixtures/` regression files for search, parser, memory, conversation, and humanization.
- Added deterministic humanization layer in `services/humanizer`.
- Added lightweight QA runner in `services/qa`.
- Added debug panel QA action through `debug-run-fixtures`.
- Added `config/humanization-config.json`.
- Added UX guidelines.

Rollback notes:
- Revert `services/humanizer`, `services/qa`, `fixtures`, `config/humanization-config.json`, debug fixture IPC/preload/renderer additions, and docs/changelog updates.

Do not break:
- AI Manager manual test flow.
- BILLZ cached search.
- Memory TTL and extracted entities.
- Debug panel diagnostics.
- Renderer/main communication through preload.
