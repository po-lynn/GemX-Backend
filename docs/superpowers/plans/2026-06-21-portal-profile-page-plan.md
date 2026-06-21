# Portal Profile Page — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-06-21-portal-profile-page-design.md`  
**Date:** 2026-06-21

---

## Phase 0: Documentation Discovery (Complete)

### Allowed APIs

| API | Source | Signature |
|---|---|---|
| `getUserById` | `features/users/db/users.ts:240` | `(id: string) => Promise<UserForEdit \| null>` |
| `updateUserInDb` | `features/users/db/users.ts:291` | `(id: string, input: UpdateUserInput) => Promise<void>` |
| `UpdateUserInput` | `features/users/db/users.ts:271` | All fields optional; `string \| null` fields allow explicit clearing |
| `UserForEdit` | `features/users/db/users.ts:25` | Extends `UserRow` with all nullable profile fields |
| `requireActionRole` | `lib/action-guard.ts:9` | `(can: (role: string) => boolean) => Promise<Session \| null>` |
| `emptyToNull` | `lib/form-data.ts:4` | `(v) => null \| undefined \| v` — `""` → `null`, `null/undefined` → `undefined` |
| `zodErrorMessage` | `lib/form-data.ts:14` | `(error: ZodError) => string` |
| `DatePicker` | `components/date-picker/date-picker.tsx` | `{ value?, name?, placeholder?, onSelect?, className? }` — emits `yyyy-MM-dd` via hidden input when `name` is set |
| `COUNTRY_LOCATIONS` | `features/users/data/country-locations.ts` | `Record<string, Record<string, string[]>>` — country → regions → cities |

### Patterns to follow

- **Form state:** individual `useState` per reactive field; uncontrolled `defaultValue` for plain text/textarea fields
- **Dirty detection:** `onInput` on `<form>` + explicit `setDirty(true)` after state mutations (image upload, date select, cascading select changes)
- **Save bar:** rendered outside `<form>`, submit button uses `form="portal-profile-form"` to target it; shows "Unsaved changes" dot when dirty
- **Image upload:** raw `XMLHttpRequest` to `/api/profile/image`, `formData.set("file", file)`, response `{ url: string }`, then `setImage(url); setDirty(true)`
- **Action return shape:** `{ ok: boolean; error?: string }`
- **CSS:** reuse existing `pd-*` classes from portal product form (already defined in globals.css)

### Anti-patterns to avoid

- Do NOT use `updateUserAction` (admin action — requires `canAdminManageUsers` permission)
- Do NOT include admin-only fields in portal schema: `role`, `points`, `verified`, `archived`, `userId`, `email`, `username`, `displayUsername`
- Do NOT pass `userId` in the form — the server action reads it from the session
- Do NOT import `UserRow` where `UserForEdit` is needed (UserRow is missing several profile fields)

---

## Phase 1: Schema and Server Action

**Files to create:**
1. `features/users/schemas/portal-profile.ts`
2. `features/users/actions/portal-profile.ts`

### Task 1.1 — Create `portalProfileUpdateSchema`

File: `features/users/schemas/portal-profile.ts`

```ts
import { z } from "zod"

export const portalProfileUpdateSchema = z.object({
  name:        z.string().min(1, "Name is required").max(200),
  phone:       z.string().max(50).optional().nullable(),
  gender:      z.string().max(50).optional().nullable(),
  dateOfBirth: z.string().max(20).optional().nullable(),
  nrc:         z.string().max(100).optional().nullable(),
  address:     z.string().max(500).optional().nullable(),
  city:        z.string().max(100).optional().nullable(),
  state:       z.string().max(100).optional().nullable(),
  country:     z.string().max(100).optional().nullable(),
  image:       z.string().url().max(2000).optional().nullable(),
})

export type PortalProfileUpdate = z.infer<typeof portalProfileUpdateSchema>
```

### Task 1.2 — Create `updatePortalProfileAction`

File: `features/users/actions/portal-profile.ts`

```ts
"use server"

import { revalidatePath } from "next/cache"
import { requireActionRole } from "@/lib/action-guard"
import { portalProfileUpdateSchema } from "@/features/users/schemas/portal-profile"
import { updateUserInDb } from "@/features/users/db/users"
import { emptyToNull, zodErrorMessage } from "@/lib/form-data"

export async function updatePortalProfileAction(
  input: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireActionRole((r) => r === "portal")
  if (!session) return { ok: false, error: "Unauthorized" }

  const parsed = portalProfileUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodErrorMessage(parsed.error) }

  const { name, phone, gender, dateOfBirth, nrc, address, city, state, country, image } = parsed.data

  await updateUserInDb(session.user.id, {
    name,
    phone:       phone ?? null,
    gender:      gender ?? null,
    dateOfBirth: dateOfBirth ?? null,
    nrc:         nrc ?? null,
    address:     address ?? null,
    city:        city ?? null,
    state:       state ?? null,
    country:     country ?? null,
    image:       image ?? null,
  })

  revalidatePath("/portal")
  return { ok: true }
}
```

