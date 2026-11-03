"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Activity, Flame, DollarSign, Globe } from "lucide-react";
import Link from "next/link";
import { apiUrl } from "@/lib/api-url";
import {
  formatPrice,
  formatChangePercent,
  changeColor,
  changeBg,
  displaySymbol,
} from "@/lib/format";

interface Quote {
  symbol: string;
  name?: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  marketCap?: number;
}

interface MultiAsset {
  symbol: string;
  name: string;
  type: string;
  unit: string;
  price: number;
  change: number;
  changePct: number;
}

interface GlobalIndex {
  symbol: string;
  name: string;
  region: string;
  price: number;
  change: number;
  changePct: number;
}

function IndexCard({ q }: { q: Quote }) {
  const chg = q.regularMarketChangePercent ?? 0;
  const isPos = chg >= 0;
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
          {q.name ?? q.shortName ?? displaySymbol(q.symbol)}
        </span>
        <span className={`flex items-center gap-0.5 text-xs font-medium rounded-full px-2 py-0.5 shrink-0 ${changeBg(chg)}`}>
          {isPos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {formatChangePercent(chg)}
        </span>
      </div>
      <div className="text-xl font-bold tabular-nums text-foreground">
        {formatPrice(q.regularMarketPrice)}
      </div>
      <div className={`text-xs tabular-nums ${changeColor(chg)}`}>
        {q.regularMarketChange != null
          ? `${chg >= 0 ? "+" : ""}${q.regularMarketChange.toFixed(2)} today`
          : ""}
      </div>
    </div>
  );
}

