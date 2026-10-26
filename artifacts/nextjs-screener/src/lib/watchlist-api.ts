import { apiUrl } from "@/lib/api-url";

export interface WatchlistItem {
  symbol: string;
  addedAt: string;
  addedPrice?: number;
  currentPrice?: number;
  priceDiff?: number;
  pricePct?: number;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  shortName?: string;
}

async function expectOk(response: Response): Promise<void> {
  if (!response.ok) {
    if (response.status === 503) {
      throw new Error("Watchlist database is not configured or unavailable (HTTP 503)");
    }
    throw new Error(`Watchlist service unavailable (HTTP ${response.status})`);
  }
}

export async function getWatchlist(): Promise<WatchlistItem[]> {
  const response = await fetch(apiUrl("/watchlist"));
  await expectOk(response);

  const data: unknown = await response.json();
  if (
    !Array.isArray(data) ||
    !data.every(
      (item): item is WatchlistItem =>
        typeof item === "object" &&
        item !== null &&
        "symbol" in item &&
        typeof item.symbol === "string" &&
        "addedAt" in item &&
        typeof item.addedAt === "string",
    )
  ) {
    throw new Error("Watchlist API returned invalid data");
  }

  return data;
}

export async function addWatchlistItem(symbol: string): Promise<void> {
  const response = await fetch(apiUrl("/watchlist"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol }),
  });
  await expectOk(response);
}

export async function removeWatchlistItem(symbol: string): Promise<void> {
  const response = await fetch(
    apiUrl(`/watchlist/${encodeURIComponent(symbol)}`),
    { method: "DELETE" },
  );
  await expectOk(response);
}
