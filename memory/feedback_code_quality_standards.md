---
name: Code quality standards
description: All generated code must be optimized, secure, and built for scale — use Next.js cache where appropriate
type: feedback
---

All generated code must be optimized, secure, and performance-ready to handle many concurrent users.

**Why:** The project is a marketplace expected to scale. Low-quality or naive implementations will cause problems under load.

**How to apply:**
- Write efficient DB queries (avoid N+1, select only needed columns, use indexes)
- Use `unstable_cache` / `revalidateTag` / `revalidatePath` from Next.js cache for read-heavy server data (admin lists, public listings)
- Validate and sanitize all inputs at API boundaries
- Never expose internal fields (adminNote, sellerId internals, etc.) to mobile clients
- Prefer server components with cached data fetches over client-side fetching where possible
- Keep API route handlers lean — push DB logic into feature `db/` modules
