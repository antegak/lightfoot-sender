# Snapshot

Version: 1.2.3 stage 10 store consultant media
Date: 2026-05-18

Stable systems:
- Electron main/renderer/preload architecture.
- WhatsApp automation and manual send flow.
- BILLZ auth, request, cache, search, and diagnostics.
- Parser/search/memory/humanizer safety boundaries.
- Stage 9 logic-first orchestration.

Recent changes:
- Added `anchoredConversationSubject` with profile, confidence, turn expiry, update timestamp, and reason.
- Added `product_gallery` intent/mode for "show", photo, gallery, and visual follow-up requests.
- Added `services/product-media` with media map, media resolver, and gallery builder.
- Added `config/product-media.json` as the optional real-photo mapping source.
- Added gallery-aware humanizer metadata and template.
- Added debug fields for anchored subject, subject confidence, response mode, gallery intent, media found, selected products, and recommendation reason.
- Simplified consultant persona/prompt away from therapy/life-coach language.
- Added Stage 10 QA fixtures for adult/child subject anchoring, Be Lenka follow-up, photo request, comfort/no-spam, and recommendation commitment.

Behavior notes:
- Follow-up requests such as "покажи be lenka" keep the anchored adult/child subject unless a new subject is explicit.
- Photo/gallery requests search product data only when concrete product viewing is needed.
- Pain/comfort topics still avoid product spam and medical claims.
- Product media uses real product fields or `config/product-media.json`; AI image generation is not allowed.

QA:
- `node -e "const { runQaFixtures } = require('./services/qa'); const r = runQaFixtures(); console.log(JSON.stringify(r.summary, null, 2));"` passed 67/67 fixtures.
- `npm test -- --runInBand` was not available because `package.json` has no `test` script.

Rollback notes:
- Revert the Stage 10 commit to return to Stage 9 behavior.
- `config/product-media.json` can remain empty until real media URLs are mapped.

Do not break:
- BILLZ auth/cache/search.
- WhatsApp sessions, collection, dedupe, sending, and progress.
- Electron IPC boundaries.
- Updater/build configuration.
- Existing QA runner.
- No autonomous replies or auto-send behavior.
- No fake products, prices, availability, AI-generated product images, SKU/barcode/stock leaks, or medical promises.
