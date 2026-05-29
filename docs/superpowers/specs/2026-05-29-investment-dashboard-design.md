# Investment Dashboard — Design Spec

**Date:** 2026-05-29
**Owner:** Tim Huynh (timhuynhwork@gmail.com)
**Status:** Approved design → ready for implementation plan

## Purpose

A private, single-user dashboard to track owned stocks (ticker + quantity),
see their current market value, and view allocation as a pie chart. Prices
auto-refresh twice daily, with an on-demand manual refresh and manual price
override. Holdings are managed entirely through the in-app UI.

## Hosting & Access

- **Deployment:** Standalone Next.js (App Router) app on **Vercel**, served at
  **`investment.timhuynh.dev`** (subdomain — no changes to the main
  `timhuynh.dev` repo; DNS CNAME + Vercel custom domain).
- **Auth:** Auth.js (NextAuth v5) with the **Google** provider. The `signIn`
  callback allows **only `timhuynhwork@gmail.com`**; every other account is
  rejected. All pages and API routes require an authenticated session.
- **Vercel plan:** Hobby (free).

## Tech Stack

- Next.js (App Router, TypeScript)
- Auth.js (NextAuth) — Google OAuth
- Neon Postgres (Vercel Postgres integration) via `@vercel/postgres` or
  `drizzle-orm` (lightweight; final choice noted in plan)
- Recharts for the pie chart
- Vercel Cron for scheduled price refresh

## Data Model

Single user, locked by email → **no user/tenant tables.**

```
holdings(
  ticker      text  PRIMARY KEY,      -- e.g. "AAPL", uppercased
  quantity    numeric NOT NULL,       -- fractional shares allowed
  created_at  timestamptz DEFAULT now()
)

prices(
  ticker      text  PRIMARY KEY,      -- references the holding
  price       numeric NOT NULL,       -- last known price per share (USD)
  source      text  NOT NULL,         -- 'auto' | 'manual'
  updated_at  timestamptz DEFAULT now()
)
```

Market value of a holding = `price * quantity`. Computed in the app layer, not
stored, so it is always consistent with the latest price/quantity.

## Price Semantics (explicit decision)

- Prices refresh **twice daily** (cron) and on the **Refresh** button.
- A **manual price edit** writes the latest value with `source = 'manual'`.
- **The next scheduled/auto fetch overwrites manual edits** (manual is NOT
  sticky). This keeps behavior predictable. (Future option: a `locked` flag to
  make a manual price persist — out of scope for v1.)

## Price Data Source

Server-side fetch (no CORS concerns; reliability is the only concern):

1. **Primary — Yahoo Finance** (unofficial, no API key):
   `https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}?interval=1d&range=1d`
   → read `chart.result[0].meta.regularMarketPrice`.
   Verified working 2026-05-29 (AAPL → 312.51).
2. **Fallback — Stooq** (no API key):
   `https://stooq.com/q/l/?s={ticker}.us&f=sd2t2ohlcv&h&e=csv`
   → read the `Close` column. Verified working 2026-05-29 (AAPL → 312.51).

Each ticker tries Yahoo first; on error/empty, falls back to Stooq. Per-ticker
failures are recorded and surfaced in the UI without failing the whole refresh.

## UI / Components

Single dashboard page (`/`, behind auth):

1. **Summary bar** — total portfolio value (sum of market values) and the
   most recent `updated_at` across prices ("Prices as of …").
2. **Holdings table** — one row per holding showing ticker, quantity, current
   price, source badge (auto/manual), market value, and % of portfolio.
   - **Add holding** — form (ticker + quantity); upserts.
   - **Edit** — change quantity, or edit price inline (sets `source='manual'`).
   - **Remove** — delete a holding (and its price row).
3. **Pie chart** — slices = **market value (price × quantity), sorted from
   highest to lowest**, recomputed on every data/price change. **This ordering
   is the headline requirement.** Legend shows ticker + % allocation.
4. **Refresh button** — triggers `/api/prices/refresh` immediately, shows a
   loading state, then re-renders with updated prices + timestamp.

## API Routes (all auth-gated)

- `GET  /api/holdings` — list holdings joined with latest prices.
- `POST /api/holdings` — add/upsert a holding (`{ ticker, quantity }`).
- `PATCH /api/holdings/{ticker}` — update quantity and/or price (price update
  sets `source='manual'`).
- `DELETE /api/holdings/{ticker}` — remove holding + price.
- `POST /api/prices/refresh` — fetch all held tickers (Yahoo→Stooq), upsert
  `prices` with `source='auto'`, return per-ticker results. Used by the Refresh
  button and by cron. Cron calls are authorized via a `CRON_SECRET` header
  (Vercel-injected), since they have no user session.

## Scheduling (Hobby plan)

Vercel Hobby allows daily-granularity cron and up to 2 jobs. Use **two daily
crons** in `vercel.json` to achieve twice-daily, both hitting
`/api/prices/refresh`:

```json
{ "crons": [
  { "path": "/api/prices/refresh", "schedule": "0 13 * * *" },
  { "path": "/api/prices/refresh", "schedule": "0 20 * * *" }
] }
```

(13:00 / 20:00 UTC ≈ 9am / 4pm ET — adjust as desired. Cron requests carry the
`CRON_SECRET` so the route authorizes them without a user session.)

## Error Handling

- Price fetch: per-ticker try/catch; failures logged and returned per-ticker so
  the UI can flag stale/failed symbols. A holding with no price yet shows
  "—" and is excluded from the pie chart until priced.
- Auth: non-allowlisted accounts are denied at `signIn`; unauthenticated API
  calls return 401.
- Invalid input (bad ticker/quantity): validated server-side, 400 with message.

## Testing

- **Unit:** market-value + pie-sort logic (highest→lowest), price-parsing for
  Yahoo and Stooq responses, allowlist check.
- **Integration:** holdings CRUD against a test DB; refresh route with mocked
  fetch (Yahoo success, Yahoo-fail→Stooq fallback, both fail).
- **Manual:** OAuth login (allowed vs denied email), add/edit/remove flow,
  manual price override, Refresh button, cron route with secret.

## Out of Scope (v1)

- Multiple users / sharing.
- Historical performance charts, cost basis, gains/losses.
- Non-US exchanges / currencies beyond USD.
- Sticky manual price overrides (documented as a future flag).

## Environment Variables

- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- `ALLOWED_EMAIL=timhuynhwork@gmail.com`
- `POSTGRES_URL` (from Vercel Postgres/Neon)
- `CRON_SECRET` (Vercel-managed, used to authorize cron-triggered refresh)
