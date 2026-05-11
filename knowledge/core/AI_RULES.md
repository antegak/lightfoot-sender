# AI Rules For Codex, Cursor, Claude

These rules protect LightFoot Sender during AI-assisted development.

## Current Stage

This project is in FOUNDATION stage. Do not do massive refactors, architecture migrations, npm package explosions, or giant rewrites unless the user explicitly starts a later implementation stage.

## Documentation Rules

Before changing code:
- read the relevant docs in `knowledge/core`, `knowledge/features`, and `knowledge/ops`;
- inspect the actual source files involved;
- identify whether the change touches stable systems: BILLZ, AI Manager, WhatsApp, parser, search, Electron, IPC.

After changing code:
- update relevant docs;
- update `CHANGELOG.md`;
- update or create a snapshot when behavior, architecture, build, parser/search logic, IPC, or release flow changes;
- note manual test requirements.

## Safe Coding Rules

- Do not break stable features.
- Do not remove logging without replacing it with equal or better diagnostics.
- Do not create silent failures.
- Do not perform random refactors.
- Do not do giant rewrites without a snapshot and rollback notes.
- Do not move secrets into renderer.
- Do not bypass preload for IPC.
- Do not change existing APIs casually.
- Do not add heavy libraries for small foundation tasks.
- Keep edits scoped to the requested behavior.

## Reflection Rules

After major changes, the agent must report:
- confidence score;
- assumptions;
- risks;
- unknowns;
- what requires manual testing.

## Low Confidence Rule

If confidence is below 70%:
- do not make risky changes;
- perform diagnostics first;
- ask a focused clarification if local evidence is insufficient;
- prefer safe implementation and reversible changes.

## Self-Audit Rule

After large changes, the agent must:
- audit the touched areas;
- update docs;
- update changelog;
- update snapshots when needed;
- check architecture consistency.

## Logging Rule

All important functions should be logged or be easy to diagnose. Even before a full logging system exists, new important flows must include clear, safe diagnostics.

## Do Not Break List

- BILLZ auth, token handling, product loading, search, diagnostics.
- AI Manager, sandbox memory, OpenRouter flow, AI response parsing.
- WhatsApp Playwright sessions, contact collection, dedupe, sending, progress.
- Parser and search behavior.
- Electron main/renderer/preload separation.
- Existing IPC contracts and renderer APIs.
