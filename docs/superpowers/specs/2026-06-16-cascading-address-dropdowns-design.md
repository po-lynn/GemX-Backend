# Cascading Address Dropdowns — Design Spec

**Date:** 2026-06-16
**Scope:** `features/users/components/UserForm.tsx`, new data file

---

## Goal

Replace the free-text State/Region and City inputs in the Address & Location section with cascading `<select>` dropdowns. Restrict the Country list to Myanmar, Thailand, and South Korea. Default to Myanmar on new user creation.

---

## Data File

**New file:** `features/users/data/country-locations.ts`

Structure:
```ts
export const COUNTRY_LOCATIONS: Record<string, Record<string, string[]>> = {
  Myanmar: {
    "Ayeyarwady Region": ["Pathein", "Hinthada", ...],
    "Yangon Region":     ["Yangon", "Thanlyin", ...],
    // 15 states/regions total
  },
  Thailand: {
    "Bangkok":    ["Bangkok", "Lat Krabang", ...],
    "Chiang Mai": ["Chiang Mai", "Mae Rim", ...],
    // all 77 provinces
  },
  "South Korea": {
    "Seoul":     ["Gangnam-gu", "Mapo-gu", ...],
    "Busan":     ["Haeundae-gu", "Jung-gu", ...],
    // 17 provinces/special cities
  },
}
```

Data coverage:
- **Myanmar:** all 15 states/regions; 5–20 major towns per region
- **Thailand:** all 77 provinces; provincial capital + major districts per province
- **South Korea:** all 17 provinces/metropolitan cities; major gu/si per province

---

## Country Dropdown

- Restrict to 3 options: Myanmar, Thailand, South Korea
- **Edit form:** initialises from `user.country`. No legacy fallback needed — project is under active development and data can be changed freely.
- **Create form:** defaults to `"Myanmar"`
- On change: reset state and city to `""`

---

## State / Region Dropdown

- Replaces the current free-text `<input>`
- Populated from `COUNTRY_LOCATIONS[selectedCountry]` keys
- Disabled when no country is selected (or country is a legacy value not in the data)
- **Edit form:** initialises from `user.state`; if not found in the options it will show as blank (data can be re-selected)
- On change: reset city to `""`

---

## City Dropdown

- Replaces the current free-text `<input>`
- Populated from `COUNTRY_LOCATIONS[selectedCountry][selectedState]`
- Disabled when no state is selected (or state is a legacy value not in the data)
- **Edit form:** initialises from `user.city`; if not found in the options it will show as blank (data can be re-selected)

---

## Cascading Reset Logic

```
Country changes → stateVal = "", city = ""
State changes   → city = ""
```

---

## What Does NOT Change

- DB schema — `country`, `state`, `city` columns are already plain `text`; no migration needed
- The `handleSave` / `handleCreate` submit logic — fields are submitted identically
- The Myanmar NRC section — unchanged, still triggered by `country === "Myanmar"`
- The `COUNTRIES` constant used elsewhere (e.g. products) — only the `UserForm` constants are changed

---

## Files Touched

| File | Change |
|------|--------|
| `features/users/data/country-locations.ts` | **Create** — geographic data |
| `features/users/components/UserForm.tsx` | **Edit** — Country/State/City dropdowns in both `UserEditForm` and `UserCreateForm` |

No API, DB, or test changes are required for this purely UI change.
