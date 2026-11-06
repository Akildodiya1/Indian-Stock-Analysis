import { NextRequest, NextResponse } from "next/server";
import { fetchHistoryTable } from "@/lib/yahoo-finance";
import { cache } from "@/lib/cache";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const requestedPage = Number(req.nextUrl.searchParams.get("page") ?? 0);
  const requestedDays = Number(req.nextUrl.searchParams.get("days") ?? 330);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage >= 0
      ? requestedPage
      : 0;
  const days = requestedDays === 195 ? 195 : 330;
  try {
    const data = await cache.getOrSet(
      `stock:history-table:v3:${symbol}:${days}:${page}`,
      () => fetchHistoryTable(symbol, page, days),
      10 * 60 * 1000
    );
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Failed to load historical data for ${symbol}`, error);
    return NextResponse.json(
      { error: "Historical stock data is currently unavailable." },
      { status: 502 }
    );
  }
}
