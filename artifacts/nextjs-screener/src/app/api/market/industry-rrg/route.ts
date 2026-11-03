import { NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import {
  fetchHistory,
  fetchIndianEquityScreenerQuotes,
} from "@/lib/yahoo-finance";

export const dynamic = "force-dynamic";

const HISTORY_CONCURRENCY = 20;
const REPRESENTATIVE_STOCKS_PER_INDUSTRY = 3;
const MATRIX_SESSIONS = 8;
const CACHE_KEY = "market:industry-rrg:v2";
const CACHE_TTL_MS = 15 * 60 * 1000;

interface IndustryQuote {
  symbol: string;
  marketCap: number;
  history: Awaited<ReturnType<typeof fetchHistory>>;
}

type IndustryRrgSignal = "Strong" | "Moderate" | "Mixed / Weak" | "Bearish" | null;

interface IndustryRrgSnapshot {
  date: string;
  return5d: number | null;
  trend14v66: number | null;
  signal: IndustryRrgSignal;
}

interface IndustryRrgPoint {
  industry: string;
  stockCount: number;
  historyCount: number;
  change1d: number | null;
  change1w: number | null;
  change1m: number | null;
  change3m: number | null;
  rsRatio: number | null;
  rsMomentum: number | null;
  quadrant: "Leading" | "Weakening" | "Lagging" | "Improving" | null;
  snapshots: IndustryRrgSnapshot[];
}

function percentageChange(
  history: IndustryQuote["history"],
  lookback: number,
): number | null {
  if (history.length <= lookback) return null;
  const previous = history[history.length - 1 - lookback]?.close;
  const latest = history[history.length - 1]?.close;
  if (!previous || !latest) return null;
  return ((latest - previous) / previous) * 100;
}

function percentageChangeAt(
  history: IndustryQuote["history"],
  timestamp: number,
  lookback: number,
): number | null {
  let latestIndex = history.length - 1;
  while (latestIndex >= 0 && history[latestIndex].timestamp > timestamp) {
    latestIndex--;
  }
  const previous = history[latestIndex - lookback]?.close;
  const latest = history[latestIndex]?.close;
  if (!previous || !latest || previous <= 0) return null;
  return ((latest - previous) / previous) * 100;
}

function weightedChange(
  stocks: IndustryQuote[],
  lookback: number,
): number | null {
  const usable = stocks
    .map((stock) => ({
      change: percentageChange(stock.history, lookback),
      weight: stock.marketCap,
    }))
    .filter(
      (entry): entry is { change: number; weight: number } =>
        entry.change != null && Number.isFinite(entry.change),
    );
  if (usable.length === 0) return null;
  const marketCapWeighted = usable.filter((entry) => entry.weight > 0);
  if (marketCapWeighted.length === 0) {
    return usable.reduce((sum, entry) => sum + entry.change, 0) / usable.length;
  }
  const totalWeight = marketCapWeighted.reduce((sum, entry) => sum + entry.weight, 0);
  return marketCapWeighted.reduce(
    (sum, entry) => sum + entry.change * (entry.weight / totalWeight),
    0,
  );
}

function weightedChangeAt(
  stocks: IndustryQuote[],
  timestamp: number,
  lookback: number,
): number | null {
  const usable = stocks
    .map((stock) => ({
      change: percentageChangeAt(stock.history, timestamp, lookback),
      weight: stock.marketCap,
    }))
    .filter(
      (entry): entry is { change: number; weight: number } =>
        entry.change != null && Number.isFinite(entry.change),
    );
  if (usable.length === 0) return null;
  const weighted = usable.filter((entry) => entry.weight > 0);
  if (weighted.length === 0) {
    return usable.reduce((sum, entry) => sum + entry.change, 0) / usable.length;
  }
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  return weighted.reduce(
    (sum, entry) => sum + entry.change * (entry.weight / totalWeight),
    0,
  );
}

function classifySnapshot(
  trend14v66: number | null,
  return5d: number | null,
): IndustryRrgSignal {
  if (trend14v66 == null || return5d == null) return null;
  if (trend14v66 > 0 && return5d > 1.5) return "Strong";
  if (trend14v66 > 0 && return5d >= 0.5) return "Moderate";
  if (trend14v66 < 0 && return5d < 0) return "Bearish";
  return "Mixed / Weak";
}

function formatMarketDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
}

