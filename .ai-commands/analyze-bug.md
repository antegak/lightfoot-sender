# /analyze-bug

Purpose: diagnose a bug before changing risky code.

Analyze:
- user-visible symptom;
- logs;
- stack traces;
- recent changes;
- affected subsystem;
- reproduction steps;
- whether secrets/network/session/build could be involved.

Workflow:
- read relevant docs;
- inspect source locally;
- reproduce when possible;
- classify likely cause;
- propose or implement the smallest safe fix;
- update docs/changelog/snapshot if behavior changes.

Output:
- root cause or best hypothesis;
- evidence;
- fix plan or patch summary;
- confidence score;
- manual tests required.
