import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PieChart, Pie, Cell } from "recharts";
import { layoutLabels, PieCallout } from "@/lib/pieLabels";
import type { Slice } from "@/lib/portfolio";

const W = 470;
const H = 340;
const R = 100;

/** Renders the same Pie configuration AllocationPie uses, at a fixed size. */
function renderPie(view: Slice[]) {
    let at: ReturnType<typeof layoutLabels> | null = null;
    return renderToStaticMarkup(
        <PieChart width={W} height={H}>
            <Pie
                data={view}
                dataKey="value"
                nameKey="ticker"
                cx="50%"
                cy="50%"
                outerRadius={R}
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
                labelLine={false}
                label={(p: { cx: number; cy: number; index: number }) => {
                    at ??= layoutLabels(view, p.cx, p.cy, R, H);
                    const place = at.get(p.index);
                    return place ? <PieCallout at={place} label={view[p.index].ticker} color="#4f8cff" /> : null;
                }}
            >
                {view.map((s) => (
                    <Cell key={s.ticker} fill="#4f8cff" />
                ))}
            </Pie>
        </PieChart>,
    );
}

const texts = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).filter(Boolean);
const leaders = (svg: string) => [...svg.matchAll(/<polyline[^>]*points="([^"]+)"/g)].map((m) => m[1]);

describe("pie callouts (rendered through recharts)", () => {
    const portfolio: Slice[] = [
        { ticker: "MSFT", value: 4647 },
        { ticker: "GOOG", value: 4100 },
        { ticker: "AAPL", value: 2600 },
        { ticker: "Other", value: 1500 },
        { ticker: "JPM", value: 1400 },
        { ticker: "NOW", value: 1100 },
        { ticker: "WMT", value: 600 },
        { ticker: "GLDM", value: 500 },
        { ticker: "META", value: 400 },
    ];

    it("draws a label for every slice, none dropped", () => {
        const svg = renderPie(portfolio);
        expect(texts(svg).sort()).toEqual(portfolio.map((s) => s.ticker).sort());
    });

    it("never leaves a leader line without its text", () => {
        const svg = renderPie(portfolio);
        expect(leaders(svg)).toHaveLength(texts(svg).length);
    });

    it("ends every leader line where its label sits", () => {
        const svg = renderPie(portfolio);
        // Each <g> holds one polyline + one text; their end y must agree.
        for (const g of svg.matchAll(/<g class="recharts-pie-callout">.*?<\/g>/gs)) {
            const endY = Number(g[0].match(/points="[^"]*\s[-\d.]+,([-\d.]+)"/)![1]);
            const textY = Number(g[0].match(/<text[^>]*\by="([-\d.]+)"/)![1]);
            expect(textY).toBeCloseTo(endY, 5);
        }
    });

    it("keeps labels inside the chart box", () => {
        const svg = renderPie(portfolio);
        for (const m of svg.matchAll(/<text[^>]*\bx="([-\d.]+)"[^>]*\by="([-\d.]+)"/g)) {
            expect(Number(m[1])).toBeGreaterThan(0);
            expect(Number(m[1])).toBeLessThan(W);
            expect(Number(m[2])).toBeGreaterThan(0);
            expect(Number(m[2])).toBeLessThan(H);
        }
    });
});
