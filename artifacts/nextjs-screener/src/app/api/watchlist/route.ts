import { NextRequest, NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@workspace/db";
import { watchlistTable } from "@workspace/db";
import { fetchQuotes } from "@/lib/yahoo-finance";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const rows = await db.select().from(watchlistTable).orderBy(watchlistTable.addedAt);
    const symbols = rows.map((r) => r.symbol);
    if (symbols.length === 0) return NextResponse.json([]);

    const quotes = await fetchQuotes(symbols);
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

    const data = rows.map((r) => {
      const q = quoteMap.get(r.symbol);
      const currentPrice = q?.regularMarketPrice;
      const addedPrice = r.addedPrice ?? undefined;
      const priceDiff = currentPrice != null && addedPrice != null ? currentPrice - addedPrice : undefined;
      const pricePct = priceDiff != null && addedPrice != null && addedPrice > 0
        ? (priceDiff / addedPrice) * 100
        : undefined;
      return {
        symbol: r.symbol,
        addedAt: r.addedAt,
        addedPrice,
        currentPrice,
        priceDiff,
        pricePct,
        regularMarketPrice: currentPrice,
        regularMarketChange: q?.regularMarketChange,
        regularMarketChangePercent: q?.regularMarketChangePercent,
        shortName: q?.shortName,
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("watchlist GET error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = (await req.json()) as { symbol?: string };
    const symbol = body.symbol?.trim();
    if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

    // Fetch current price to store as addedPrice
    let addedPrice: number | undefined;
    try {
      const quotes = await fetchQuotes([symbol]);
      addedPrice = quotes[0]?.regularMarketPrice ?? undefined;
    } catch { /* optional */ }

    await db.insert(watchlistTable)
      .values({ symbol, name: symbol, exchange: "NSE", addedPrice })
      .onConflictDoNothing();
    return NextResponse.json({ symbol }, { status: 201 });
  } catch (err) {
    console.error("watchlist POST error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
