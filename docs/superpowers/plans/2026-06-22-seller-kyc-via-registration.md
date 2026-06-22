# Seller KYC via Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add seller KYC verification to the existing registration flow — sellers submit document photo URLs alongside profile data, and admins approve/reject from the user edit page to set `user.verified`.

**Architecture:** Four document URL columns are added directly to the `user` table (no separate table). The mobile registration route accepts the URLs and saves them after `signUpEmail`. A new `PATCH /api/mobile/profile` endpoint lets sellers update their documents after rejection. The admin user edit page gets a `KycDocumentsCard` component with Approve/Reject buttons backed by server actions.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + PostgreSQL (Supabase), Better Auth bearer tokens, Zod, Vitest + Testing Library, `shadcn/ui`, Supabase Storage.

## Global Constraints

- Every mobile API route handler must call `await connection()` from `next/server` as its first statement.
- Mobile API auth uses `auth.api.getSession({ headers: request.headers })` — bearer token from `Authorization: Bearer <token>`.
- Use `jsonError(message, status)` from `@/lib/api` for error responses; `jsonUncached({ ... })` for uncached success responses.
- Server actions use `requireActionRole(canAdminManageUsers)` from `@/lib/action-guard` and `@/features/users/permissions/users`.
- Tests live in `tests/api/` (route handlers) and `tests/component/` (React components); run with `npm run test`.
- Drizzle schema changes: edit schema file → `npm run db:generate` → `npm run db:migrate` (never hand-write SQL).
- Path alias `@/*` maps to the repository root.
- `updatedAt` must be set manually on every `db.update()` call: `.set({ ..., updatedAt: new Date() })`.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `drizzle/schema/auth-schema.ts` | Modify | Add 4 nullable doc URL columns to `user` table |
| `drizzle/migrations/<next>.sql` | Generated | Migration for new columns |
| `features/users/db/users.ts` | Modify | Add doc URLs to `UserForEdit`, `UpdateUserInput`, `getUserById` |
| `lib/supabase/server.ts` | Modify | Add `KYC_DOCUMENTS_BUCKET` constant |
| `app/api/upload/kyc-document/route.ts` | Create | Document photo upload (JPEG/PNG/WEBP/PDF, 10 MB) |
| `app/api/mobile/register/route.ts` | Modify | Accept + save 4 optional doc URL fields |
| `app/api/mobile/profile/route.ts` | Create | `PATCH` — seller updates profile fields + doc URLs |
| `features/users/actions/kyc-actions.ts` | Create | `approveUserKycAction`, `rejectUserKycAction` server actions |
| `features/users/components/KycDocumentsCard.tsx` | Create | Admin UI card: shows docs, Approve/Reject buttons |
| `app/admin/users/[id]/edit/page.tsx` | Modify | Add `KycDocumentsCard` below `UserForm` |
| `tests/api/upload/kyc-document.test.ts` | Create | Upload route tests |
| `tests/api/mobile/profile.test.ts` | Create | Profile PATCH route tests |
| `tests/component/KycDocumentsCard.test.tsx` | Create | Component tests |

---

### Task 1: Schema — add document URL columns and update DB types

**Files:**
- Modify: `drizzle/schema/auth-schema.ts`
- Modify: `features/users/db/users.ts`
- Generated: `drizzle/migrations/<next>.sql`

**Interfaces:**
- Produces: `UserForEdit` gains `nrcFrontUrl`, `nrcBackUrl`, `selfieUrl`, `businessLicenseUrl` (all `string | null`) — used by Tasks 3 and 4.
- Produces: `getUserById` returns these fields — used by Task 4.
- Produces: `UpdateUserInput` accepts these fields — used by Task 4 server actions.

- [ ] **Step 1: Add 4 columns to the user table schema**

In `drizzle/schema/auth-schema.ts`, add after the `dateOfBirth` line (line 33):

```ts
  nrcFrontUrl: text("nrc_front_url"),
  nrcBackUrl: text("nrc_back_url"),
  selfieUrl: text("selfie_url"),
  businessLicenseUrl: text("business_license_url"),
```

The full `user` table definition (lines 4–43) should now end with:
```ts
  dateOfBirth: date("date_of_birth", { mode: "string" }),
  nrcFrontUrl: text("nrc_front_url"),
  nrcBackUrl: text("nrc_back_url"),
  selfieUrl: text("selfie_url"),
  businessLicenseUrl: text("business_license_url"),
  points: integer("points").notNull().default(0),
```

