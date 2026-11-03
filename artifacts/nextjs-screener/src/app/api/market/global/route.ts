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

const GLOBAL_INDICES = [
  { symbol: "^GSPC", name: "S&P 500", region: "US" },
  { symbol: "^DJI", name: "Dow Jones", region: "US" },
  { symbol: "^IXIC", name: "Nasdaq", region: "US" },
  { symbol: "^RUT", name: "Russell 2000", region: "US" },
  { symbol: "^FTSE", name: "FTSE 100", region: "EU" },
  { symbol: "^GDAXI", name: "DAX", region: "EU" },
  { symbol: "^FCHI", name: "CAC 40", region: "EU" },
  { symbol: "^STOXX50E", name: "Euro Stoxx 50", region: "EU" },
  { symbol: "^N225", name: "Nikkei 225", region: "Asia" },
  { symbol: "^HSI", name: "Hang Seng", region: "Asia" },
  { symbol: "000001.SS", name: "Shanghai Comp", region: "Asia" },
  { symbol: "^AXJO", name: "ASX 200", region: "Asia" },
  { symbol: "^STI", name: "Straits Times", region: "Asia" },
];

async function fetchIndex(idx: (typeof GLOBAL_INDICES)[0]) {
  try {
    const url = `${YF_BASE}/v8/finance/chart/${encodeURIComponent(idx.symbol)}?interval=1d&range=5d`;
    const data = await yfFetch(url) as {
      chart?: { result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number } }[] };
    };
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice ?? 0;
    const prev = meta.chartPreviousClose ?? 0;
    const change = prev > 0 ? price - prev : 0;
    const changePct = prev > 0 ? (change / prev) * 100 : 0;
    return { symbol: idx.symbol, name: idx.name, region: idx.region, price, change, changePct };
  } catch { return null; }
}

async function fetchAll() {
  const results = await Promise.all(GLOBAL_INDICES.map(fetchIndex));
  const available = results.filter((result) => result !== null);
  if (available.length === 0) {
    throw new Error("No global index quotes were returned");
  }
  return available;
}

export async function GET() {
  try {
    const data = await cache.getOrSet("market:global", () => fetchAll(), 5 * 60 * 1000);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Global market data is unavailable", error);
    return NextResponse.json(
      { error: "Global market data is temporarily unavailable" },
      { status: 502 },
    );
  }
}
