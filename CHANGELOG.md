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
- Added brand aliases `BB`/`BL` for Be Lenka, `KT` for Key Top, and `XZ` for XZero.
- Added Stage 4 fixtures, deterministic humanization layer, response strategy metadata, and lightweight QA runner.
- Added Stage 4 hotfix QA for always showing both addresses, LL child age/size formatting, and inventory-style response prevention.
- Added Stage 5 tech debt audit report and shared data-structure map.
- Added extra parser/search/conversation fixtures for Be Lenka follow-up, child-age wording, black 35, and foot-length sizing.

### Fixed
- Improved parser/search handling for mixed colors, follow-up context, and brand-list intent without changing Electron architecture.
- Fixed Be Lenka query parsing so `be` is not misread as beige.
- Fixed child-age parsing for queries like `LL на 3 года`.
- Fixed humanized LL/Be Lenka child size output so raw `3/33` is never shown to customers.
- Fixed humanized responses to always include both public branch addresses and avoid branch-specific stock routing.
- Fixed brand summary source so Be Lenka, Key Top, and XZero are no longer excluded from known brand output.

### Refactored
- Reused canonical store addresses in the humanizer branch formatter.
- Removed an unnecessary dynamic require from humanizer response formatting.

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