- [ ] **Step 2: Generate and apply the migration**

```bash
npm run db:generate
npm run db:migrate
```

Expected: a new `.sql` file appears in `drizzle/migrations/` with four `ALTER TABLE "user" ADD COLUMN` statements.

- [ ] **Step 3: Update `UserForEdit` type and `getUserById` query**

In `features/users/db/users.ts`, extend `UserForEdit` (currently lines 25–34):

```ts
export type UserForEdit = UserRow & {
  image: string | null;
  username: string | null;
  displayUsername: string | null;
  nrc: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  nrcFrontUrl: string | null;
  nrcBackUrl: string | null;
  selfieUrl: string | null;
  businessLicenseUrl: string | null;
};
```

In `getUserById` (currently lines 240–269), add the four fields to both the `.select({...})` object and the WHERE query:

```ts
export async function getUserById(id: string): Promise<UserForEdit | null> {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      points: user.points,
      emailVerified: user.emailVerified,
      verified: user.verified,
      archived: user.archived,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      image: user.image,
      username: user.username,
      displayUsername: user.displayUsername,
      nrc: user.nrc,
      address: user.address,
      city: user.city,
      state: user.state,
      country: user.country,
      nrcFrontUrl: user.nrcFrontUrl,
      nrcBackUrl: user.nrcBackUrl,
      selfieUrl: user.selfieUrl,
      businessLicenseUrl: user.businessLicenseUrl,
    })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  return row ?? null;
}
```

- [ ] **Step 4: Extend `UpdateUserInput`**

In `features/users/db/users.ts`, extend `UpdateUserInput` (currently lines 271–289):

```ts
export type UpdateUserInput = {
  name?: string;
  email?: string;
  role?: string;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  points?: number;
  verified?: boolean;
  archived?: boolean;
  image?: string | null;
  username?: string | null;
  displayUsername?: string | null;
  nrc?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  nrcFrontUrl?: string | null;
  nrcBackUrl?: string | null;
  selfieUrl?: string | null;
  businessLicenseUrl?: string | null;
};
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: No type errors related to the new fields. (Build may fail on other pre-existing issues — ignore those.)

- [ ] **Step 6: Commit**

```bash
git add drizzle/schema/auth-schema.ts drizzle/migrations/ features/users/db/users.ts
git commit -m "feat: add kyc document url columns to user table"
```

---

### Task 2: KYC document upload endpoint

**Files:**
- Modify: `lib/supabase/server.ts`
- Create: `app/api/upload/kyc-document/route.ts`
- Create: `tests/api/upload/kyc-document.test.ts`

**Interfaces:**
- Consumes: `requireUploadContext`, `validateUploadFile`, `storageObjectPath`, `uploadFileToBucket` from `@/lib/supabase/storage-upload` (existing utilities — study `app/api/upload/user-image/route.ts` as the exact pattern to follow).
- Produces: `POST /api/upload/kyc-document` → `{ url: string }` on success.
- Produces: `KYC_DOCUMENTS_BUCKET = "kyc-documents"` from `lib/supabase/server.ts` — used in the route.

- [ ] **Step 1: Add bucket constant**

In `lib/supabase/server.ts`, append after the last existing `export const` line:

```ts
/** Bucket for KYC verification documents (NRC photos, selfies, business licenses). Create in Supabase Dashboard > Storage. */
export const KYC_DOCUMENTS_BUCKET = "kyc-documents"
```

- [ ] **Step 2: Write the failing tests**

Create `tests/api/upload/kyc-document.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { POST } from "@/app/api/upload/kyc-document/route"

vi.mock("@/lib/supabase/storage-upload", () => ({
  requireUploadContext: vi.fn(),
  validateUploadFile: vi.fn().mockReturnValue(null),
  storageObjectPath: vi.fn().mockReturnValue("user-1/abc.jpg"),
  uploadFileToBucket: vi.fn(),
}))
vi.mock("@/lib/supabase/server", () => ({
  KYC_DOCUMENTS_BUCKET: "kyc-documents",
}))

import {
  requireUploadContext,
  validateUploadFile,
  uploadFileToBucket,
} from "@/lib/supabase/storage-upload"

