import { describe, it, expect } from "vitest";
import { layoutLabels, polar, LABEL_GAP } from "@/lib/pieLabels";
import type { Slice } from "@/lib/portfolio";

const CX = 235;
const CY = 170;
const R = 100;
const H = 340;

const slices = (...values: number[]): Slice[] => values.map((value, i) => ({ ticker: `T${i}`, value }));

describe("polar", () => {
    it("puts 90deg at 12 o'clock and runs clockwise, like recharts", () => {
        const top = polar(0, 0, 10, 90);
        expect(top.x).toBeCloseTo(0);
        expect(top.y).toBeCloseTo(-10); // SVG y grows downward
        const right = polar(0, 0, 10, 0);
        expect(right.x).toBeCloseTo(10);
        expect(right.y).toBeCloseTo(0);
    });
});

describe("layoutLabels", () => {
    const ysOnSide = (m: Map<number, { x: number; y: number }>, right: boolean) =>
        [...m.values()].filter((p) => (p.x > CX) === right).map((p) => p.y).sort((a, b) => a - b);

    it("places every slice when they comfortably fit", () => {
        const out = layoutLabels(slices(30, 25, 20, 15, 10), CX, CY, R, H);
        expect(out.size).toBe(5);
    });

    it("never lets two labels on the same side overlap", () => {
        // 18 slices, many of them tiny -> lots of near-identical rim angles
        const out = layoutLabels(slices(20, 15, 12, 10, 8, 6, 5, 4, 4, 3, 3, 2, 2, 2, 1, 1, 1, 1), CX, CY, R, H);
        for (const right of [true, false]) {
            const ys = ysOnSide(out, right);
            for (let i = 1; i < ys.length; i++) {
                expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(LABEL_GAP - 1e-6);
            }
        }
    });

    it("keeps every label inside the plot height", () => {
        const out = layoutLabels(slices(...Array(24).fill(1)), CX, CY, R, H);
        for (const p of out.values()) {
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeLessThanOrEqual(H);
        }
    });

    it("drops the smallest slices, not arbitrary ones, when a column overflows", () => {
        // 40 equal-ish slices cannot all fit; the big one must survive.
        const data: Slice[] = [{ ticker: "BIG", value: 500 }, ...Array.from({ length: 40 }, (_, i) => ({ ticker: `s${i}`, value: 1 }))];
        const out = layoutLabels(data, CX, CY, R, H);
        expect(out.has(0)).toBe(true);
        expect(out.size).toBeLessThan(data.length);
    });

    it("anchors text away from the pie on each side", () => {
        const out = layoutLabels(slices(50, 50), CX, CY, R, H);
        for (const p of out.values()) {
            expect(p.anchor).toBe(p.x > CX ? "start" : "end");
            expect(Math.abs(p.x - CX)).toBeGreaterThan(R);
        }
    });

    it("returns nothing for an empty or zero-value pie", () => {
        expect(layoutLabels([], CX, CY, R, H).size).toBe(0);
        expect(layoutLabels(slices(0, 0), CX, CY, R, H).size).toBe(0);
    });
});
