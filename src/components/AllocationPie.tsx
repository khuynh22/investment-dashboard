"use client";
import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { groupSmallSlices, OTHER_TICKER, type Slice } from "@/lib/portfolio";
import { layoutLabels, PieCallout } from "@/lib/pieLabels";

// Eight entity hues, assigned in fixed order and never cycled past the list
// (a 9th holding would repeat a hue eight positions away, never adjacent).
const COLORS = ["#4f8cff", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#f87171", "#22d3ee", "#fb923c"];
// "Other" is a bucket, not a holding, so it gets a neutral outside the rotation.
const OTHER_COLOR = "#94a3b8";

const SURFACE = "#0b0e14";
const INK = "#e6e6e6";

/** Holdings below this share of the portfolio are folded into the Other bucket. */
const MIN_SLICE_PERCENT = 1;
const CHART_HEIGHT = 340;
const RADIUS = 100;

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// data MUST arrive pre-sorted highest -> lowest (see portfolio.pieData).
export function AllocationPie({ data }: { data: Slice[] }) {
    const [drilled, setDrilled] = useState(false);

    if (data.length === 0) return <p style={{ opacity: 0.6 }}>Add a priced holding to see allocation.</p>;

    const slices = groupSmallSlices(data, MIN_SLICE_PERCENT);
    const otherBreakdown = slices.find((s) => s.ticker === OTHER_TICKER)?.breakdown;
    // Falls back to the full pie if Other vanished (e.g. holdings changed while drilled in).
    const breakdown = drilled ? otherBreakdown : undefined;
    const view = breakdown ?? slices;
    const total = view.reduce((s, d) => s + d.value, 0);

    const colorOf = (s: Slice, i: number) => (s.ticker === OTHER_TICKER ? OTHER_COLOR : COLORS[i % COLORS.length]);

    // recharts calls the label renderer once per slice, but the layout is global
    // (labels get pushed apart), so solve it once for the width recharts settled on.
    let cached: { cx: number; at: ReturnType<typeof layoutLabels> } | null = null;
    const placements = (cx: number, cy: number) => {
        if (!cached || cached.cx !== cx) cached = { cx, at: layoutLabels(view, cx, cy, RADIUS, CHART_HEIGHT) };
        return cached.at;
    };

    return (
        <div>
            {/* Fixed-height control row keeps the chart from jumping when drilling in. */}
            <div style={{ minHeight: 28, display: "flex", alignItems: "center", fontSize: 13 }}>
                {breakdown ? (
                    <>
                        <button
                            type="button"
                            onClick={() => setDrilled(false)}
                            style={{ font: "inherit", background: "none", border: "none", color: "#4f8cff", cursor: "pointer", padding: 0 }}
                        >
                            ← Back to all
                        </button>
                        <span style={{ opacity: 0.7, marginLeft: 12 }}>
                            Inside Other · {fmt.format(total)} across {view.length} holdings
                        </span>
                    </>
                ) : otherBreakdown ? (
                    <span style={{ opacity: 0.6 }}>
                        Click the Other slice to break out its {otherBreakdown.length} holdings under {MIN_SLICE_PERCENT}%.
                    </span>
                ) : null}
            </div>

            <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <PieChart>
                    <Pie
                        data={view}
                        dataKey="value"
                        nameKey="ticker"
                        cx="50%"
                        cy="50%"
                        outerRadius={RADIUS}
                        startAngle={90}
                        endAngle={-270}
                        // Leader lines are drawn inside the label element so a line can never
                        // outlive the text it points at (recharts renders the two separately).
                        labelLine={false}
                        label={(p) => {
                            const at = placements(p.cx, p.cy).get(p.index);
                            if (!at) return null;
                            return <PieCallout at={at} label={view[p.index].ticker} color={colorOf(view[p.index], p.index)} />;
                        }}
                        onClick={(_, i) => {
                            if (view[i]?.ticker === OTHER_TICKER) setDrilled(true);
                        }}
                    >
                        {view.map((s, i) => (
                            <Cell
                                key={s.ticker}
                                fill={colorOf(s, i)}
                                stroke={SURFACE}
                                strokeWidth={2}
                                cursor={s.ticker === OTHER_TICKER ? "pointer" : "default"}
                            />
                        ))}
                    </Pie>
                    <Tooltip
                        formatter={(v: number) => `${fmt.format(v)} · ${((v / total) * 100).toFixed(1)}%`}
                        contentStyle={{ background: "#1b2230", border: "1px solid #39445a", borderRadius: 8, padding: "6px 10px" }}
                        itemStyle={{ color: INK }}
                        labelStyle={{ color: INK }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
