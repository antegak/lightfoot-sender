# Stage 13 Health Conversation Hotfix Snapshot

Date: 2026-05-18

## Trigger

Live failure:

```text
Customer: Привет! у меня вросшие ногти, мне посоветовали вас.
AI: comfort explanation
Customer: Ну что взять тогда?
AI: Уточните размер и цвет?
Customer: 39 размер хочу необычные цвета
AI: shows black/beige/red options plus store address
```

## Root Cause

- `nail_problem` was not carried into the next turn.
- Follow-up "что взять" fell back to generic clarification.
- Product display did not treat "необычные цвета" as a display preference.
- Availability template always included branch addresses.

## Changes

- Added `currentIntent`, `previousIntent`, `lastHealthIntent`, and `lastHealthIntentTurns` to conversation state.
- Runtime and QA now persist orchestration health intent after `responsePlan`.
- `determineClarification()` blocks clarification when health context is still fresh.
- `determineNextBestAction()` recognizes UTF-8 advice phrases such as "что взять" and routes health follow-ups to `recommend_direction`.
- Added `after_health_recommendation` template.
- `recommendation-engine` emits `searchHint: wide_toe_box_preferred` for health context.
- Product display filters basic colors for unusual-color requests when a non-basic option exists.
- Branch addresses are hidden for normal availability responses unless the customer asks about address/location or the flow is conversion.

## QA

Added `fixtures/stage13-health-conversation-fixtures.json`:
- health follow-up recommends TipsieToes/Be Lenka without asking size/color;
- unusual-color availability keeps red and hides black/beige plus store addresses.

Validation:

```bash
node -e "const { runQaFixtures } = require('./services/qa'); const r = runQaFixtures(); console.log(JSON.stringify(r.summary, null, 2)); if (r.summary.failed) process.exit(1);"
```

Result: `77/77` passed.
