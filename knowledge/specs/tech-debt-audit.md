# Stage 5 Tech Debt Audit

Date: 2026-05-12
Branch: `feature/tech-debt-audit`
Scope: audit plus controlled cleanup only. No massive rewrite, no Electron architecture changes, no BILLZ/WhatsApp/search/parser/memory/humanizer rewrite.

## Summary

LightFoot Sender has a working Stage 1-4 foundation, but the project now has predictable growth debt:

- business rules are duplicated across parser, search, humanizer, QA, prompt, and product indexing;
- `main.js` and `renderer/app.js` are very large and mix several responsibilities;
- deterministic humanizer and OpenRouter prompt overlap in response formatting rules;
- fixture coverage exists but still misses some real conversation regressions;
- some important fallbacks are intentionally safe, but too quiet for debugging.

The highest-value cleanup path is gradual centralization around `knowledge-base.js`, explicit data contracts, stronger fixtures, and later extraction of AI orchestration from `main.js`.

## Critical debt

### Prompt can contradict deterministic humanizer

- file: `main.js`
- function/module: `requestOpenRouterChat`
- problem: OpenRouter system prompt contains customer-facing inventory/address rules while Stage 4 also creates deterministic `humanizedResponse`. One prompt line still says to use only addresses from context and not add the second branch when it is absent, while the hotfix rule says both addresses must always be shown.
- impact: AI can override the deterministic draft and reintroduce branch-specific or incomplete address behavior.
- risk: medium-high UX risk, low runtime risk.
- suggested fix: later move customer-visible business rules out of prompt into deterministic templates/config. Keep prompt focused on tone/reasoning and explicitly prefer `deterministicDraft`.
- confidence: 85%
- can fix now: no. Needs a small prompt strategy pass and manual sandbox checks.

### Stale brand summary excludes newer brands

- file: `product-index.js`
- function/module: `buildBrandSummary`
- problem: `known` only includes `TipsieToes`, `Little Light`, and `Saguaro`, while `Be Lenka`, `Key Top`, and `XZero` were added later. It also marks `Be Lenka` as unavailable.
- impact: brand-list intent can give outdated or misleading output even when parser/search understands newer aliases.
- risk: medium UX risk, low runtime risk.
- suggested fix: derive known brands from `knowledge-base.js` `BRANDS`, keep output shape stable, and avoid hardcoded unavailable Be Lenka.
- confidence: 95%
- can fix now: yes.

### Address source is duplicated

- file: `services/humanizer/branch-humanizer.js`
- function/module: `BRANCHES`, `humanizeBranches`
- problem: public branch addresses are hardcoded separately from `knowledge-base.js` `STORES`.
- impact: address changes can drift between parser/store detection and customer-facing output.
- risk: medium UX risk, low runtime risk.
- suggested fix: build humanizer branches from `STORES` and `formatStoreAddress`.
- confidence: 95%
- can fix now: yes.

## High priority debt

### AI pipeline has mixed responsibilities in main process

- file: `main.js`
- function/module: `requestAiTestChat`, `mergeMemoryIntoText`, `requestOpenRouterChat`
- problem: Electron IPC, AI memory, BILLZ context building, deterministic humanizer, prompt creation, and OpenRouter request handling all live in one file.
- impact: future AI changes are risky and difficult to test.
- risk: high refactor risk if done quickly.
- suggested fix: later extract an `ai-manager` service with orchestration tests, keeping IPC wrappers in `main.js`.
- confidence: 90%
- can fix now: no. Requires planned refactor and snapshot.

### Memory can mutate search input too aggressively

- file: `main.js`
- function/module: `mergeMemoryIntoText`
- problem: follow-up memory appends brand/color/size/material directly to user text before BILLZ search.
- impact: useful for follow-up queries, but can distort explicit fresh user intent or make debug search text harder to reason about.
- risk: medium behavior risk.
- suggested fix: pass memory as structured search context instead of modifying raw query text.
- confidence: 80%
- can fix now: no. Needs search regression coverage first.

### Product logic is repeated across modules

