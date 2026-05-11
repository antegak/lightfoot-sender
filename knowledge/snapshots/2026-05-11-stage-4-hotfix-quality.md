# Snapshot

Version: 1.2.3 stage 4 hotfix quality
Date: 2026-05-11

Stable systems:
- Search/parser/memory architecture unchanged.
- Fuse search unchanged.
- AI context builder unchanged except humanized debug metadata already provided by humanizer.
- No autonomous AI mode and no auto-reply behavior.

Known issues:
- Humanizer fixtures are still lightweight and should grow with real conversations.
- Terminal may display legacy Russian text with encoding artifacts, but runtime strings are UTF-8 in the updated humanizer files.

Recent changes:
- Humanizer always shows both public branch addresses.
- Removed customer-facing branch-specific inventory routing from deterministic templates.
- Added LL/child size humanization: raw `3/33` becomes age and size lines.
- Improved brand-list wording.
- Strengthened QA runner to catch raw age/size formats, raw branch codes, inventory terms, and missing addresses.

Rollback notes:
- Revert changes in `services/humanizer`, `services/qa/fixture-runner.js`, updated fixtures, docs, changelog, and the small debug metadata addition in `main.js`.

Do not break:
- BILLZ cached search.
- Parser/search/memory.
- AI Manager manual flow.
- Debug panel QA runner.