function AssetCard({ a }: { a: MultiAsset }) {
  const isPos = a.changePct >= 0;
  const iconMap: Record<string, string> = {
    commodity: "🛢️",
    currency: "💱",
    bond: "📊",
    volatility: "⚡",
  };
  return (
    <div className="rounded-lg border bg-card p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate flex items-center gap-1">
          <span>{iconMap[a.type] ?? "📈"}</span>
          {a.name}
        </span>
        <span className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 shrink-0 ${changeBg(a.changePct)}`}>
          {isPos ? "+" : ""}{a.changePct.toFixed(2)}%
        </span>
      </div>
      <div className="text-lg font-bold tabular-nums">
        {a.price > 0 ? a.price.toFixed(a.type === "bond" || a.type === "volatility" ? 2 : 2) : "—"}
        {a.unit && <span className="text-[10px] text-muted-foreground ml-1">{a.unit}</span>}
      </div>
      <div className={`text-xs tabular-nums ${changeColor(a.changePct)}`}>
        {isPos ? "+" : ""}{a.change.toFixed(2)} today
      </div>
    </div>
  );
}

function GlobalCard({ g }: { g: GlobalIndex }) {
  const isPos = g.changePct >= 0;
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-accent/30 transition-colors">
      <div>
        <div className="text-sm font-semibold">{g.name}</div>
        <div className="text-xs text-muted-foreground">{g.symbol}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold tabular-nums">
          {g.price > 1000 ? g.price.toLocaleString("en-US", { maximumFractionDigits: 0 }) : g.price.toFixed(2)}
        </div>
        <div className={`text-xs tabular-nums ${changeColor(g.changePct)}`}>
          {isPos ? "+" : ""}{g.changePct.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

function StockRow({ q, rank }: { q: Quote; rank: number }) {
  const chg = q.regularMarketChangePercent ?? 0;
  return (
    <Link
      href={`/stock/${encodeURIComponent(q.symbol)}`}
      className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent/50 transition-colors group"
    >
      <span className="w-5 text-center text-xs text-muted-foreground font-mono">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm group-hover:text-primary transition-colors">
          {displaySymbol(q.symbol)}
        </div>
        <div className="text-xs text-muted-foreground truncate">{q.shortName ?? ""}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-bold tabular-nums">{formatPrice(q.regularMarketPrice)}</div>
        <div className={`text-xs font-medium tabular-nums ${changeColor(chg)}`}>
          {formatChangePercent(chg)}
        </div>
      </div>
    </Link>
  );
}

function MoverSection({
  title, icon: Icon, iconClass, data, isLoading, isError,
}: {
  title: string; icon: React.ElementType; iconClass: string; data?: Quote[]; isLoading: boolean; isError: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Icon className={`h-4 w-4 ${iconClass}`} />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="flex-1 p-2">
        {isLoading ? (
          <div className="space-y-1.5 p-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 rounded-md bg-accent/40 animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div role="alert" className="py-8 text-center text-xs text-amber-500">Live data unavailable</div>
        ) : (data ?? []).length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">No data available</div>
        ) : (
          <div className="space-y-0.5">
            {(data ?? []).slice(0, 10).map((q, i) => (
              <StockRow key={q.symbol} q={q} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const REGIONS = ["US", "EU", "Asia"] as const;
type Region = (typeof REGIONS)[number];

export default function MarketPage() {
  const [globalRegion, setGlobalRegion] = useState<Region>("US");

  const { data: indices, isLoading: indicesLoading, isError: indicesError } = useQuery<Quote[]>({
    queryKey: ["market", "overview"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/overview"));
      if (!response.ok) throw new Error("Market overview request failed");
      return response.json();
    },
  });

  const { data: gainers, isLoading: gainersLoading, isError: gainersError } = useQuery<Quote[]>({
    queryKey: ["market", "top-gainers"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/top-gainers"));
      if (!response.ok) throw new Error("Top gainers request failed");
      return response.json();
    },
  });

  const { data: losers, isLoading: losersLoading, isError: losersError } = useQuery<Quote[]>({
    queryKey: ["market", "top-losers"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/top-losers"));
      if (!response.ok) throw new Error("Top losers request failed");
      return response.json();
    },
  });

  const { data: active, isLoading: activeLoading, isError: activeError } = useQuery<Quote[]>({
    queryKey: ["market", "most-active"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/most-active"));
      if (!response.ok) throw new Error("Most-active stocks request failed");
      return response.json();
    },
  });

  const { data: multiAsset, isLoading: multiLoading, isError: multiError } = useQuery<MultiAsset[]>({
    queryKey: ["market", "multi-asset"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/multi-asset"));
      if (!response.ok) throw new Error("Multi-asset request failed");
      return response.json();
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { data: globalIndices, isLoading: globalLoading, isError: globalError } = useQuery<GlobalIndex[]>({
    queryKey: ["market", "global"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/global"));
      if (!response.ok) throw new Error("Global markets request failed");
      return response.json();
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const vix = multiAsset?.find((a) => a.symbol === "^INDIAVIX");
  const otherAssets = multiAsset?.filter((a) => a.symbol !== "^INDIAVIX") ?? [];
  const regionIndices = (globalIndices ?? []).filter((g) => g.region === globalRegion);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Market Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Live NSE/BSE indices, multi-asset, and global markets</p>
        </div>
        {vix && (
          <div className={`rounded-lg border px-4 py-2 text-center shrink-0 ${vix.changePct >= 0 ? "border-orange-500/40 bg-orange-500/10" : "border-green-500/40 bg-green-500/10"}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">⚡ India VIX</div>
            <div className="text-xl font-bold tabular-nums mt-0.5">{vix.price.toFixed(2)}</div>
            <div className={`text-xs font-medium tabular-nums ${changeColor(vix.changePct)}`}>
              {vix.changePct >= 0 ? "+" : ""}{vix.changePct.toFixed(2)}%
            </div>
          </div>
        )}
      </div>

      {/* Indian Index cards */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Indian Indices</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          {indicesLoading
            ? [...Array(6)].map((_, i) => (
                <div key={i} className="rounded-lg border bg-card p-4 h-22 animate-pulse" />
              ))
            : indicesError
              ? <div role="alert" className="col-span-full rounded-lg border border-amber-500/30 p-4 text-sm text-amber-500">Market indices are temporarily unavailable.</div>
            : (indices ?? []).map((q) => <IndexCard key={q.symbol} q={q} />)}
        </div>
      </div>

      {/* Multi-Asset Section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Commodities, Currencies & Bonds</h2>
        </div>
        {multiLoading ? (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-3 h-21 animate-pulse" />
            ))}
          </div>
        ) : (
          multiError
            ? <div role="alert" className="rounded-lg border border-amber-500/30 p-4 text-sm text-amber-500">Multi-asset quotes are temporarily unavailable.</div>
            : <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
                {otherAssets.map((a) => <AssetCard key={a.symbol} a={a} />)}
              </div>
        )}
      </div>

      {/* Global Markets */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card flex flex-col lg:col-span-1">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Global Markets</h3>
          </div>
          <div className="flex gap-1 px-3 pt-2">
            {REGIONS.map((r) => (
              <button
                key={r}
                onClick={() => setGlobalRegion(r)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  globalRegion === r
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="flex-1 p-2">
            {globalLoading ? (
              <div className="space-y-1.5 p-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 rounded-md bg-accent/40 animate-pulse" />
                ))}
              </div>
            ) : (
              globalError
                ? <div role="alert" className="py-8 text-center text-xs text-amber-500">Global market data is temporarily unavailable.</div>
                : <div className="space-y-0.5">
                    {regionIndices.map((g) => <GlobalCard key={g.symbol} g={g} />)}
                  </div>
            )}
          </div>
        </div>

        {/* Top movers */}
        <div className="lg:col-span-2 grid gap-4 md:grid-cols-3">
          <MoverSection title="Top Gainers" icon={TrendingUp} iconClass="text-green-500" data={gainers} isLoading={gainersLoading} isError={gainersError} />
          <MoverSection title="Top Losers" icon={TrendingDown} iconClass="text-red-500" data={losers} isLoading={losersLoading} isError={losersError} />
          <MoverSection title="Most Active" icon={Activity} iconClass="text-primary" data={active} isLoading={activeLoading} isError={activeError} />
        </div>
      </div>
    </div>
  );
}
