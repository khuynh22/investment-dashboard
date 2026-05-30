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
        <main className="container">
            <header className="dashboard-header">
                <h1 className="dashboard-title">Investment Dashboard</h1>
                <RefreshButton />
            </header>
            <SummaryBar total={totalValue(rows)} asOf={asOf} />
            <section className="grid-2">
                <div><h2 className="section-title">Allocation</h2><AllocationPie data={pieData(rows)} /></div>
                <div><h2 className="section-title">Add holding</h2><AddHoldingForm /></div>
            </section>
            <section><h2 className="section-title">Holdings</h2><HoldingsTable rows={rows} /></section>
        </main>
    );
}
