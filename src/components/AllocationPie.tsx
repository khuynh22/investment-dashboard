"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#4f8cff", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#f87171", "#22d3ee", "#facc15", "#fb923c", "#94a3b8"];

// data MUST arrive pre-sorted highest -> lowest (see portfolio.pieData).
export function AllocationPie({ data }: { data: { ticker: string; value: number }[] }) {
    if (data.length === 0) return <p style={{ opacity: 0.6 }}>Add a priced holding to see allocation.</p>;
    const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    return (
        <ResponsiveContainer width="100%" height={320}>
            <PieChart>
                <Pie data={data} dataKey="value" nameKey="ticker" cx="50%" cy="50%" outerRadius={120} label={(d) => d.ticker}>
                    {data.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmt.format(v)} />
                <Legend />
            </PieChart>
        </ResponsiveContainer>
    );
}
