# Business Rules

This document stores LightFoot business vocabulary used by parser, search, AI context, and manager-facing responses.

## Brands

- `TT` - brand code used in product names/search.
- `LL` - brand code used in product names/search. LL requests can also appear as age or size-context phrases, so parser changes around LL require care.
- `BB` - Be Lenka brand code.
- `KT` - Key Top brand code.
- `XZ` - XZero brand code.
- `Saguaro` - brand name used in customer/product queries.
- `Be Lenka` - brand name used in customer/product queries.
- `Key Top` - brand name used in customer/product queries.
- `XZero` - brand name used in customer/product queries.

`BB` and the written name `Be Lenka` resolve to `Be Lenka`. The old conflicting two-letter shortcut is not a Be Lenka alias.

Stage 6 rule: do not restore removed Be Lenka shortcuts without explicit business confirmation and fixtures.

## Consultant Tone

Customer-facing answers should sound like a friendly LightFoot consultant:
- concise;
- helpful;
- no raw JSON/API fields;
- no article/SKU when a human model name exists;
- light emoji only, mainly `💛` and `📍`.

For foot problems such as wide feet, painful feet, flat feet, or squeezed toes, explain barefoot comfort softly and avoid medical claims.

## Colors

- `BK` - black.
- `WH` - white.
- `BE` - beige.
- `GR` - green or grey depending product dictionary context. Parser/search changes must verify actual current mapping before changing behavior.
- `LG` - light green or light grey depending product dictionary context. Treat as a code, not free text.
- `PI` - pink.
- `WR` - wine red or warm red depending product dictionary context. Treat as a code, not free text.
- `LR` - light red or related red tone depending product dictionary context. Treat as a code, not free text.

## Mixed Colors

- `WH&BK` - white and black.
- `GR&WH` - green/grey and white, depending product dictionary context.
- `PI&WH` - pink and white.

Multi-color system rules:
- preserve the raw color code;
- parse each side of `&` as a separate color code;
- keep display text human-readable;
- search should match both exact mixed code and individual color components when appropriate;
- do not collapse mixed colors into one generic color unless the fallback is documented.

## Materials

- `01` - material code. Keep dictionary-backed meaning in parser docs before changing.
- `02` - material code. Keep dictionary-backed meaning in parser docs before changing.
- `03` - material code. Keep dictionary-backed meaning in parser docs before changing.
- `04` - material code. Keep dictionary-backed meaning in parser docs before changing.

## Stores

### LF

Address: Коенкозова 75, 3 подъезд, 2 этаж.

Note: вход со стороны Рыскулова.

### LF 9

Address: Байтик Баатыра 4/1.

## Rule

When business meaning is uncertain, do not invent behavior in code. Document the uncertainty, add diagnostics, and ask for confirmation before changing parser/search results.

Customer-facing AI responses must always show both public addresses. The LLM must not choose a branch or describe branch-specific stock; addresses come from the deterministic humanizer.
