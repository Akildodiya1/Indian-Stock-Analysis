import { NextRequest, NextResponse } from "next/server";
import { fetchNseApi, nseDate } from "@/lib/nse";

export const dynamic = "force-dynamic";

interface NseBulkDeal {
  date?: string;
  symbol?: string;
  secName?: string;
  clientName?: string;
  buySell?: string;
  quantityTraded?: number | string;
  wgtAvgPrice?: number | string;
  remarks?: string;
}

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
    const raw = await fetchNseApi<NseBulkDeal[]>(
      `bulk-deals-archives?from_date=${encodeURIComponent(nseDate(90))}&to_date=${encodeURIComponent(nseDate())}`,
    );
    const deals = (Array.isArray(raw) ? raw : [])
      .filter((deal) => (deal.symbol ?? "").toUpperCase() === nseSymbol)
      .map((deal) => ({
        date: deal.date ?? "",
        symbol: deal.symbol ?? nseSymbol,
        name: deal.secName ?? deal.symbol ?? nseSymbol,
        clientName: deal.clientName ?? "",
        dealType: (deal.buySell ?? "").toUpperCase().trim(),
        quantity: numeric(deal.quantityTraded),
        price: numeric(deal.wgtAvgPrice),
        remarks: deal.remarks ?? "",
      }));
    return NextResponse.json(deals);
  } catch {
    return NextResponse.json([]);
  }
}