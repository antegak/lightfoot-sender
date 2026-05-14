# Snapshot

Version: 1.2.3 stage 8 dialogue quality hotfix
Date: 2026-05-14

Stable systems:
- Electron main/renderer/preload architecture.
- WhatsApp automation and manual send flow.
- BILLZ auth, request, cache, search, and diagnostics.
- Parser/search/memory/humanizer safety boundaries.
- Stage 8 controlled freedom layer.

Recent changes:
- Made child school responses less scripted and less repetitive.
- Added `school_pe` use case for school plus PE/change-shoe requests.
- Updated child direction templates to split classroom shoes from PE/change shoes.
- Removed mechanical phrasing such as "Тогда двигаемся" from progression templates.
- Added a regression fixture for the real family -> child school -> PE/change-shoe flow.

Behavior notes:
- AI sandbox should not repeat the same school summary when the customer adds PE/change-shoe context.
- The response may recommend directions, but must not invent exact product availability.
- Keep the next question short and singular.

Rollback notes:
- Revert this hotfix commit to return to the original Stage 8 controlled freedom behavior.

Do not break:
- BILLZ/search/parser/memory/humanizer fact safety.
- WhatsApp auto-send must remain disabled.
- No autonomous replies.
