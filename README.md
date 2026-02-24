npm run db:generate

npm run db:push

2. npm run db:migrate
npm run db:studio

npx @better-auth/cli generate
npm run seed:admin

admin@gemx.com
gemx@2026

---
#Rebuild
## Deploy to Vercel + Supabase

### 1. Supabase (database)

1. Create a project at [supabase.com](https://supabase.com).
2. **Settings → Database**: copy the **Connection string** (URI).
   - **Session mode (port 5432)** – use for local dev and for `next build`. With many serverless instances you may hit "max clients reached".
   - **Transaction mode (port 6543)** – use in production for higher capacity. If the app or build **stuck at "Prerendering" with no response**, use **5432** for that env (e.g. keep 5432 in `.env.local`; use 6543 only in Vercel Production if you’ve ensured no DB during prerender).
   - Add `?sslmode=require` if not already in the URL.
3. Optional: run migrations against Supabase from your machine:
   - Put Supabase `DATABASE_URL` in `.env` (or temporarily in `.env.local`).
   - `npm run db:migrate` (or `db:push` for prototyping).
4. If the Dashboard shows **"relation supabase_migrations.schema_migrations does not exist"**, run once in **Supabase → SQL Editor**: `scripts/supabase-migrations-schema.sql` (or `psql $DATABASE_URL -f scripts/supabase-migrations-schema.sql`).

### 2. Vercel (app)

1. Push your repo and import the project in [vercel.com](https://vercel.com).
2. **Settings → Environment Variables** – add `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` (your production URL). Redeploy.

**Env files:** **`.env.local`** is for **local development only** (gitignored; never used by Vercel or Supabase). Copy **`.env.example`** to **`.env.local`** and set DATABASE_URL, AUTH_SECRET, AUTH_URL, etc. **Vercel** uses its own env (Project → Settings → Environment Variables); **Supabase** is just the database and doesn’t read env files.


Gewellery -. Ring, Earings, Necklaces , Pendants ,  Bracelet , Bangles , Accessories

Promote Premium asset at product entry 
Privilege Assist, Direct Assist,Private Assist
Precaution at entry form. product details
To request Premium assist service for user  at home page
Gold => 30000 Credits,
Platium => 50000 Credits
profile  သည် Company ထက် private account  ပိုများမယ်
My wallet how many credits
promotion items
ဆိုပြီးရေးထားမယ် နိုပ်လိုက်မှ ပြပေးမယ်
verification ကို phone နဲ့သော်လည်းကောင်း social နဲ့သော်လည်းကောင်းလုပ်မယ်

discussion

Add detail of seller 
/api/products/:id
API for Origin,
/api/profile -> return current profile
lab API