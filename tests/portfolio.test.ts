import { describe, it, expect } from "vitest";
import {
    buildRows,
    totalValue,
    pieData,
    groupSmallSlices,
    type Holding,
    type PriceInfo,
} from "@/lib/portfolio";

const holdings: Holding[] = [
    { ticker: "AAPL", quantity: 10 },
    { ticker: "MSFT", quantity: 2 },
    { ticker: "TSLA", quantity: 5 }, // no price -> unpriced
];
const prices: PriceInfo[] = [
    {
        ticker: "AAPL",
        price: 100,
        source: "auto",
        updatedAt: "2026-05-29T00:00:00Z",
    },
    {
        ticker: "MSFT",
        price: 400,
        source: "manual",
        updatedAt: "2026-05-29T00:00:00Z",
    },
];

describe("buildRows", () => {
    it("computes market value and percent of priced total", () => {
        const rows = buildRows(holdings, prices);
        const aapl = rows.find((r) => r.ticker === "AAPL")!;
        const msft = rows.find((r) => r.ticker === "MSFT")!;
        const tsla = rows.find((r) => r.ticker === "TSLA")!;
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
        expect(data.map((d) => d.ticker)).toEqual(["AAPL", "MSFT"]);
        expect(data.map((d) => d.value)).toEqual([1000, 800]);
    });
});

describe("groupSmallSlices", () => {
    // total 1000 -> TSLA 0.6%, NVDA 0.4%, both under the 1% threshold
    const tail = [
        { ticker: "AAPL", value: 950 },
        { ticker: "MSFT", value: 40 },
        { ticker: "TSLA", value: 6 },
        { ticker: "NVDA", value: 4 },
    ];

    it("folds sub-threshold slices into one Other bucket, kept last", () => {
        const out = groupSmallSlices(tail);
        expect(out.map((s) => s.ticker)).toEqual(["AAPL", "MSFT", "Other"]);
        expect(out[2].value).toBe(10);
    });

    it("carries the folded members as a breakdown for drill-down", () => {
        const other = groupSmallSlices(tail)[2];
        expect(other.breakdown).toEqual([
            { ticker: "TSLA", value: 6 },
            { ticker: "NVDA", value: 4 },
        ]);
    });

    it("leaves a lone small slice alone rather than renaming it to Other", () => {
        const out = groupSmallSlices([
            { ticker: "AAPL", value: 995 },
            { ticker: "TSLA", value: 5 },
        ]);
        expect(out.map((s) => s.ticker)).toEqual(["AAPL", "TSLA"]);
        expect(out.every((s) => s.breakdown === undefined)).toBe(true);
    });

    it("respects a custom threshold", () => {
        const out = groupSmallSlices(tail, 5); // MSFT is 4% -> now folded too
        expect(out.map((s) => s.ticker)).toEqual(["AAPL", "Other"]);
        expect(out[1].value).toBe(50);
    });

    it("handles an empty portfolio", () => {
        expect(groupSmallSlices([])).toEqual([]);
    });
});
