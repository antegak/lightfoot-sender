# /safe-refactor

Purpose: prepare a reversible refactor.

Before refactor:
- read relevant `knowledge/` docs;
- create or update a snapshot;
- review dependencies;
- identify affected stable systems;
- write rollback notes;
- define manual tests;
- keep change scope small.

During refactor:
- preserve existing APIs unless migration is explicit;
- preserve logs or improve them;
- avoid unrelated cleanup;
- update docs as behavior changes.

After refactor:
- update changelog;
- update snapshot;
- report confidence, assumptions, risks, unknowns, and manual tests.
