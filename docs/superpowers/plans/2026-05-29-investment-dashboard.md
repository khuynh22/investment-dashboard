# Investment Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A private single-user web app at `investment.timhuynh.dev` to track owned stocks (ticker + quantity), show their market value and allocation as a pie chart sorted highest→lowest, with prices auto-refreshed twice daily plus manual refresh/override.

**Architecture:** Standalone Next.js (App Router, TypeScript) app on Vercel. Auth.js (NextAuth v5) Google OAuth locked to one email. Neon Postgres (`@vercel/postgres`) holds two tables (`holdings`, `prices`). Pure logic (portfolio math, price parsing, allowlist) is isolated in `src/lib/*` and unit-tested with Vitest; React UI is thin. Vercel Cron hits the refresh route twice daily.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · next-auth@beta (v5) · @vercel/postgres (Neon) · Recharts · Vitest.

---

## File Structure

```
my-portfolio-dashboard/
  package.json
  tsconfig.json
  next.config.ts
  vitest.config.ts
  vercel.json                     # twice-daily crons
  .gitignore
  .env.local.example
  src/
    auth.ts                       # NextAuth config (Google + allowlist)
    middleware.ts                 # protect page routes
    lib/
      auth-allowlist.ts           # isAllowed(email, allowed)
      portfolio.ts                # buildRows / totalValue / pieData (pure)
      prices.ts                   # parseYahoo / parseStooq / fetchPrice
      db.ts                       # Postgres queries
      session.ts                  # requireSession() helper for API routes
    db/
      schema.sql                  # table DDL (run once on Neon)
    app/
      layout.tsx
      page.tsx                    # dashboard (server component)
      signin/page.tsx             # sign-in screen
      api/
        auth/[...nextauth]/route.ts
        holdings/route.ts         # GET list, POST add/upsert
        holdings/[ticker]/route.ts# PATCH, DELETE
        prices/refresh/route.ts   # GET: session OR cron-secret
    components/
      SummaryBar.tsx
      HoldingsTable.tsx           # client: rows, edit/remove, inline price
      AddHoldingForm.tsx          # client
      AllocationPie.tsx           # client (Recharts)
      RefreshButton.tsx           # client
  tests/
    portfolio.test.ts
    prices.test.ts
    auth-allowlist.test.ts
```

---

### Task 1: Scaffold project + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`, `.env.local.example`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "investment-dashboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next-auth": "^5.0.0-beta.25",
    "@vercel/postgres": "^0.10.0",
    "recharts": "^2.13.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `next.config.ts`**

```ts
import type { NextConfig } from "next";
// Served on its own subdomain (investment.timhuynh.dev) → no basePath needed.
const nextConfig: NextConfig = {};
export default nextConfig;
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
  resolve: { alias: { "@": resolve(__dirname, "src") } },
});
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
.next/
.env.local
.env*.local
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 6: Create `.env.local.example`**

```
# Auth.js
AUTH_SECRET=            # generate with: npx auth secret
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ALLOWED_EMAIL=timhuynhwork@gmail.com

# Neon / Vercel Postgres
POSTGRES_URL=

# Cron authorization (set automatically by Vercel when configured)
CRON_SECRET=
```

- [ ] **Step 7: Install deps**

Run: `npm install`
Expected: dependencies install without errors; `node_modules/` created.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json next.config.ts vitest.config.ts .gitignore .env.local.example package-lock.json
git commit -m "chore: scaffold Next.js + Vitest tooling"
```

---

### Task 2: Portfolio logic (pure, TDD)

