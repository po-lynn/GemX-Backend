# Guide: Buying Guide & Selling Guide (App Content)

## Prerequisites

```bash
npm run db:migrate
```

Migration `0093_buying_selling_guide_sections.sql` adds `buying_guide` and `selling_guide`.  
Auto-translate needs `GOOGLE_TRANSLATE_API_KEY`.

## Use

1. **Admin → App Content → Buying Guide** or **Selling Guide** (beside Terms & Conditions).
2. Edit in BlockNote with Language = English.
3. Click **Save** — goes live and translates to Myanmar, Thai, Korean when English is detected.
4. Mobile:
   - `GET /api/mobile/buying-guide?lang=Myanmar`
   - `GET /api/mobile/selling-guide?lang=Thai`

## Common errors

| Error | Fix |
| --- | --- |
| enum value missing | Run migration 0093 |
| Google Translate error | Set `GOOGLE_TRANSLATE_API_KEY` |
