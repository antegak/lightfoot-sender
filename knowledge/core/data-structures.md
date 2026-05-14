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

Strict product contract produced by `services/normalization`.

```js
NormalizedProduct = {
  id,
  brand,
  line,
  model,
  audience,
  color,
  material,
  size,
  ageGroup,
  price,
  stock,
  available,
  displayName,
  searchableText,
  metadata
}
```

Important nested fields:
- `color.code`, `color.codes`, `color.mixedCode`, `color.label`.
- `material.code`, `material.label`.
- `metadata.parsed`, `metadata.human`, `metadata.store`.

Rules:
- `knowledge-base.js` is the canonical source for brands, colors, materials, stores, and size tables.
- Store fields are not inventory-routing instructions for AI responses.
- Parser/search/humanizer should gradually consume this object instead of creating separate partial product transforms.

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
- `BB` and the written name `Be Lenka` map to `Be Lenka`; the old conflicting two-letter shortcut must not be treated as a Be Lenka brand alias.

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
- `searchSummary.confidence` and `searchSummary.lowConfidence` are confidence hooks for future suggest/handoff modes.

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

## ConversationContext

Cleaner Stage 6 context object built around memory and current parser output.

Important fields:
- `entities`
- `inferredCustomerProfile`
- `previousIntent`
- `previousProducts`
- `clarificationState`

Rules:
- Original user query must stay intact.
- Follow-up context should be passed as structured memory, not by rewriting customer text.

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

## Stage7ConversationState

Deterministic AI sandbox dialogue state from `services/conversation`.

Important fields:
- `currentFocus`: `adult_selection`, `child_selection`, `teen_selection`, `family_selection`, `sizing`, `brand_comparison`, `product_availability`, `recommendation`, `reassurance`, `location`, `conversion`, or `unknown`.
- `currentStage`: `discovery`, `clarification`, `narrowing`, `recommendation`, `comparison`, `sizing`, `reassurance`, `conversion`, or `handoff_needed`.
- `activeSubject`: `adultProfile`, `childProfile`, `teenProfile`, `family`, or null.
- `adultProfile`, `childProfile`, `teenProfile`.
- `missingInfo`.
- `nextBestAction`.
- `shouldSearchProducts`.
- `salesFlow`.
- `freedomLevel`: `strict_safe`, `guided_consultant`, or `proactive_consultant`.
- `hasNewInfo`, `newInfoType`, `newInfo`.
- `blockedByRepetition`.
- `selectedDialogueMove`.
- `reasonForNextBestAction`.
- `confidence`.

Rules:
- Keep adult and child profile facts separate.
- Fresh user subject cues such as "for myself" switch `activeSubject` to adult without discarding child context.
- Brand advice and comparison can avoid product search; availability and concrete size/color requests can search.
- This is AI sandbox state, not persistent CRM memory.
- Stage 8 controlled freedom can make the AI more initiative-driven only when exact product facts are not required.
- Repetition blocking should change the dialogue move, not invent product facts.

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
- `normalizedProducts`
- `normalizedRecommendations`
- `customerProfile`
- `conversationContext`
- `reasoningObject`
- `aiConfidence`
- `totalCachedProducts`
- `matchedProducts`
- `searchMode`
- `humanizedResponse`
- `responsePlan`

Rules:
- Keep product context short and relevant.
- Deterministic `humanizedResponse` is the safest customer-facing draft.
- Prompt should support tone/reasoning, not become the only home for business rules.

## ResponsePlan

Stage 9 deterministic orchestration object. It is the source of truth for AI sandbox mode, search permission, empathy, clarification, recommendation, and safety.

Important fields:
- `mode`: `comfort_consultation`, `family_guidance`, `recommendation`, `clarification`, `comparison`, `reassurance`, `availability_check`, `sizing_help`, `style_guidance`, `school_selection`, `sport_selection`, or `conversion_soft`.
- `intent` / `selectedIntent`.
- `shouldSearchProducts`, `searchAllowed`.
- `shouldClarify`, `clarificationAllowed`.
- `shouldRecommend`, `recommendationConfidence`.
- `shouldEmpathize`, `empathyGate`.
- `activeProfile`, `currentFocus`.
- `allowedTopics`, `forbiddenTopics`.
- `suggestedBrands`, `suggestedUseCases`.
- `riskLevel`, `safetyFlags`.
- `conversationEnergy`, `customerEmotion`, `conversationMomentum`, `trustBuildingMode`, `variationStyle`.
- `orchestrationReason`.

Rules:
- LLM must not override `responsePlan`.
- Comfort/pain intents must not trigger product search first.
- Exact availability and price requests stay strict and fact-bound.
- Human dynamics fields vary tone without changing product facts.

## AIReasoningObject

Structured object returned by the LLM reasoning layer or produced locally as a fallback.

Important fields:
- `strategy`
- `tone`
- `clarificationNeeded`
- `clarificationReason`
- `recommendationReason`
- `suggestedProducts`
- `confidence`
- `uncertaintyFlags`
- `riskyResponseFlags`

Rules:
- This object is debug/reasoning input only.
- It must not format final customer-facing text.
- Humanizer remains the final renderer.
