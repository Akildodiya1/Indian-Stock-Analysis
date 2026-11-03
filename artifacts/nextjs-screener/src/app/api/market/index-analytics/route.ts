import { NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import { INDEX_SYMBOLS } from "@/lib/index-symbols";
import { fetchHistory } from "@/lib/yahoo-finance";

export const dynamic = "force-dynamic";

interface IndexAnalytics {
  symbol: string;
  name: string;
  asOfDate: string;
  close: number;
  change1m: number | null;
  change3m: number | null;
  change6m: number | null;
  change1y: number | null;
  change5y: number | null;
  high5y: number;
  low5y: number;
  drawdown5y: number;
}

function percentageChange(
  closes: number[],
  sessions: number,
): number | null {
  if (closes.length <= sessions) return null;
  const previous = closes[closes.length - sessions - 1];
  const latest = closes[closes.length - 1];
  return previous > 0 ? ((latest - previous) / previous) * 100 : null;
}

function percentageChangeOverYears(
  history: { timestamp: number; close: number }[],
  years: number,
): number | null {
  const latest = history[history.length - 1];
  if (!latest) return null;

  const targetTimestamp =
    latest.timestamp - years * 365.25 * 24 * 60 * 60;
  const comparison = history.find(
    (point) => point.timestamp >= targetTimestamp,
  );
  if (
    !comparison ||
    comparison.timestamp - targetTimestamp > 14 * 24 * 60 * 60
  ) {
    return null;
  }
  return comparison.close > 0
    ? ((latest.close - comparison.close) / comparison.close) * 100
    : null;
}

async function fetchIndexAnalytics(): Promise<IndexAnalytics[]> {
  const results = await Promise.all(
    INDEX_SYMBOLS.map(async ({ symbol, name }) => {
      try {
        const history = await fetchHistory(symbol, "5y", "1d");
        if (history.length === 0) return null;

        const closes = history.map((point) => point.close);
        let peak = closes[0];
        let maxDrawdown = 0;
        for (const close of closes) {
          peak = Math.max(peak, close);
          if (peak > 0) maxDrawdown = Math.min(maxDrawdown, (close / peak - 1) * 100);
        }

        const latest = history[history.length - 1];
        return {
          symbol,
          name,
          asOfDate: new Date(latest.timestamp * 1000).toLocaleDateString(
            "en-CA",
            { timeZone: "Asia/Kolkata" },
          ),
          close: latest.close,
          change1m: percentageChange(closes, 21),
          change3m: percentageChange(closes, 63),
          change6m: percentageChange(closes, 126),
          change1y: percentageChange(closes, 252),
          change5y: percentageChangeOverYears(history, 5),
          high5y: Math.max(...closes),
          low5y: Math.min(...closes),
          drawdown5y: maxDrawdown,
        };
      } catch (error) {
        console.warn(`Index history is unavailable for ${symbol}`, error);
        return null;
      }
    }),
  );
  const available = results.filter(
    (result): result is IndexAnalytics => result !== null,
  );
  if (available.length === 0) {
    throw new Error("No index history was returned");
  }
  return available;
}

export async function GET() {
  try {
    const data = await cache.getOrSet(
      "market:index-analytics:eod:v1",
      fetchIndexAnalytics,
      12 * 60 * 60 * 1000,
    );
    return NextResponse.json(data);
  } catch (error) {
    console.error("Index analytics are unavailable", error);
    return NextResponse.json(
      { error: "Index analytics are temporarily unavailable" },
      { status: 502 },
    );
  }
}
