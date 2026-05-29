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
