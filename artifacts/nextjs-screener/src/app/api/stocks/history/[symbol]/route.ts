import { NextRequest, NextResponse } from "next/server";
import { fetchHistory } from "@/lib/yahoo-finance";
import { cache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  const period = req.nextUrl.searchParams.get("period") ?? "1mo";
  const interval = req.nextUrl.searchParams.get("interval") ?? "1d";
  const supportedPeriods = new Set([
    "5d",
    "1mo",
    "3mo",
    "6mo",
    "1y",
    "2y",
    "5y",
    "10y",
    "ytd",
    "max",
  ]);
  const supportedIntervals = new Set([
    "1m",
    "2m",
    "5m",
    "15m",
    "30m",
    "60m",
    "90m",
    "1h",
    "1d",
    "5d",
    "1wk",
    "1mo",
    "3mo",
  ]);
  if (!supportedPeriods.has(period) || !supportedIntervals.has(interval)) {
    return NextResponse.json(
      { error: "Unsupported history period or interval" },
      { status: 400 },
    );
  }

  const cacheKey = `stock:history:${symbol}:${period}:${interval}`;
  const data = await cache.getOrSet(
    cacheKey,
    () => fetchHistory(symbol, period, interval),
    interval === "1d" || interval === "1wk" || interval === "1mo"
      ? 12 * 60 * 60 * 1000
      : 60_000,
  );
  return NextResponse.json(data);
}
