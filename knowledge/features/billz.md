# BILLZ Feature

Source files: `billz-client.js`, `product-parser.js`, `product-index.js`, `intent-detector.js`, renderer BILLZ controls.

Reference: BILLZ API Notion page states that BILLZ 2.0 REST API integrations use HTTPS, JSON request/response data, and the admin API base URL `https://api-admin.billz.ai`.

## Auth

BILLZ auth uses a secret token to request an access token. The code keeps token state in memory and refreshes when expired or forced.

Current foundation rules:
- keep secret token out of renderer;
- mask secret status in UI;
- log auth success/failure with safe metadata only;
- never log raw access tokens or secret tokens.

## Access Token

The access token is cached with expiration handling and expiry skew. JWT expiration can be decoded when available.

Risk area:
- changes to token caching can break all product, diagnostics, and AI context flows.

## Cache

Product search uses local cache layers:
- request/product search cache;
- local product list cache;
- parsed product/index data for hybrid search.

Cache changes should document:
- invalidation rules;
- page/limit behavior;
- stale data risk;
- diagnostics available to managers or developers.

## Products

Products are loaded from BILLZ endpoints, normalized, parsed into business metadata, and optionally humanized for AI/manager display.

Product metadata includes:
- brand;
- model;
- SKU/barcode;
- size;
- color;
- material;
- store.

## Search

Search behavior includes direct SKU/barcode lookup, API-backed search, cached local search, parser-assisted filters, scoring, and fallback results.

Search must expose enough debug context to answer:
- what was parsed;
- whether strict or soft matching was used;
- how many products were cached;
- which top scores were selected;
- whether result came from API or local cache.

## Diagnostics

BILLZ diagnostics should verify:
- auth availability;
- product endpoints;
- sample product shape;
- search endpoint behavior;
- safe error classification.

Diagnostics must not leak secrets.