- file: `knowledge-base.js`, `product-parser.js`, `services/search/query-normalizer.js`, `services/humanizer/product-humanizer.js`, `services/humanizer/templates.js`
- function/module: brand/color/material aliases and descriptions
- problem: each module has partial maps for brands, colors, materials, descriptions, or aliases.
- impact: aliases can drift, especially `BL` which is both a color code (`blue`) and Be Lenka alias in some contexts.
- risk: medium parser/search regression risk.
- suggested fix: centralize canonical data in `knowledge-base.js` and add small adapter helpers per layer.
- confidence: 90%
- can fix now: partially. Only address and brand summary consolidation are safe now.

### Silent fallback hides some persistence failures

- file: `main.js`
- function/module: `safeReadJson`, history load/write handlers
- problem: some JSON reads/writes fall back silently.
- impact: app stays alive, but Codex/debugging may miss corrupted or failed history persistence.
- risk: medium debugging risk.
- suggested fix: log non-sensitive persistence failures with `logger.warn`.
- confidence: 75%
- can fix now: no. Needs careful filtering to avoid noisy logs and secret leakage.

## Medium priority debt

### Large files slow safe AI edits

- file: `main.js`, `renderer/app.js`, `renderer/styles.css`, `billz-client.js`, `whatsapp.js`
- function/module: file-level structure
- problem: large multi-responsibility files increase context load and patch risk.
- impact: harder review, harder automated checks, more merge conflict risk.
- risk: medium maintenance risk.
- suggested fix: future staged extraction by ownership: AI service, debug panel module, BILLZ cache/search adapter, WhatsApp status helpers.
- confidence: 95%
- can fix now: no.

### QA fixtures are lightweight and miss several Stage 5 scenarios

- file: `fixtures/parser-fixtures.json`, `fixtures/search-fixtures.json`, `fixtures/conversation-fixtures.json`
- function/module: QA data
- problem: existing fixtures cover Stage 3/4 basics, but miss follow-up Be Lenka, 10-year-old child recommendation, and explicit black footwear 35 wording.
- impact: regressions can slip through after parser/search/humanizer edits.
- risk: medium QA risk.
- suggested fix: add missing fixtures without changing runtime logic.
- confidence: 90%
- can fix now: yes.

### Humanizer dynamic require is unnecessary

- file: `services/humanizer/response-formatter.js`
- function/module: `formatHumanResponse`
- problem: `humanizeChildSize` is required inside a loop.
- impact: small readability/performance debt.
- risk: low.
- suggested fix: import `humanizeChildSize` at module top with `humanizeProducts`.
- confidence: 95%
- can fix now: yes.

### Logging gaps in parser/memory/humanizer

- file: `intent-detector.js`, `services/memory/*`, `services/humanizer/*`
- function/module: core AI quality pipeline
- problem: search is logged, but parser, memory entity updates, and humanizer strategy are mostly visible only through debug state.
- impact: harder to debug mismatch between parsed query, memory context, and final response.
- risk: medium observability risk.
- suggested fix: add low-volume structured logs at pipeline boundaries.
- confidence: 80%
- can fix now: no. Needs log-noise rules.

## Low priority debt

### Some docs contain stale Git initialization note

- file: `knowledge/core/project-memory.md`
- function/module: Known Problems
- problem: memory still says `.git` metadata is unavailable, but repository is now on `dev`/remote and Stage 5 is on a feature branch.
- impact: AI sessions can make wrong assumptions about rollback readiness.
- risk: low.
- suggested fix: update project memory.
- confidence: 100%
- can fix now: yes.

### Brand descriptions are hardcoded in templates

- file: `services/humanizer/templates.js`
- function/module: `brandDescription`
- problem: descriptions are useful UX copy, but not represented in `knowledge-base.js`.
- impact: mild copy drift.
- risk: low.
- suggested fix: later add `BRAND_DESCRIPTIONS` to `knowledge-base.js`.
- confidence: 80%
- can fix now: no. Avoid broad copy changes in Stage 5.

## Do not refactor now

- Do not split `main.js` in this patch.
- Do not rewrite parser/search scoring.
- Do not change BILLZ auth/request/cache behavior.
- Do not change WhatsApp Playwright automation core.
- Do not change Electron main/renderer/preload architecture.
- Do not replace OpenRouter prompt strategy wholesale.
- Do not add vector DB, embeddings, cloud memory, or heavy test frameworks.

