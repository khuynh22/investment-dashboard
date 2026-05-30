import { describe, it, expect, vi } from "vitest";
import { parseYahoo, parseStooq, fetchPrice } from "@/lib/prices";

describe("parseYahoo", () => {
    it("reads regularMarketPrice", () => {
        expect(
            parseYahoo({
                chart: { result: [{ meta: { regularMarketPrice: 312.51 } }] },
            }),
        ).toBe(312.51);
    });
    it("returns null on missing data", () => {
        expect(parseYahoo({ chart: { result: [] } })).toBeNull();
        expect(parseYahoo({})).toBeNull();
    });
});

describe("parseStooq", () => {
    it("reads the Close column", () => {
        const csv =
            "Symbol,Date,Time,Open,High,Low,Close,Volume\nAAPL.US,2026-05-28,22:00:19,310.68,312.8,309.57,312.51,48220390";
        expect(parseStooq(csv)).toBe(312.51);
    });
    it("returns null on N/D rows", () => {
        const csv =
            "Symbol,Date,Time,Open,High,Low,Close,Volume\nXXXX.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D";
        expect(parseStooq(csv)).toBeNull();
    });
});

describe("fetchPrice", () => {
    it("returns Yahoo price when Yahoo succeeds", async () => {
        const fakeFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                chart: { result: [{ meta: { regularMarketPrice: 100 } }] },
            }),
        });
        expect(
            await fetchPrice("AAPL", fakeFetch as unknown as typeof fetch),
        ).toBe(100);
        expect(fakeFetch).toHaveBeenCalledTimes(1);
    });

    it("falls back to Stooq when Yahoo fails", async () => {
        const fakeFetch = vi
            .fn()
            .mockResolvedValueOnce({ ok: false, json: async () => ({}) }) // Yahoo
            .mockResolvedValueOnce({
                ok: true,
                text: async () =>
                    "Symbol,Date,Time,Open,High,Low,Close,Volume\nAAPL.US,2026-05-28,22:00:19,310,312,309,312.51,1",
            }); // Stooq
        expect(
            await fetchPrice("AAPL", fakeFetch as unknown as typeof fetch),
        ).toBe(312.51);
        expect(fakeFetch).toHaveBeenCalledTimes(2);
    });

    it("returns null when both fail", async () => {
        const fakeFetch = vi
            .fn()
            .mockResolvedValue({
                ok: false,
                json: async () => ({}),
                text: async () => "",
            });
        expect(
            await fetchPrice("ZZZZ", fakeFetch as unknown as typeof fetch),
        ).toBeNull();
    });
});
