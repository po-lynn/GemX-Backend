npm run db:generate

npm run db:push

2. npm run db:migrate
npm run db:studio

npx @better-auth/cli generate
npm run seed:admin

admin@gemx.com
gemx@2026

---

## Deploy to Vercel + Supabase

### 1. Supabase (database)

1. Create a project at [supabase.com](https://supabase.com).
2. **Settings → Database**: copy the **Connection string** (URI).
   - Use **Transaction** pooler (port **6543**) for serverless.
   - Add `?sslmode=require` if not already in the URL.
3. Optional: run migrations against Supabase from your machine:
   - Put Supabase `DATABASE_URL` in `.env` (or temporarily in `.env.local`).
   - `npm run db:migrate` (or `db:push` for prototyping).

### 2. Vercel (app)

1. Push your repo and import the project in [vercel.com](https://vercel.com).
2. **Settings → Environment Variables** – add `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` (your production URL). Redeploy.

**Env files:** **`.env.local`** is for **local development only** (gitignored; never used by Vercel or Supabase). Copy **`.env.example`** to **`.env.local`** and set DATABASE_URL, AUTH_SECRET, AUTH_URL, etc. **Vercel** uses its own env (Project → Settings → Environment Variables); **Supabase** is just the database and doesn’t read env files.