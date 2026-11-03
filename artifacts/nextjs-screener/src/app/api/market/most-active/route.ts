import { NextResponse } from "next/server";
import { fetchIndianEquityScreenerQuotes } from "@/lib/yahoo-finance";
import { cache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const active = await cache.getOrSet(
      "market:most-active",
      async () => (await fetchIndianEquityScreenerQuotes())
        .filter((q) => (q.regularMarketVolume ?? 0) > 0)
        .sort((a, b) => (b.regularMarketVolume ?? 0) - (a.regularMarketVolume ?? 0))
        .slice(0, 10),
      120_000,
    );
    return NextResponse.json(active);
  } catch (error) {
    console.error("Most active stocks are unavailable", error);
    return NextResponse.json({ error: "Most active stocks are temporarily unavailable" }, { status: 502 });
  }
}
