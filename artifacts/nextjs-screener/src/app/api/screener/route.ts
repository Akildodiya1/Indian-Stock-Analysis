import { NextRequest, NextResponse } from "next/server";
import { fetchQuotes, searchYahoo } from "@/lib/yahoo-finance";
import { NSE_STOCKS } from "@/lib/stock-list";
import { cache } from "@/lib/cache";
import { fetchScreenerFundamentals } from "@/lib/screener-fundamentals";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const exchange = sp.get("exchange") ?? "";
  const sector = sp.get("sector") ?? "";
  const minPe = sp.get("minPe") ? parseFloat(sp.get("minPe")!) : null;
  const maxPe = sp.get("maxPe") ? parseFloat(sp.get("maxPe")!) : null;
  const minPb = sp.get("minPb") ? parseFloat(sp.get("minPb")!) : null;
  const maxPb = sp.get("maxPb") ? parseFloat(sp.get("maxPb")!) : null;
  const minMarketCapCr = sp.get("minMarketCapCr")
    ? parseFloat(sp.get("minMarketCapCr")!)
    : null;
  const sortBy = sp.get("sortBy") ?? "marketCap";
  const sortOrder = sp.get("sortOrder") ?? "desc";
  const limitParam = sp.get("limit");
  const limit = limitParam ? parseInt(limitParam) : null;
  const searchQuery = (sp.get("search") ?? sp.get("q") ?? "").trim();

  let stocks: Array<{
    symbol: string;
    name: string;
    exchange: string;
    sector: string;
  }> = [];

  if (searchQuery) {
    // Start with the known Indian list so exact symbols such as BEL and
    // RELIANCE keep their sector/exchange metadata even if Yahoo search is
    // slow or returns a global match first.
    const normalizedQuery = searchQuery.toLowerCase();
    const knownMatches = NSE_STOCKS.filter((stock) => {
      const baseSymbol = stock.symbol.replace(/\.(NS|BO)$/i, "").toLowerCase();
      return (
        baseSymbol.includes(normalizedQuery) ||
        stock.name.toLowerCase().includes(normalizedQuery)
      );
    });

    // Supplement with Yahoo live search for stocks outside the bundled list.
    const searchResults = await searchYahoo(searchQuery, 200);
    const yahooMatches = searchResults
      .filter((q) => q.typeDisp === "equity" || q.typeDisp === "Equity")
      .map((q) => ({
        symbol: q.symbol,
        name: q.shortname || q.symbol,
        exchange:
          q.exchDisp === "NSE"
            ? "NSE"
            : q.exchDisp === "BSE"
              ? "BSE"
              : q.exchDisp || "",
        sector: q.sector ?? "",
      }))
      .filter((s) => s.exchange === "NSE" || s.exchange === "BSE");

    const merged = new Map<string, (typeof knownMatches)[number] | (typeof yahooMatches)[number]>();
    for (const stock of knownMatches) merged.set(stock.symbol, stock);
    for (const stock of yahooMatches) {
      if (!merged.has(stock.symbol)) merged.set(stock.symbol, stock);
    }

    stocks = [...merged.values()].filter((s) => {
        if (exchange && exchange !== "ALL" && s.exchange !== exchange)
          return false;
        if (sector && s.sector !== sector) return false;
        return true;
      });
  } else {
    // No search query — use the static stock list and filter by exchange/sector
    stocks = NSE_STOCKS.filter((s) => {
      if (exchange && exchange !== "ALL" && s.exchange !== exchange) return false;
      if (sector && s.sector !== sector) return false;
      return true;
    });
  }

  const symbols = stocks.map((s) => s.symbol);
  const cacheKey = `screener:quotes:${symbols.join(",")}`;

  const quotes = await cache.getOrSet(
    cacheKey,
    () => fetchQuotes(symbols),
    120_000,
  );

  const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));
  const fundamentalsMap = await fetchScreenerFundamentals(symbols);

  const results = stocks
    .map((s) => {
      const q = quoteMap.get(s.symbol);
      const f = fundamentalsMap.get(s.symbol);
      return {
        symbol: s.symbol,
        name: s.name,
        exchange: s.exchange,
        sector: s.sector,
        regularMarketPrice: q?.regularMarketPrice,
        regularMarketChange: q?.regularMarketChange,
        regularMarketChangePercent: q?.regularMarketChangePercent,
        regularMarketVolume: q?.regularMarketVolume,
        marketCap: q?.marketCap ?? f?.marketCap,
        trailingPE: q?.trailingPE ?? f?.trailingPE,
        priceToBook: q?.priceToBook ?? f?.priceToBook,
        dividendYield: q?.dividendYield ?? f?.dividendYield,
        returnOnEquity: q?.returnOnEquity ?? f?.returnOnEquity,
      };
    })
    .filter((s) => {
      if (minPe !== null && s.trailingPE != null && s.trailingPE < minPe)
        return false;
      if (maxPe !== null && s.trailingPE != null && s.trailingPE > maxPe)
        return false;
      if (minPb !== null && s.priceToBook != null && s.priceToBook < minPb)
        return false;
      if (maxPb !== null && s.priceToBook != null && s.priceToBook > maxPb)
        return false;
      if (minMarketCapCr !== null) {
        const capCr = s.marketCap != null ? s.marketCap / 1e7 : null;
        if (capCr != null && capCr < minMarketCapCr) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const key = sortBy as keyof typeof a;
      const av =
        (a[key] as number | undefined) ??
        (sortOrder === "asc" ? Infinity : -Infinity);
      const bv =
        (b[key] as number | undefined) ??
        (sortOrder === "asc" ? Infinity : -Infinity);
      return sortOrder === "asc" ? av - bv : bv - av;
    });

  const pagedResults = limit ? results.slice(0, limit) : results;

  return NextResponse.json(pagedResults);
}
