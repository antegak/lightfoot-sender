# Data Structures

This document records the shared shapes used across BILLZ, parser/search, memory, AI context, and humanizer. It is not a TypeScript contract yet; it is a project memory map for safe JavaScript changes.

## BillzProduct

Raw product object received from BILLZ or loaded from local cache.

Important fields:
- `id`
- `name`
- `sku`
- `vendorCode`
- `barcode`
- `price`
- `stock`, `qty`, or `availableQty`
- optional source fields such as `color`, `material`, `model`

Rules:
- Do not expose raw SKU/barcode/stock fields to customers unless a manager explicitly needs diagnostics.
- Do not request BILLZ per customer message when cache can answer.

## NormalizedProduct

Product document produced by `product-parser.js` and `product-index.js`.

Important fields:
- `brand`: customer-facing brand name.
- `brandLine`: `adult`, `kids`, `family`, or `external`.
- `model`: parsed model name when available.
- `colorCode`, `colorCodes`, `mixedColorCode`, `colorHuman`.
- `materialCode`, `materialHuman`.
- `size`.
- `price`.
- `stock`.
- `store`: internal store hint only. Customer-facing responses should show both public addresses.
- `humanName`, `searchableText`, `tokens`.

Rules:
- `knowledge-base.js` is the canonical source for brands, colors, materials, stores, and size tables.
- Store fields are not inventory-routing instructions for AI responses.

## ParsedQuery

Output from `intent-detector.js` or `services/search/query-normalizer.js`.

Important fields:
- `raw`
- `normalized`
- `searchText`
- `intent`
- `brand`, `brandCode`, `excludeBrand`
- `color`, `colorHuman`, `colorCode`, `colorCodes`, `mixedColorCodes`
- `material`, `materialCode`
- `size`
- `footLength`
- `childAge`
- `customerType`
- `genderCategory`
- `recommendedSize`
- `sizeRecommendation`

Rules:
- Fresh user input wins over memory.
- Brand-list intent must not search for a product named "brand".
- `BB` and `BL` both map to `Be Lenka` in brand context; `BL` can also be a color code in product color parsing, so context matters.

## SearchResult

Structured result from `services/search`.

Important fields:
- `ok`
- `query`
- `mode`: `strict`, `fuzzy`, `semantic-like`, or `fallback`.
- `products`
- `docs`
- `recommendations`
- `searchSummary`
- `recommendationReasoning`

Rules:
- Product results sent to AI context are capped at 5.
- Search failures must return safe empty results rather than crashing.
- Search diagnostics should include normalized query, intent, matches, score, and fallback usage.

## HumanizedProduct

Customer-facing product representation created by `services/humanizer/product-humanizer.js`.

Important fields/text:
- brand and model when available;
- readable color and material;
- child age and shoe size split for LL/Be Lenka child formats;
- formatted price.

Rules:
- Never show raw `3/33`.
- Never show raw SKU/barcode/stock terms in customer responses.
- Prefer model/color/size/price over inventory details.

## ConversationMemory

State from `services/memory/conversation-memory.js`.

Important fields:
- `shortTerm`
- `summary`
- `entities`
- `updatedAt`
- `ttlMinutes`

Rules:
- Keep memory lightweight and TTL-based.
- Do not store infinite chat logs.
- Reset must clear recent turns and extracted entities.

## CustomerProfile

Lightweight extracted entity view, not a CRM record.

Important fields:
- `preferredSize`
- `preferredBrand`
- `preferredColor`
- `preferredMaterial`
- `footLength`
- `childAge`
- `customerType`
- `lastIntent`

Rules:
- This is short-term conversational context.
- Persistent CRM memory requires a separate privacy and retention design.

## AIContext

Object passed from AI Manager orchestration into the humanizer and OpenRouter prompt.

Important fields:
- `query`
- `connected`
- `products`
- `recommendations`
- `parsedQuery`
- `detectedIntent`
- `sizeRecommendation`
- `searchSummary`
- `searchDebug`
- `brandSummary`
- `memorySummary`
- `memoryEntities`
- `recentMessages`
- `recommendationReasoning`
- `totalCachedProducts`
- `matchedProducts`
- `searchMode`
- `humanizedResponse`

Rules:
- Keep product context short and relevant.
- Deterministic `humanizedResponse` is the safest customer-facing draft.
- Prompt should support tone/reasoning, not become the only home for business rules.
