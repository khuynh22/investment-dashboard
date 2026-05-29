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
