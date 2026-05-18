# Stage 11 Critical AI Stabilization Snapshot

Date: 2026-05-18

## Scope

Critical fixes only:
- intent hierarchy cleanup;
- anchored subject priority fix;
- clarification loop budget;
- recommendation commitment when context is known.

No `main.js` refactor, no memory schema rewrite, no WhatsApp/Claude/auto-reply changes, and no product media data population.

## Changes

- Removed mojibake/byte-corrupted regex duplicates from `services/orchestration/intent-hierarchy.js`.
- Kept health and comfort intents above availability/search, including `nail_problem` and `wide_foot`.
- Changed `anchoredConversationSubject` priority to prefer explicit subject, family advice, strong/follow-up carried anchor, then inferred subject.
- Prevented product/gallery follow-ups from switching family/adult/child subject accidentally.
- Added `clarificationCount` and `lastClarificationReason` to conversation state.
- Made `determineClarification()` avoid repeating the same clarification after it has already been asked.
- Made `response-contract.needsClarification()` respect `responsePlan.shouldClarify === false`.
- Added brand context to recommendation confidence.
- Allowed `availability_check` to keep `shouldRecommend: true` when subject, brand, and size/use-case/fit context are already known.
- Updated post-plan `nextBestAction` override in runtime and QA to use `recommend_product` for search/product fact flow and `recommend_direction` for non-search recommendation.

## QA

Added `fixtures/stage11-critical-ai-fixtures.json` covering:
- adult plus child context where `покажи be lenka` stays adult;
- child anchor where `есть фото?` stays child;
- `при вросших ногтях что-то есть?` routes to comfort consultation without product search;
- wide foot wording routes to comfort consultation without product search;
- repeated clarification budget progresses instead of asking again;
- known brand plus size/use case commits to product recommendation flow.

Validation command:

```bash
node -e "const { runQaFixtures } = require('./services/qa'); const r = runQaFixtures(); console.log(JSON.stringify(r.summary, null, 2)); if (r.summary.failed) process.exit(1);"
```

Result: `73/73` passed.
