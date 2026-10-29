import { NextResponse } from "next/server";
import { fetchQuotes, fetchHistory } from "@/lib/yahoo-finance";
import { NSE_STOCKS } from "@/lib/stock-list";
import { cache } from "@/lib/cache";

export const dynamic = "force-dynamic";

function computeEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

async function computeMarketBreadth() {
  const symbols = NSE_STOCKS.map((s) => s.symbol);

  // Fetch live quotes + Nifty history in parallel
  const [quotes, niftyHist] = await Promise.all([
    fetchQuotes(symbols),
    fetchHistory("^NSEI", "1y", "1d"),
  ]);
  if (quotes.length === 0 || niftyHist.length === 0) {
    throw new Error("Market breadth source returned no quote or index history data");
  }

  // Advance / Decline
  let advances = 0, declines = 0, unchanged = 0;
  let near52wHigh = 0, near52wLow = 0, at52wHigh = 0, at52wLow = 0;
  let strongUp = 0, strongDown = 0;

  const topGainers: { symbol: string; name: string; changePercent: number }[] = [];
  const topLosers: { symbol: string; name: string; changePercent: number }[] = [];

  for (const q of quotes) {
    const chg = q.regularMarketChangePercent ?? 0;
    if (chg > 0) advances++;
    else if (chg < 0) declines++;
    else unchanged++;

    if (chg >= 3) strongUp++;
    if (chg <= -3) strongDown++;

    const price = q.regularMarketPrice ?? 0;
    const high52 = q.fiftyTwoWeekHigh ?? 0;
    const low52 = q.fiftyTwoWeekLow ?? 0;
    if (high52 > 0) {
      const pctFromHigh = (price / high52) * 100;
      if (pctFromHigh >= 98) at52wHigh++;
      else if (pctFromHigh >= 95) near52wHigh++;
    }
    if (low52 > 0) {
      const pctFromLow = (price / low52) * 100;
      if (pctFromLow <= 102) at52wLow++;
      else if (pctFromLow <= 110) near52wLow++;
    }

    const nameStr = NSE_STOCKS.find((s) => s.symbol === q.symbol)?.name ?? q.symbol;
    if (chg >= 3) topGainers.push({ symbol: q.symbol, name: nameStr, changePercent: chg });
    if (chg <= -3) topLosers.push({ symbol: q.symbol, name: nameStr, changePercent: chg });
  }

  topGainers.sort((a, b) => b.changePercent - a.changePercent);
  topLosers.sort((a, b) => a.changePercent - b.changePercent);

  // Nifty EMA calculation
  const closes = niftyHist.map((h) => h.close);
  const ema20arr = computeEMA(closes, 20);
  const ema50arr = computeEMA(closes, 50);
  const ema200arr = computeEMA(closes, 200);
  const currentPrice = closes[closes.length - 1] ?? 0;
  const ema20 = ema20arr[ema20arr.length - 1] ?? 0;
  const ema50 = ema50arr[ema50arr.length - 1] ?? 0;
  const ema200 = ema200arr[ema200arr.length - 1] ?? 0;

  // Weekly AD ratio (last 5 days as proxy)
  const adRatio = declines > 0 ? advances / declines : advances;

  return {
    total: quotes.length,
    advanceDecline: {
      advances,
      declines,
      unchanged,
      ratio: parseFloat(adRatio.toFixed(2)),
    },
    fiftyTwoWeek: {
      at52wHigh,
      near52wHigh,
      near52wLow,
      at52wLow,
    },
    momentum: {
      strongUp,
      strongDown,
      topGainers: topGainers.slice(0, 10),
      topLosers: topLosers.slice(0, 10),
    },
    niftyEma: {
      price: currentPrice,
      ema20: parseFloat(ema20.toFixed(2)),
      ema50: parseFloat(ema50.toFixed(2)),
      ema200: parseFloat(ema200.toFixed(2)),
      aboveEma20: currentPrice > ema20,
      aboveEma50: currentPrice > ema50,
      aboveEma200: currentPrice > ema200,
    },
  };
}

export async function GET() {
  try {
    const data = await cache.getOrSet("market:market-breadth", computeMarketBreadth, 3 * 60 * 1000);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Market breadth is unavailable", error);
    return NextResponse.json(
      { error: "Market breadth data is temporarily unavailable" },
      { status: 502 },
    );
  }
}
