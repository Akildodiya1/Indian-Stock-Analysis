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
  quoteUnavailable?: boolean;
}

async function expectOk(response: Response): Promise<void> {
  if (!response.ok) {
    let message = `Watchlist service unavailable (HTTP ${response.status})`;
    try {
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
      ) {
        message = body.error;
      }
    } catch {
      // Keep the HTTP status message when the server does not return JSON.
    }
    if (response.status === 503 && message === "Database not configured") {
      message =
        "Database not configured. Set DATABASE_URL, run `pnpm --filter @workspace/db push`, and restart the app.";
    }
    throw new Error(message);
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
