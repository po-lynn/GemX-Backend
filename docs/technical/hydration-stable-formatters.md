# Hydration-stable formatters (React #418)

## What changed and why

Production on Vercel threw **minified React error #418** (`Hydration failed because the server rendered text didn't match the client`).

Root cause in shared formatters: `Intl.NumberFormat(undefined, …)` and `Intl.DateTimeFormat(undefined, …)` pick the **runtime default locale/timezone**.

| Runtime | Typical locale / TZ | Example `formatDate(2025-02-03T14:30:00Z)` |
|---------|---------------------|---------------------------------------------|
| Vercel Node SSR | `en-US` / `UTC` | `Feb 3, 2025, 2:30 PM` |
| Browser (e.g. Myanmar) | `en-GB` or `my` / `Asia/Yangon` | `3 Feb 2025, 9:00 pm` (different text) |

Client components that SSR `formatDate` / `formatPrice*` (product form, product lists, portal lists) then hydrate with a different string → **#418**.

### Files touched

- `lib/formatters.ts` — pin `DISPLAY_LOCALE = "en-US"` and `DISPLAY_TIME_ZONE = "UTC"` for all `Intl` formatters
- `app/articles/[id]/page.tsx` — `toLocaleDateString("en-US", { timeZone: "UTC", … })`
- `app/news/[id]/page.tsx` — same
- `components/home/ContactSection.tsx` — `suppressHydrationWarning` on visible email (CDN email obfuscation can rewrite text before hydrate)
- `tests/unit/formatters.test.ts` — assert stable en-US UTC output

## Data flow

```
Server Component / Client SSR
  → formatDate / formatPrice* (en-US + UTC)
  → HTML text nodes
Client hydrate
  → same formatters → identical text → no #418
```

## Schema impact

None.

## Auth & permissions

N/A (display helpers only).

## Edge cases & known limitations

1. **Absolute times show UTC**, not the viewer’s local zone. Prefer this over silent hydration failures. If local TZ is required later, render a placeholder on the server and format in `useEffect`, or use `suppressHydrationWarning` on that node only.
2. **Relative times** (`Xm ago` via `Date.now()`) in admin tables can still mismatch across a minute boundary. Prefer `suppressHydrationWarning` on those cells (already done on one UserForm path) or defer until after mount.
3. **Cloudflare Email Obfuscation** (if the custom domain sits behind Cloudflare) rewrites `hello@…` in HTML and is a separate #418 source. Disable Scrape Shield email obfuscation, or keep `suppressHydrationWarning` / `<!--email_off-->` wrappers.
4. Browser extensions that inject text into the DOM before React loads can still trigger #418; test in a clean profile.