function makeReq(formData: FormData): NextRequest {
  return { headers: new Headers(), formData: () => Promise.resolve(formData) } as unknown as NextRequest
}

describe("POST /api/upload/kyc-document", () => {
  const fakeCtx = { user: { id: "user-1", role: "user" }, supabase: {} }

  beforeEach(() => {
    vi.mocked(requireUploadContext).mockResolvedValue({ ctx: fakeCtx as never })
    vi.mocked(uploadFileToBucket).mockResolvedValue({ url: "https://example.com/kyc-documents/user-1/abc.jpg", error: undefined })
  })

  it("returns 401 when not authenticated", async () => {
    // requireUploadContext returns an error Response when unauth
    vi.mocked(requireUploadContext).mockResolvedValue({
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    } as never)
    const fd = new FormData()
    const res = await POST(makeReq(fd))
    expect(res.status).toBe(401)
  })

  it("returns 400 when no file provided", async () => {
    const fd = new FormData() // no file
    const res = await POST(makeReq(fd))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/no file/i)
  })

  it("returns 400 when file type is invalid", async () => {
    vi.mocked(validateUploadFile).mockReturnValue(
      Response.json({ error: "Invalid file type" }, { status: 400 })
    )
    const fd = new FormData()
    fd.append("file", new File(["x"], "doc.txt", { type: "text/plain" }))
    const res = await POST(makeReq(fd))
    expect(res.status).toBe(400)
  })

  it("returns 200 with url on valid JPEG upload", async () => {
    const fd = new FormData()
    fd.append("file", new File(["x"], "nrc.jpg", { type: "image/jpeg" }))
    const res = await POST(makeReq(fd))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe("https://example.com/kyc-documents/user-1/abc.jpg")
  })

  it("returns 200 with url on valid PDF upload", async () => {
    const fd = new FormData()
    fd.append("file", new File(["x"], "license.pdf", { type: "application/pdf" }))
    const res = await POST(makeReq(fd))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toMatch(/^https/)
  })
})
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
npm run test tests/api/upload/kyc-document.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/upload/kyc-document/route'`.

- [ ] **Step 4: Create the upload route**

Create `app/api/upload/kyc-document/route.ts`:

```ts
import { NextRequest } from "next/server"
import {
  requireUploadContext,
  storageObjectPath,
  uploadFileToBucket,
  validateUploadFile,
} from "@/lib/supabase/storage-upload"
import { KYC_DOCUMENTS_BUCKET } from "@/lib/supabase/server"

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  try {
    const { ctx, error } = await requireUploadContext(request)
    if (error) return error

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return Response.json({ error: "No file provided." }, { status: 400 })
    }

    const invalid = validateUploadFile(file, ALLOWED_TYPES, MAX_SIZE_BYTES)
    if (invalid) return invalid

    const result = await uploadFileToBucket(ctx.supabase, {
      bucket: KYC_DOCUMENTS_BUCKET,
      path: storageObjectPath(ctx.user.id, file, "jpg"),
      file,
      createBucketIfMissing: true,
    })
    if (result.error) return result.error

    return Response.json({ url: result.url })
  } catch (err) {
    console.error("POST /api/upload/kyc-document:", err)
    return Response.json({ error: "Upload failed" }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm run test tests/api/upload/kyc-document.test.ts
```

Expected: 5/5 passing.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/server.ts app/api/upload/kyc-document/route.ts tests/api/upload/kyc-document.test.ts
git commit -m "feat: kyc document upload endpoint"
```

---

### Task 3: Registration extension + mobile profile update endpoint

**Files:**
- Modify: `app/api/mobile/register/route.ts`
- Create: `app/api/mobile/profile/route.ts`
- Create: `tests/api/mobile/profile.test.ts`

**Interfaces:**
- Consumes: `user` table from `@/drizzle/schema` (has `nrcFrontUrl`, `nrcBackUrl`, `selfieUrl`, `businessLicenseUrl` from Task 1).
- Consumes: `auth.api.getSession` from `@/lib/auth`, `jsonError`/`jsonUncached` from `@/lib/api`, `connection` from `next/server`.
- Produces: `PATCH /api/mobile/profile` — updates profile + doc URL fields for the authenticated user.

- [ ] **Step 1: Write failing tests for the profile update endpoint**

Create `tests/api/mobile/profile.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { NextRequest } from "next/server"
import { connection } from "next/server"
import { auth } from "@/lib/auth"
import { PATCH } from "@/app/api/mobile/profile/route"

