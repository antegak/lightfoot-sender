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
