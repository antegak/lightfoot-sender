# Search System

Source files: `billz-client.js`, `product-index.js`, `product-parser.js`, `intent-detector.js`.

## Normalization

Search begins by normalizing text: casing, whitespace, punctuation, and product/customer query tokens. Normalization should be deterministic and shared by parser/index code.

## Stop Words

Human queries include filler words such as request phrases, size words, and general product words. Stop-word changes affect scoring and should be tested with real manager examples.

## Scoring

Scoring combines:
- exact SKU/barcode;
- size match;
- color/color-code match;
- material/material-code match;
- brand match or exclusion;
- model match;
- useful token overlap;
- soft fallback matches.

## Strict Search

Strict search should protect high-confidence constraints:
- SKU;
- barcode;
- explicit brand exclusions;
- exact model when resolved;
- required size/material/color when confidence is high.

## Soft Search

Soft search is used when the query is human, incomplete, or ambiguous. It may rank likely products but must keep debug output so wrong recommendations can be diagnosed.

## Fallback Logic

Fallback logic should prefer:
1. exact SKU/barcode;
2. parsed strict filters;
3. indexed local search;
4. soft token search;
5. empty result with useful debug information.

## Safety Rules

- Do not silently broaden search when user asked for an exact SKU/barcode.
- Do not remove `searchSummary`/debug fields without replacing them.
- Snapshot before large scoring changes.

## Stage 3 Advanced Search

Stage 3 adds `services/search`:
- `index.js` - safe entrypoint used by BILLZ local search;
- `query-normalizer.js` - colors, materials, intents, age, size, brand aliases, stop words;
- `fuzzy-search.js` - Fuse.js fuzzy search;
- `search-score.js` - strict/context scoring;
- `recommendations.js` - similar size/brand/color fallback suggestions.

Search priority is strict match, fuzzy match, semantic-like contextual fallback, then recommendations. Modes are `strict`, `fuzzy`, `semantic-like`, and `fallback`.

AI context remains capped at 5 products and must not send the full catalog to OpenRouter.

## Stage 4 Fixtures

Search regression fixtures live in `fixtures/search-fixtures.json`. They cover availability, brand-list, material, mixed color, wide-foot recommendation, sizing by centimeters, and LL child-age queries.
