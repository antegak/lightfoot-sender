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
