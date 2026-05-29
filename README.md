# Investment Dashboard

Private single-user dashboard for tracking owned stocks. Deployed at `investment.timhuynh.dev`.

## Local development
1. `npm install`
2. Copy `.env.local.example` to `.env.local` and fill values:
   - `AUTH_SECRET` — run `npx auth secret`
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — from Google Cloud Console
   - `ALLOWED_EMAIL=timhuynhwork@gmail.com`
   - `POSTGRES_URL` — from Neon
3. Apply schema: paste `src/db/schema.sql` into the Neon SQL editor and run it.
4. `npm run dev` → http://localhost:3000
5. `npm test` runs the unit tests.

## Google OAuth setup
In Google Cloud Console → Credentials → OAuth 2.0 Client (Web):
- Authorized redirect URIs:
  - `http://localhost:3000/api/auth/callback/google`
  - `https://investment.timhuynh.dev/api/auth/callback/google`

## Deploy (Vercel)
1. Create a Vercel project from this repo.
2. Add the Neon/Vercel Postgres integration (sets `POSTGRES_URL`).
3. Add env vars: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAIL`, `CRON_SECRET` (any long random string).
4. Add custom domain `investment.timhuynh.dev` (CNAME to Vercel) in the project's Domains settings.
5. Run `src/db/schema.sql` against the production Neon database once.
6. Deploy. `vercel.json` registers the two daily price-refresh crons automatically.

## How it works
- Prices auto-refresh twice daily (cron) and via the **Refresh prices** button.
- Double-click a quantity or price cell in the table to edit; a manual price is tagged `manual` but is overwritten by the next auto-refresh.
- The pie chart shows priced holdings ordered by market value, highest → lowest.
