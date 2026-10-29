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

    let quotes: Awaited<ReturnType<typeof fetchQuotes>> = [];
    try {
      quotes = await fetchQuotes(symbols);
    } catch (err) {
      console.error("watchlist quote fetch failed; returning saved items without quotes", err);
    }
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
        quoteUnavailable: currentPrice == null,
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
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }
    const rawSymbol =
      typeof body === "object" && body !== null && !Array.isArray(body) && "symbol" in body
        ? body.symbol
        : undefined;
    if (
      typeof rawSymbol !== "string" ||
      !/^[A-Za-z0-9.^&=_-]{1,50}$/.test(rawSymbol.trim())
    ) {
      return NextResponse.json({ error: "A valid stock symbol is required" }, { status: 400 });
    }
    const symbol = rawSymbol.trim().toUpperCase();

    let addedPrice: number | undefined;
    try {
      const quotes = await fetchQuotes([symbol]);
      addedPrice = quotes[0]?.regularMarketPrice ?? undefined;
    } catch (err) {
      console.error("watchlist add quote fetch failed; saving without an added price", err);
    }

    await db.insert(watchlistTable)
      .values({ symbol, name: symbol, exchange: "NSE", addedPrice })
      .onConflictDoNothing();
    return NextResponse.json({ symbol, quoteUnavailable: addedPrice == null }, { status: 201 });
  } catch (err) {
    console.error("watchlist POST error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
