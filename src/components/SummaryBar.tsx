export function SummaryBar({ total, asOf }: { total: number; asOf: string | null }) {
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  return (
    <div style={{ display: "flex", gap: 32, alignItems: "baseline", flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>Total value</div>
        <div style={{ fontSize: 32, fontWeight: 700 }}>{fmt.format(total)}</div>
      </div>
      <div style={{ fontSize: 13, opacity: 0.7 }}>
        {asOf ? `Prices as of ${new Date(asOf).toLocaleString()}` : "No prices yet"}
      </div>
    </div>
  );
}
