import { NextResponse } from "next/server";
import { isAuthorizedUser } from "@/lib/session";
import { getHeldTickers, upsertPrice } from "@/lib/db";
import { fetchPrice } from "@/lib/prices";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function refresh(req: Request) {
  // Vercel cron sends GET with the Authorization: Bearer <CRON_SECRET> header.
  if (!isCron(req) && !(await isAuthorizedUser())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tickers = await getHeldTickers();
  const results = await Promise.all(
    tickers.map(async (ticker) => {
      const price = await fetchPrice(ticker);
      if (price != null) await upsertPrice(ticker, price, "auto");
      return { ticker, price, ok: price != null };
    })
  );
  return NextResponse.json({ refreshed: results.filter((r) => r.ok).length, results });
}

export async function GET(req: Request) {
  return refresh(req);
}
export async function POST(req: Request) {
  return refresh(req);
}