vi.mock("next/server", () => ({ connection: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}))
vi.mock("@/drizzle/db", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}))
vi.mock("@/drizzle/schema", () => ({ user: {} }))

function makeReq(body: unknown): NextRequest {
  return {
    headers: new Headers(),
    json: () => Promise.resolve(body),
  } as unknown as NextRequest
}

describe("PATCH /api/mobile/profile", () => {
  beforeEach(() => {
    vi.mocked(connection).mockResolvedValue(undefined)
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1", role: "user" },
    } as never)
  })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)
    const res = await PATCH(makeReq({ nrc: "12/ABC(N)123456" }))
    expect(res.status).toBe(401)
  })

  it("returns 200 with ok:true on valid body", async () => {
    const res = await PATCH(makeReq({ nrc: "12/ABC(N)123456", city: "Yangon" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it("returns 200 when body is an empty object (no-op)", async () => {
    const res = await PATCH(makeReq({}))
    expect(res.status).toBe(200)
  })

  it("returns 400 when nrcFrontUrl is not a valid URL", async () => {
    const res = await PATCH(makeReq({ nrcFrontUrl: "not-a-url" }))
    expect(res.status).toBe(400)
  })

  it("accepts null to clear a doc URL field", async () => {
    const res = await PATCH(makeReq({ nrcFrontUrl: null }))
    expect(res.status).toBe(200)
  })

  it("accepts valid https URL for doc fields", async () => {
    const res = await PATCH(makeReq({
      nrcFrontUrl: "https://example.com/nrc-front.jpg",
      selfieUrl: "https://example.com/selfie.jpg",
    }))
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test tests/api/mobile/profile.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/mobile/profile/route'`.

- [ ] **Step 3: Create the profile update route**

Create `app/api/mobile/profile/route.ts`:

```ts
import { NextRequest, connection } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { jsonError, jsonUncached } from "@/lib/api"
import { db } from "@/drizzle/db"
import { user as userTable } from "@/drizzle/schema"
import { eq } from "drizzle-orm"

const urlField = z.string().url().optional().nullable()

const profileUpdateSchema = z.object({
  nrc: z.string().max(100).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  nrcFrontUrl: urlField,
  nrcBackUrl: urlField,
  selfieUrl: urlField,
  businessLicenseUrl: urlField,
})

export async function PATCH(request: NextRequest) {
  await connection()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) return jsonError("Unauthorized", 401)

  const body = await request.json().catch(() => null)
  const parsed = profileUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const data = parsed.data
  const updates: Record<string, unknown> = {}
  if (data.nrc !== undefined) updates.nrc = data.nrc
  if (data.address !== undefined) updates.address = data.address
  if (data.city !== undefined) updates.city = data.city
  if (data.state !== undefined) updates.state = data.state
  if (data.country !== undefined) updates.country = data.country
  if (data.nrcFrontUrl !== undefined) updates.nrcFrontUrl = data.nrcFrontUrl
  if (data.nrcBackUrl !== undefined) updates.nrcBackUrl = data.nrcBackUrl
  if (data.selfieUrl !== undefined) updates.selfieUrl = data.selfieUrl
  if (data.businessLicenseUrl !== undefined) updates.businessLicenseUrl = data.businessLicenseUrl

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date()
    await db.update(userTable).set(updates).where(eq(userTable.id, session.user.id))
  }

  return jsonUncached({ ok: true })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm run test tests/api/mobile/profile.test.ts
```

Expected: 6/6 passing.

- [ ] **Step 5: Extend the registration route to accept doc URLs**

In `app/api/mobile/register/route.ts`, after the `dateOfBirth` parsing line (line 24), add:

```ts
    const nrcFrontUrl = body?.nrcFrontUrl != null ? String(body.nrcFrontUrl).trim() || null : null;
    const nrcBackUrl = body?.nrcBackUrl != null ? String(body.nrcBackUrl).trim() || null : null;
    const selfieUrl = body?.selfieUrl != null ? String(body.selfieUrl).trim() || null : null;
    const businessLicenseUrl = body?.businessLicenseUrl != null ? String(body.businessLicenseUrl).trim() || null : null;
```

Then in the block that does the post-signup `db.update` (currently around line 71–75), merge the doc URLs into the same update:

```ts
      if (u?.id) {
        await db
          .update(userTable)
          .set({
            role: "user",
            updatedAt: new Date(),
            ...(nrcFrontUrl ? { nrcFrontUrl } : {}),
            ...(nrcBackUrl ? { nrcBackUrl } : {}),
            ...(selfieUrl ? { selfieUrl } : {}),
            ...(businessLicenseUrl ? { businessLicenseUrl } : {}),
          })
          .where(eq(userTable.id, u.id));
      }
```

- [ ] **Step 6: Run the full test suite**

```bash
npm run test
```

Expected: same pass count as before (3 pre-existing failures in `tests/api/products/` are unrelated — ignore them). No new failures.

- [ ] **Step 7: Commit**

```bash
git add app/api/mobile/register/route.ts app/api/mobile/profile/route.ts tests/api/mobile/profile.test.ts
git commit -m "feat: extend registration with kyc doc urls and add profile update endpoint"
```

---

### Task 4: Admin approve/reject server actions + KycDocumentsCard UI

**Files:**
- Create: `features/users/actions/kyc-actions.ts`
- Create: `features/users/components/KycDocumentsCard.tsx`
- Modify: `app/admin/users/[id]/edit/page.tsx`
- Create: `tests/component/KycDocumentsCard.test.tsx`

**Interfaces:**
- Consumes: `UserForEdit` from `@/features/users/db/users` (has doc URL fields from Task 1).
- Consumes: `getUserById` returns doc URLs — the edit page already calls it.
- Consumes: `requireActionRole` from `@/lib/action-guard`, `canAdminManageUsers` from `@/features/users/permissions/users`, `db` from `@/drizzle/db`, `user` table from `@/drizzle/schema`.
- Produces: `approveUserKycAction(userId: string): Promise<{ ok: boolean; error?: string }>` — sets `verified = true`.
- Produces: `rejectUserKycAction(userId: string): Promise<{ ok: boolean; error?: string }>` — sets `verified = false`.
- Produces: `KycDocumentsCard` component with props `{ userId: string; user: UserForEdit }`.

- [ ] **Step 1: Write the failing component tests**

Create `tests/component/KycDocumentsCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { KycDocumentsCard } from "@/features/users/components/KycDocumentsCard"
import { approveUserKycAction, rejectUserKycAction } from "@/features/users/actions/kyc-actions"

vi.mock("@/features/users/actions/kyc-actions", () => ({
  approveUserKycAction: vi.fn(),
  rejectUserKycAction: vi.fn(),
}))

const BASE_USER = {
  id: "user-1",
  name: "Aung Ko",
  email: "test@example.com",
  role: "user",
  phone: "09123456789",
  gender: null,
  dateOfBirth: null,
  points: 0,
  emailVerified: true,
  verified: false,
  archived: false,
  createdAt: new Date("2026-06-22T10:00:00Z"),
  updatedAt: new Date("2026-06-22T10:00:00Z"),
  image: null,
  username: null,
  displayUsername: null,
  nrc: null,
  address: null,
  city: null,
  state: null,
  country: null,
  nrcFrontUrl: null,
  nrcBackUrl: null,
  selfieUrl: null,
  businessLicenseUrl: null,
}

describe("KycDocumentsCard", () => {
  beforeEach(() => {
    vi.mocked(approveUserKycAction).mockResolvedValue({ ok: true })
    vi.mocked(rejectUserKycAction).mockResolvedValue({ ok: true })
  })

  it("shows 'No documents submitted' when no NRC and no doc URLs", () => {
    render(<KycDocumentsCard userId="user-1" user={BASE_USER} />)
    expect(screen.getByText(/no documents submitted/i)).toBeInTheDocument()
  })

  it("shows NRC number when present", () => {
    render(<KycDocumentsCard userId="user-1" user={{ ...BASE_USER, nrc: "12/ABC(N)123456" }} />)
    expect(screen.getByText("12/ABC(N)123456")).toBeInTheDocument()
  })

  it("shows Approve button when user is not verified and has an NRC", () => {
    render(<KycDocumentsCard userId="user-1" user={{ ...BASE_USER, nrc: "12/ABC(N)123456" }} />)
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument()
  })

  it("shows Reject button when user is already verified", () => {
    render(<KycDocumentsCard userId="user-1" user={{ ...BASE_USER, nrc: "12/ABC(N)123456", verified: true }} />)
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument()
  })

  it("shows NRC front link when nrcFrontUrl is present", () => {
    render(<KycDocumentsCard userId="user-1" user={{ ...BASE_USER, nrc: "12/ABC(N)123456", nrcFrontUrl: "https://example.com/nrc-front.jpg" }} />)
    const link = screen.getByRole("link", { name: /nrc front/i })
    expect(link).toHaveAttribute("href", "https://example.com/nrc-front.jpg")
  })

  it("does not show nrcBackUrl link when nrcBackUrl is null", () => {
    render(<KycDocumentsCard userId="user-1" user={{ ...BASE_USER, nrc: "12/ABC(N)123456", nrcBackUrl: null }} />)
    expect(screen.queryByRole("link", { name: /nrc back/i })).not.toBeInTheDocument()
  })

  it("calls approveUserKycAction with userId when Approve is clicked", async () => {
    render(<KycDocumentsCard userId="user-1" user={{ ...BASE_USER, nrc: "12/ABC(N)123456" }} />)
    fireEvent.click(screen.getByRole("button", { name: /approve/i }))
    await waitFor(() => expect(approveUserKycAction).toHaveBeenCalledWith("user-1"))
  })

  it("calls rejectUserKycAction with userId when Reject is clicked", async () => {
    render(<KycDocumentsCard userId="user-1" user={{ ...BASE_USER, nrc: "12/ABC(N)123456", verified: true }} />)
    fireEvent.click(screen.getByRole("button", { name: /reject/i }))
    await waitFor(() => expect(rejectUserKycAction).toHaveBeenCalledWith("user-1"))
  })

  it("shows verified badge when user is verified", () => {
    render(<KycDocumentsCard userId="user-1" user={{ ...BASE_USER, nrc: "12/ABC(N)123456", verified: true }} />)
    expect(screen.getByTestId("kyc-verified-status")).toHaveTextContent(/verified/i)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm run test:component tests/component/KycDocumentsCard.test.tsx
```

Expected: FAIL — `Cannot find module '@/features/users/components/KycDocumentsCard'` and `Cannot find module '@/features/users/actions/kyc-actions'`.

- [ ] **Step 3: Create the server actions**

Create `features/users/actions/kyc-actions.ts`:

```ts
"use server"

import { db } from "@/drizzle/db"
import { user } from "@/drizzle/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireActionRole } from "@/lib/action-guard"
import { canAdminManageUsers } from "@/features/users/permissions/users"

export async function approveUserKycAction(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireActionRole(canAdminManageUsers)
  if (!session) return { ok: false, error: "Unauthorized" }
  try {
    await db
      .update(user)
      .set({ verified: true, updatedAt: new Date() })
      .where(eq(user.id, userId))
    revalidatePath(`/admin/users/${userId}/edit`)
    return { ok: true }
  } catch {
    return { ok: false, error: "Failed to approve" }
  }
}

export async function rejectUserKycAction(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireActionRole(canAdminManageUsers)
  if (!session) return { ok: false, error: "Unauthorized" }
  try {
    await db
      .update(user)
      .set({ verified: false, updatedAt: new Date() })
      .where(eq(user.id, userId))
    revalidatePath(`/admin/users/${userId}/edit`)
    return { ok: true }
  } catch {
    return { ok: false, error: "Failed to reject" }
  }
}
```

- [ ] **Step 4: Create the KycDocumentsCard component**

Create `features/users/components/KycDocumentsCard.tsx`:

```tsx
"use client"

import { useState, useTransition } from "react"
import {
  approveUserKycAction,
  rejectUserKycAction,
} from "@/features/users/actions/kyc-actions"
import type { UserForEdit } from "@/features/users/db/users"

type Props = {
  userId: string
  user: UserForEdit
}

const DOC_LINKS = [
  { label: "NRC Front", key: "nrcFrontUrl" },
  { label: "NRC Back", key: "nrcBackUrl" },
  { label: "Selfie", key: "selfieUrl" },
  { label: "Business License", key: "businessLicenseUrl" },
] as const

export function KycDocumentsCard({ userId, user }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const hasContent = user.nrc || DOC_LINKS.some((d) => user[d.key])

  function handleApprove() {
    setError(null)
    startTransition(async () => {
      const result = await approveUserKycAction(userId)
      if (!result.ok) setError(result.error ?? "Failed to approve")
    })
  }

  function handleReject() {
    setError(null)
    startTransition(async () => {
      const result = await rejectUserKycAction(userId)
      if (!result.ok) setError(result.error ?? "Failed to reject")
    })
  }

  return (
    <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200/60 space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">KYC Documents</h3>

      {!hasContent ? (
        <p className="text-sm text-slate-500">No documents submitted.</p>
      ) : (
        <div className="space-y-3">
          {user.nrc && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-slate-600 w-28">NRC</span>
              <span className="text-slate-900">{user.nrc}</span>
            </div>
          )}

          {DOC_LINKS.map(({ label, key }) =>
            user[key] ? (
              <div key={key} className="flex items-center gap-2 text-sm">
                <span className="font-medium text-slate-600 w-28">{label}</span>
                <a
                  href={user[key]!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline hover:text-blue-800 truncate max-w-xs"
                >
                  {label}
                </a>
              </div>
            ) : null
          )}

          <div className="flex items-center gap-3 pt-2">
            <span
              data-testid="kyc-verified-status"
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                user.verified
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {user.verified ? "Verified" : "Not verified"}
            </span>

            {!user.verified ? (
              <button
                onClick={handleApprove}
                disabled={isPending}
                className="text-xs px-3 py-1 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
            ) : (
              <button
                onClick={handleReject}
                disabled={isPending}
                className="text-xs px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Export from components index**

In `features/users/components/index.ts`, add the export:

```ts
export { KycDocumentsCard } from "./KycDocumentsCard"
```

(Add to whatever is already there — don't replace existing exports.)

- [ ] **Step 6: Run component tests — verify they pass**

```bash
npm run test:component tests/component/KycDocumentsCard.test.tsx
```

Expected: 9/9 passing.

- [ ] **Step 7: Add KycDocumentsCard to the admin user edit page**

Replace the content of `app/admin/users/[id]/edit/page.tsx` with:

```tsx
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { UserForm } from "@/features/users/components";
import { KycDocumentsCard } from "@/features/users/components/KycDocumentsCard";
import { getUserById } from "@/features/users/db/users";
import { getUserPermissions } from "@/features/rbac/db/permissions";
import { requireFeatureAccess } from "@/lib/admin-guard";
import { FEATURE_KEYS } from "@/features/rbac/feature-keys";
import { FadeUp } from "@/components/admin/motion";

type Props = {
  params: Promise<{ id: string }>;
};

async function AdminUsersEditContent({ params }: Props) {
  await connection();
  const session = await requireFeatureAccess(FEATURE_KEYS.USERS);
  const isInternal = session.user.role === "internal";
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();

  // Internal users cannot view or edit admin accounts.
  if (isInternal && user.role === "admin") redirect("/admin/users");

  const permissions = user.role === "internal" ? await getUserPermissions(user.id) : {};
  return (
    <div className="space-y-6">
      <UserForm key={user.id} mode="edit" user={user} permissions={permissions} canAssignAdmin={!isInternal} />
      <KycDocumentsCard userId={user.id} user={user} />
    </div>
  );
}

export default function AdminUsersEditPage(props: Props) {
  return (
    <FadeUp>
      <Suspense
        fallback={
          <div className="animate-pulse space-y-5 py-2">
            <div className="h-8 w-48 rounded-lg bg-slate-200" />
            <div className="h-96 rounded-xl bg-white ring-1 ring-slate-200/60" />
          </div>
        }
      >
        <AdminUsersEditContent {...props} />
      </Suspense>
    </FadeUp>
  );
}
```

- [ ] **Step 8: Run the full test suite**

```bash
npm run test
```

Expected: same result as before (3 pre-existing failures only). All new tests pass.

- [ ] **Step 9: Commit**

```bash
git add features/users/actions/kyc-actions.ts features/users/components/KycDocumentsCard.tsx features/users/components/index.ts app/admin/users/[id]/edit/page.tsx tests/component/KycDocumentsCard.test.tsx
git commit -m "feat: admin kyc approve and reject on user edit page"
```
