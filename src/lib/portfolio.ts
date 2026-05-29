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
