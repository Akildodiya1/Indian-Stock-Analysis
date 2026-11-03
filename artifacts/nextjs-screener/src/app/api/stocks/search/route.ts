import { NextRequest, NextResponse } from "next/server";
import { searchYahoo } from "@/lib/yahoo-finance";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json([]);

  try {
    const results = await searchYahoo(query);
    const seen = new Set<string>();
    const matches = results
      .filter((result) => /\.(NS|BO)$/i.test(result.symbol))
      .filter((result) => {
        const key = result.symbol.toUpperCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
    return NextResponse.json(matches);
  } catch (error) {
    console.error("Stock search is unavailable", error);
    return NextResponse.json({ error: "Stock search is temporarily unavailable" }, { status: 502 });
  }
}
