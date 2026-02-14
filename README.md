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
   - Set `DATABASE_URL` in `.env` to that connection string.
   - `npm run db:migrate` (or `db:push` for prototyping).

### 2. Vercel (app)

1. Push your repo and import the project in [vercel.com](https://vercel.com).
2. **Settings → Environment Variables** – add:

   | Name           | Value                    | Notes                    |
   |----------------|--------------------------|--------------------------|
   | `DATABASE_URL` | `postgresql://...`       | Supabase connection URI  |
   | `AUTH_SECRET`  | (generate with `openssl rand -base64 32`) | Required |
   | `AUTH_URL`     | `https://your-app.vercel.app` | Your production URL |
   | `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | From GitHub OAuth app | If using GitHub login |
   | `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`     | From Google Cloud Console | If using Google login |

3. Redeploy so the build uses these variables.

### 3. Auth redirect URLs

In your OAuth providers (GitHub, Google), set the callback URL to:

- `https://your-app.vercel.app/api/auth/callback/github` (or `/callback/google`).

The app uses **DATABASE_URL** in production (Supabase) and **DB_HOST**, **DB_USER**, **DB_NAME**, **DB_PASSWORD** locally.