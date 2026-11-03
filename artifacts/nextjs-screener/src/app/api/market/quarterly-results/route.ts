import { NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import {
  fetchFinancialSeries,
  fetchIndianEquityScreenerQuotes,
} from "@/lib/yahoo-finance";

export const dynamic = "force-dynamic";
const STOCK_LIMIT = 30;
const FETCH_CONCURRENCY = 8;

export interface QuarterlyResult {
  symbol: string;
  name: string;
  sector: string;
  period: string;
  revenue: number | null;
  profit: number | null;
  revenueGrowth: number | null;
  profitGrowth: number | null;
  eps: number | null;
  beat: "beat" | "miss" | "inline" | null;
}

function toCrores(value: number | undefined): number | null {
  return value != null && Number.isFinite(value) ? value / 10_000_000 : null;
}

async function fetchQuarterlyResults(): Promise<QuarterlyResult[]> {
  const stocks = (await fetchIndianEquityScreenerQuotes())
    .filter((quote) => quote.marketCap != null)
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .slice(0, STOCK_LIMIT);
  const results: Array<QuarterlyResult | null> = Array(stocks.length).fill(null);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(FETCH_CONCURRENCY, stocks.length) },
    async () => {
      while (nextIndex < stocks.length) {
        const index = nextIndex++;
        const stock = stocks[index];
        try {
          const series = await fetchFinancialSeries(stock.symbol, "quarterly");
          const latest = series[series.length - 1];
          if (!latest || (latest.revenue == null && latest.netIncome == null)) continue;

          const previousYear = series.find(
            (point) =>
              point.date.slice(0, 4) ===
                String(Number(latest.date.slice(0, 4)) - 1) &&
              point.date.slice(5, 7) === latest.date.slice(5, 7),
          );
          results[index] = {
            symbol: stock.symbol,
            name: stock.longName ?? stock.shortName ?? stock.symbol,
            sector: stock.sector ?? "Unclassified",
            period: latest.period,
            revenue: toCrores(latest.revenue),
            profit: toCrores(latest.netIncome),
            revenueGrowth:
              latest.revenue != null &&
              previousYear?.revenue != null &&
              previousYear.revenue !== 0
                ? ((latest.revenue - previousYear.revenue) /
                    Math.abs(previousYear.revenue)) *
                  100
                : null,
            profitGrowth:
              latest.netIncome != null &&
              previousYear?.netIncome != null &&
              previousYear.netIncome !== 0
                ? ((latest.netIncome - previousYear.netIncome) /
                    Math.abs(previousYear.netIncome)) *
                  100
                : null,
            eps: latest.eps ?? null,
            beat: null,
          };
        } catch (error) {
          console.warn(`Quarterly financials unavailable for ${stock.symbol}`, error);
        }
      }
    },
  );
  await Promise.all(workers);
  const availableResults = results.filter(
    (result): result is QuarterlyResult => result !== null,
  );
  if (availableResults.length === 0) {
    throw new Error("Yahoo Finance returned no quarterly financial statements");
  }
  return availableResults;
}

export async function GET() {
  try {
    const data = await cache.getOrSet(
      "market:quarterly-results:v2",
      fetchQuarterlyResults,
      30 * 60 * 1000,
    );
    return NextResponse.json(data);
  } catch (error) {
    console.error("Quarterly results are unavailable", error);
    return NextResponse.json({ error: "Quarterly results are temporarily unavailable" }, { status: 502 });
  }
}
