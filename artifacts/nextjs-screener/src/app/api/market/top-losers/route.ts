import { NextResponse } from "next/server";
import { fetchIndianEquityScreenerQuotes } from "@/lib/yahoo-finance";
import { cache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const losers = await cache.getOrSet(
      "market:top-losers",
      async () => (await fetchIndianEquityScreenerQuotes())
        .filter((q) => (q.regularMarketChangePercent ?? 0) < 0)
        .sort((a, b) => (a.regularMarketChangePercent ?? 0) - (b.regularMarketChangePercent ?? 0))
        .slice(0, 10),
      120_000,
    );
    return NextResponse.json(losers);
  } catch (error) {
    console.error("Top losers are unavailable", error);
    return NextResponse.json({ error: "Top losers are temporarily unavailable" }, { status: 502 });
  }
}
