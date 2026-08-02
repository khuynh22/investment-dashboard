"use client";
import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { groupSmallSlices, OTHER_TICKER, type Slice } from "@/lib/portfolio";

// Eight entity hues, assigned in fixed order and never cycled past the list
// (a 9th holding would repeat a hue eight positions away, never adjacent).
const COLORS = ["#4f8cff", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#f87171", "#22d3ee", "#fb923c"];
// "Other" is a bucket, not a holding, so it gets a neutral outside the rotation.
const OTHER_COLOR = "#94a3b8";

/** Holdings below this share of the portfolio are folded into the Other bucket. */
const MIN_SLICE_PERCENT = 1;
/** Slices below this share stay unlabelled — their text would collide on the rim. */
const MIN_LABEL_FRACTION = 0.03;

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

            <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                    <Pie
                        data={view}
                        dataKey="value"
                        nameKey="ticker"
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        // Direct-label the readable slices; Other is always labelled since it is the click target.
                        label={(d) => (d.percent >= MIN_LABEL_FRACTION || d.ticker === OTHER_TICKER ? d.ticker : "")}
                        onClick={(_, i) => {
                            if (view[i]?.ticker === OTHER_TICKER) setDrilled(true);
                        }}
                    >
                        {view.map((s, i) => (
                            <Cell
                                key={s.ticker}
                                fill={s.ticker === OTHER_TICKER ? OTHER_COLOR : COLORS[i % COLORS.length]}
                                stroke="#0b0e14"
                                strokeWidth={2}
                                cursor={s.ticker === OTHER_TICKER ? "pointer" : "default"}
                            />
                        ))}
                    </Pie>
                    <Tooltip
                        formatter={(v: number) => `${fmt.format(v)} · ${((v / total) * 100).toFixed(1)}%`}
                        contentStyle={{ background: "#0b0e14", border: "1px solid #2a3140", borderRadius: 6 }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
