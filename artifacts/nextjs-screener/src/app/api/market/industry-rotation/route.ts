import { NextResponse } from "next/server";
import { fetchIndianEquityScreenerQuotes, fetchSectorPerformance } from "@/lib/yahoo-finance";
import { cache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export interface IndustryRotationSector {
  sector: string;
  stockCount: number;
  advances: number;
  declines: number;
  unchanged: number;
  adRatio: number | null;
  avgChange1d: number | null;
  strongUp: number;
  strongDown: number;
  topStock: string | null;
  topStockChange: number | null;
  worstStock: string | null;
  worstStockChange: number | null;
  change1w: number | null;
  change1m: number | null;
  change3m: number | null;
  rsRatio: number | null;
  rsMomentum: number | null;
  quadrant: "Leading" | "Weakening" | "Lagging" | "Improving" | null;
  momentum: "accelerating" | "decelerating" | "stable" | null;
}

async function computeIndustryRotation(): Promise<IndustryRotationSector[]> {
  const [quotes, sectorPerf] = await Promise.all([
    fetchIndianEquityScreenerQuotes(),
    fetchSectorPerformance().catch((error) => {
      console.warn("Historical sector performance is unavailable", error);
      return [];
    }),
  ]);
  const sectorPerfMap = new Map(sectorPerf.map((performance) => [performance.sector, performance]));
  const sectorGroups = new Map<string, typeof quotes>();

  for (const quote of quotes) {
    const sector = quote.sector ?? "Unclassified";
    const stocks = sectorGroups.get(sector) ?? [];
    stocks.push(quote);
    sectorGroups.set(sector, stocks);
  }

  const result: IndustryRotationSector[] = [];
  for (const [sector, stocks] of sectorGroups) {
    let advances = 0;
    let declines = 0;
    let unchanged = 0;
    let strongUp = 0;
    let strongDown = 0;
    let totalChange = 0;
    let validCount = 0;
    let topStock: string | null = null;
    let topChange = -Infinity;
    let worstStock: string | null = null;
    let worstChange = Infinity;

    for (const stock of stocks) {
      const change = stock.regularMarketChangePercent;
      if (change == null) continue;
      totalChange += change;
      validCount++;
      if (change > 0) advances++;
      else if (change < 0) declines++;
      else unchanged++;
      if (change >= 3) strongUp++;
      if (change <= -3) strongDown++;
      if (change > topChange) {
        topChange = change;
        topStock = stock.longName ?? stock.shortName ?? stock.symbol;
      }
      if (change < worstChange) {
        worstChange = change;
        worstStock = stock.longName ?? stock.shortName ?? stock.symbol;
      }
    }

    const avgChange1d = validCount > 0 ? totalChange / validCount : null;
    const performance = sectorPerfMap.get(sector);
    const momentum = performance && avgChange1d != null
      ? avgChange1d > performance.change1w / 5
        ? "accelerating"
        : avgChange1d < performance.change1w / 5
          ? "decelerating"
          : "stable"
      : null;

    result.push({
      sector,
      stockCount: stocks.length,
      advances,
      declines,
      unchanged,
      adRatio: declines > 0 ? advances / declines : null,
      avgChange1d,
      strongUp,
      strongDown,
      topStock,
      topStockChange: topStock == null ? null : topChange,
      worstStock,
      worstStockChange: worstStock == null ? null : worstChange,
      change1w: performance?.change1w ?? null,
      change1m: performance?.change1m ?? null,
      change3m: performance?.change3m ?? null,
      rsRatio: performance?.rsRatio ?? null,
      rsMomentum: performance?.rsMomentum ?? null,
      quadrant: performance?.quadrant ?? null,
      momentum,
    });
  }

  return result.sort((a, b) => (b.avgChange1d ?? -Infinity) - (a.avgChange1d ?? -Infinity));
}

export async function GET() {
  try {
    const data = await cache.getOrSet("market:industry-rotation", computeIndustryRotation, 3 * 60 * 1000);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Industry rotation data is unavailable", error);
    return NextResponse.json(
      { error: "Industry rotation data is temporarily unavailable" },
      { status: 502 },
    );
  }
}
