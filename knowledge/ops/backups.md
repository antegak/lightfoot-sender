# Backups And Rollback

This project needs backup-ready workflows before larger AI development.

## Snapshots

Snapshots live in `knowledge/snapshots`.

Create a snapshot before:
- large refactor;
- parser/search changes;
- IPC changes;
- Electron architecture changes;
- release/build changes;
- data or memory persistence changes.

## Rollback

Rollback notes should include:
- last known stable version;
- files touched;
- systems affected;
- manual restore steps;
- what must not be broken.

## Restore Workflow

1. Read the latest snapshot.
2. Identify stable systems and recent changes.
3. Restore from GitHub or local backup.
4. Reinstall dependencies only if package files changed.
5. Run `npm start` for smoke test.
6. Run `npm run build` before release.
7. Manually test WhatsApp, BILLZ, AI Manager, parser/search examples.

## GitHub Backup Workflow

The workspace now has git metadata available. Before relying on GitHub rollback:
- confirm the remote repository points to the intended GitHub repo;
- commit foundation docs, config, logger, diagnostics, and debug panel work;
- push `dev` and `stable`;
- tag stable releases when installers are produced.

Suggested setup:

```bash
git branch -M dev
git checkout -b stable
git checkout dev
git remote add origin <github-url>
git push -u origin dev
git push -u origin stable
```

## Branch Strategy

- `stable` - last production-safe build.
- `dev` - tested integration branch.
- `feature/*` - scoped implementation work.
- `experimental/*` - risky prototypes and AI experiments.

## Safe Refactor Rule

Before risky changes:
- create a snapshot in `knowledge/snapshots`;
- update `CHANGELOG.md`;
- commit the stable state;
- write rollback notes;
- then continue changes.

## Snapshot Workflow

```text
before risky refactor
  -> create snapshot md
  -> update changelog
  -> commit
  -> continue changes
```
