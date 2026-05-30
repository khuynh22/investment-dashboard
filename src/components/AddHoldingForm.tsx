"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddHoldingForm() {
    const router = useRouter();
    const [ticker, setTicker] = useState("");
    const [quantity, setQuantity] = useState("");
    const [error, setError] = useState<string | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        const res = await fetch("/api/holdings", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ticker, quantity }),
        });
        if (!res.ok) {
            setError((await res.json().catch(() => ({})))?.error ?? "Failed to add");
            return;
        }
        setTicker("");
        setQuantity("");
        router.refresh();
    }

    const inp = { padding: 8, borderRadius: 6, border: "1px solid #333", background: "#111", color: "#eee" };
    return (
        <form onSubmit={submit} className="add-form">
            <input style={inp} placeholder="Ticker (e.g. AAPL)" value={ticker} onChange={(e) => setTicker(e.target.value)} />
            <input style={inp} placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" />
            <button type="submit" style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>Add holding</button>
            {error && <span style={{ color: "#f87171" }}>{error}</span>}
        </form>
    );
}
