// End-to-end backend smoke test against the running dev server.
// Seeds a holding, triggers the cron-authorized refresh, then prints the DB state.
// Usage: node scripts/smoke-test.mjs http://localhost:3001
import { readFileSync } from "node:fs";
import { createPool } from "@vercel/postgres";

const base = process.argv[2] || "http://localhost:3001";

function env(key) {
  const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = txt.split(/\r?\n/).find((l) => l.startsWith(key + "="));
  return line.slice(key.length + 1).replace(/\s+#.*$/, "").trim();
}
function toPooled(url) {
  const u = new URL(url);
  if (!u.hostname.includes("-pooler")) u.hostname = u.hostname.replace(/^(ep-[^.]+)/, "$1-pooler");
  return u.toString();
}

const pool = createPool({ connectionString: toPooled(env("POSTGRES_URL")) });

// 1. Seed a holding (simulates "add AAPL, qty 10" without needing the browser session)
await pool.query(
  `INSERT INTO holdings (ticker, quantity) VALUES ('AAPL', 10)
   ON CONFLICT (ticker) DO UPDATE SET quantity = EXCLUDED.quantity`
);
console.log("Seeded holding: AAPL x10");

// 2. Trigger the refresh endpoint as the cron job would (Bearer CRON_SECRET)
const res = await fetch(`${base}/api/prices/refresh`, {
  headers: { authorization: `Bearer ${env("CRON_SECRET")}` },
});
console.log(`Refresh -> HTTP ${res.status}:`, JSON.stringify(await res.json()));

// 3. Read back the joined state the dashboard would render
const { rows } = await pool.query(
  `SELECT h.ticker, h.quantity::float8 AS quantity, p.price::float8 AS price, p.source,
          (h.quantity * p.price)::float8 AS market_value
   FROM holdings h LEFT JOIN prices p ON p.ticker = h.ticker ORDER BY market_value DESC NULLS LAST`
);
console.log("DB state:", JSON.stringify(rows, null, 2));
await pool.end();
