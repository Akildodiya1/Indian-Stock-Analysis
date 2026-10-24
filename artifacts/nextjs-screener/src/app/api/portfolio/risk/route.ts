import { NextResponse } from "next/server";
import { db } from "@workspace/db";
import { portfolioTable } from "@workspace/db/schema";
import { cache } from "@/lib/cache";
import { fetchHistory, fetchQuotes } from "@/lib/yahoo-finance";
import { NSE_STOCKS } from "@/lib/stock-list";
import { buildPortfolioRisk } from "@/lib/portfolio-risk";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 5 * 60 * 1000;
const HISTORY_CONCURRENCY = 5;

async function fetchPositionHistories(symbols: string[]) {
  const histories = new Map<string, Awaited<ReturnType<typeof fetchHistory>>>();
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(HISTORY_CONCURRENCY, symbols.length) },
    async () => {
      while (nextIndex < symbols.length) {
        const index = nextIndex++;
        const symbol = symbols[index];
        try {
          histories.set(symbol, await fetchHistory(symbol, "1y", "1d"));
        } catch {
          histories.set(symbol, []);
        }
      }
    },
  );
  await Promise.all(workers);
  return histories;
}

export async function GET() {
  try {
    const holdings = await db.select().from(portfolioTable);
    const signature = holdings
      .map((holding) =>
        [
          holding.id,
          holding.symbol.toUpperCase(),
          holding.quantity,
          holding.avgPrice,
        ].join(":"),
      )
      .sort()
      .join("|");

    const response = await cache.getOrSet(
      `portfolio:risk:v1:${signature || "empty"}`,
      async () => {
        if (holdings.length === 0) {
          return buildPortfolioRisk([], [], new Map());
        }

        const aggregated = new Map<
          string,
          { symbol: string; name: string; quantity: number; invested: number }
        >();
        for (const holding of holdings) {
          const symbol = holding.symbol.toUpperCase();
          const current = aggregated.get(symbol);
          const quantity = Number(holding.quantity) || 0;
          const invested = quantity * (Number(holding.avgPrice) || 0);
          if (current) {
            current.quantity += quantity;
            current.invested += invested;
          } else {
            aggregated.set(symbol, {
              symbol,
              name: holding.name || symbol,
              quantity,
              invested,
            });
          }
        }

        const symbols = [...aggregated.keys()];
        const [quotes, historyBySymbol, niftyHistory] = await Promise.all([
          fetchQuotes(symbols).catch(() => []),
          fetchPositionHistories(symbols),
          fetchHistory("^NSEI", "1y", "1d").catch(() => []),
        ]);
        const quoteBySymbol = new Map(
          quotes.map((quote) => [quote.symbol.toUpperCase(), quote]),
        );
        const positions = [...aggregated.values()].map((position) => {
          const quote = quoteBySymbol.get(position.symbol);
          const marketPrice = quote?.regularMarketPrice;
          const quoteAvailable =
            marketPrice != null && Number.isFinite(marketPrice) && marketPrice > 0;
          return {
            symbol: position.symbol,
            name: position.name,
            currentValue: quoteAvailable
              ? marketPrice * position.quantity
              : position.invested,
            quoteAvailable,
            history: historyBySymbol.get(position.symbol) ?? [],
          };
        });
        const sectorsBySymbol = new Map(
          NSE_STOCKS.map((stock) => [stock.symbol.toUpperCase(), stock.sector]),
        );
        return buildPortfolioRisk(positions, niftyHistory, sectorsBySymbol);
      },
      CACHE_TTL_MS,
    );
    return NextResponse.json(response);
  } catch (error) {
    console.error("Portfolio risk analytics failed", error);
    return NextResponse.json(
      { error: "Failed to calculate portfolio risk" },
      { status: 500 },
    );
  }
}
