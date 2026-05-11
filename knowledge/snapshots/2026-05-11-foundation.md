# Snapshot

Version: 1.2.3 foundation
Date: 2026-05-11

Stable systems:
- Electron main/renderer/preload architecture.
- BILLZ auth, token cache, product loading, search, diagnostics.
- AI Manager with sandbox memory, intents, parser, OpenRouter, BILLZ context.
- WhatsApp Playwright collection, dedupe, sessions, sending, progress.
- Parser/search files and current business dictionaries.

Known issues:
- Current workspace has no `.git` metadata visible.
- Existing README/CHANGELOG may contain encoding artifacts in terminal output.
- Color/material code meanings need business confirmation before code changes.
- Automated tests are limited or not present.

Recent changes:
- Added FOUNDATION knowledge system.
- Added AI rules, project memory, business rules, feature docs, ops docs, tasks, snapshots, and command templates.
- Updated changelog structure for foundation work.

Rollback notes:
- This snapshot only adds documentation and command infrastructure.
- Rollback can remove `knowledge/` and `.ai-commands/` plus the new changelog entry.
- Runtime files were intentionally not changed.

Do not break:
- BILLZ.
- AI Manager.
- WhatsApp.
- Parser.
- Search.
- Electron main/renderer/preload IPC separation.
