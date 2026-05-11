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
