"use client";
import { useRouter } from "next/navigation";
import type { Row } from "@/lib/portfolio";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function HoldingsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const cell: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #222", textAlign: "right" };
  const left = { ...cell, textAlign: "left" as const };

  async function patch(ticker: string, payload: Record<string, unknown>) {
    await fetch(`/api/holdings/${ticker}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    router.refresh();
  }
  async function remove(ticker: string) {
    if (!confirm(`Remove ${ticker}?`)) return;
    await fetch(`/api/holdings/${ticker}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
      <thead>
        <tr style={{ opacity: 0.7, textAlign: "right" }}>
          <th style={left}>Ticker</th><th style={cell}>Qty</th><th style={cell}>Price</th>
          <th style={cell}>Source</th><th style={cell}>Value</th><th style={cell}>%</th><th style={cell}></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.ticker}>
            <td style={left}><b>{r.ticker}</b></td>
            <td
              style={cell}
              onDoubleClick={() => {
                const q = prompt(`New quantity for ${r.ticker}`, String(r.quantity));
                if (q) patch(r.ticker, { quantity: Number(q) });
              }}
              title="Double-click to edit"
            >{r.quantity}</td>
            <td
              style={cell}
              onDoubleClick={() => {
                const p = prompt(`Manual price for ${r.ticker}`, r.price != null ? String(r.price) : "");
                if (p) patch(r.ticker, { price: Number(p) });
              }}
              title="Double-click to set a manual price"
            >{r.price != null ? fmt.format(r.price) : "—"}</td>
            <td style={cell}>{r.source ?? "—"}</td>
            <td style={cell}>{r.marketValue != null ? fmt.format(r.marketValue) : "—"}</td>
            <td style={cell}>{r.percent != null ? `${r.percent.toFixed(1)}%` : "—"}</td>
            <td style={cell}>
              <button onClick={() => remove(r.ticker)} style={{ cursor: "pointer", background: "none", border: "none", color: "#f87171" }}>✕</button>
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={7} style={{ ...left, opacity: 0.6, padding: 16 }}>No holdings yet. Add one above.</td></tr>
        )}
      </tbody>
    </table>
  );
}
