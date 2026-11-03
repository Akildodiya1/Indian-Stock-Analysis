"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { apiUrl } from "@/lib/api-url";

interface IndexAnalytics {
  symbol: string;
  name: string;
  asOfDate: string;
  close: number;
  change1m: number | null;
  change3m: number | null;
  change6m: number | null;
  change1y: number | null;
  change5y: number | null;
  high5y: number;
  low5y: number;
  drawdown5y: number;
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function valueClass(value: number | null): string {
  if (value == null || value === 0) return "text-muted-foreground";
  return value > 0 ? "text-emerald-500" : "text-red-500";
}

export default function IndexAnalyticsPage() {
  const { data, isLoading, isError } = useQuery<IndexAnalytics[]>({
    queryKey: ["market", "index-analytics"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/index-analytics"));
      if (!response.ok) throw new Error("Index analytics are unavailable");
      return response.json();
    },
    staleTime: 12 * 60 * 60 * 1000,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BarChart3 className="h-6 w-6 text-primary" />
          Index Analytics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          NSE and BSE benchmark performance from daily closing prices. Data is
          refreshed twice daily and may reflect the previous trading session.
        </p>
      </header>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading daily index history…
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-lg border border-amber-500/30 bg-card p-8 text-center text-sm text-amber-500">
          Index analytics are temporarily unavailable.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-225 text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Index</th>
                <th className="px-4 py-3 text-right font-medium">Daily close</th>
                <th className="px-4 py-3 text-right font-medium">1M</th>
                <th className="px-4 py-3 text-right font-medium">3M</th>
                <th className="px-4 py-3 text-right font-medium">6M</th>
                <th className="px-4 py-3 text-right font-medium">1Y</th>
                <th className="px-4 py-3 text-right font-medium">5Y</th>
                <th className="px-4 py-3 text-right font-medium">5Y drawdown</th>
                <th className="px-4 py-3 text-right font-medium">As of</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((index) => (
                <tr key={index.symbol} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{index.name}</div>
                    <div className="text-xs text-muted-foreground">{index.symbol}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {index.close.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </td>
                  {[index.change1m, index.change3m, index.change6m, index.change1y, index.change5y].map(
                    (change, i) => (
                      <td key={i} className={`px-4 py-3 text-right tabular-nums ${valueClass(change)}`}>
                        {formatPercent(change)}
                      </td>
                    ),
                  )}
                  <td className="px-4 py-3 text-right tabular-nums text-red-500">
                    {formatPercent(index.drawdown5y)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {index.asOfDate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs text-muted-foreground">
            Returns compare the latest available daily close with the close
            approximately 21, 63, 126, or 252 trading sessions earlier. The
            5Y return uses the closest available close to five calendar years
            earlier.
          </p>
        </div>
      )}
    </div>
  );
}
