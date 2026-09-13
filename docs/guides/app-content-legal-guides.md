# Guide: Legal & Guides (App Content)

## Prerequisites

```bash
npm run db:migrate
```

Applies `0095_privacy_policy_section.sql` (enum only). Set `GOOGLE_TRANSLATE_API_KEY` for EN auto-translate.

## Use

1. **Admin → App Content → Legal & Guides**
2. Pick a document from the dropdown (Terms, Buying Guide, Selling Guide, Privacy Policy).
3. Edit in BlockNote; **Save** while on English to translate MY/TH/KO (goes live immediately).

## Mobile APIs

| Doc | Endpoint |
| --- | --- |
| Terms | `GET /api/mobile/terms-conditions` |
| Buying | `GET /api/mobile/buying-guide` |
| Selling | `GET /api/mobile/selling-guide` |
| Privacy | `GET /api/mobile/privacy-policy` |

Optional `?lang=Myanmar|Thai|Korean|English`.
