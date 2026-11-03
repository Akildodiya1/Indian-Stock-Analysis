import { NextResponse } from "next/server";
import { fetchIndianEquityScreenerQuotes } from "@/lib/yahoo-finance";
import { cache } from "@/lib/cache";

export const dynamic = "force-dynamic";

async function fetchAllWithQuotes() {
  const quotes = await fetchIndianEquityScreenerQuotes();
  return quotes.map((quote) => ({
    symbol: quote.symbol,
    name: quote.longName ?? quote.shortName ?? quote.symbol,
    sector: quote.sector ?? "",
    exchange: "NSE",
    price: quote.regularMarketPrice ?? null,
    change_pct: quote.regularMarketChangePercent ?? null,
    volume: quote.regularMarketVolume ?? null,
    pe: quote.trailingPE ?? null,
    forward_pe: quote.forwardPE ?? null,
    pb: quote.priceToBook ?? null,
    market_cap: quote.marketCap != null ? quote.marketCap / 1e7 : null,
    eps: quote.trailingEps ?? null,
    roe: quote.returnOnEquity != null ? quote.returnOnEquity * 100 : null,
    div_yield: quote.dividendYield != null ? quote.dividendYield * 100 : null,
    week52_high: quote.fiftyTwoWeekHigh ?? null,
    week52_low: quote.fiftyTwoWeekLow ?? null,
  }));
}

export async function GET() {
  try {
    const stocks = await cache.getOrSet(
      "screener:advanced-dataset",
      fetchAllWithQuotes,
      180_000,
    );
    return NextResponse.json(stocks);
  } catch (error) {
    console.error("Advanced screener data is unavailable", error);
    return NextResponse.json(
      { error: "Advanced screener data is temporarily unavailable" },
      { status: 502 },
    );
  }
}
