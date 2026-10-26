import { NextRequest, NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@workspace/db";
import { portfolioTable } from "@workspace/db/schema";
import { fetchQuotes } from "@/lib/yahoo-finance";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const holdings = await db.select().from(portfolioTable);
    if (holdings.length === 0) return NextResponse.json([]);
    const symbols = [...new Set(holdings.map((h) => h.symbol))];
    const quotes = await fetchQuotes(symbols);
    const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));
    const result = holdings.map((h) => {
      const q = quoteMap.get(h.symbol);
      const currentPrice = q?.regularMarketPrice ?? null;
      const currentValue = currentPrice != null ? currentPrice * h.quantity : null;
      const invested = h.avgPrice * h.quantity;
      const pnl = currentValue != null ? currentValue - invested : null;
      const pnlPct = pnl != null && invested > 0 ? (pnl / invested) * 100 : null;
      let cagr: number | null = null;
      if (h.purchaseDate && currentValue != null && invested > 0) {
        const years = (Date.now() - new Date(h.purchaseDate).getTime()) / (365.25 * 24 * 3600 * 1000);
        if (years > 0.01) cagr = (Math.pow(currentValue / invested, 1 / years) - 1) * 100;
      }
      return {
        ...h,
        shortName: q?.shortName ?? h.name,
        currentPrice,
        currentValue,
        invested,
        pnl,
        pnlPct,
        cagr,
        regularMarketChangePercent: q?.regularMarketChangePercent,
      };
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch portfolio" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = (await req.json()) as {
      symbol: string;
      name?: string;
      exchange?: string;
      quantity: number;
      avgPrice: number;
      purchaseDate?: string;
      notes?: string;
    };
    if (!body.symbol || !body.quantity || !body.avgPrice) {
      return NextResponse.json({ error: "symbol, quantity, avgPrice required" }, { status: 400 });
    }
    const [inserted] = await db
      .insert(portfolioTable)
      .values({
        symbol: body.symbol.toUpperCase(),
        name: body.name ?? body.symbol,
        exchange: body.exchange ?? "NSE",
        quantity: body.quantity,
        avgPrice: body.avgPrice,
        purchaseDate: body.purchaseDate ?? null,
        notes: body.notes ?? null,
      })
      .returning();
    return NextResponse.json(inserted, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to add holding" }, { status: 500 });
  }
}
