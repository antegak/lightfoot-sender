# Snapshot

Version: 1.2.3 stage 8 controlled freedom
Date: 2026-05-14

Stable systems:
- Electron main/renderer/preload architecture.
- WhatsApp Playwright automation and manual send flow.
- BILLZ auth, request, cache, search, and diagnostics.
- Parser/search/memory/humanizer safety boundaries.
- Stage 7 conversation state and deterministic response contract.

Recent changes:
- Added controlled freedom levels: `strict_safe`, `guided_consultant`, and `proactive_consultant`.
- Added new-info detection for use case, color, size, foot length, age, brand, material, fit/style preference, budget, objection, and comparison.
- Added repetition detection to block stale repeated drafts and switch to a progress-conversation move.
- Added active subject resolver improvements for adult, child, teen, and family follow-ups.
- Added Stage 8 dialogue templates for school/child direction, adult direction, correction acknowledgement, and progress continuation.
- Added Stage 8 conversation fixtures.

Behavior notes:
- Exact availability, exact price, concrete product, unavailable BILLZ, and low-confidence search stay in strict safe mode.
- Advice, comfort, style, school, everyday, and recommendation flows can be more proactive.
- New customer details should update the profile and progress the conversation.
- The AI sandbox still must not invent products, prices, availability, medical claims, or branch-specific stock.

Rollback notes:
- Revert this Stage 8 commit to return to Stage 7 behavior.
- Main rollback scope: `services/conversation`, `services/humanizer`, `services/qa`, `fixtures/stage8-conversation-fixtures.json`, prompt/docs/changelog updates, and the small AI sandbox debug integration in `main.js`.

Do not break:
- BILLZ.
- WhatsApp.
- AI sandbox manual test flow.
- Parser/search/memory/humanizer fact safety.
- No autonomous replies or auto-send behavior.
