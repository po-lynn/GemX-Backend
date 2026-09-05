# Hydration-stable display formatting

## Prerequisites

None beyond the normal app setup. No new env vars.

## Why this exists

React **#418** on Vercel means server HTML text ≠ client text during hydration. Shared helpers in `lib/formatters.ts` must use a **fixed locale and timezone** so SSR (Node on Vercel) and the browser always produce the same string.

## How to use

```ts
import { formatDate, formatPrice, formatPriceWithCurrency, formatNumber } from "@/lib/formatters"

formatDate(new Date("2025-02-03T14:30:00Z"))
// → "Feb 3, 2025, 2:30 PM"  (always en-US, UTC)

formatNumber(1000)
// → "1,000"

formatPriceWithCurrency(25, "USD")
// → "$25"
```

Use these helpers in any Client Component that renders during SSR. Do **not** call `toLocaleDateString()` / `toLocaleString()` without an explicit locale (and `timeZone` for dates) in SSR’d UI.

### Dates on public pages

```tsx
new Date(iso).toLocaleDateString("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})
```

### Relative “Xm ago” strings

These use `Date.now()` and can still differ across a minute boundary:

```tsx
<span suppressHydrationWarning>{fmtRelative(updatedAt)}</span>
```

Or render only after mount (`useSyncExternalStore` / `useEffect`).

### Email addresses on marketing pages

If the site is behind Cloudflare with Email Obfuscation, wrap visible emails:

```tsx
<span suppressHydrationWarning>hello@example.com</span>
```

Or disable Email Address Obfuscation in the Cloudflare dashboard.

## How to extend

- Need a new date style? Add another `Intl.DateTimeFormat(DISPLAY_LOCALE, { …, timeZone: DISPLAY_TIME_ZONE })` in `lib/formatters.ts` — keep locale/TZ constants, do not pass `undefined`.
- Need viewer-local times? Add a client-only component that formats in `useEffect`; do not change the shared SSR-safe helpers to use local TZ.

## Common errors

| Symptom | Cause | Fix |
|---------|--------|-----|
| Minified React #418 / #425 on Vercel only | Locale or TZ differ server vs client | Use `@/lib/formatters` or explicit `"en-US"` + `timeZone: "UTC"` |
| #418 only on homepage contact block | CDN rewrote email text | `suppressHydrationWarning` or disable CF email obfuscation |
| #418 in admin lists on “5m ago” | `Date.now()` crossed a boundary | `suppressHydrationWarning` or client-only relative time |
