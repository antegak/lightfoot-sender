# Snapshot

Version: 1.2.3 stage 7 conversational sales engine
Date: 2026-05-13

Stable systems:
- Electron main/renderer/preload architecture.
- WhatsApp Playwright automation and manual send flow.
- BILLZ auth, request, cache, search, and diagnostics.
- Parser/search/memory/humanizer foundation.
- Stage 6 deterministic customer-facing response contract.

Recent changes:
- Added `services/conversation` with conversation state, topic tracking, sales flow, customer profiles, next-best-action, dialogue policy, and persona rules.
- Added `services/ai/prompts/lightfoot-consultant.js` for the OpenRouter reasoning/persona prompt.
- AI sandbox debug state now includes conversation focus, stage, active subject, next best action, search decision, and adult/child/teen profiles.
- Humanizer now has Stage 7 dialogue templates for family discovery, family brand advice, adult advice, child advice, brand comparison, and child sizing advice.
- Added multi-step Stage 7 conversation fixtures.

Behavior notes:
- Brand advice and comparison should not automatically search random products.
- Concrete availability, size, color, and "show options" requests can still search.
- Adult and child facts are kept separate in conversation state.
- "For myself" follow-ups should answer through the adult profile even when child context exists.

Rollback notes:
- Revert `services/conversation`, `services/ai/prompts/lightfoot-consultant.js`, `fixtures/stage7-conversation-fixtures.json`, and the Stage 7 integration patches in `main.js`, `services/humanizer`, and `services/qa`.
- Do not rollback Stage 6 deterministic response contract unless explicitly requested.

Do not break:
- BILLZ.
- WhatsApp.
- AI sandbox manual test flow.
- Parser/search/memory/humanizer safety rules.
- IPC through preload.
- No autonomous replies or auto-send behavior.
