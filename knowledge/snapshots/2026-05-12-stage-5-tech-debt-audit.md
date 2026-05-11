# Snapshot

Version: 1.2.3 stage 5 tech debt audit
Date: 2026-05-12

Stable systems:
- Electron main/renderer/preload architecture.
- WhatsApp Playwright automation.
- BILLZ auth, request, cache, search, diagnostics.
- AI Manager manual OpenRouter flow.
- Fuse.js search, parser, memory, humanizer, QA fixtures.
- Debug panel, logging, diagnostics, knowledge system, git workflow.

Known issues:
- This snapshot starts the audit; findings will be documented in `knowledge/specs/tech-debt-audit.md`.
- Large files still exist (`main.js`, `renderer/app.js`, `billz-client.js`, `whatsapp.js`).
- Business rules are partly centralized, but brand/color/material/address logic still appears in several modules.

Recent changes:
- Created feature branch `feature/tech-debt-audit`.
- Created this pre-cleanup snapshot.
- Added tech debt audit report and shared data-structure map.
- Consolidated customer-facing branch addresses through `knowledge-base.js`.
- Updated brand summary and Stage 5 QA fixtures.

Rollback notes:
- If cleanup causes issues, revert the Stage 5 commit or return to `origin/dev` at `d00dedc`.
- Do not rollback Stage 1-4 foundation unless explicitly requested.

Do not break:
- BILLZ.
- WhatsApp.
- AI Sandbox/AI Manager.
- Parser/search/memory/humanizer.
- IPC through preload.
