# Public Terms of Service / Privacy Policy Page — Design Spec

## Background

The App Content Admin feature (built 2026-07-11/12) lets an admin configure `termsSlug`/`privacySlug` strings and tracks `termsUpdatedAt`/`privacyUpdatedAt` timestamps in the About Us tab, and the mobile API (`GET /api/mobile/about-us`) already exposes all four fields. But no page anywhere in this codebase actually renders content at those slugs — the slug fields currently point at nothing. This spec adds the missing public page.

**Out of scope:** the mobile app itself (a separate codebase) opening `gemx.app/{slug}` in an in-app WebView/browser — that already works today given the existing API response and needs no changes here.

## Architecture

A single dynamic route, `app/[slug]/page.tsx`, at the site root. Static legal text lives in a new file, `lib/legal-content.ts` — there is no admin-editable rich text for these documents; the text is git-committed and changed via code deploys.

### `lib/legal-content.ts`

```ts
export type LegalDocument = {
  title: string
  body: ReactNode
}

export const LEGAL_CONTENT: { terms: LegalDocument; privacy: LegalDocument } = {
  terms: { title: "Terms of Service", body: <>...</> },
  privacy: { title: "Privacy Policy", body: <>...</> },
}

export type LegalDocumentKey = "terms" | "privacy"

/**
 * Matches a requested URL slug against the currently-published About Us
 * termsSlug/privacySlug. Returns which document key matched, or null.
 * If both slugs are set to the same non-empty value (admin misconfiguration),
 * "terms" wins the tie.
 */
export function matchLegalSlug(
  content: { termsSlug: string; privacySlug: string },
  requestedSlug: string
): LegalDocumentKey | null {
  if (requestedSlug && requestedSlug === content.termsSlug) return "terms"
  if (requestedSlug && requestedSlug === content.privacySlug) return "privacy"
  return null
}
```

`matchLegalSlug` is a pure function with no I/O — this is the one piece of real branching logic in this feature and is unit-tested directly (see Testing).

### `app/[slug]/page.tsx`

Follows the exact convention already used by `app/articles/[id]/page.tsx` and `app/news/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation"
import { connection } from "next/server"
import type { Metadata } from "next"
import { HomeNavbar } from "@/components/home/HomeNavbar"
import { HomeFooter } from "@/components/home/HomeFooter"
import { getCachedPublishedAboutUs } from "@/features/app-content/db/cache/app-content"
import { LEGAL_CONTENT, matchLegalSlug } from "@/lib/legal-content"

type Props = { params: Promise<{ slug: string }> }

async function resolveLegalDoc(slug: string) {
  const aboutUs = await getCachedPublishedAboutUs()
  const key = matchLegalSlug(aboutUs, slug)
  if (!key) return null
  const updatedAt = key === "terms" ? aboutUs.termsUpdatedAt : aboutUs.privacyUpdatedAt
  return { doc: LEGAL_CONTENT[key], updatedAt }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection()
  const { slug } = await params
  const resolved = await resolveLegalDoc(slug)
  if (!resolved) return {}
  return { title: resolved.doc.title }
}

export default async function LegalDocumentPage({ params }: Props) {
  await connection()
  const { slug } = await params
  const resolved = await resolveLegalDoc(slug)
  if (!resolved) notFound()

  return (
    <div className="min-h-screen bg-background">
      <HomeNavbar />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {resolved.doc.title}
        </h1>
        {resolved.updatedAt && (
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated {new Date(resolved.updatedAt).toLocaleDateString()}
          </p>
        )}
        <div className="mt-6 leading-relaxed text-muted-foreground">
          {resolved.doc.body}
        </div>
      </main>
      <HomeFooter />
    </div>
  )
}
```

`getCachedPublishedAboutUs()` is Task 3's existing cached getter (`features/app-content/db/cache/app-content.ts`) — no new DB or cache work. `AboutUsContent`'s relevant fields (`features/app-content/schemas/app-content.ts:31-41`): `termsSlug: string`, `termsUpdatedAt: string | null`, `privacySlug: string`, `privacyUpdatedAt: string | null`.

## Data Flow

1. Admin sets `termsSlug`/`privacySlug` in the About Us tab, clicks Save draft then Publish.
2. Publish already revalidates the `"appContent"` cache tag (existing `revalidateAppContentCache()`, Task 5) — no new invalidation plumbing needed.
3. A visitor (or the mobile app's WebView) requests `gemx.app/{slug}`. The page fetches the freshly-cached About Us content, matches the slug, and renders the corresponding static document from `lib/legal-content.ts` plus the DB-sourced "Last updated" date.
4. Before the About Us section has ever been published, `termsSlug`/`privacySlug` default to `""` (empty string) — an empty string can never match a real URL segment, so every slug correctly 404s pre-publish. No special-casing needed.

## Known Limitation

"Last updated" reflects when the admin last saved the **slug field** in App Content Admin, not when the actual document text in `lib/legal-content.ts` was last edited — the two are decoupled since the text isn't admin-editable. If the legal team ships new Terms/Privacy text via a code deploy without anyone touching the admin UI, the displayed date will not automatically update.

**Accepted workaround, not solved by this feature:** whoever updates `lib/legal-content.ts` should ask the admin to re-save the same slug value (even unchanged) in App Content Admin afterward, to bump the timestamp. Tracking a true "content last-modified" date would require either a build-time git-blame lookup or a new DB field — both are more machinery than this static-content feature warrants; out of scope here.

## Content Authorship

This spec does not include the actual Terms of Service / Privacy Policy legal text — that's a content/legal task, not a code design decision. The implementation plan will scaffold `lib/legal-content.ts` with clearly-marked placeholder copy (e.g. "Placeholder — replace with real legal text before launch"), so the feature is functionally complete and testable, but real legal text must be supplied (by the user or legal counsel) before this ships to production visitors.

## Error Handling

- Slug matches neither `termsSlug` nor `privacySlug` → `notFound()` (standard Next.js 404). This also covers "never published yet" (see Data Flow §4) and "admin renamed the slug" (the old URL 404s once the rename is published — expected, since the admin's slug field is the actual routing key, not a display label).
- A DB error while fetching is allowed to bubble to Next.js's default error boundary — no public page in this codebase (`articles`, `news`) wraps this in its own try/catch, so this stays consistent with sibling pages.
- Both slugs set to the same non-empty value (admin misconfiguration): `matchLegalSlug` resolves "terms" first — documented, not user-facing.

## Testing

- `tests/unit/legal-content.test.ts` — unit tests for `matchLegalSlug`: matches on `termsSlug`, matches on `privacySlug`, no match returns `null`, empty requested slug returns `null` even if `termsSlug`/`privacySlug` are also empty (pre-publish defaults), tie-break when both slugs are equal and non-empty.
- No dedicated test for `app/[slug]/page.tsx` itself — matches this codebase's existing convention of not unit/component-testing thin server-page wiring (no such tests exist for `app/articles/[id]/page.tsx` or `app/news/[id]/page.tsx` either). Manual verification (visiting the page in a browser after publishing a slug) is the coverage for the page-level wiring, consistent with how the rest of App Content Admin's UI was manually verified rather than component-tested.

## Files

- Create: `lib/legal-content.ts`
- Create: `app/[slug]/page.tsx`
- Create: `tests/unit/legal-content.test.ts`