**Verification:**
- TypeScript compiles: `npx tsc --noEmit`
- Action uses session user ID — no client-supplied userId
- Only portal role can call it (checked via `requireActionRole`)

---

## Phase 2: PortalProfileForm Component

**File to create:** `components/portal/PortalProfileForm.tsx`

### Task 2.1 — Component shell and imports

```ts
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Save, Upload, User } from "lucide-react"
import DatePicker from "@/components/date-picker/date-picker"
import { COUNTRY_LOCATIONS } from "@/features/users/data/country-locations"
import { updatePortalProfileAction } from "@/features/users/actions/portal-profile"
import type { UserForEdit } from "@/features/users/db/users"
```

### Task 2.2 — Component state

Controlled state (affect rendering or aren't captured by native `onInput`):
```ts
const [image, setImage] = useState<string | null>(user.image ?? null)
const [country, setCountry] = useState(user.country ?? "")
const [stateRegion, setStateRegion] = useState(user.state ?? "")
const [city, setCity] = useState(user.city ?? "")
const [dirty, setDirty] = useState(false)
const [loading, setLoading] = useState(false)
const [uploadingImage, setUploadingImage] = useState(false)
```

Cascading logic (derived, not state):
```ts
const countries = Object.keys(COUNTRY_LOCATIONS)
const regions = country ? Object.keys(COUNTRY_LOCATIONS[country] ?? {}) : []
const cities = (country && stateRegion) ? (COUNTRY_LOCATIONS[country]?.[stateRegion] ?? []) : []
```

### Task 2.3 — Profile image upload

```ts
function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return
  e.target.value = ""
  setUploadingImage(true)
  const fd = new FormData()
  fd.set("file", file)
  const xhr = new XMLHttpRequest()
  xhr.open("POST", "/api/profile/image")
  xhr.addEventListener("load", () => {
    const data = JSON.parse(xhr.responseText)
    if (data.url) { setImage(data.url); setDirty(true) }
    else toast.error("Image upload failed")
    setUploadingImage(false)
  })
  xhr.addEventListener("error", () => {
    toast.error("Image upload failed")
    setUploadingImage(false)
  })
  xhr.send(fd)
}
```

### Task 2.4 — Submit handler

```ts
async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault()
  setLoading(true)
  const fd = new FormData(e.currentTarget)

  const input = {
    name:        fd.get("name") as string,
    phone:       (fd.get("phone") as string) || null,
    gender:      (fd.get("gender") as string) || null,
    dateOfBirth: (fd.get("dateOfBirth") as string) || null,
    nrc:         (fd.get("nrc") as string) || null,
    address:     (fd.get("address") as string) || null,
    city:        city || null,       // from state (cascading select)
    state:       stateRegion || null,
    country:     country || null,
    image:       image || null,
  }

  const result = await updatePortalProfileAction(input)
  setLoading(false)

  if (!result.ok) {
    toast.error("Failed to save", { description: result.error })
    return
  }

  setDirty(false)
  toast.success("Profile saved")
}
```

### Task 2.5 — Layout structure

```tsx
return (
  <div className="pd-page">
    {/* Save bar — outside <form>, targets by id */}
    <div className="pd-stickybar" style={{ top: "56px" }}>
      <div className="pd-savebar">
        {dirty ? (
          <span className="pd-savebar-dirty">
            <span className="pd-savebar-dirty-dot" /> Unsaved changes
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Profile</span>
        )}
        <span style={{ flex: 1 }} />
        <button
          type="submit"
          form="portal-profile-form"
          className="pd-btn pd-btn-primary"
          disabled={loading || uploadingImage}
        >
          <Save size={13} />
          {loading ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>

    {/* Two-column layout */}
    <div className="pd-layout">
      <form
        id="portal-profile-form"
        className="pd-main"
        onSubmit={handleSubmit}
        onInput={() => setDirty(true)}
      >
        {/* Profile photo section */}
        {/* Personal info: name, phone, gender, dateOfBirth */}
        {/* Identity: NRC */}
        {/* Address: address textarea, country, state/region, city */}
      </form>

      {/* Sidebar — read-only account info */}
      <aside className="pd-sidebar">
        {/* Email, Points, Verified status, Member since */}
      </aside>
    </div>
  </div>
)
```

### Task 2.6 — Form sections detail

**Profile photo card:**
- Avatar display: 80×80 circle, shows `<img src={image}>` or `<User>` icon placeholder
- Hidden `<input type="file" accept="image/jpeg,image/png,image/webp,image/gif">` triggered by an "Upload photo" button
- Shows spinner when `uploadingImage === true`

**Personal info card** (fields, all uncontrolled except gender and dateOfBirth):
- Name: `<input name="name" defaultValue={user.name} required />`
- Phone: `<input name="phone" defaultValue={user.phone ?? ""} />`
- Gender: `<select name="gender" value={gender} onChange={...}>` — options: "", male, female, other, prefer_not_to_say
- Date of birth: `<DatePicker name="dateOfBirth" value={user.dateOfBirth ?? undefined} onSelect={() => setDirty(true)} />`

**Identity card:**
- NRC: `<input name="nrc" defaultValue={user.nrc ?? ""} placeholder="e.g. 12/MaKaNa(N)123456" />`

**Location card** (all controlled via state):
- Address: `<textarea name="address" defaultValue={user.address ?? ""} />`
  - Note: address uses `defaultValue` (uncontrolled) since it doesn't affect rendering; `onInput` on parent form catches it
- Country: `<select value={country} onChange={(e) => { setCountry(e.target.value); setStateRegion(""); setCity(""); setDirty(true) }}`
- State/Region: `<select value={stateRegion} onChange={(e) => { setStateRegion(e.target.value); setCity(""); setDirty(true) }}` — disabled when no country
- City: `<select value={city} onChange={(e) => { setCity(e.target.value); setDirty(true) }}` — disabled when no stateRegion; falls back to free-text `<input>` if cities array is empty

**Sidebar (read-only):**
```tsx
<div className="pd-card">
  <div className="pd-card-title">Account</div>
  <dl>
    <dt>Email</dt><dd>{user.email}</dd>
    <dt>Points</dt><dd>{user.points.toLocaleString()} pts</dd>
    <dt>Status</dt>
    <dd>{user.verified ? <Badge>Verified</Badge> : <Badge variant="outline">Unverified</Badge>}</dd>
    <dt>Member since</dt>
    <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
  </dl>
</div>
```

**Verification:**
- Component renders without TypeScript errors
- `onInput` on the form catches all native input/textarea/select changes
- `setDirty(true)` explicitly called after image upload, date pick, and country/state/city changes
- Save bar submit button is disabled when `loading || uploadingImage`

---

## Phase 3: Page and Navbar

### Task 3.1 — Replace `app/portal/page.tsx`

Replace the redirect with a server component:

```tsx
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getUserById } from "@/features/users/db/users"
import PortalProfileForm from "@/components/portal/PortalProfileForm"
import { notFound } from "next/navigation"

export default async function PortalProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  // session is guaranteed non-null by layout, but guard anyway
  if (!session) return notFound()

  const user = await getUserById(session.user.id)
  if (!user) return notFound()

  return <PortalProfileForm user={user} />
}
```

**Verification:**
- `/portal` no longer redirects to `/portal/products`
- Page loads and displays the user's existing data prefilled in form

### Task 3.2 — Update `PortalNavbar`

Add Products + Profile nav links with active state:

```tsx
"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
// ...existing imports

export default function PortalNavbar({ userName, points }: { userName: string; points: number }) {
  const router = useRouter()
  const pathname = usePathname()

  // ...existing handleSignOut

  return (
    <header className="sticky top-0 z-30 border-b bg-card shadow-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <Gem className="h-5 w-5 text-violet-600" />
          <span className="text-sm font-semibold tracking-tight">GemX Portal</span>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          <Link
            href="/portal"
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium transition-colors",
              pathname === "/portal"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Profile
          </Link>
          <Link
            href="/portal/products"
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium transition-colors",
              pathname.startsWith("/portal/products")
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Products
          </Link>
        </nav>

        {/* Right side — points + username + sign out (unchanged) */}
        <div className="flex items-center gap-3">
          {/* ...existing points badge, userName, sign out button */}
        </div>
      </div>
    </header>
  )
}
```

New imports needed: `usePathname` from `next/navigation`, `Link` from `next/link`, `cn` from `@/lib/utils`.

**Verification:**
- "Profile" link is active (highlighted) when on `/portal`
- "Products" link is active when on `/portal/products` or `/portal/products/*`
- Existing points badge, username, and sign-out are unaffected

---

## Phase 4: Verification

### Checklist

1. **TypeScript:** `npx tsc --noEmit` — zero errors
2. **Dev server:** `npm run dev` — no build errors
3. **Navigate to `/portal`:**
   - Form loads with user's current data prefilled
   - Save bar hidden (not dirty)
   - Sidebar shows email, points, verified status, member since
4. **Edit a field:**
   - Save bar appears with "Unsaved changes" dot
5. **Upload profile photo:**
   - File picker opens
   - Image uploads to `/api/profile/image`
   - Preview updates
   - Save bar appears
6. **Save changes:**
   - Toast "Profile saved" appears
   - Save bar returns to "Profile" (not dirty)
   - Refresh page — changes persist
7. **Navbar:**
   - "Profile" link active on `/portal`
   - "Products" link active on `/portal/products`
   - Clicking each link navigates correctly
8. **Run tests:** `npm run test` — no regressions

---

## File Summary

| Action | File |
|---|---|
| **Create** | `features/users/schemas/portal-profile.ts` |
| **Create** | `features/users/actions/portal-profile.ts` |
| **Create** | `components/portal/PortalProfileForm.tsx` |
| **Replace** | `app/portal/page.tsx` |
| **Update** | `components/portal/PortalNavbar.tsx` |
