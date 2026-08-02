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

export type Slice = { ticker: string; value: number };
/** A pie slice; `breakdown` is present only on the aggregated "Other" bucket. */
export type PieSlice = Slice & { breakdown?: Slice[] };

export const OTHER_TICKER = "Other";

/** Pie slices: only priced holdings, sorted highest -> lowest market value. */
export function pieData(rows: Row[]): Slice[] {
  return rows
    .filter((r): r is Row & { marketValue: number } => r.marketValue != null && r.marketValue > 0)
    .map((r) => ({ ticker: r.ticker, value: r.marketValue }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Folds slices worth less than `minPercent` of the total into a single "Other"
 * bucket, appended last, which carries its members in `breakdown` for drill-down.
 * A lone small slice is left as-is — renaming one holding to "Other" hides it for
 * no gain in readability.
 */
export function groupSmallSlices(data: Slice[], minPercent = 1): PieSlice[] {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return data.map((d) => ({ ...d }));

  const large: PieSlice[] = [];
  const small: Slice[] = [];
  for (const d of data) {
    ((d.value / total) * 100 < minPercent ? small : large).push({ ...d });
  }
  if (small.length < 2) return data.map((d) => ({ ...d }));

  return [
    ...large,
    {
      ticker: OTHER_TICKER,
      value: small.reduce((s, d) => s + d.value, 0),
      breakdown: small,
    },
  ];
}
