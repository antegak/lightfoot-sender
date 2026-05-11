# Git Workflow

Git is the rollback foundation for LightFoot Sender. The repository must protect stable runtime behavior while allowing AI-assisted work through small, reviewable changes.

## Branch Strategy

- `stable` - last known production-safe state. Only release-ready changes should land here.
- `dev` - integration branch for tested work before promotion to `stable`.
- `feature/*` - scoped feature work, documentation, small improvements, or bug fixes.
- `experimental/*` - risky prototypes, parser/search experiments, AI behavior trials, or architecture investigations.

## Safe Refactor Rule

Before risky changes:
- create or update a snapshot in `knowledge/snapshots`;
- commit the current stable state;
- add a `CHANGELOG.md` entry;
- document rollback notes;
- list manual tests.

Risky changes include:
- parser/search behavior;
- BILLZ auth, cache, diagnostics, or API changes;
- WhatsApp session/collection/sending changes;
- Electron main/preload/renderer IPC changes;
- build/release changes;
- persistent AI memory changes.

## Snapshot Workflow

```text
before risky refactor
  -> create snapshot md
  -> update changelog
  -> commit
  -> continue changes
```

## Commit Discipline

Use focused commits:
- `docs: update knowledge foundation`
- `infra: add structured logging`
- `fix: handle billz diagnostics error`
- `refactor: split parser helpers`

Avoid commits that mix unrelated runtime changes, generated build output, dependency churn, and docs.

## Do Not Commit

The `.gitignore` excludes:
- `node_modules`;
- `dist`;
- `build`;
- `logs`;
- `*.log`;
- `.env` and `.env.*`;
- coverage and Playwright reports.

Do commit:
- `knowledge`;
- `knowledge/snapshots`;
- `CHANGELOG.md`;
- `.ai-commands`;
- config files that do not contain secrets.

## Promotion Flow

```text
feature/*
  -> dev
  -> smoke test
  -> snapshot
  -> stable
  -> build installer
```
