# Snapshot

Version: 1.2.3 stage 6 AI pipeline stabilization
Date: 2026-05-13

Stable systems:
- Electron main/renderer/preload architecture.
- WhatsApp Playwright automation.
- BILLZ auth, request, cache, search, diagnostics.
- AI Manager manual OpenRouter flow.
- Fuse.js search, parser, memory, humanizer, QA fixtures.
- Stage 5 tech debt audit and shared data-structure docs.

Known issues:
- Stage 6 starts with prompt/business-rule duplication still present.
- AI memory follow-up context still mutates search text before this stage.
- Normalized product contract exists only as documentation before this stage.

Recent changes:
- Created branch `feature/ai-pipeline-stabilization`.
- Created this pre-change snapshot.
- Added normalized product service and AI reasoning response contract.
- Final AI sandbox customer response now comes from deterministic humanizer output.
- Removed old conflicting Be Lenka shortcut from parser/search/docs/fixtures.
- Added confidence hooks, clarification state, customer profile, and normalized product debug preview.

Rollback notes:
- If stabilization causes regressions, revert the Stage 6 commit or return to `feature/tech-debt-audit` at `c914259`.
- Keep Stage 5 audit artifacts unless explicitly reverting all Stage 5+ work.

Do not break:
- BILLZ.
- WhatsApp.
- AI Sandbox/AI Manager manual flow.
- Parser/search/memory/humanizer.
- IPC through preload.
- Customer-facing both-address rule.
