# Profile API (mobile)

## GET current profile

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/profile
```

Response `profile.verified` reflects admin verification (`user.verified`). Use it in the app to show a verified badge or gate features.

## Extend

To expose another `user` column on **GET `/api/profile`** only:

1. Confirm `getUserById` in `features/users/db/users.ts` selects the column.
2. Add the field to the `profile` object in `app/api/profile/route.ts`.
3. Update `docs/MOBILE-API.md` section **5.4** and **Recent changes**.

Public seller profiles (**GET `/api/profile/:id`**) also return `profile.verified` for badge display on seller pages.

To add a field on **both** endpoints, update `app/api/profile/route.ts` and `app/api/profile/[id]/route.ts` (public profile omits private fields like `email` / `phone`).
