# Changelog

## 1.2.X

### Added
- Added FOUNDATION knowledge system under `knowledge/`.
- Added AI rules for Codex/Cursor/Claude.
- Added project memory, business rules, feature docs, ops docs, roadmap, tasks, and snapshot workflow.
- Added `.ai-commands` workflow templates for audit, safe refactor, knowledge updates, and bug analysis.
- Added Stage 2 observability foundation with structured logging, diagnostics service, debug panel, config files, and git workflow docs.
- Added Winston as a lightweight local logging dependency.
- Added Stage 3 advanced search foundation with Fuse.js, query normalization, recommendation engine, lightweight conversation memory, and smarter AI context builder.
- Added brand aliases `BB` for Be Lenka, `KT` for Key Top, and `XZ` for XZero.
- Added Stage 4 fixtures, deterministic humanization layer, response strategy metadata, and lightweight QA runner.
- Added Stage 4 hotfix QA for always showing both addresses, LL child age/size formatting, and inventory-style response prevention.
- Added Stage 5 tech debt audit report and shared data-structure map.
- Added extra parser/search/conversation fixtures for Be Lenka follow-up, child-age wording, black 35, and foot-length sizing.
- Added Stage 6 deterministic response contracts, normalized product service, AI reasoning object, confidence hooks, and expanded QA fixtures.
- Added Stage 7 conversational sales engine for AI sandbox with conversation state, topic focus, customer profiles, next-best-action, persona prompt, and multi-step dialogue fixtures.
- Added Stage 8 controlled freedom layer with new-info detection, freedom levels, repetition blocking, proactive dialogue moves, and human-like sales fixtures.
- Added Stage 9 logic-first orchestration with deterministic response plans, intent hierarchy, mode selection, safety/clarification/recommendation engines, and human dynamics fields.

### Fixed
- Improved parser/search handling for mixed colors, follow-up context, and brand-list intent without changing Electron architecture.
- Fixed Be Lenka query parsing so `be` is not misread as beige.
- Fixed child-age parsing for queries like `LL на 3 года`.
- Fixed humanized LL/Be Lenka child size output so raw `3/33` is never shown to customers.
- Fixed humanized responses to always include both public branch addresses and avoid branch-specific stock routing.
- Fixed brand summary source so Be Lenka, Key Top, and XZero are no longer excluded from known brand output.
- Fixed AI sandbox product replies so final customer-facing text comes from the deterministic humanizer, not OpenRouter formatting.
- Removed the old conflicting Be Lenka shortcut from parser/search/docs/fixtures.
- Fixed AI sandbox dialogue focus so family, adult, and child follow-ups can stay on the requested subject instead of falling back to unrelated sizing or product-search behavior.
- Fixed stale safe-summary repetition in AI sandbox by detecting near-duplicate drafts and switching to a progress-conversation move.
- Fixed Stage 8 school/PE child flow so the AI does not repeat the school summary and can split classroom shoes from PE/change shoes in a more natural tone.
- Fixed premature product search for comfort/pain intents by routing them through empathy-first `comfort_consultation`.

### Refactored
- Reused canonical store addresses in the humanizer branch formatter.
- Removed an unnecessary dynamic require from humanizer response formatting.
- Preserved original user query during memory follow-up search by passing memory as structured context.
- Moved LightFoot consultant reasoning prompt rules into `services/ai/prompts/lightfoot-consultant.js`.
- Extended conversation state with controlled freedom, new information, active subject resolution, and repetition metadata.

### Known Issues
- Stage 5 audit found prompt/business-rule duplication that should be reduced in a later controlled AI pipeline patch.
- Some existing Russian docs may show encoding artifacts in terminal output and should be verified before large text edits.

## 1.2.2

### Added
- Added sound notifications for AI flows.
- Split sounds for suggest and handoff flows.
- Added chat search.
- Added chat filters.
- Updated onboarding/training for new functions.

### Fixed
- Optimized UI for small screens.
- Fixed test sending UI.
- Fixed repeated sending issue.
- Improved contact duplicate handling.
- Desktop shortcut is recreated after install/update.

### Refactored
- No structured refactor entry was recorded for this historical version.

### Known Issues
- Historical entry was reconstructed from an older changelog that displayed encoding artifacts in terminal output.