**Files:**
- Test: `tests/portfolio.test.ts`
- Create: `src/lib/portfolio.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/portfolio.test.ts
import { describe, it, expect } from "vitest";
import { buildRows, totalValue, pieData, type Holding, type PriceInfo } from "@/lib/portfolio";

const holdings: Holding[] = [
  { ticker: "AAPL", quantity: 10 },
  { ticker: "MSFT", quantity: 2 },
  { ticker: "TSLA", quantity: 5 },   // no price -> unpriced
];
const prices: PriceInfo[] = [
  { ticker: "AAPL", price: 100, source: "auto", updatedAt: "2026-05-29T00:00:00Z" },
  { ticker: "MSFT", price: 400, source: "manual", updatedAt: "2026-05-29T00:00:00Z" },
];

describe("buildRows", () => {
  it("computes market value and percent of priced total", () => {
    const rows = buildRows(holdings, prices);
    const aapl = rows.find(r => r.ticker === "AAPL")!;
    const msft = rows.find(r => r.ticker === "MSFT")!;
    const tsla = rows.find(r => r.ticker === "TSLA")!;
    expect(aapl.marketValue).toBe(1000);
    expect(msft.marketValue).toBe(800);
    expect(tsla.marketValue).toBeNull();
    // total priced = 1800 -> AAPL 55.55%, MSFT 44.44%
    expect(aapl.percent).toBeCloseTo(55.555, 2);
    expect(tsla.percent).toBeNull();
    expect(msft.source).toBe("manual");
  });
});

describe("totalValue", () => {
  it("sums only priced holdings", () => {
    expect(totalValue(buildRows(holdings, prices))).toBe(1800);
  });
});

describe("pieData", () => {
  it("returns only priced holdings sorted highest -> lowest", () => {
    const data = pieData(buildRows(holdings, prices));
    expect(data.map(d => d.ticker)).toEqual(["AAPL", "MSFT"]);
    expect(data.map(d => d.value)).toEqual([1000, 800]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- portfolio`
Expected: FAIL — cannot resolve `@/lib/portfolio`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/portfolio.ts
export type Source = "auto" | "manual";
export type Holding = { ticker: string; quantity: number };
export type PriceInfo = { ticker: string; price: number; source: Source; updatedAt: string };

export type Row = {
  ticker: string;
  quantity: number;
  price: number | null;
  source: Source | null;
  updatedAt: string | null;
  marketValue: number | null;
  percent: number | null;
};

export function buildRows(holdings: Holding[], prices: PriceInfo[]): Row[] {
  const priceMap = new Map(prices.map((p) => [p.ticker, p]));
  const rows: Row[] = holdings.map((h) => {
    const p = priceMap.get(h.ticker) ?? null;
    const marketValue = p ? p.price * h.quantity : null;
    return {
      ticker: h.ticker,
      quantity: h.quantity,
      price: p?.price ?? null,
      source: p?.source ?? null,
      updatedAt: p?.updatedAt ?? null,
      marketValue,
      percent: null,
    };
  });
  const total = rows.reduce((s, r) => s + (r.marketValue ?? 0), 0);
  for (const r of rows) {
    r.percent = r.marketValue != null && total > 0 ? (r.marketValue / total) * 100 : null;
  }
  return rows;
}

export function totalValue(rows: Row[]): number {
  return rows.reduce((s, r) => s + (r.marketValue ?? 0), 0);
}

