import { NextResponse } from "next/server";
import { fetchNseApi } from "@/lib/nse";
import { fetchIndianEquityScreenerQuotes } from "@/lib/yahoo-finance";
import { cache } from "@/lib/cache";

export const dynamic = "force-dynamic";

interface NseTopCorpInfo {
  data?: NseTopCorpInfo;
  promoterHoldingPct?: number;
  promoterPledgedPct?: number;
  institutionalHoldingPct?: number;
  retailHoldingPct?: number;
  promoterChange?: number;
  qtrName?: string;
  shareholdings_patterns?: {
    data?: Record<string, Record<string, string | number>[]>;
  };
}

export interface PromoterRecord {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  promoterHolding: number | null;
  promoterPledged: number | null;
  institutionalHolding: number | null;
  publicHolding: number | null;
  quarterlyChange: number | null;
  trend: "buying" | "selling" | "neutral";
}

function numeric(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number.parseFloat(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function getHolding(
  rows: Record<string, string | number>[],
  key: string,
): number | null {
  for (const row of rows) {
    const match = Object.entries(row).find(
      ([label]) => label.trim().toLowerCase() === key.toLowerCase(),
    );
    if (match) return numeric(match[1]);
  }
  return null;
}

function getHoldingPeriods(data: NseTopCorpInfo) {
  return Object.entries(data.shareholdings_patterns?.data ?? {})
    .map(([date, rows]) => ({
      date,
      timestamp: Date.parse(date),
      rows,
    }))
    .filter((period) => Number.isFinite(period.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
}

// Fetch promoter holding data for a single stock from NSE
async function fetchOnePromoterHolding(symbol: string): Promise<NseTopCorpInfo | null> {
  const nseSymbol = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase();
  try {
    const response = await fetchNseApi<NseTopCorpInfo>(
      `top-corp-info?symbol=${encodeURIComponent(nseSymbol)}&market=equities`,
    );
    return response.data ?? response;
  } catch (error) {
    console.warn(`Promoter data unavailable for ${nseSymbol}`, error);
    return null;
  }
}

async function fetchPromoterActivity(): Promise<PromoterRecord[]> {
  const topStocks = (await fetchIndianEquityScreenerQuotes())
    .filter((quote) => quote.marketCap != null)
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .slice(0, 30);

  const results: PromoterRecord[] = [];
  for (let index = 0; index < topStocks.length; index += 5) {
    const batch = await Promise.all(
      topStocks.slice(index, index + 5).map(async (stock): Promise<PromoterRecord | null> => {
        const info = await fetchOnePromoterHolding(stock.symbol);
        if (!info) return null;
        const periods = getHoldingPeriods(info);
        const latest = periods[periods.length - 1];
        const previous = periods[periods.length - 2];
        const latestPromoter = latest
          ? getHolding(latest.rows, "Promoter & Promoter Group")
          : null;
        const previousPromoter = previous
          ? getHolding(previous.rows, "Promoter & Promoter Group")
          : null;
        const promoterHolding = info.promoterHoldingPct ?? latestPromoter;
        if (promoterHolding == null) return null;
        const change = info.promoterChange ?? (
          latestPromoter != null && previousPromoter != null
            ? latestPromoter - previousPromoter
            : null
        );
        const trend: "buying" | "selling" | "neutral" =
          change != null && change > 0.1 ? "buying"
            : change != null && change < -0.1 ? "selling"
              : "neutral";
        return {
          symbol: stock.symbol,
          name: stock.longName ?? stock.shortName ?? stock.symbol,
          exchange: "NSE",
          sector: stock.sector ?? "Unclassified",
          promoterHolding,
          promoterPledged: info.promoterPledgedPct ?? (
            latest ? getHolding(latest.rows, "Shares pledged or otherwise encumbered") : null
          ),
          institutionalHolding: info.institutionalHoldingPct ?? (
            latest ? getHolding(latest.rows, "Institutional Investors") : null
          ),
          publicHolding: info.retailHoldingPct ?? (
            latest ? getHolding(latest.rows, "Public") : null
          ),
          quarterlyChange: change,
          trend,
        };
      }),
    );
    results.push(...batch.filter((record): record is PromoterRecord => record !== null));
  }

  if (results.length === 0) throw new Error("NSE returned no promoter holding data");

  return results;
}

export async function GET() {
  try {
    const data = await cache.getOrSet("market:promoter-activity", fetchPromoterActivity, 15 * 60 * 1000);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Promoter activity is unavailable", error);
    return NextResponse.json({ error: "Promoter activity is temporarily unavailable" }, { status: 502 });
  }
}
