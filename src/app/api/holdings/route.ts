import { NextResponse } from "next/server";
import { isAuthorizedUser } from "@/lib/session";
import { getHoldings, getPrices, addToHolding } from "@/lib/db";
import { buildRows } from "@/lib/portfolio";

export async function GET() {
    if (!(await isAuthorizedUser()))
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const [holdings, prices] = await Promise.all([getHoldings(), getPrices()]);
    return NextResponse.json({ rows: buildRows(holdings, prices) });
}

export async function POST(req: Request) {
    if (!(await isAuthorizedUser()))
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => null);
    const ticker =
        typeof body?.ticker === "string"
            ? body.ticker.trim().toUpperCase()
            : "";
    const quantity = Number(body?.quantity);
    if (
        !/^[A-Z.\-]{1,10}$/.test(ticker) ||
        !Number.isFinite(quantity) ||
        quantity <= 0
    ) {
        return NextResponse.json(
            { error: "invalid ticker or quantity" },
            { status: 400 },
        );
    }
    await addToHolding(ticker, quantity); // adding an existing ticker accumulates shares
    return NextResponse.json({ ok: true });
}
