# Snapshot

Version: 1.2.3 stage 9 logic-first orchestration
Date: 2026-05-14

Stable systems:
- Electron main/renderer/preload architecture.
- WhatsApp automation and manual send flow.
- BILLZ auth, request, cache, search, and diagnostics.
- Parser/search/memory/humanizer safety boundaries.
- Stage 8 controlled freedom and dialogue quality hotfix.

Recent changes:
- Added `services/orchestration` with intent hierarchy, decision engine, response planner, mode selector, safety, clarification, recommendation, and context priority helpers.
- Added deterministic `responsePlan` as the source of truth for AI sandbox mode, search, empathy, clarification, recommendation, active profile, risk, and human dynamics.
- Added Stage 9 templates for comfort consultation, school/sport child selection, and office/style guidance.
- Added Stage 9 QA fixtures for nail problems, comfort/wide-foot flow, school plus sport, exact availability, and office style guidance.
- AI sandbox debug now exposes response plan fields directly.

Behavior notes:
- Pain and comfort messages should not trigger product search first.
- LLM is draft-only and must not override responsePlan decisions.
- Exact availability remains strict and BILLZ-bound.
- Human dynamics such as conversation energy, emotion, momentum, and variation style can affect wording but not facts.

Rollback notes:
- Revert this Stage 9 commit to return to Stage 8 dialogue-quality behavior.
- Do not rollback BILLZ, WhatsApp, Electron IPC, or updater flows.

Do not break:
- No autonomous replies.
- No auto-send.
- No fake products, prices, availability, SKU/barcode/stock, or medical promises.
