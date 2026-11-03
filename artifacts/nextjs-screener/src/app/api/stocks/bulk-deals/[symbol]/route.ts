import { NextRequest, NextResponse } from "next/server";
import { fetchNseBulkDeals, nseDate } from "@/lib/nse";

export const dynamic = "force-dynamic";

function numeric(value?: number | string): number {
  const parsed = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const nseSymbol = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase();
  if (!nseSymbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const raw = await fetchNseBulkDeals(nseDate(90), nseDate());
    const deals = raw
      .filter((deal) => (deal.symbol ?? "").toUpperCase() === nseSymbol)
      .map((deal) => ({
        date: deal.date ?? "",
        symbol: deal.symbol ?? nseSymbol,
        name: deal.secName ?? deal.symbol ?? nseSymbol,
        clientName: deal.clientName ?? "",
        dealType: (deal.buyOrSellFlag ?? deal.buySell ?? "").toUpperCase().trim(),
        quantity: numeric(deal.quantityTraded),
        price: numeric(deal.tradePrice ?? deal.wgtAvgPrice),
        remarks: deal.remarks ?? "",
      }));
    return NextResponse.json(deals);
  } catch (error) {
    console.error(`Bulk deals unavailable for ${nseSymbol}`, error);
    return NextResponse.json(
      { error: "Bulk deal data is temporarily unavailable" },
      { status: 502 },
    );
  }
}