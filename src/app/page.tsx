import { getHoldings, getPrices } from "@/lib/db";
import { buildRows, totalValue, pieData } from "@/lib/portfolio";
import { SummaryBar } from "@/components/SummaryBar";
import { AllocationPie } from "@/components/AllocationPie";
import { HoldingsTable } from "@/components/HoldingsTable";
import { AddHoldingForm } from "@/components/AddHoldingForm";
import { RefreshButton } from "@/components/RefreshButton";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [holdings, prices] = await Promise.all([getHoldings(), getPrices()]);
  const rows = buildRows(holdings, prices);
  const asOf = prices.reduce<string | null>((latest, p) => (!latest || p.updatedAt > latest ? p.updatedAt : latest), null);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24, display: "grid", gap: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Investment Dashboard</h1>
        <RefreshButton />
      </header>
      <SummaryBar total={totalValue(rows)} asOf={asOf} />
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        <div><h2 style={{ fontSize: 16 }}>Allocation</h2><AllocationPie data={pieData(rows)} /></div>
        <div><h2 style={{ fontSize: 16 }}>Add holding</h2><AddHoldingForm /></div>
      </section>
      <section><h2 style={{ fontSize: 16 }}>Holdings</h2><HoldingsTable rows={rows} /></section>
    </main>
  );
}
