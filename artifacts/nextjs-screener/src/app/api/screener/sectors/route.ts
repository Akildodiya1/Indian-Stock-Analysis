import { NextResponse } from "next/server";
import { fetchIndianEquityScreenerQuotes } from "@/lib/yahoo-finance";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const quotes = await fetchIndianEquityScreenerQuotes();
    const sectors = [...new Set(quotes.map((quote) => quote.sector || "Unclassified"))].sort();
    return NextResponse.json(sectors);
  } catch (error) {
    console.error("Screener sectors are unavailable", error);
    return NextResponse.json({ error: "Screener sectors are temporarily unavailable" }, { status: 502 });
  }
}
