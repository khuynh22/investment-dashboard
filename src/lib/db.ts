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

export async function holdingExists(ticker: string): Promise<boolean> {
  const { rows } = await sql<{ ticker: string }>`SELECT ticker FROM holdings WHERE ticker = ${ticker}`;
  return rows.length > 0;
}

// Set a holding's quantity to an absolute value (used by inline edit).
export async function upsertHolding(ticker: string, quantity: number): Promise<void> {
  await sql`
    INSERT INTO holdings (ticker, quantity) VALUES (${ticker}, ${quantity})
    ON CONFLICT (ticker) DO UPDATE SET quantity = EXCLUDED.quantity`;
}

// Add shares to a holding, creating it if absent (used by the "Add holding" form).
export async function addToHolding(ticker: string, quantity: number): Promise<void> {
  await sql`
    INSERT INTO holdings (ticker, quantity) VALUES (${ticker}, ${quantity})
    ON CONFLICT (ticker) DO UPDATE SET quantity = holdings.quantity + EXCLUDED.quantity`;
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