/** Pie slices: only priced holdings, sorted highest -> lowest market value. */
export function pieData(rows: Row[]): { ticker: string; value: number }[] {
  return rows
    .filter((r): r is Row & { marketValue: number } => r.marketValue != null && r.marketValue > 0)
    .map((r) => ({ ticker: r.ticker, value: r.marketValue }))
    .sort((a, b) => b.value - a.value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- portfolio`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/portfolio.test.ts src/lib/portfolio.ts
git commit -m "feat: portfolio math with highest-to-lowest pie ordering"
```

---

### Task 3: Price fetching logic (TDD)

**Files:**
- Test: `tests/prices.test.ts`
- Create: `src/lib/prices.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/prices.test.ts
import { describe, it, expect, vi } from "vitest";
import { parseYahoo, parseStooq, fetchPrice } from "@/lib/prices";

describe("parseYahoo", () => {
  it("reads regularMarketPrice", () => {
    expect(parseYahoo({ chart: { result: [{ meta: { regularMarketPrice: 312.51 } }] } })).toBe(312.51);
  });
  it("returns null on missing data", () => {
    expect(parseYahoo({ chart: { result: [] } })).toBeNull();
    expect(parseYahoo({})).toBeNull();
  });
});

describe("parseStooq", () => {
  it("reads the Close column", () => {
    const csv = "Symbol,Date,Time,Open,High,Low,Close,Volume\nAAPL.US,2026-05-28,22:00:19,310.68,312.8,309.57,312.51,48220390";
    expect(parseStooq(csv)).toBe(312.51);
  });
  it("returns null on N/D rows", () => {
    const csv = "Symbol,Date,Time,Open,High,Low,Close,Volume\nXXXX.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D";
    expect(parseStooq(csv)).toBeNull();
  });
});

describe("fetchPrice", () => {
  it("returns Yahoo price when Yahoo succeeds", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: 100 } }] } }),
    });
    expect(await fetchPrice("AAPL", fakeFetch as unknown as typeof fetch)).toBe(100);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to Stooq when Yahoo fails", async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) }) // Yahoo
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "Symbol,Date,Time,Open,High,Low,Close,Volume\nAAPL.US,2026-05-28,22:00:19,310,312,309,312.51,1",
      }); // Stooq
    expect(await fetchPrice("AAPL", fakeFetch as unknown as typeof fetch)).toBe(312.51);
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });

  it("returns null when both fail", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}), text: async () => "" });
    expect(await fetchPrice("ZZZZ", fakeFetch as unknown as typeof fetch)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- prices`
Expected: FAIL — cannot resolve `@/lib/prices`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/prices.ts
export function parseYahoo(json: unknown): number | null {
  const price = (json as any)?.chart?.result?.[0]?.meta?.regularMarketPrice;
  return typeof price === "number" && Number.isFinite(price) ? price : null;
}

export function parseStooq(csv: string): number | null {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const close = parseFloat(lines[1].split(",")[6]); // Symbol,Date,Time,Open,High,Low,Close,Volume
  return Number.isFinite(close) && close > 0 ? close : null;
}

/** Fetch one ticker's price: Yahoo first, Stooq fallback. Returns null if both fail. */
export async function fetchPrice(ticker: string, fetchFn: typeof fetch = fetch): Promise<number | null> {
  const sym = ticker.trim().toUpperCase();
  try {
    const res = await fetchFn(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (res.ok) {
      const p = parseYahoo(await res.json());
      if (p != null) return p;
    }
  } catch {
    /* fall through to Stooq */
  }
  try {
    const res = await fetchFn(
      `https://stooq.com/q/l/?s=${encodeURIComponent(sym.toLowerCase())}.us&f=sd2t2ohlcv&h&e=csv`
    );
    if (res.ok) {
      const p = parseStooq(await res.text());
      if (p != null) return p;
    }
  } catch {
    /* both failed */
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- prices`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/prices.test.ts src/lib/prices.ts
git commit -m "feat: price fetch with Yahoo primary + Stooq fallback"
```

---

### Task 4: Auth allowlist + NextAuth + middleware

**Files:**
- Test: `tests/auth-allowlist.test.ts`
- Create: `src/lib/auth-allowlist.ts`, `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts`, `src/lib/session.ts`, `src/app/signin/page.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// tests/auth-allowlist.test.ts
import { describe, it, expect } from "vitest";
import { isAllowed } from "@/lib/auth-allowlist";

describe("isAllowed", () => {
  const allowed = "timhuynhwork@gmail.com";
  it("accepts the exact email case-insensitively", () => {
    expect(isAllowed("timhuynhwork@gmail.com", allowed)).toBe(true);
    expect(isAllowed("TimHuynhWork@Gmail.com", allowed)).toBe(true);
  });
  it("rejects other or missing emails", () => {
    expect(isAllowed("someoneelse@gmail.com", allowed)).toBe(false);
    expect(isAllowed(null, allowed)).toBe(false);
    expect(isAllowed("timhuynhwork@gmail.com", undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- auth-allowlist`
Expected: FAIL — cannot resolve `@/lib/auth-allowlist`.

- [ ] **Step 3: Implement the allowlist**

```ts
// src/lib/auth-allowlist.ts
export function isAllowed(email: string | null | undefined, allowed: string | undefined): boolean {
  if (!email || !allowed) return false;
  return email.trim().toLowerCase() === allowed.trim().toLowerCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- auth-allowlist`
Expected: PASS (2 tests).

- [ ] **Step 5: Create NextAuth config**

```ts
// src/auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowed } from "@/lib/auth-allowlist";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/signin" },
  callbacks: {
    // Only the allowlisted email may sign in.
    signIn({ profile }) {
      return isAllowed(profile?.email, process.env.ALLOWED_EMAIL);
    },
  },
});
```

- [ ] **Step 6: Create the NextAuth route handler**

```ts
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 7: Create the session helper**

```ts
// src/lib/session.ts
import { auth } from "@/auth";
import { isAllowed } from "@/lib/auth-allowlist";

/** True only for an authenticated, allowlisted user. */
export async function isAuthorizedUser(): Promise<boolean> {
  const session = await auth();
  return isAllowed(session?.user?.email, process.env.ALLOWED_EMAIL);
}
```

- [ ] **Step 8: Create middleware to protect pages**

```ts
// src/middleware.ts
import { auth } from "@/auth";

export default auth((req) => {
  // API routes self-authorize (incl. cron). Only guard pages here.
  if (!req.auth && !req.nextUrl.pathname.startsWith("/signin")) {
    const url = new URL("/signin", req.nextUrl.origin);
    return Response.redirect(url);
  }
});

// Run on everything except API, static assets, and the sign-in page.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|signin).*)"],
};
```

- [ ] **Step 9: Create the sign-in page**

```tsx
// src/app/signin/page.tsx
import { signIn } from "@/auth";

export default function SignIn() {
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", fontFamily: "system-ui" }}>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <h1 style={{ marginBottom: 16 }}>Investment Dashboard</h1>
        <button
          type="submit"
          style={{ padding: "10px 20px", fontSize: 16, borderRadius: 8, cursor: "pointer" }}
        >
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 10: Commit**

```bash
git add tests/auth-allowlist.test.ts src/lib/auth-allowlist.ts src/auth.ts src/lib/session.ts src/middleware.ts "src/app/api/auth/[...nextauth]/route.ts" src/app/signin/page.tsx
git commit -m "feat: Google OAuth locked to allowlisted email + route protection"
```

---

### Task 5: Database schema + query layer

**Files:**
- Create: `src/db/schema.sql`, `src/lib/db.ts`

- [ ] **Step 1: Create the schema**

```sql
-- src/db/schema.sql  (run once in the Neon SQL editor; see deployment notes)
CREATE TABLE IF NOT EXISTS holdings (
  ticker     text PRIMARY KEY,
  quantity   numeric NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prices (
  ticker     text PRIMARY KEY REFERENCES holdings(ticker) ON DELETE CASCADE,
  price      numeric NOT NULL,
  source     text NOT NULL CHECK (source IN ('auto','manual')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Create the query layer**

```ts
// src/lib/db.ts
import { sql } from "@vercel/postgres";
import type { Holding, PriceInfo, Source } from "@/lib/portfolio";

export async function getHoldings(): Promise<Holding[]> {
  const { rows } = await sql<{ ticker: string; quantity: number }>`
    SELECT ticker, quantity::float8 AS quantity FROM holdings ORDER BY ticker`;
  return rows;
}

export async function getPrices(): Promise<PriceInfo[]> {
  const { rows } = await sql<{ ticker: string; price: number; source: Source; updatedAt: string }>`
    SELECT ticker, price::float8 AS price, source, updated_at AS "updatedAt" FROM prices`;
  return rows;
}

export async function getHeldTickers(): Promise<string[]> {
  const { rows } = await sql<{ ticker: string }>`SELECT ticker FROM holdings`;
  return rows.map((r) => r.ticker);
}

export async function upsertHolding(ticker: string, quantity: number): Promise<void> {
  await sql`
    INSERT INTO holdings (ticker, quantity) VALUES (${ticker}, ${quantity})
    ON CONFLICT (ticker) DO UPDATE SET quantity = EXCLUDED.quantity`;
}

export async function deleteHolding(ticker: string): Promise<void> {
  await sql`DELETE FROM holdings WHERE ticker = ${ticker}`; // prices cascade
}

export async function upsertPrice(ticker: string, price: number, source: Source): Promise<void> {
  await sql`
    INSERT INTO prices (ticker, price, source, updated_at)
    VALUES (${ticker}, ${price}, ${source}, now())
    ON CONFLICT (ticker) DO UPDATE SET price = EXCLUDED.price, source = EXCLUDED.source, updated_at = now()`;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.sql src/lib/db.ts
git commit -m "feat: Postgres schema and query layer"
```

---

### Task 6: Holdings API routes

**Files:**
- Create: `src/app/api/holdings/route.ts`, `src/app/api/holdings/[ticker]/route.ts`

- [ ] **Step 1: Create the collection route (list + add)**

```ts
// src/app/api/holdings/route.ts
import { NextResponse } from "next/server";
import { isAuthorizedUser } from "@/lib/session";
import { getHoldings, getPrices, upsertHolding } from "@/lib/db";
import { buildRows } from "@/lib/portfolio";

export async function GET() {
  if (!(await isAuthorizedUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [holdings, prices] = await Promise.all([getHoldings(), getPrices()]);
  return NextResponse.json({ rows: buildRows(holdings, prices) });
}

export async function POST(req: Request) {
  if (!(await isAuthorizedUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const ticker = typeof body?.ticker === "string" ? body.ticker.trim().toUpperCase() : "";
  const quantity = Number(body?.quantity);
  if (!/^[A-Z.\-]{1,10}$/.test(ticker) || !Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "invalid ticker or quantity" }, { status: 400 });
  }
  await upsertHolding(ticker, quantity);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create the item route (patch + delete)**

```ts
// src/app/api/holdings/[ticker]/route.ts
import { NextResponse } from "next/server";
import { isAuthorizedUser } from "@/lib/session";
import { upsertHolding, deleteHolding, upsertPrice } from "@/lib/db";

export async function PATCH(req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  if (!(await isAuthorizedUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ticker: raw } = await ctx.params;
  const ticker = raw.trim().toUpperCase();
  const body = await req.json().catch(() => null);

  if (body?.quantity !== undefined) {
    const quantity = Number(body.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0)
      return NextResponse.json({ error: "invalid quantity" }, { status: 400 });
    await upsertHolding(ticker, quantity);
  }
  if (body?.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0)
      return NextResponse.json({ error: "invalid price" }, { status: 400 });
    await upsertPrice(ticker, price, "manual"); // manual override
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  if (!(await isAuthorizedUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ticker } = await ctx.params;
  await deleteHolding(ticker.trim().toUpperCase());
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/holdings
git commit -m "feat: holdings CRUD API (auth-gated, manual price override)"
```

---

### Task 7: Price refresh route (session OR cron secret)

**Files:**
- Create: `src/app/api/prices/refresh/route.ts`

- [ ] **Step 1: Create the refresh route**

```ts
// src/app/api/prices/refresh/route.ts
import { NextResponse } from "next/server";
import { isAuthorizedUser } from "@/lib/session";
import { getHeldTickers, upsertPrice } from "@/lib/db";
import { fetchPrice } from "@/lib/prices";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function refresh(req: Request) {
  // Vercel cron sends GET with the Authorization: Bearer <CRON_SECRET> header.
  if (!isCron(req) && !(await isAuthorizedUser())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tickers = await getHeldTickers();
  const results = await Promise.all(
    tickers.map(async (ticker) => {
      const price = await fetchPrice(ticker);
      if (price != null) await upsertPrice(ticker, price, "auto");
      return { ticker, price, ok: price != null };
    })
  );
  return NextResponse.json({ refreshed: results.filter((r) => r.ok).length, results });
}

export async function GET(req: Request) {
  return refresh(req);
}
export async function POST(req: Request) {
  return refresh(req);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/prices/refresh/route.ts
git commit -m "feat: price refresh route for manual button + cron"
```

---

### Task 8: Dashboard UI

**Files:**
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/SummaryBar.tsx`, `src/components/AllocationPie.tsx`, `src/components/HoldingsTable.tsx`, `src/components/AddHoldingForm.tsx`, `src/components/RefreshButton.tsx`

- [ ] **Step 1: Create the root layout**

```tsx
// src/app/layout.tsx
export const metadata = { title: "Investment Dashboard" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0b0e14", color: "#e6e6e6" }}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create the SummaryBar**

```tsx
// src/components/SummaryBar.tsx
export function SummaryBar({ total, asOf }: { total: number; asOf: string | null }) {
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  return (
    <div style={{ display: "flex", gap: 32, alignItems: "baseline", flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>Total value</div>
        <div style={{ fontSize: 32, fontWeight: 700 }}>{fmt.format(total)}</div>
      </div>
      <div style={{ fontSize: 13, opacity: 0.7 }}>
        {asOf ? `Prices as of ${new Date(asOf).toLocaleString()}` : "No prices yet"}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the AllocationPie (client, Recharts)**

```tsx
// src/components/AllocationPie.tsx
"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#4f8cff", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#f87171", "#22d3ee", "#facc15", "#fb923c", "#94a3b8"];

// data MUST arrive pre-sorted highest -> lowest (see portfolio.pieData).
export function AllocationPie({ data }: { data: { ticker: string; value: number }[] }) {
  if (data.length === 0) return <p style={{ opacity: 0.6 }}>Add a priced holding to see allocation.</p>;
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="ticker" cx="50%" cy="50%" outerRadius={120} label={(d) => d.ticker}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => fmt.format(v)} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Create the RefreshButton (client)**

```tsx
// src/components/RefreshButton.tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/prices/refresh", { method: "POST" });
        router.refresh();
        setBusy(false);
      }}
      style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}
    >
      {busy ? "Refreshing…" : "Refresh prices"}
    </button>
  );
}
```

- [ ] **Step 5: Create the AddHoldingForm (client)**

```tsx
// src/components/AddHoldingForm.tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddHoldingForm() {
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/holdings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticker, quantity }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({})))?.error ?? "Failed to add");
      return;
    }
    setTicker("");
    setQuantity("");
    router.refresh();
  }

  const inp = { padding: 8, borderRadius: 6, border: "1px solid #333", background: "#111", color: "#eee" };
  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input style={inp} placeholder="Ticker (e.g. AAPL)" value={ticker} onChange={(e) => setTicker(e.target.value)} />
      <input style={inp} placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" />
      <button type="submit" style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>Add holding</button>
      {error && <span style={{ color: "#f87171" }}>{error}</span>}
    </form>
  );
}
```

- [ ] **Step 6: Create the HoldingsTable (client, edit/remove + inline price)**

```tsx
// src/components/HoldingsTable.tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Row } from "@/lib/portfolio";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function HoldingsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const cell: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #222", textAlign: "right" };
  const left = { ...cell, textAlign: "left" as const };

  async function patch(ticker: string, payload: Record<string, unknown>) {
    await fetch(`/api/holdings/${ticker}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    router.refresh();
  }
  async function remove(ticker: string) {
    if (!confirm(`Remove ${ticker}?`)) return;
    await fetch(`/api/holdings/${ticker}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
      <thead>
        <tr style={{ opacity: 0.7, textAlign: "right" }}>
          <th style={left}>Ticker</th><th style={cell}>Qty</th><th style={cell}>Price</th>
          <th style={cell}>Source</th><th style={cell}>Value</th><th style={cell}>%</th><th style={cell}></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.ticker}>
            <td style={left}><b>{r.ticker}</b></td>
            <td
              style={cell}
              onDoubleClick={() => {
                const q = prompt(`New quantity for ${r.ticker}`, String(r.quantity));
                if (q) patch(r.ticker, { quantity: Number(q) });
              }}
              title="Double-click to edit"
            >{r.quantity}</td>
            <td
              style={cell}
              onDoubleClick={() => {
                const p = prompt(`Manual price for ${r.ticker}`, r.price != null ? String(r.price) : "");
                if (p) patch(r.ticker, { price: Number(p) });
              }}
              title="Double-click to set a manual price"
            >{r.price != null ? fmt.format(r.price) : "—"}</td>
            <td style={cell}>{r.source ?? "—"}</td>
            <td style={cell}>{r.marketValue != null ? fmt.format(r.marketValue) : "—"}</td>
            <td style={cell}>{r.percent != null ? `${r.percent.toFixed(1)}%` : "—"}</td>
            <td style={cell}>
              <button onClick={() => remove(r.ticker)} style={{ cursor: "pointer", background: "none", border: "none", color: "#f87171" }}>✕</button>
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={7} style={{ ...left, opacity: 0.6, padding: 16 }}>No holdings yet. Add one above.</td></tr>
        )}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 7: Create the dashboard page (server component)**

```tsx
// src/app/page.tsx
import { getHoldings, getPrices } from "@/lib/db";
import { buildRows, totalValue, pieData } from "@/lib/portfolio";
import { SummaryBar } from "@/components/SummaryBar";
import { AllocationPie } from "@/components/AllocationPie";
import { HoldingsTable } from "@/components/HoldingsTable";
import { AddHoldingForm } from "@/components/AddHoldingForm";
import { RefreshButton } from "@/components/RefreshButton";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [holdings, prices] = await Promise.all([getHoldings(), getPrices()]);
  const rows = buildRows(holdings, prices);
  const asOf = prices.reduce<string | null>((latest, p) => (!latest || p.updatedAt > latest ? p.updatedAt : latest), null);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24, display: "grid", gap: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Investment Dashboard</h1>
        <RefreshButton />
      </header>
      <SummaryBar total={totalValue(rows)} asOf={asOf} />
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        <div><h2 style={{ fontSize: 16 }}>Allocation</h2><AllocationPie data={pieData(rows)} /></div>
        <div><h2 style={{ fontSize: 16 }}>Add holding</h2><AddHoldingForm /></div>
      </section>
      <section><h2 style={{ fontSize: 16 }}>Holdings</h2><HoldingsTable rows={rows} /></section>
    </main>
  );
}
```

- [ ] **Step 8: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: type-check passes; `next build` completes (DB calls are not executed at build time because pages are `force-dynamic`).

- [ ] **Step 9: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/components
git commit -m "feat: dashboard UI — summary, sorted pie, holdings table, add/refresh"
```

---

### Task 9: Cron config + deployment docs

**Files:**
- Create: `vercel.json`, `README.md`

- [ ] **Step 1: Create `vercel.json` with two daily crons (Hobby tier)**

```json
{
  "crons": [
    { "path": "/api/prices/refresh", "schedule": "0 13 * * *" },
    { "path": "/api/prices/refresh", "schedule": "0 20 * * *" }
  ]
}
```

(13:00 / 20:00 UTC ≈ 9am / 4pm US Eastern. Vercel adds the `Authorization: Bearer $CRON_SECRET` header to these requests, which the refresh route checks.)

- [ ] **Step 2: Create `README.md` with setup/deploy steps**

````markdown
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
````

- [ ] **Step 3: Commit**

```bash
git add vercel.json README.md
git commit -m "chore: cron schedule and deployment docs"
```

---

## Verification Checklist (after all tasks)

- [ ] `npm test` → all unit tests pass (portfolio, prices, allowlist).
- [ ] `npx tsc --noEmit` → no type errors.
- [ ] `npm run build` → succeeds.
- [ ] Local: signing in with the allowed Google account reaches the dashboard; a different account is rejected.
- [ ] Add a holding (e.g. AAPL / 10) → appears in table; click **Refresh prices** → price + value populate.
- [ ] Pie chart slices are ordered highest → lowest market value.
- [ ] Double-click a price cell, set a manual value → row shows `manual`; running refresh overwrites it back to `auto`.
- [ ] Remove a holding → disappears from table and pie.
- [ ] `curl -H "Authorization: Bearer $CRON_SECRET" https://investment.timhuynh.dev/api/prices/refresh` → refreshes; without the header → 401.

---

## Notes / Design Decisions Carried From Spec

- **Pie ordering (headline requirement):** enforced in `portfolio.pieData` (`.sort((a,b) => b.value - a.value)`), unit-tested in Task 2.
- **Manual price is not sticky:** `upsertPrice(..., "manual")` on edit; the next auto refresh writes `"auto"` and overwrites it. A future `locked` flag would change this.
- **Single user:** no user tables; `signIn` callback + `isAuthorizedUser()` enforce the email allowlist everywhere.
- **Cron auth:** the refresh route accepts either an authorized session (button) or the `CRON_SECRET` bearer header (Vercel cron).