async function fetchIndustryRrg(): Promise<IndustryRrgPoint[]> {
  const [quotes, benchmarkHistory] = await Promise.all([
    fetchIndianEquityScreenerQuotes(),
    fetchHistory("^NSEI", "6mo", "1d"),
  ]);
  if (benchmarkHistory.length <= 63) {
    throw new Error("Insufficient NIFTY 50 history for industry RRG");
  }

  const grouped = new Map<string, typeof quotes>();
  for (const quote of quotes) {
    const industry = quote.industry?.trim() || "Unclassified";
    const stocks = grouped.get(industry) ?? [];
    stocks.push(quote);
    grouped.set(industry, stocks);
  }

  const representatives = [...grouped.entries()].map(([industry, stocks]) => ({
    industry,
    stocks: [...stocks]
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
      .slice(0, REPRESENTATIVE_STOCKS_PER_INDUSTRY),
  }));
  const symbols = [
    ...new Set(representatives.flatMap(({ stocks }) => stocks.map((stock) => stock.symbol))),
  ];
  const historyBySymbol = new Map<string, IndustryQuote["history"]>();
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(HISTORY_CONCURRENCY, symbols.length) },
    async () => {
      while (nextIndex < symbols.length) {
        const index = nextIndex++;
        const symbol = symbols[index];
        try {
          historyBySymbol.set(symbol, await fetchHistory(symbol, "6mo", "1d"));
        } catch (error) {
          console.warn(`Industry RRG history unavailable for ${symbol}`, error);
          historyBySymbol.set(symbol, []);
        }
      }
    },
  );
  await Promise.all(workers);

  const benchmarkChanges = {
    oneMonth: percentageChange(benchmarkHistory, 21),
    threeMonths: percentageChange(benchmarkHistory, 63),
  };
  const snapshotTimestamps = benchmarkHistory
    .slice(-MATRIX_SESSIONS)
    .map((point) => point.timestamp);

  return representatives.map(({ industry, stocks }) => {
    const industryStocks = stocks.map((stock) => ({
      symbol: stock.symbol,
      marketCap: stock.marketCap ?? 0,
      history: historyBySymbol.get(stock.symbol) ?? [],
    }));
    const change1d = weightedChange(industryStocks, 1);
    const change1w = weightedChange(industryStocks, 5);
    const change1m = weightedChange(industryStocks, 21);
    const change3m = weightedChange(industryStocks, 63);
    const rsRatio =
      change3m != null && benchmarkChanges.threeMonths != null
        ? 100 + change3m - benchmarkChanges.threeMonths
        : null;
    const rsMomentum =
      change1m != null && benchmarkChanges.oneMonth != null
        ? 100 + change1m - benchmarkChanges.oneMonth
        : null;
    const quadrant =
      rsRatio == null || rsMomentum == null
        ? null
        : rsRatio >= 100 && rsMomentum >= 100
          ? "Leading"
          : rsRatio >= 100
            ? "Weakening"
            : rsMomentum < 100
              ? "Lagging"
              : "Improving";
    const snapshots = snapshotTimestamps.map((timestamp) => {
      const return5d = weightedChangeAt(industryStocks, timestamp, 5);
      const return14d = weightedChangeAt(industryStocks, timestamp, 14);
      const return66d = weightedChangeAt(industryStocks, timestamp, 66);
      const trend14v66 =
        return14d != null && return66d != null
          ? return14d - (return66d * 14) / 66
          : null;
      return {
        date: formatMarketDate(timestamp),
        return5d,
        trend14v66,
        signal: classifySnapshot(trend14v66, return5d),
      };
    });

    return {
      industry,
      stockCount: grouped.get(industry)?.length ?? stocks.length,
      historyCount: industryStocks.filter((stock) => stock.history.length > 63).length,
      change1d,
      change1w,
      change1m,
      change3m,
      rsRatio,
      rsMomentum,
      quadrant,
      snapshots,
    };
  });
}

let industryRrgRequest: Promise<IndustryRrgPoint[]> | undefined;

export async function GET() {
  try {
    const cached = cache.get<IndustryRrgPoint[]>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);
    industryRrgRequest ??= fetchIndustryRrg();
    const data = await industryRrgRequest;
    cache.set(CACHE_KEY, data, CACHE_TTL_MS);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Industry RRG data is unavailable", error);
    return NextResponse.json(
      { error: "Industry RRG data is temporarily unavailable" },
      { status: 502 },
    );
  } finally {
    industryRrgRequest = undefined;
  }
}
