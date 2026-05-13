# Architecture

LightFoot Sender is an Electron desktop app with a privileged main process, a browser renderer, and a preload bridge. The current foundation rule is to document and protect this architecture before large AI-assisted changes.

## Runtime Layout

```text
package.json
  -> Electron main: main.js
  -> Preload bridge: preload.js
  -> Renderer UI: renderer/index.html, renderer/app.js, renderer/styles.css
  -> WhatsApp automation: whatsapp.js
  -> BILLZ API/search: billz-client.js, product-index.js
  -> Parsing/intents: product-parser.js, intent-detector.js, name-utils.js
  -> Local knowledge helpers: knowledge-base.js
```

## Electron Flow

```text
User
  -> renderer UI
  -> window.api from preload.js
  -> ipcMain handlers in main.js
  -> privileged modules/files/network
  -> result back through IPC
  -> renderer updates UI
```

## Main Process

`main.js` owns application startup, BrowserWindow creation, IPC handlers, local app data, secret storage/access, AI request orchestration, BILLZ calls, WhatsApp controller lifecycle, updater behavior, and diagnostics files.

Main process rules:
- keep secrets and filesystem access in main;
- log important workflow steps;
- return structured success/error objects to renderer;
- avoid silent catches;
- keep IPC channels stable unless a snapshot and migration notes exist.

## Renderer Process

`renderer/app.js`, `renderer/index.html`, and `renderer/styles.css` own the visible UI, local UI state, manager controls, AI Manager panel, BILLZ connection controls, contact collection views, sending views, and progress rendering.

Renderer rules:
- call backend features only through `window.api`;
- never directly access secrets;
- handle loading, success, empty, and error states;
- do not duplicate business-critical parser/search logic in UI code.

## Preload

`preload.js` is the only bridge between renderer and main. It exposes safe functions through `contextBridge` and forwards calls through `ipcRenderer`.

Preload rules:
- expose narrow methods, not generic filesystem or shell access;
- validate and normalize simple inputs when useful;
- keep method names stable for renderer compatibility;
- document any new IPC method in feature docs.

## IPC

```text
renderer event
  -> window.api.someAction(payload)
  -> preload ipcRenderer.invoke(channel, payload)
  -> main ipcMain.handle(channel, handler)
  -> module call / filesystem / network
  -> structured response
```

IPC is the safety boundary. New features should add small, named IPC handlers instead of exposing broad privileged APIs.

## AI Pipeline

```text
Manager input / chat context
  -> intent detection
  -> parser extracts product constraints
  -> conversation state tracks focus, subject, stage, and next best action
  -> AI sandbox memory updates current context
  -> BILLZ context optional search
  -> OpenRouter request
  -> response text
  -> renderer parses variants and displays results
```

AI output must remain explainable and debuggable. BILLZ context, parsed query, detected intent, and search debug should stay inspectable when troubleshooting.

## Stage 7 Conversation Pipeline

```text
user message
  -> parser and lightweight memory
  -> conversation state engine
  -> customer profiles for adult / child / teen / family
  -> topic focus and next-best-action decision
  -> deterministic humanizer templates
  -> OpenRouter reasoning layer only
  -> final AI sandbox response
```

Stage 7 is limited to AI sandbox/test chat quality. It does not enable WhatsApp auto replies, autonomous mode, CRM persistence, or a rewrite of BILLZ/search/parser/memory/humanizer.

## BILLZ Pipeline

```text
Secret token
  -> BILLZ auth endpoint
  -> access token cache
  -> products endpoint
  -> product cache
  -> parser/index
  -> local hybrid search
  -> humanized product context
  -> renderer or AI Manager
```

BILLZ API documentation states that the REST API is used for BILLZ 2.0 integrations, uses HTTPS, the base admin API is `https://api-admin.billz.ai`, and JSON is used for request/response data.

## Search Pipeline

```text
Raw query
  -> normalize text
  -> parse intent, brand, color, material, size, model, SKU/barcode
  -> build/search product index
  -> strict matches
  -> soft matches
  -> fallback ranking
  -> search summary/debug
```

Strict filters should be preserved for high-confidence fields such as SKU/barcode. Soft search is useful for human phrasing but must not hide why a result was selected.

## Parser System

```text
Product/customer text
  -> normalize tokens
  -> detect brand/color/material/store/model/size
  -> resolve code dictionaries
  -> attach parsed metadata
  -> feed search and AI context
```

Parser changes are high risk because they affect recommendations, search, and AI context. Snapshot before large parser edits.

## Memory Flow

```text
Parsed customer query
  -> AI sandbox memory current brand/color/size/material
  -> BILLZ context debug
  -> response generation context
  -> renderer display
```

Memory should help continuity, not override fresh user input. Any persistent memory expansion must document retention, reset behavior, and privacy boundaries.
