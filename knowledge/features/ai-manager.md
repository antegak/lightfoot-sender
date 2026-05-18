# AI Manager Feature

AI Manager helps managers generate product-aware messages and recommendations using AI plus current app context.

## Sandbox

The AI sandbox stores short-lived parsed context such as current brand, color, size, and material. It should support safer experiments without replacing stable user workflows.

Rules:
- memory helps context, but fresh user input wins;
- memory must be inspectable through debug output when it influences results;
- persistent memory expansion requires a privacy and reset plan.

## AI Memory

Current memory flow is lightweight and context-oriented. Future AI CRM memory should be designed separately with explicit retention rules.

## Intents

Intents are detected from customer/manager text and used to shape search and response context. Intent changes can affect AI tone and product retrieval.

## Parser

The parser extracts colors, mixed colors, brands, materials, sizes, foot length, model names, SKU/barcode, and store cues. AI Manager relies on parser output to ask BILLZ for relevant products.

## OpenRouter

OpenRouter is the AI provider path. API keys and provider configuration must stay outside renderer-visible state.

## AI Context

AI context can include:
- user text;
- detected intent;
- parsed query;
- BILLZ search results;
- brand summary;
- size recommendation;
- AI sandbox memory;
- diagnostics/debug summaries.

## Response Pipeline

```text
Input
  -> detect intent
  -> parse query
  -> update sandbox memory
  -> optional BILLZ search
  -> compose AI prompt/context
  -> OpenRouter response
  -> parse/display AI variants
```

## Safety Rules

- Do not hide BILLZ failures behind generic AI answers.
- Preserve debug context for search-backed recommendations.
- Do not make AI modify product facts.
- Manual testing is required for prompt, parser, or BILLZ context changes.

## Stage 3 Memory And Context

Stage 3 adds lightweight memory in `services/memory`:
- short-term memory keeps only recent turns;
- summarized memory stores compact conversation context;
- entity memory stores preferred brand, size, color, material, foot length, child age, customer type, and last intent.

Memory has TTL from `config/memory-config.json` and must not store infinite chat logs.

AI context is built through `services/ai/context-builder.js` and includes only top relevant products, parsed query, memory summary, recent context, and recommendation reasoning. Product context is capped at 5 items.

Responses should read like a consultant response, not a database dump.

## Stage 4 Humanization

Stage 4 adds deterministic humanization in `services/humanizer`.

The AI now receives a stable formatted draft with:
- response strategy;
- template used;
- product formatting;
- branch formatting;
- recommendations;
- fallback reason.

This layer is deterministic and local. It does not trigger extra OpenRouter calls and does not enable autonomous replies.

## Stage 4 Hotfix

- Humanized answers always show both customer-facing branch addresses.
- Product answers must not route a product to a specific branch or mention branch-specific stock.
- LL/child formats like `3/33` are split into human text: approximate age first, shoe size second.
- Debug metadata includes detected child format, humanized age, and whether address formatting was applied.

## Stage 5 Audit Notes

- Deterministic `humanizedResponse` should be treated as the safest customer-facing draft.
- OpenRouter prompt should focus on tone and reasoning. Business rules should gradually move into deterministic helpers/config.
- AI context remains capped to top relevant products and should not send the full catalog.
- Follow-up memory works today, but future cleanup should pass memory as structured search context instead of mutating the raw query text.

## Stage 6 Stabilization

Stage 6 makes the deterministic layer the customer-facing response contract.

Pipeline:

```text
user message
  -> parser
  -> structured memory context
  -> intent/search/recommendations
  -> normalized products
  -> AI reasoning object
  -> deterministic humanizer
  -> customer response
```

Rules:
- OpenRouter is a reasoning layer only for AI sandbox product conversations.
- OpenRouter must not insert addresses, format products, or choose branch availability.
- Final customer text is overwritten with `humanizedResponse.text`.
- If OpenRouter is unavailable, AI sandbox can still return the deterministic humanized response with an `aiError`.
- Debug state includes normalized product preview, reasoning object, formatter output preview, customer profile, clarification state, and AI confidence.
- Follow-up context is passed as memory entities to search; the original user query is preserved.

## Stage 7 Conversational Sales Engine

Stage 7 adds `services/conversation` for AI sandbox/test chat quality:
- conversation state;
- topic focus;
- adult/child/teen/family profile separation;
- sales flow detection;
- next-best-action;
- product-search decision;
- dialogue policy and persona.

The AI sandbox now exposes conversation debug state with `currentFocus`, `currentStage`, `activeSubject`, `nextBestAction`, `shouldSearchProducts`, `customerProfile`, `adultProfile`, and `childProfile`.

Rules:
- Do not enable autonomous WhatsApp replies.
- Do not send messages automatically.
- Do not create permanent CRM memory.
- Do not ask for size/foot length when the conversation state already has it.
- If the customer says "for myself", answer for the adult profile even when child context exists.
- For brand advice, compare and recommend before searching random products.
- For concrete availability, color, size, or "show options" requests, product search may be used.

## Stage 8 Controlled Freedom

Stage 8 makes the AI sandbox less repetitive and more consultant-like while keeping deterministic safety boundaries.

