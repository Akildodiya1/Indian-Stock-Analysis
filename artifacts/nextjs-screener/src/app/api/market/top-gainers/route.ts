import { NextResponse } from "next/server";
import { fetchIndianEquityScreenerQuotes } from "@/lib/yahoo-finance";
import { cache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const gainers = await cache.getOrSet(
      "market:top-gainers",
      async () => (await fetchIndianEquityScreenerQuotes())
        .filter((q) => (q.regularMarketChangePercent ?? 0) > 0)
        .sort((a, b) => (b.regularMarketChangePercent ?? 0) - (a.regularMarketChangePercent ?? 0))
        .slice(0, 10),
      120_000,
    );
    return NextResponse.json(gainers);
  } catch (error) {
    console.error("Top gainers are unavailable", error);
    return NextResponse.json({ error: "Top gainers are temporarily unavailable" }, { status: 502 });
  }
}
