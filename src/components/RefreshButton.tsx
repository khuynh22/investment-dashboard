"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/prices/refresh", { method: "POST" });
        router.refresh();
        setBusy(false);
      }}
      style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}
    >
      {busy ? "Refreshing…" : "Refresh prices"}
    </button>
  );
}
