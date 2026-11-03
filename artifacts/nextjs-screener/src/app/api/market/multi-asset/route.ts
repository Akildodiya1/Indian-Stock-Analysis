import { NextResponse } from "next/server";
import { cache } from "@/lib/cache";

const YF_BASE = "https://query1.finance.yahoo.com";

async function yfFetch(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`YF ${res.status}`);
  return res.json();
}

const ASSETS = [
  { symbol: "GC=F", name: "Gold (COMEX)", type: "commodity", unit: "USD/oz" },
  { symbol: "CL=F", name: "Crude Oil (WTI)", type: "commodity", unit: "USD/bbl" },
  { symbol: "NG=F", name: "Natural Gas", type: "commodity", unit: "USD/MMBtu" },
  { symbol: "USDINR=X", name: "USD/INR", type: "currency", unit: "INR" },
  { symbol: "EURINR=X", name: "EUR/INR", type: "currency", unit: "INR" },
  { symbol: "^TNX", name: "US 10Y Yield", type: "bond", unit: "%" },
  { symbol: "^INBMKTN-GL.NS", name: "India 10Y Yield", type: "bond", unit: "%" },
  { symbol: "^INDIAVIX", name: "India VIX", type: "volatility", unit: "" },
];

async function fetchAsset(asset: (typeof ASSETS)[0]) {
  try {
    const url = `${YF_BASE}/v8/finance/chart/${encodeURIComponent(asset.symbol)}?interval=1d&range=5d`;
    const data = await yfFetch(url) as {
      chart?: { result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number; regularMarketDayHigh?: number; regularMarketDayLow?: number } }[] };
    };
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice ?? 0;
    const prev = meta.chartPreviousClose ?? 0;
    const change = prev > 0 ? price - prev : 0;
    const changePct = prev > 0 ? (change / prev) * 100 : 0;
    return {
      symbol: asset.symbol,
      name: asset.name,
      type: asset.type,
      unit: asset.unit,
      price,
      change,
      changePct,
      high: meta.regularMarketDayHigh,
      low: meta.regularMarketDayLow,
    };
  } catch { return null; }
}

async function fetchAll() {
  const results = await Promise.all(ASSETS.map(fetchAsset));
  const available = results.filter((result) => result !== null);
  if (available.length === 0) {
    throw new Error("No multi-asset quotes were returned");
  }
  return available;
}

export async function GET() {
  try {
    const data = await cache.getOrSet("market:multi-asset", () => fetchAll(), 60 * 1000);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Multi-asset data is unavailable", error);
    return NextResponse.json(
      { error: "Multi-asset data is temporarily unavailable" },
      { status: 502 },
    );
  }
}
