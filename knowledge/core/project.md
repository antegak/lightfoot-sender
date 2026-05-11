# LightFoot Sender Project

LightFoot Sender is a Windows Electron application for LightFoot managers who need to work with WhatsApp contacts, send messages, and use AI-assisted product context from BILLZ.

The project solves several operational problems:
- collect and deduplicate WhatsApp contacts from chats;
- prepare and send controlled WhatsApp message campaigns;
- connect AI responses to real product data from BILLZ;
- parse customer requests into product attributes;
- search the local BILLZ product cache with safer fallbacks;
- keep manager workflows inside one desktop app.

## Main Systems

### Electron Shell

The app runs through Electron. `main.js` owns privileged application logic, filesystem access, secrets, update flow, and IPC handlers. `renderer/` owns the user interface. `preload.js` exposes the safe bridge between them.

### AI Manager

AI Manager helps prepare product-aware responses. It uses OpenRouter configuration, current chat context, AI sandbox memory, detected customer intent, parsed query attributes, and optional BILLZ search context.

### BILLZ

BILLZ integration connects to the BILLZ REST API, authenticates with a secret token, receives an access token, loads product data, caches product lists, runs search, and exposes diagnostics.

### WhatsApp

WhatsApp automation uses Playwright and Chromium to open WhatsApp Web, preserve sessions, collect contacts, dedupe results, and send messages with progress tracking.

### Sandbox

The AI sandbox is a safe context layer for AI experiments and AI-assisted responses. It should never bypass existing app boundaries, leak secrets into renderer state, or silently replace stable user workflows.

### Search

Search combines query normalization, parser output, product indexing, strict filters, soft scoring, and fallback logic. Search behavior is business-critical because managers depend on correct product recommendations.

### Parser

The parser extracts brands, colors, materials, sizes, foot length, models, SKU/barcode values, store data, and mixed color codes from product and customer text.

## Foundation Stage Boundary

This stage creates documentation, AI workflow rules, snapshots, command templates, roadmap, changelog structure, and rollback-ready habits. It intentionally does not refactor runtime logic, change IPC contracts, replace Electron architecture, or add heavy dependencies.
