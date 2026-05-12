# Parser System

Source files: `product-parser.js`, `intent-detector.js`, parser helpers inside `billz-client.js`.

## Color Parsing

Color parsing detects product color codes and human color names. Business codes include `BK`, `WH`, `BE`, `GR`, `LG`, `PI`, `WR`, and `LR`.

Rules:
- preserve raw code;
- map to human display only through documented dictionaries;
- avoid guessing when a code has uncertain business meaning;
- keep parser debug data when possible.

## Mixed Colors

Mixed colors include `WH&BK`, `GR&WH`, and `PI&WH`.

Rules:
- parse both sides of `&`;
- keep exact mixed code;
- allow component matching only when search mode intentionally permits it;
- display mixed colors clearly to managers.

## Brand Parsing

Known brand vocabulary includes `TT`, `LL`, `Saguaro`, `Be Lenka`, `Key Top`, and `XZero`.

Brand parser changes can affect AI recommendations and search filters. Add examples and manual tests before changing behavior.

## LL Parsing

`LL` is a brand/business code and may also appear near age/size text. Treat LL changes as high risk.

## Age Parsing

Age parsing should distinguish customer age/size intent from product model or brand codes. When uncertain, store low-confidence parse metadata instead of forcing a result.

## Model Parsing

Model parsing should prefer stable product name patterns and index-backed model resolution. Avoid broad regexes that accidentally consume color/material/store codes.

## Material Parsing

Material codes include `01`, `02`, `03`, and `04`. Confirm current dictionary meaning before changing code behavior.

## Parser Change Checklist

- Add or update parser docs.
- Add examples in task/snapshot notes.
- Verify search behavior.
- Verify AI Manager context.
- Verify BILLZ diagnostics/sample product rendering.

## Stage 3 Parser Upgrade

Brand code map:
- `TT` -> `TipsieToes`;
- `LL` -> `Little Light`;
- `BB` -> `Be Lenka`;
- `KT` -> `Key Top`;
- `XZ` -> `XZero`.

`BB` and the written name `Be Lenka` resolve to Be Lenka. The old conflicting two-letter shortcut must not be treated as a Be Lenka alias.

Mixed colors preserve `mixedCode` and component color codes for combinations like `WH&BK`, `GR&WH`, `PI&WH`, and other known color-code pairs.

The normalizer recognizes age/category phrases such as `3 года`, `5 лет`, `подростковые`, and `детские`.

Parser regression fixtures live in `fixtures/parser-fixtures.json`. Update them whenever parser behavior changes intentionally.

## Stage 5 Audit Notes

- Be Lenka recognition is limited to `BB` and written brand names.
- LL and Be Lenka child model formats must keep age and shoe size separate in customer-facing responses.
- Parser/search changes need fixtures first, then small patches.

## Stage 6 Stabilization

- Be Lenka no longer has the old conflicting two-letter shortcut.
- Parser fixtures include a guard that the removed shortcut does not resolve as a brand or color.
- Child/teen queries with age but no foot length should trigger clarification before product recommendation.
- Parser output feeds the normalized product/context pipeline and should not directly format customer text.