## Suggested cleanup plan

1. Safe Stage 5 cleanup:
   - derive branch humanizer addresses from `knowledge-base.js`;
   - derive brand summary from canonical brand map;
   - add missing regression fixtures;
   - add `knowledge/core/data-structures.md`;
   - update changelog and project memory.
2. Next planned patch:
   - extract prompt text into a dedicated prompt module/config;
   - make deterministic draft the primary response contract;
   - add structured parser/memory/humanizer boundary logs.
3. Later refactor:
   - move AI orchestration from `main.js` into a service;
   - split renderer debug panel from the large renderer file;
   - centralize brand descriptions and alias metadata.

## Controlled cleanup completed

- `services/humanizer/branch-humanizer.js` now derives customer-facing branch addresses from `knowledge-base.js`.
- `product-index.js` now derives brand summary from canonical `BRANDS` and no longer hardcodes Be Lenka as unavailable.
- `services/humanizer/response-formatter.js` now imports `humanizeChildSize` once instead of requiring it inside a loop.
- `fixtures/parser-fixtures.json`, `fixtures/search-fixtures.json`, and `fixtures/conversation-fixtures.json` now include Stage 5 regression coverage for Be Lenka follow-up, child-age wording, black 35 wording, and foot-length sizing.
- `knowledge/core/data-structures.md` documents shared object shapes for future AI/code sessions.

## AI pipeline audit

Current flow:

```text
user message
-> mergeMemoryIntoText
-> BILLZ context/search
-> query normalizer / intent detector / parser
-> Fuse/search scoring
-> conversation memory update
-> AI context builder
-> deterministic humanizer
-> OpenRouter prompt
-> UI response/debug state
```

Findings:

- `mergeMemoryIntoText` makes memory helpful but implicit; structured memory context would be safer than rewriting the query string.
- Search/parser facts and humanizer facts are deterministic, but prompt still repeats some of the same business rules.
- Humanizer and OpenRouter can both decide customer-facing formatting. The deterministic draft should become the stronger source of truth.
- AI context is capped to 5 products, which is good; keep this invariant.

## Product logic audit

Findings:

- `knowledge-base.js` is the right canonical base for brands, colors, materials, stores, and size tables.
- Brand aliases also appear in `services/search/query-normalizer.js` and `product-parser.js`.
- Color logic appears in `knowledge-base.js`, `product-parser.js`, and `services/search/query-normalizer.js`.
- Address logic appears in `knowledge-base.js`, `services/humanizer/branch-humanizer.js`, and older prompt text.
- LL child age/size logic is protected by Stage 4 fixtures but should keep growing with real product examples.

## BILLZ layer audit

Findings:

- BILLZ core should remain untouched in Stage 5.
- Auth/cache/request behavior is concentrated in `billz-client.js`, with diagnostics exposed through Stage 2.
- Local product search uses cached products, which protects against request-per-message behavior.
- Retry/rate-limit strategy is basic. This is acceptable now, but should be documented before any BILLZ request refactor.

## Memory audit

Findings:

- Memory is in-process and TTL-based; no giant history storage was found.
- `ConversationMemory` trims recent turns and summaries.
- Current singleton sandbox memory is suitable for the AI sandbox, but not yet a CRM memory model.
- Reset path exists through AI sandbox reset.
- Structured context should eventually replace raw query mutation for follow-ups.

## Humanizer audit

Findings:

- Humanizer has good customer-first templates and Stage 4 hotfix protections.
- Branch formatting should use canonical stores.
- Product formatting protects LL `3/33` from leaking as raw customer text.
- QA runner checks no raw branch codes, no SKU, no `stock`, no raw child size pattern, and both public addresses.

## QA fixture audit

Covered:

- brand list intent;
- Be Lenka availability;
- LL child age;
- mixed black/white colors;
- foot length sizing;
- wide-foot recommendation;
- both addresses;
- no raw age/size format;
- no raw branch codes or stock language.

Gaps to add:

- `а be lenka?` follow-up-like query;
- `какую модель ребенку 10 лет?`;
- `есть черная обувь 35 размера?`;
- `стопа 24 см`;
- explicit no raw SKU/stock conversation fixture.
