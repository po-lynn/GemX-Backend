# App Content — Legal & Guides UI + Privacy Policy

## What changed

- Replaced separate Terms / Buying / Selling **tabs** with one **Legal & Guides** tab.
- Document selector dropdown: Terms & Conditions, Buying Guide, Selling Guide, **Privacy Policy**.
- Added `privacy_policy` **enum value only** (same `app_content_section` table — no new columns).
- Mobile: `GET /api/mobile/privacy-policy`

## DB

Migration `0095_privacy_policy_section.sql`:

```sql
ALTER TYPE "public"."app_content_section_name" ADD VALUE IF NOT EXISTS 'privacy_policy';
```

Existing rows for terms / buying / selling are unchanged.

## Admin URL

- `/admin/app-content?tab=legal&doc=terms|buying|selling|privacy`
- Legacy `?tab=terms|buying|selling` still opens Legal & Guides with the matching doc.

## Auth

Unchanged App Content permissions. Privacy mobile route is public.
