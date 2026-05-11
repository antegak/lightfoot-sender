# Monitoring And Diagnostics

Monitoring is local and lightweight. Stage 2 intentionally avoids Sentry, Datadog, enterprise monitoring, and heavy telemetry.

## Logger Architecture

Logger files:
- `services/logger/logger.js`;
- `services/logger/transports.js`;
- `services/logger/categories.js`.

Config:
- `config/logging-config.json`;
- `config/feature-flags.json`.

Log files:
- `logs/combined.log`;
- `logs/error.log`.

Logs use Winston file transports with basic size-based rotation. Logging is defensive: logger failures must not crash the app.

## Categories

- `AI` - OpenRouter and AI Manager operations.
- `BILLZ` - auth, diagnostics, product requests.
- `SEARCH` - parser/search/index operations.
- `WHATSAPP` - collection, sessions, sending.
- `IPC` - debug IPC and IPC failures.
- `CACHE` - cache state and rebuilds.
- `SYSTEM` - app lifecycle and local system events.
- `ERROR` - unhandled exceptions/rejections.
- `PERFORMANCE` - request/search/diagnostic duration.

## Logs

Important systems should log:
- BILLZ auth and request stages;
- AI Manager request stages;
- WhatsApp connection, collection, send progress;
- parser/search debug summaries;
- build/update failures.

Global handlers log:
- `uncaughtException`;
- `unhandledRejection`.

Never log:
- raw BILLZ secret tokens;
- raw OpenRouter keys;
- unnecessary customer private data.

## Diagnostics

Diagnostics live in `services/diagnostics`. The debug diagnostics object checks:
- BILLZ connected;
- OpenRouter connected;
- cache state;
- AI memory active;
- WhatsApp session active.

Config lives in `config/diagnostics-config.json`.

## Debug Panel

The hidden debug panel opens with `Ctrl + Shift + D`.

It shows:
- recent local logs;
- structured diagnostics;
- cache state;
- AI memory state;
- WhatsApp session state.

Actions:
- clear logs;
- export/open logs directory;
- reload diagnostics.

## Debug Systems

Debug output should answer:
- what action was attempted;
- what inputs were safely summarized;
- which subsystem failed;
- whether failure is auth, network, parser/search, UI, or provider related;
- what manual test should be run next.

## Crash Handling

Crash handling should prefer:
- structured error returns for expected failures;
- logs for unexpected failures;
- user-facing message for recoverable problems;
- snapshot before changing global error handling.
