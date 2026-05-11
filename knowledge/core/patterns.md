# Engineering Patterns

## Structured Logging

Important flows should log clear tags, stage names, and safe metadata. Do not log tokens, full secrets, or private customer data unless explicitly sanitized.

Preferred shape:

```js
logger.info(LOG_CATEGORIES.SEARCH, 'search completed', {
  query,
  intent,
  matches,
});
```

Logger files live in `services/logger/`:
- `logger.js` - safe logger API, recent log reader, clear logs helper;
- `transports.js` - Winston file transports and basic rotation;
- `categories.js` - allowed categories.

Categories:
- `AI`;
- `BILLZ`;
- `SEARCH`;
- `WHATSAPP`;
- `IPC`;
- `CACHE`;
- `SYSTEM`;
- `ERROR`;
- `PERFORMANCE`.

Logging must never crash the application. If file logging fails, runtime behavior should continue.

## No Magic Logic

Business rules should live in named dictionaries, parser helpers, or documented functions. Avoid hidden regex behavior without tests or docs.

## Renderer/Main Separation

Renderer owns UI. Main owns privileged work. Do not move filesystem, secret, network auth, or Playwright control into renderer.

## IPC Only Through Preload

Renderer must use `window.api` exposed by `preload.js`. Do not import Electron directly inside renderer code.

## No Secrets In Renderer

Secret tokens, OpenRouter keys, and privileged config must remain in main/app data. Renderer can display masked state only.

## No Silent Failures

Every catch block should either return a structured error, log context, or rethrow. Silent failures are allowed only when the action is explicitly optional and documented.

## Diagnostics Required

Any new important function should have at least one of:
- structured log event;
- debug panel visibility;
- diagnostics state;
- explicit manual test note.

## Avoid Giant Functions

Large workflow functions should be split when there is a clear boundary: validation, IO, parsing, scoring, formatting, UI rendering. Do not split just for style churn.

## Avoid Duplicated Logic

Parser/search/business rules should have one source of truth. If renderer needs display labels, expose safe summaries instead of copying backend logic.

## Foundation Stage Rule

During FOUNDATION stage, prefer documentation, snapshots, and small safety scaffolding over runtime refactors.
