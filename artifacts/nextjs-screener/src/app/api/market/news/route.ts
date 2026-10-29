import { NextResponse } from "next/server";
import { fetchMarketNews } from "@/lib/yahoo-finance";
import { cache } from "@/lib/cache";

export async function GET() {
  try {
    const news = await cache.getOrSet("market:news:v2", () => fetchMarketNews(30), 5 * 60 * 1000);
    return NextResponse.json(news);
  } catch (error) {
    console.error("Market news is unavailable", error);
    return NextResponse.json(
      { error: "Market news is temporarily unavailable" },
      { status: 502 },
    );
  }
}
