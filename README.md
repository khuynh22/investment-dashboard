# Investment Dashboard

A private, single-user web dashboard for tracking the stocks you own. Add your
holdings (ticker + quantity), see their current market value and allocation as a
pie chart, and let prices auto-refresh twice a day — with a manual refresh button
and per-ticker manual price override.

Built to self-host on **Vercel** with **Neon Postgres** and **Google sign-in**,
locked to a single email so only you can see it.

## Features

- 🔐 **Google OAuth**, restricted to one allowlisted email — nobody else can get in
- ➕ Add holdings via the UI; re-adding a ticker **accumulates** shares
- ✏️ Inline **Edit / Save** for quantity, plus a manual price override
- 🥧 **Allocation pie chart**, slices ordered by market value (highest → lowest)
- 🔄 Prices auto-refresh **twice daily** (Vercel Cron) and on demand
- 📈 Live prices from **Yahoo Finance** with a **Stooq** fallback (no API key)
- 📱 Responsive layout for phone, tablet, and desktop

## Tech stack

Next.js 15 (App Router) · TypeScript · Auth.js (NextAuth v5) · Neon Postgres
(`@vercel/postgres`) · Recharts · Vitest · Vercel (hosting + cron).

## Prerequisites

- Node.js 18+
- A free [Neon](https://neon.tech) Postgres database
- A Google account + a [Google Cloud](https://console.cloud.google.com) project
  for OAuth credentials
- (For deploy) a [Vercel](https://vercel.com) account

## Local setup

1. **Install**
   ```bash
   npm install
   ```

2. **Configure environment** — copy the template and fill it in:
   ```bash
   cp .env.local.example .env.local
   npx auth secret        # writes AUTH_SECRET into .env.local
   ```
   Then set in `.env.local`:
   - `ALLOWED_EMAIL` — the Google email allowed to sign in
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — see **Google OAuth** below
   - `POSTGRES_URL` — your Neon **pooled** connection string (host contains `-pooler`)
   - `CRON_SECRET` — any long random string

3. **Create the database tables** — apply the schema once. Either paste
   `src/db/schema.sql` into Neon's SQL editor, or run:
   ```bash
   npm run db:init
   ```

4. **Run**
   ```bash
   npm run dev          # http://localhost:3000
   npm test             # run the unit tests
   ```

## Google OAuth

In Google Cloud Console → **APIs & Services**:

1. **OAuth consent screen** → External → add your email under **Test users**
   (staying in "Testing" mode is fine for a single user).
2. **Credentials → Create Credentials → OAuth client ID → Web application**.
3. Add **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google` (local dev)
   - `https://YOUR_DOMAIN/api/auth/callback/google` (production)
4. Copy the Client ID/secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

## Deploy to Vercel

1. Push this repo to your own GitHub and **import it** at
   [vercel.com/new](https://vercel.com/new).
2. Add the environment variables from your `.env.local` to the Vercel project,
   plus:
   - `AUTH_URL` = your production URL (e.g. `https://investment.example.com`)
   - `AUTH_TRUST_HOST` = `true`
3. Deploy. `vercel.json` registers two daily price-refresh crons automatically.
4. Apply `src/db/schema.sql` to your production database (skip if you reuse the
   same Neon DB as local).

### Custom domain

In the Vercel project → **Settings → Domains**, add your domain/subdomain.
Vercel shows the DNS record to create. For a subdomain, add a **CNAME** at your
DNS provider pointing to `cname.vercel-dns.com`. (On Cloudflare, set the record
to **DNS only / grey cloud** so Vercel can issue the TLS certificate.)

## How it works

- The dashboard and all API routes require an authenticated, allowlisted session;
  the cron refresh authorizes via the `CRON_SECRET` bearer token instead.
- **Adding** an existing ticker adds to its share count; the **Edit** button sets
  an absolute quantity. A manual price is tagged `manual` and is overwritten by
  the next auto-refresh (it is intentionally not "sticky").
- The pie chart shows only priced holdings, ordered by market value, highest → lowest.

## Project layout

```
src/lib/        portfolio math, price fetching, db queries, auth helpers (unit-tested)
src/app/        pages, API routes (holdings CRUD, price refresh), auth
src/components/ dashboard UI (table, pie, forms)
src/db/         schema.sql
scripts/        db:init and smoke-test helpers
```

## Helper scripts

- `npm run db:init` — create the tables from `src/db/schema.sql`
- `node scripts/smoke-test.mjs <baseURL>` — seed a holding and exercise the
  refresh endpoint against a running server