Added:
- `services/conversation/controlled-freedom.js` with `strict_safe`, `guided_consultant`, and `proactive_consultant` levels;
- `services/conversation/new-info-detector.js` for size, foot length, age, use case, color, material, brand, fit/style preference, budget, objection, and comparison cues;
- `services/conversation/repetition-detector.js` to block stale repeated drafts;
- active subject resolution for adult, child, teen, and family follow-ups;
- Stage 8 fixtures for school use case, adult follow-up, correction handling, no stale summary, freedom levels, and one-good-question behavior.

Rules:
- LOW freedom is used for exact availability, exact price, concrete product facts, unavailable BILLZ, low confidence, or conflicting data.
- MEDIUM/HIGH freedom can recommend direction, explain options, and suggest the next step when exact product facts are not required.
- New customer information should progress the conversation instead of repeating the last summary.
- If a draft is too similar to the previous assistant response, switch to a progress move.
- Ask at most one important question.
- The AI still must not invent products, prices, availability, medical promises, or branch-specific stock.

### Stage 8 Dialogue Quality Hotfix

The school/PE child flow was tightened after real sandbox feedback:
- avoid "moving along" / mechanical phrases;
- avoid repeating the same school recommendation when the customer adds PE/change-shoe context;
- split classroom shoes and PE/change shoes as two directions;
- keep one concise next question;
- avoid raw "orientir" style phrasing in customer-facing child recommendations.

## Stage 9 Logic-First Orchestration

Stage 9 adds `services/orchestration`. The response plan becomes the deterministic source of truth for AI sandbox decisions.

Responsibilities:
- intent hierarchy decides high-priority flows such as pain, nail problems, comfort, school, family, exact availability, sizing, style, and comparison;
- mode selector chooses response modes such as `comfort_consultation`, `school_selection`, `sport_selection`, `availability_check`, and `style_guidance`;
- safety engine blocks fake availability, fake prices, raw SKU/barcode/stock, branch-specific stock, and medical promises;
- clarification engine prevents over-questioning when recommendation confidence is high;
- recommendation engine chooses directional brands and use cases before the LLM speaks.

LLM policy:
- LLM is draft-only.
- LLM may improve natural wording and flow.
- LLM must not choose mode, search, clarification, empathy, safety, or business facts.

Debug adds:
- `responsePlan`;
- `selectedMode`;
- `selectedIntent`;
- `recommendationConfidence`;
- `clarificationAllowed`;
- `searchAllowed`;
- `activeProfile`;
- `orchestrationReason`.

## Stage 10 Store Consultant And Product Media

Stage 10 narrows the AI target to a LightFoot store consultant:
- logic decides intent, active subject, search permission, gallery mode, and safety;
- LLM remains wording-only;
- `anchoredConversationSubject` keeps adult/child focus across follow-ups such as "покажи", "какие", "эти", "фото", or brand-only requests;
- `product_gallery` starts the real-photo flow when the customer asks to see a model, color, brand, or photo;
- `services/product-media` builds galleries from real product fields or `config/product-media.json`.

Debug adds:
- `anchoredSubject`;
- `subjectConfidence`;
- `responseMode`;
- `galleryIntent`;
- `mediaFound`;
- `selectedProducts`;
- `recommendationReason`.

Rules:
- Do not generate AI product images.
- Do not use product search for pain/comfort discovery unless the customer asks for concrete options.
- Keep responses short, product-aware, and store-consultant-like.

## Stage 11 Critical Stabilization

Stage 11 fixes the critical audit findings without refactoring `main.js` or changing memory schema:
- `intent-hierarchy` now uses clean UTF-8 health/comfort/gallery/search patterns so issues like ingrown nails or wide feet win over availability/search wording;
- `anchoredConversationSubject` priority is explicit subject, family advice, carried strong/follow-up anchor, then inferred subject;
- `clarificationCount` and `lastClarificationReason` stop repeated clarification loops for the same missing context;
- recommendation confidence includes known brand, and availability checks no longer suppress recommendation commitment when subject plus brand and fit context are already known.

QA coverage lives in `fixtures/stage11-critical-ai-fixtures.json`.

## Stage 12 Consultant Quality

Stage 12 targets the "bot feeling" issues from the audit while keeping the Stage 11 architecture:
- conversation state tracks `lastRecommendation` and a short `recommendationHistory`;
- repeated advice after a known recommendation moves to `progress_conversation` instead of repeating the same brand summary;
- deterministic wording is slightly more assertive and less question-heavy for adult direction/progression;
- OpenRouter/reasoning prompts explicitly treat `deterministicDraft` as the final meaning and forbid extra questions or changed facts;
- `config/product-media.json` contains initial verified Be Lenka media mappings from official product images.

QA coverage lives in `fixtures/stage12-consultant-quality-fixtures.json`.

## Stage 13 Health Conversation Hotfix

Stage 13 fixes a live failure where the AI handled ingrown nails correctly once, then lost the context:
- conversation state now carries `currentIntent`, `previousIntent`, `lastHealthIntent`, and a short `lastHealthIntentTurns` TTL;
- follow-ups such as "Ну что взять тогда?" after nail/pain context use `after_health_recommendation` instead of generic clarification;
- `determineClarification()` refuses repeated size/color clarification immediately after health context;
- recommendation planning includes `searchHint: wide_toe_box_preferred` for health-context product flow;
- availability display filters basic colors when the customer asks for unusual colors and non-basic options exist;
- branch addresses are shown only for branch/location/conversion context, not every product list.

QA coverage lives in `fixtures/stage13-health-conversation-fixtures.json`.
