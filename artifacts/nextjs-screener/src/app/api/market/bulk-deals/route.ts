import { NextRequest, NextResponse } from "next/server";
import { fetchNseBulkDeals, nseDate } from "@/lib/nse";
import { cache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export interface BulkDeal {
  date: string;
  symbol: string;
  name: string;
  clientName: string;
  dealType: "BUY" | "SELL" | string;
  quantity: number;
  price: number;
  remarks: string;
}

async function fetchBulkDeals(fromDate: string, toDate: string): Promise<BulkDeal[]> {
  const raw = await fetchNseBulkDeals(fromDate, toDate);
  return raw.map((r) => ({
    date: r.date ?? "",
    symbol: r.symbol ?? "",
    name: r.secName ?? r.symbol ?? "",
    clientName: r.clientName ?? "",
    dealType: (r.buyOrSellFlag ?? r.buySell ?? "").toUpperCase().trim(),
    quantity: parseNumeric(r.quantityTraded),
    price: parseNumeric(r.tradePrice ?? r.wgtAvgPrice),
    remarks: r.remarks ?? "",
  }));
}

function parseNumeric(value: number | string | undefined): number {
  const parsed = typeof value === "string"
    ? Number.parseFloat(value.replace(/,/g, ""))
    : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fromDate = sp.get("from_date") ?? nseDate(30);
  const toDate = sp.get("to_date") ?? nseDate();
  const cacheKey = `market:bulk-deals:${fromDate}:${toDate}`;
  try {
    const data = await cache.getOrSet(cacheKey, () => fetchBulkDeals(fromDate, toDate), 5 * 60 * 1000);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Bulk deal data is unavailable", error);
    return NextResponse.json({ error: "Bulk deal data is temporarily unavailable" }, { status: 502 });
  }
}
