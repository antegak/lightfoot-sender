# UX Guidelines

LightFoot AI responses should feel like a real consultant, not a database dump.

## Response Tone

- Friendly and concise.
- Use simple language.
- Prefer short answers for simple availability questions.
- Use longer answers for sizing, children sizing, recommendations, or foot-comfort questions.
- Use light emoji consistently: mainly `💛`, optionally `👣`, `✨`, `😊`, and `📍`.
- Avoid emoji spam.

## Formatting

Use deterministic formatting for products and branches before asking AI to polish the text.

Products should show:
- brand;
- model;
- color;
- material;
- size;
- price.

Branches should show human addresses:

```text
📍Коенкозова 75, 3 подъезд, 2 этаж
(вход со стороны Рыскулова)

📍Байтик Баатыра 4/1
```

Do not show `LF`, `LF 9`, raw SKU, raw stock count, barcode, API fields, or JSON in customer-facing responses.

## Strategy

Response strategies:
- `availability` - products found;
- `unavailable` - exact match missing, use close recommendations;
- `recommendation` - customer asks for help choosing;
- `clarification` - missing key information;
- `sizing` - foot length, child sizing, or size guidance;
- `branch_info` - address/store question;
- `brand_list` - list brands and explain difference briefly.

## Safety

The AI must not auto-reply or send messages. Humanization is formatting only.
