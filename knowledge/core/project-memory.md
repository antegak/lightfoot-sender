# Project Memory

Project memory records durable decisions, tradeoffs, known problems, and future plans so AI sessions do not lose context.

## Architecture Decisions

- Electron remains the desktop shell.
- `main.js` remains the privileged process.
- `renderer/` remains UI-only.
- `preload.js` remains the only renderer/main bridge.
- WhatsApp automation remains Playwright-based.
- BILLZ integration remains in `billz-client.js` and related parser/search modules.
- Parser/search changes are high risk and require snapshots.

## Contested Or Sensitive Decisions

- AI context should use BILLZ product data, but should not hide search/debug context.
- Renderer can display BILLZ connection status, but should not receive raw secrets.
- Soft search improves manager workflow, but strict SKU/barcode behavior must remain predictable.
- Large single files exist; splitting them is a later-stage refactor, not FOUNDATION work.

## Reasons For Future Refactor

- Reduce size and coupling in `main.js`.
- Separate AI Manager orchestration from Electron lifecycle code.
- Add focused tests for parser/search dictionaries and scoring.
- Improve diagnostics around BILLZ API failures and WhatsApp session states.
- Make persistent AI memory explicit, inspectable, and resettable.

## Known Problems

- Existing README/CHANGELOG show encoding artifacts in some terminal output; verify file encoding before editing large Russian text blocks.
- Parser color/material dictionaries need business confirmation before changing code mappings.
- Build output and `node_modules` are present locally; avoid treating generated files as source.
- AI prompt, deterministic humanizer, and product/search logic still duplicate some business rules.
- Some parser/search fixtures intentionally capture current behavior even when future UX may want stronger recommendation intent.

## Technical Debt

- Large renderer and main files make AI edits risky.
- Runtime has limited automated tests.
- Some diagnostics exist, but a unified logging standard is not fully enforced.
- Parser/search logic is business-critical and should receive snapshot coverage before major edits.
- `knowledge-base.js` is now the preferred source of truth for brands, colors, materials, stores, and size tables, but not all modules consume it fully yet.
- `main.js` still mixes Electron IPC, AI orchestration, prompt construction, BILLZ context, and memory wiring.
- Follow-up memory currently helps search by appending remembered entities to the query text; a future safer path is structured memory context.
- Stage 6 changed AI sandbox search to preserve the original user query and pass previous entities as structured memory.
- Stage 6 made deterministic humanizer output the final customer-facing response for product-aware AI sandbox answers.
- Stage 6 removed the old conflicting Be Lenka shortcut; Be Lenka recognition is now `BB` plus written names only.
- Stage 7 added a conversation state engine for AI sandbox quality: topic focus, adult/child profile separation, sales flow, next-best-action, search decision, and LightFoot consultant persona.
- Stage 7 keeps OpenRouter as a reasoning/persona helper only; deterministic templates still own customer-facing product facts and formatting.
- Stage 8 added controlled freedom so AI sandbox can progress a conversation, use new details, recommend direction, and avoid stale summary repetition without inventing product facts.
- Stage 8 uses LOW freedom for exact facts and BILLZ/search uncertainty, and MEDIUM/HIGH freedom for advice, use-case, style, comfort, and recommendation flows.
- Stage 8 dialogue-quality hotfix made school plus PE/change-shoe child follow-ups less scripted: classroom shoes and PE shoes are handled as separate directions instead of repeating the same school summary.
- Stage 9 added logic-first orchestration: deterministic `responsePlan` now controls mode, search permission, empathy, clarification, recommendation confidence, active profile, safety, and human dynamics; LLM is draft-only.

## Future Plans

- AI auto mode.
- Suggest mode.
- Handoff mode.
- Voice transcription.
- Image support.
- Advanced recommendations.
- AI CRM memory.
- Analytics.
- Advanced search.
- Stage 7 follow-up: extract more AI orchestration out of `main.js` after more fixtures exist.
