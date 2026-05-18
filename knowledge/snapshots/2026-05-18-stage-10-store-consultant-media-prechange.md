# Snapshot

Version: 1.2.3 stage 10 store consultant media prechange
Date: 2026-05-18

Stable systems:
- Electron main/renderer/preload architecture.
- WhatsApp automation and manual send flow.
- BILLZ auth, request, cache, search, and diagnostics.
- Parser/search/memory/humanizer safety boundaries.
- Stage 9 logic-first orchestration and QA fixtures.

Known issues:
- Active subject is inherited through conversation state but is not yet anchored with confidence and TTL.
- Product photo/gallery flow is not yet represented as a first-class response mode.
- Some old persona/reasoning wording still reflects a broader psychology-style assistant instead of a store consultant.
- Russian text can display with encoding artifacts in terminal output, so runtime copy changes should stay focused.

Planned changes:
- Add anchored conversation subject for follow-up continuity.
- Add product media architecture for real product photos and galleries.
- Add gallery/showcase response modes and deterministic templates.
- Add debug fields for anchored subject, gallery intent, media resolution, selected products, and recommendation reasons.
- Add fixtures for adult/child subject continuity, Be Lenka follow-up, photo request, comfort/no-spam, and recommendation commitment.

Rollback notes:
- Revert the Stage 10 commit to return to Stage 9 logic-first orchestration.
- Do not rollback BILLZ, WhatsApp, Electron IPC, updater, or existing QA runner behavior unless explicitly requested.

Do not break:
- BILLZ auth/cache/search.
- WhatsApp sessions, collection, dedupe, sending, and progress.
- Electron IPC boundaries.
- Updater/build configuration.
- Existing QA runner.
- No autonomous replies or auto-send behavior.
- No fake products, prices, availability, AI-generated product images, SKU/barcode/stock leaks, or medical promises.
