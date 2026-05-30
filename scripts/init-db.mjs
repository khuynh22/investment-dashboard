// One-time DB setup/verify: loads POSTGRES_URL from .env.local, applies
// src/db/schema.sql, and prints the resulting tables.
// Run: node scripts/init-db.mjs
import { readFileSync } from "node:fs";
import { createPool } from "@vercel/postgres";

function loadEnv(key) {
  const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = txt.split(/\r?\n/).find((l) => l.startsWith(key + "="));
  if (!line) throw new Error(`${key} not found in .env.local`);
  // strip key=, trailing inline comments, and surrounding whitespace
  return line.slice(key.length + 1).replace(/\s+#.*$/, "").trim();
}

// @vercel/postgres needs the POOLED endpoint (host contains "-pooler").
function toPooled(url) {
  const u = new URL(url);
  if (!u.hostname.includes("-pooler")) {
    u.hostname = u.hostname.replace(/^(ep-[^.]+)/, "$1-pooler");
  }
  return u.toString();
}

const raw = loadEnv("POSTGRES_URL");
const pooled = toPooled(raw);
if (pooled !== raw) {
  console.log("Note: rewrote direct connection -> pooled endpoint for @vercel/postgres.");
  console.log("Pooled URL host:", new URL(pooled).hostname);
}

const pool = createPool({ connectionString: pooled });
const schema = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf8");

await pool.query(schema);
const { rows } = await pool.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
);
console.log("Tables now present:", rows.map((r) => r.table_name).join(", ") || "(none)");
await pool.end();
console.log("DB ready. POOLED_URL (use this in .env.local if it differs):");
console.log(pooled);
