import { NextResponse } from "next/server";
import { isAuthorizedUser } from "@/lib/session";
import {
    upsertHolding,
    deleteHolding,
    upsertPrice,
    holdingExists,
} from "@/lib/db";

export async function PATCH(
    req: Request,
    ctx: { params: Promise<{ ticker: string }> },
) {
    if (!(await isAuthorizedUser()))
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { ticker: raw } = await ctx.params;
    const ticker = raw.trim().toUpperCase();
    // PATCH only edits an existing holding; it must not create one.
    if (!(await holdingExists(ticker)))
        return NextResponse.json({ error: "not found" }, { status: 404 });
    const body = await req.json().catch(() => null);

    if (body?.quantity !== undefined) {
        const quantity = Number(body.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0)
            return NextResponse.json(
                { error: "invalid quantity" },
                { status: 400 },
            );
        await upsertHolding(ticker, quantity);
    }
    if (body?.price !== undefined) {
        const price = Number(body.price);
        if (!Number.isFinite(price) || price <= 0)
            return NextResponse.json(
                { error: "invalid price" },
                { status: 400 },
            );
        await upsertPrice(ticker, price, "manual"); // manual override
    }
    return NextResponse.json({ ok: true });
}

export async function DELETE(
    _req: Request,
    ctx: { params: Promise<{ ticker: string }> },
) {
    if (!(await isAuthorizedUser()))
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { ticker } = await ctx.params;
    await deleteHolding(ticker.trim().toUpperCase());
    return NextResponse.json({ ok: true });
}
