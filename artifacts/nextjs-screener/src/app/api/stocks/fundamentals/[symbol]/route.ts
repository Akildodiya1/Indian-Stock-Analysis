import { NextRequest, NextResponse } from "next/server";
import {
  fetchFinancialRatios,
  fetchNseData,
  fetchQuotes,
  fetchSummary,
  searchYahoo,
} from "@/lib/yahoo-finance";
import { cache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  if (!symbol)
    return NextResponse.json({ error: "symbol required" }, { status: 400 });

  const cacheKey = `stock:fundamentals:${symbol}`;
  const data = await cache.getOrSet(
    cacheKey,
    async () => {
      const normalizedSymbol = symbol.replace(/\.(NS|BO)$/i, "").toUpperCase();
      let canonicalSymbol = `${normalizedSymbol}.NS`;

      const searchResults = await searchYahoo(normalizedSymbol);
      const nseMatch = searchResults.find((result) =>
        result.symbol.toUpperCase().endsWith(".NS"),
      );
      if (nseMatch) canonicalSymbol = nseMatch.symbol;

      const [summary, [quote], nse, financialRatios] = await Promise.all([
        fetchSummary(canonicalSymbol),
        fetchQuotes([canonicalSymbol]),
        fetchNseData(canonicalSymbol),
        fetchFinancialRatios(canonicalSymbol),
      ]);
      const trailingPE =
        summary.summaryDetail?.trailingPE?.raw ?? quote?.trailingPE ?? nse.pe;
      const earningsGrowth =
        summary.defaultKeyStatistics?.earningsQuarterlyGrowth?.raw;

      return {
        trailingPE,
        forwardPE: summary.summaryDetail?.forwardPE?.raw ?? quote?.forwardPE,
        priceToBook:
          summary.defaultKeyStatistics?.priceToBook?.raw ?? quote?.priceToBook,
        trailingEps:
          summary.defaultKeyStatistics?.trailingEps?.raw ??
          quote?.trailingEps ??
          (quote?.regularMarketPrice && nse.pe
            ? quote.regularMarketPrice / nse.pe
            : undefined),
        forwardEps:
          summary.defaultKeyStatistics?.forwardEps?.raw ??
          (quote && quote.forwardPE && quote.regularMarketPrice
            ? quote.regularMarketPrice / quote.forwardPE
            : undefined),
        pegRatio:
          summary.defaultKeyStatistics?.pegRatio?.raw ??
          (trailingPE != null && earningsGrowth != null && earningsGrowth > 0
            ? trailingPE / (earningsGrowth * 100)
            : undefined),
        beta:
          summary.summaryDetail?.beta?.raw ??
          summary.defaultKeyStatistics?.beta?.raw ??
          quote?.beta,
        dividendYield:
          summary.summaryDetail?.dividendYield?.raw ?? quote?.dividendYield,
        dividendRate:
          summary.summaryDetail?.dividendRate?.raw ?? quote?.dividendRate,
        payoutRatio: summary.summaryDetail?.payoutRatio?.raw,
        marketCap:
          summary.summaryDetail?.marketCap?.raw ??
          quote?.marketCap ??
          (nse.marketCapCrores != null
            ? nse.marketCapCrores * 1_000_000_00
            : undefined),
        returnOnEquity:
          summary.financialData?.returnOnEquity?.raw ??
          quote?.returnOnEquity ??
          financialRatios.returnOnEquity,
        returnOnAssets:
          summary.financialData?.returnOnAssets?.raw ??
          financialRatios.returnOnAssets,
        grossMargins: summary.financialData?.grossMargins?.raw,
        operatingMargins: summary.financialData?.operatingMargins?.raw,
        profitMargins: summary.financialData?.profitMargins?.raw,
        currentRatio:
          summary.financialData?.currentRatio?.raw ??
          financialRatios.currentRatio,
        debtToEquity: summary.financialData?.debtToEquity?.raw,
        revenueGrowth: summary.financialData?.revenueGrowth?.raw,
        totalRevenue: summary.financialData?.totalRevenue?.raw,
        freeCashflow: summary.financialData?.freeCashflow?.raw,
        totalCash: summary.financialData?.totalCash?.raw,
        targetMeanPrice: summary.financialData?.targetMeanPrice?.raw,
        recommendationKey: summary.financialData?.recommendationKey,
        sector:
          summary.assetProfile?.sector ??
          quote?.sector ??
          nse.sector,
        industry:
          summary.assetProfile?.industry ?? quote?.industry ?? nse.industry,
        longBusinessSummary: summary.assetProfile?.longBusinessSummary,
        country: summary.assetProfile?.country,
        fullTimeEmployees: summary.assetProfile?.fullTimeEmployees,
        website: summary.assetProfile?.website,
      };
    },
    300_000,
  );

  return NextResponse.json(data);
}
