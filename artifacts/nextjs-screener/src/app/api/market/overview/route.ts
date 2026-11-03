import { NextResponse } from "next/server";
import { fetchQuotes } from "@/lib/yahoo-finance";
import { cache } from "@/lib/cache";
import { INDEX_SYMBOLS } from "@/lib/index-symbols";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await cache.getOrSet(
    "market:overview",
    async () => {
      const symbols = INDEX_SYMBOLS.map((i) => i.symbol);
      const quotes = await fetchQuotes(symbols);
      return quotes.map((q) => ({
        ...q,
        name: INDEX_SYMBOLS.find((i) => i.symbol === q.symbol)?.name ?? q.shortName ?? q.symbol,
      }));
    },
    60_000
  );
  return NextResponse.json(data);
}
