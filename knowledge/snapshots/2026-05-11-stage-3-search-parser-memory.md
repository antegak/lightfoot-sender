# Snapshot

Version: 1.2.3 stage 3 search parser memory
Date: 2026-05-11

Stable systems:
- Electron main/renderer/preload architecture remains unchanged.
- BILLZ request/auth/cache flow remains unchanged; advanced search uses existing cached products.
- WhatsApp runtime remains unchanged except prior logging foundation.
- AI Manager still uses OpenRouter through existing IPC.

Known issues:
- Attached PDF size table was extracted and appears broadly aligned with existing LL, Saguaro, and TT size tables; still needs manual business QA before changing production recommendations.
- Fuse.js quality depends on product names and parser dictionaries.
- Automated parser/search tests are still lightweight and should be expanded.

Recent changes:
- Added Fuse.js advanced search service.
- Added query normalizer for colors, materials, intents, age, brand aliases, and stop words.
- Added recommendation engine for neighbor size, similar brand/color, and same material.
- Added lightweight conversation memory with TTL, short-term turns, summary, and extracted entities.
- Added AI context builder capped at 5 products.
- Added debug diagnostics state for parsed query, search summary, memory, matched products, fallback logic, and recommendation reasoning.
- Checked attached `Новая таблица.pdf` for LL, Saguaro, TT size-table context.

Rollback notes:
- Revert `services/search`, `services/memory`, `services/ai/context-builder.js`, search/memory config files, Fuse.js dependency, and the small integration points in `billz-client.js`, `intent-detector.js`, `main.js`, `product-index.js`, `product-parser.js`, and `knowledge-base.js`.

Do not break:
- BILLZ auth/cache/product loading.
- Parser/search ranking explainability.
- AI Manager OpenRouter request flow.
- WhatsApp collection/sending.
- IPC through preload.
