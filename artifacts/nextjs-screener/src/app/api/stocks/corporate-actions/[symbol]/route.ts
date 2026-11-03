import { NextResponse } from "next/server";
import { cache } from "@/lib/cache";
import { fetchCorporateActions } from "@/lib/yahoo-finance";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  if (!symbol || !/^[A-Za-z0-9.^=-]+$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid stock symbol" }, { status: 400 });
  }

  try {
    const actions = await cache.getOrSet(
      `stock:corporate-actions:${symbol.toUpperCase()}`,
      () => fetchCorporateActions(symbol.toUpperCase()),
      12 * 60 * 60 * 1000,
    );
    return NextResponse.json({ symbol: symbol.toUpperCase(), actions });
  } catch (error) {
    console.error(`Corporate actions are unavailable for ${symbol}`, error);
    return NextResponse.json(
      { error: "Corporate action data is temporarily unavailable" },
      { status: 502 },
    );
  }
}
