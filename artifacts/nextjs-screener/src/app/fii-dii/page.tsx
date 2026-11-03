"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, TrendingUp, TrendingDown, RefreshCw, Info } from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";

interface FiiDiiEntry {
  category: string;
  buyValue: number;
  sellValue: number;
  netValue: number;
  date: string | null;
}

function fmtCr(n: number) {
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L Cr`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(2)}K Cr`;
  return `₹${n.toFixed(2)} Cr`;
}

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(222,47%,10%)",
  border: "1px solid hsl(217,33%,17%)",
  borderRadius: 6, fontSize: 11, color: "hsl(213,31%,91%)",
};

export default function FiiDiiPage() {
  const { data: entries = [], isLoading, isFetching, isError, dataUpdatedAt, refetch } = useQuery<FiiDiiEntry[]>({
    queryKey: ["market", "fii-dii"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/fii-dii"));
      if (!response.ok) throw new Error("FII/DII data request failed");
      return response.json();
    },
    refetchInterval: 10 * 60 * 1000,
  });

  const fii = entries.find(e => e.category.toLowerCase().includes("fii") || e.category.toLowerCase().includes("fpi"));
  const dii = entries.find(e => e.category.toLowerCase().includes("dii"));

  const todayBarData = entries.map(e => ({
    name: e.category,
    Buy: e.buyValue,
    Sell: e.sellValue,
    Net: e.netValue,
  }));

  const date = fii?.date ?? dii?.date ?? null;

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            FII / DII Activity
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Foreign & Domestic Institutional Investor daily flows · NSE India
          </p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
          {dataUpdatedAt ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString("en-IN")}` : "Refresh"}
        </button>
      </div>

      {isError && (
        <div role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-500">
          Live NSE FII/DII data is currently unavailable. Please try again later.
        </div>
      )}

      {/* FII / DII hero cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[fii, dii].map((e, idx) => {
          if (!e && !isLoading) return null;
          const isFii = idx === 0;
          const label = isFii ? "FII / FPI" : "DII";
          const isNetBuy = (e?.netValue ?? 0) >= 0;
          return (
            <div key={label} className={`rounded-xl border p-5 ${isFii ? "border-blue-500/20 bg-blue-500/5" : "border-purple-500/20 bg-purple-500/5"}`}>
              {e ? (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <div className={`text-sm font-bold uppercase tracking-wide ${isFii ? "text-blue-400" : "text-purple-400"}`}>{label}</div>
                    {isFetching ? (
                      <span className="text-[10px] bg-yellow-500/10 text-yellow-400 rounded-full px-2 py-0.5">
                        Updating…
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">{date ?? "Date not provided by NSE"}</div>
                  <div className="flex items-center gap-2 mb-4">
                    {isNetBuy ? <TrendingUp className="h-5 w-5 text-green-500" /> : <TrendingDown className="h-5 w-5 text-red-500" />}
                    <span className={`text-2xl font-bold tabular-nums ${isNetBuy ? "text-green-500" : "text-red-500"}`}>
                      {e.netValue >= 0 ? "+" : ""}{fmtCr(e.netValue)}
                    </span>
                    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${isNetBuy ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                      {isNetBuy ? "NET BUY" : "NET SELL"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-green-500/10 p-3">
                      <div className="text-xs text-muted-foreground mb-1">Buy Value</div>
                      <div className="font-bold tabular-nums text-green-400">{fmtCr(e.buyValue)}</div>
                    </div>
                    <div className="rounded-lg bg-red-500/10 p-3">
                      <div className="text-xs text-muted-foreground mb-1">Sell Value</div>
                      <div className="font-bold tabular-nums text-red-400">{fmtCr(e.sellValue)}</div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Net Combined signal */}
      {fii && dii && (
        <div className={`rounded-lg border p-4 flex items-center gap-4 flex-wrap ${
          fii.netValue + dii.netValue >= 0 ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"
        }`}>
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">Combined FII + DII Net Flow</div>
            <div className={`text-2xl font-bold tabular-nums ${fii.netValue + dii.netValue >= 0 ? "text-green-400" : "text-red-400"}`}>
              {fii.netValue + dii.netValue >= 0 ? "+" : ""}{fmtCr(fii.netValue + dii.netValue)}
            </div>
          </div>
          <div className="border-l pl-4">
            <div className="text-xs text-muted-foreground mb-0.5">Market Signal</div>
            <div className={`font-bold text-sm ${fii.netValue + dii.netValue >= 0 ? "text-green-400" : "text-red-400"}`}>
              {fii.netValue > 0 && dii.netValue > 0
                ? "🟢 Both Buying — Strong Bullish"
                : fii.netValue < 0 && dii.netValue < 0
                ? "🔴 Both Selling — Strong Bearish"
                : fii.netValue > 0
                ? "🟡 FII Buying / DII Selling — Mixed"
                : "🟠 DII Buying / FII Selling — Mixed"}
            </div>
          </div>
        </div>
      )}

      {/* Today's buy/sell/net bar chart */}
      {todayBarData.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold text-sm mb-4">Today&apos;s Buy vs Sell vs Net (₹ Cr)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={todayBarData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(215,20%,55%)" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => fmtCr(v)} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="Buy" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Sell" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Net" radius={[4, 4, 0, 0]}>
                {todayBarData.map((entry, i) => (
                  <Cell key={i} fill={entry.Net >= 0 ? "#22d3ee" : "#f59e0b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Explainer */}
      <div className="rounded-lg border bg-card p-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1 leading-relaxed">
          <p><strong className="text-foreground">FII (Foreign Institutional Investors)</strong> — Overseas funds, hedge funds, and institutions investing in Indian markets. Heavy FII buying is broadly bullish; selling puts pressure on markets.</p>
          <p><strong className="text-foreground">DII (Domestic Institutional Investors)</strong> — Indian MFs, insurance companies, banks. DIIs often buy when FIIs sell, providing stability.</p>
          <p><strong className="text-foreground">Data source:</strong> NSE India daily provisional figures. Updated after market close. Values in ₹ Crore.</p>
        </div>
      </div>
    </div>
  );
}
