"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Row } from "@/lib/portfolio";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function HoldingsTable({ rows }: { rows: Row[] }) {
    const router = useRouter();
    // Which ticker is being edited, plus the draft values for its inputs.
    const [editing, setEditing] = useState<string | null>(null);
    const [qtyDraft, setQtyDraft] = useState("");
    const [priceDraft, setPriceDraft] = useState("");
    const [busy, setBusy] = useState(false);

    const cell: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #222", textAlign: "right" };
    const left = { ...cell, textAlign: "left" as const };
    const inp: React.CSSProperties = {
        width: 80, padding: 4, borderRadius: 4, border: "1px solid #333",
        background: "#111", color: "#eee", textAlign: "right",
    };
    const btn: React.CSSProperties = { cursor: "pointer", background: "none", border: "1px solid #333", borderRadius: 6, color: "#ddd", padding: "4px 10px", marginLeft: 4 };

    function startEdit(r: Row) {
        setEditing(r.ticker);
        setQtyDraft(String(r.quantity));
        setPriceDraft(r.price != null ? String(r.price) : "");
    }
    function cancelEdit() {
        setEditing(null);
    }

    async function patch(ticker: string, payload: Record<string, unknown>) {
        await fetch(`/api/holdings/${ticker}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
        });
        router.refresh();
    }

    // Save only the fields that actually changed, so an unchanged price isn't
    // needlessly flipped to a manual override.
    async function saveEdit(r: Row) {
        const payload: Record<string, unknown> = {};
        const q = Number(qtyDraft);
        if (qtyDraft.trim() !== "" && Number.isFinite(q) && q > 0 && q !== r.quantity) payload.quantity = q;
        const p = Number(priceDraft);
        if (priceDraft.trim() !== "" && Number.isFinite(p) && p > 0 && p !== r.price) payload.price = p;

        setBusy(true);
        if (Object.keys(payload).length > 0) await patch(r.ticker, payload);
        setBusy(false);
        setEditing(null);
    }

    async function remove(ticker: string) {
        if (!confirm(`Remove ${ticker}?`)) return;
        await fetch(`/api/holdings/${ticker}`, { method: "DELETE" });
        router.refresh();
    }

    return (
        <div className="table-wrap">
            <table className="holdings-table">
                <thead>
                    <tr style={{ opacity: 0.7, textAlign: "right" }}>
                        <th style={left}>Ticker</th><th style={cell}>Qty</th><th style={cell}>Price</th>
                        <th style={cell}>Source</th><th style={cell}>Value</th><th style={cell}>%</th><th style={cell}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => {
                        const isEditing = editing === r.ticker;
                        return (
                            <tr key={r.ticker}>
                                <td style={left}><b>{r.ticker}</b></td>
                                <td style={cell}>
                                    {isEditing ? (
                                        <input
                                            style={inp}
                                            value={qtyDraft}
                                            onChange={(e) => setQtyDraft(e.target.value)}
                                            inputMode="decimal"
                                            autoFocus
                                            aria-label={`Quantity for ${r.ticker}`}
                                        />
                                    ) : (
                                        r.quantity
                                    )}
                                </td>
                                <td style={cell}>
                                    {isEditing ? (
                                        <input
                                            style={inp}
                                            value={priceDraft}
                                            onChange={(e) => setPriceDraft(e.target.value)}
                                            inputMode="decimal"
                                            placeholder="auto"
                                            aria-label={`Manual price for ${r.ticker}`}
                                        />
                                    ) : r.price != null ? (
                                        fmt.format(r.price)
                                    ) : (
                                        "—"
                                    )}
                                </td>
                                <td style={cell}>{r.source ?? "—"}</td>
                                <td style={cell}>{r.marketValue != null ? fmt.format(r.marketValue) : "—"}</td>
                                <td style={cell}>{r.percent != null ? `${r.percent.toFixed(1)}%` : "—"}</td>
                                <td style={cell}>
                                    {isEditing ? (
                                        <>
                                            <button style={{ ...btn, color: "#34d399" }} onClick={() => saveEdit(r)} disabled={busy}>
                                                {busy ? "Saving…" : "Save"}
                                            </button>
                                            <button style={btn} onClick={cancelEdit} disabled={busy}>Cancel</button>
                                        </>
                                    ) : (
                                        <>
                                            <button style={btn} onClick={() => startEdit(r)}>Edit</button>
                                            <button
                                                style={{ ...btn, color: "#f87171" }}
                                                onClick={() => remove(r.ticker)}
                                                aria-label={`Remove ${r.ticker}`}
                                            >
                                                ✕
                                            </button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                    {rows.length === 0 && (
                        <tr><td colSpan={7} style={{ ...left, opacity: 0.6, padding: 16 }}>No holdings yet. Add one above.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
