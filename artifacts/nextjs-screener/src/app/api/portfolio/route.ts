import { NextRequest, NextResponse } from "next/server";
import { db, isDatabaseConfigured } from "@workspace/db";
import { portfolioTable } from "@workspace/db/schema";
import { fetchQuotes } from "@/lib/yahoo-finance";
import { validatePortfolioInput } from "@/lib/portfolio-validation";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const holdings = await db.select().from(portfolioTable);
    if (holdings.length === 0) return NextResponse.json([]);
    const symbols = [...new Set(holdings.map((h) => h.symbol))];
    let quotes: Awaited<ReturnType<typeof fetchQuotes>> = [];
    try {
      quotes = await fetchQuotes(symbols);
    } catch (err) {
      console.error("portfolio quote fetch failed; returning saved holdings without quotes", err);
    }
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
        quoteUnavailable: currentPrice == null,
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
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }
    const validation = validatePortfolioInput(body);
    if ("error" in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const [inserted] = await db
      .insert(portfolioTable)
      .values(validation.value)
      .returning();
    return NextResponse.json(inserted, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to add holding" }, { status: 500 });
  }
}
