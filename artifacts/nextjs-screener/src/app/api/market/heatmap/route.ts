import { NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import { fetchIndianEquityScreenerQuotes } from "@/lib/yahoo-finance";

interface HeatmapStock {
  symbol: string;
  name: string;
  sector: string | null;
  change1d: number | null;
}

interface HeatmapIndustry {
  industry: string;
  stockCount: number;
  pricedCount: number;
  change1d: number | null;
  stocks: HeatmapStock[];
}

interface HeatmapData {
  totalStocks: number;
  industryCount: number;
  unclassifiedCount: number;
  industries: HeatmapIndustry[];
}

async function buildHeatmap(): Promise<HeatmapData> {
  const quotes = await fetchIndianEquityScreenerQuotes();
  const groups = new Map<string, HeatmapStock[]>();

  for (const quote of quotes) {
    const industry = quote.industry?.trim() || "Unclassified";
    const stocks = groups.get(industry) ?? [];
    stocks.push({
      symbol: quote.symbol,
      name: quote.shortName ?? quote.longName ?? quote.symbol,
      sector: quote.sector?.trim() || null,
      change1d:
        typeof quote.regularMarketChangePercent === "number"
          ? quote.regularMarketChangePercent
          : null,
    });
    groups.set(industry, stocks);
  }

  const industries = [...groups.entries()]
    .map(([industry, stocks]) => {
      const pricedStocks = stocks.filter(
        (stock): stock is HeatmapStock & { change1d: number } =>
          stock.change1d !== null,
      );
      return {
        industry,
        stockCount: stocks.length,
        pricedCount: pricedStocks.length,
        change1d:
          pricedStocks.length > 0
            ? pricedStocks.reduce((total, stock) => total + stock.change1d, 0) /
              pricedStocks.length
            : null,
        stocks: stocks.sort((a, b) => a.name.localeCompare(b.name)),
      };
    })
    .sort((a, b) => {
      if (a.industry === "Unclassified") return 1;
      if (b.industry === "Unclassified") return -1;
      return a.industry.localeCompare(b.industry);
    });

  return {
    totalStocks: quotes.length,
    industryCount: industries.filter(
      (item) => item.industry !== "Unclassified",
    ).length,
    unclassifiedCount:
      industries.find((item) => item.industry === "Unclassified")?.stockCount ??
      0,
    industries,
  };
}

export async function GET() {
  try {
    const data = await cache.getOrSet(
      "market:heatmap:all-nse-industries",
      buildHeatmap,
      15 * 60 * 1000,
    );
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Unable to load the complete NSE industry heatmap." },
      { status: 502 },
    );
  }
}
