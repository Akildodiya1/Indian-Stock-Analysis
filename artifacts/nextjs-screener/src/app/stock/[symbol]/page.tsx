"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  ComposedChart, LineChart, Line, Bar, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, Legend,
} from "recharts";
import { ArrowLeft, Star, StarOff, TrendingUp, TrendingDown, ExternalLink, Clock, FileText, AlertTriangle, Activity, Gauge, BarChart3, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api-url";
import {
  formatPrice, formatChangePercent, formatMarketCap, formatPercent,
  formatRatio, formatVolume, changeColor, changeBg, displaySymbol,
} from "@/lib/format";
import { isFno } from "@/lib/fno-stocks";
import { toast } from "sonner";
import {
  addWatchlistItem,
  getWatchlist,
  removeWatchlistItem,
  type WatchlistItem,
} from "@/lib/watchlist-api";
import {
  INSIGHT_TABS,
  StockInsightsDashboard,
  type BulkDeal,
  type InsightTab,
  type OwnershipData,
  type StockInsights,
} from "@/components/stock-insights";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Quote {
  symbol: string; shortName?: string; longName?: string;
  regularMarketPrice?: number; regularMarketChange?: number; regularMarketChangePercent?: number;
  regularMarketOpen?: number; regularMarketDayHigh?: number; regularMarketDayLow?: number;
  regularMarketPreviousClose?: number; regularMarketVolume?: number; marketCap?: number;
  fiftyTwoWeekHigh?: number; fiftyTwoWeekLow?: number; exchange?: string;
}
interface Fundamental {
  trailingPE?: number; forwardPE?: number; priceToBook?: number; trailingEps?: number;
  forwardEps?: number; dividendYield?: number; dividendRate?: number; beta?: number;
  marketCap?: number;
  returnOnEquity?: number; returnOnAssets?: number; grossMargins?: number;
  operatingMargins?: number; profitMargins?: number; currentRatio?: number;
  debtToEquity?: number; revenueGrowth?: number; totalRevenue?: number; freeCashflow?: number;
  payoutRatio?: number;
  targetMeanPrice?: number; recommendationKey?: string; sector?: string; industry?: string;
  longBusinessSummary?: string; pegRatio?: number;
}
interface HistoryPoint { timestamp: number; open: number; high: number; low: number; close: number; volume: number }
interface HistoryRow {
  date: string; timestamp: number; open: number; high: number; low: number; close: number;
  volume: number; change1d: number; change5d: number | null; change22d: number | null; change66d: number | null; rsi: number | null;
}
interface NewsItem { uuid: string; title: string; publisher: string; link: string; providerPublishTime: number; relatedTickers?: string[] }
interface Filing { title: string; date: string; type: string; category: string; url?: string }
interface TechnicalPoint {
  date: string;
  close: number;
  volume: number;
  rsi: number | null;
  sma20: number | null;
  sma50: number | null;
  ema20: number | null;
  macd: number | null;
  signal: number | null;
  roc20: number | null;
  volatility: number | null;
}

/* ─── Constants ─────────────────────────────────────────────────────────── */
const PERIODS = [
  { label: "5D", value: "5d", interval: "15m" },
  { label: "1M", value: "1mo", interval: "1d" },
  { label: "3M", value: "3mo", interval: "1d" },
  { label: "6M", value: "6mo", interval: "1d" },
  { label: "1Y", value: "1y", interval: "1d" },
  { label: "5Y", value: "5y", interval: "1wk" },
];
const TECHNICAL_VIEWS = ["Charts", "Volume & Delivery", "Price History"] as const;
type TechnicalView = (typeof TECHNICAL_VIEWS)[number];

/* ─── RSI computation ───────────────────────────────────────────────────── */
function computeRSI(closes: number[], period = 14): (number | null)[] {
  const rsi: (number | null)[] = new Array(period).fill(null);
  if (closes.length <= period) return rsi;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

/* ─── Small helpers ─────────────────────────────────────────────────────── */
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold tabular-nums">{value}</span>
    </div>
  );
}
const TOOLTIP_STYLE = {
  backgroundColor: "hsl(222,47%,10%)",
  border: "1px solid hsl(217,33%,17%)",
  borderRadius: 6, fontSize: 11, color: "hsl(213,31%,91%)",
};

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function pctCell(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

async function fetchStockData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Stock data unavailable (HTTP ${response.status})`);
  }
  return response.json();
}

function computeTechnicalData(
  data: { date: string; close: number; volume: number; rsi: number | null }[],
): TechnicalPoint[] {
  let ema12: number | null = null;
  let ema26: number | null = null;
  let signal: number | null = null;
  const alpha12 = 2 / 13;
  const alpha26 = 2 / 27;
  const alphaSignal = 2 / 10;

  return data.map((point, index) => {
    ema12 = ema12 == null ? point.close : point.close * alpha12 + ema12 * (1 - alpha12);
    ema26 = ema26 == null ? point.close : point.close * alpha26 + ema26 * (1 - alpha26);
    const macd = ema12 - ema26;
    signal = signal == null ? macd : macd * alphaSignal + signal * (1 - alphaSignal);

    const window20 = data.slice(Math.max(0, index - 19), index + 1).map((item) => item.close);
    const window50 = data.slice(Math.max(0, index - 49), index + 1).map((item) => item.close);
    const sma20 = window20.length >= 20
      ? window20.reduce((sum, value) => sum + value, 0) / window20.length
      : null;
    const sma50 = window50.length >= 50
      ? window50.reduce((sum, value) => sum + value, 0) / window50.length
      : null;
    const mean20 = sma20;
    const standardDeviation = mean20 == null
      ? null
      : Math.sqrt(window20.reduce((sum, value) => sum + (value - mean20!) ** 2, 0) / window20.length);
    const volatility = standardDeviation != null && mean20 != null && mean20 !== 0
      ? (standardDeviation / mean20) * 100
      : null;
    const oldClose = index >= 20 ? data[index - 20].close : null;

    return {
      date: point.date,
      close: point.close,
      volume: point.volume,
      rsi: point.rsi,
      sma20,
      sma50,
      ema20: ema12,
      macd,
      signal,
      roc20: oldClose ? ((point.close - oldClose) / oldClose) * 100 : null,
      volatility,
    };
  });
}

function MiniLineCard({
  title,
  subtitle,
  data,
  dataKey,
  color,
  value,
  formatter = (v) => v.toFixed(2),
  bar = false,
}: {
  title: string;
  subtitle: string;
  data: TechnicalPoint[];
  dataKey: keyof TechnicalPoint;
  color: string;
  value: string;
  formatter?: (value: number) => string;
  bar?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 min-w-0">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate">{title}</div>
          <div className="text-[10px] text-muted-foreground truncate">{subtitle}</div>
        </div>
        <div className="text-sm font-bold tabular-nums whitespace-nowrap">{value}</div>
      </div>
      <ResponsiveContainer width="100%" height={92}>
        <ComposedChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 0 }}>
          <XAxis dataKey="date" hide />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v) => [
              typeof v === "number" ? formatter(v) : "—",
              title,
            ]}
            labelFormatter={(label) => String(label)}
          />
          {bar ? (
            <Bar dataKey={String(dataKey)} fill={color} opacity={0.72} radius={[2, 2, 0, 0]} />
          ) : (
            <Area
              type="monotone"
              dataKey={String(dataKey)}
              stroke={color}
              fill={color}
              fillOpacity={0.12}
              strokeWidth={1.8}
              dot={false}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── RSI chart with coloured bands ─────────────────────────────────────── */
function RSIChart({ data }: { data: { date: string; rsi: number | null }[] }) {
  // Build 3 series for coloured line segments
  const processed = data.map((d, i) => {
    const r = d.rsi;
    const prev = i > 0 ? data[i - 1].rsi : null;
    const next = i < data.length - 1 ? data[i + 1].rsi : null;
    return {
      ...d,
      // Overlap by 1 point at each boundary to prevent gaps
      rsiRed: r != null && (r > 70 || (prev != null && prev > 70) || (next != null && next > 70)) ? r : null,
      rsiGreen: r != null && (r < 30 || (prev != null && prev < 30) || (next != null && next < 30)) ? r : null,
      rsiYellow: r != null ? r : null,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={130}>
      <LineChart data={processed} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        {/* Coloured zone fills */}
        <ReferenceArea y1={70} y2={100} fill="#ef4444" fillOpacity={0.06} />
        <ReferenceArea y1={40} y2={60} fill="#22d3ee" fillOpacity={0.06} />
        <ReferenceArea y1={0} y2={30} fill="#22c55e" fillOpacity={0.06} />
        {/* Reference lines */}
        <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.7} strokeWidth={1} />
        <ReferenceLine y={60} stroke="hsl(217,33%,30%)" strokeDasharray="2 4" strokeOpacity={0.5} strokeWidth={1} />
        <ReferenceLine y={50} stroke="hsl(217,33%,28%)" strokeDasharray="2 4" strokeOpacity={0.5} strokeWidth={1} />
        <ReferenceLine y={40} stroke="hsl(217,33%,30%)" strokeDasharray="2 4" strokeOpacity={0.5} strokeWidth={1} />
        <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.7} strokeWidth={1} />
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} tickLine={false} axisLine={false}
          ticks={[0, 30, 40, 50, 60, 70, 100]} width={26} />
        <Tooltip contentStyle={TOOLTIP_STYLE}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(v: any, name: string) => {
            if (v == null) return ["—", name];
            const label = name === "rsiRed" ? "RSI (OB)" : name === "rsiGreen" ? "RSI (OS)" : "RSI";
            return [(v as number).toFixed(1), label];
          }} />
        {/* Base yellow line (neutral) */}
        <Line type="monotone" dataKey="rsiYellow" stroke="#f59e0b" strokeWidth={1.5} dot={false} connectNulls name="RSI" />
        {/* Red overlay for overbought */}
        <Line type="monotone" dataKey="rsiRed" stroke="#ef4444" strokeWidth={2.5} dot={false} connectNulls={false} name="rsiRed" legendType="none" />
        {/* Green overlay for oversold */}
        <Line type="monotone" dataKey="rsiGreen" stroke="#22c55e" strokeWidth={2.5} dot={false} connectNulls={false} name="rsiGreen" legendType="none" />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────────── */
export default function StockPage() {
  const params = useParams();
  const rawSymbol = decodeURIComponent((params?.symbol as string | undefined) ?? "");
  const [period, setPeriod] = useState(PERIODS[2]);
  const [activeTab, setActiveTab] = useState<InsightTab>("Advanced Insights");
  const [technicalView, setTechnicalView] = useState<TechnicalView>("Charts");
  const queryClient = useQueryClient();

  const { data: quote, isLoading: quoteLoading } = useQuery<Quote>({
    queryKey: ["stock", "quote", rawSymbol],
    queryFn: () => fetch(apiUrl(`/stocks/quote/${encodeURIComponent(rawSymbol)}`)).then(r => r.json()),
    enabled: !!rawSymbol,
    refetchInterval: 30_000,
  });
  const { data: fundamentals } = useQuery<Fundamental>({
    queryKey: ["stock", "fundamentals", rawSymbol],
    queryFn: () => fetch(apiUrl(`/stocks/fundamentals/${encodeURIComponent(rawSymbol)}`)).then(r => r.json()),
    enabled: !!rawSymbol,
  });
  const {
    data: insights,
    isLoading: insightsLoading,
    isError: insightsError,
  } = useQuery<StockInsights>({
    queryKey: ["stock", "insights", rawSymbol],
    queryFn: () => fetchStockData(apiUrl(`/stocks/insights/${encodeURIComponent(rawSymbol)}`)),
    enabled: !!rawSymbol,
    staleTime: 5 * 60 * 1000,
  });
  const { data: history, isLoading: historyLoading } = useQuery<HistoryPoint[]>({
    queryKey: ["stock", "history", rawSymbol, period.value],
    queryFn: () =>
      fetch(apiUrl(`/stocks/history/${encodeURIComponent(rawSymbol)}?period=${period.value}&interval=${period.interval}`)).then(r => r.json()),
    enabled: !!rawSymbol,
  });
  const { data: historyTable = [], isLoading: tableLoading } = useQuery<HistoryRow[]>({
    queryKey: ["stock", "history-table", rawSymbol],
    queryFn: () => fetch(apiUrl(`/stocks/history-table/${encodeURIComponent(rawSymbol)}`)).then(r => r.json()),
    enabled: !!rawSymbol && activeTab === "Technicals" && technicalView === "Price History",
    staleTime: 10 * 60 * 1000,
  });
  const { data: stockNews = [], isLoading: newsLoading } = useQuery<NewsItem[]>({
    queryKey: ["stock", "news", rawSymbol],
    queryFn: () => fetch(apiUrl(`/stocks/news/${encodeURIComponent(rawSymbol)}`)).then(r => r.json()),
    enabled: !!rawSymbol,
    staleTime: 5 * 60 * 1000,
  });
  const { data: filings = [], isLoading: filingsLoading } = useQuery<Filing[]>({
    queryKey: ["stock", "filings", rawSymbol],
    queryFn: () => fetch(apiUrl(`/stocks/filings/${encodeURIComponent(rawSymbol)}`)).then(r => r.json()),
    enabled: !!rawSymbol && activeTab === "Filings",
    staleTime: 5 * 60 * 1000,
  });
  const { data: ownership } = useQuery<OwnershipData>({
    queryKey: ["stock", "ownership", rawSymbol],
    queryFn: () => fetchStockData(apiUrl(`/stocks/ownership/${encodeURIComponent(rawSymbol)}`)),
    enabled: !!rawSymbol && (activeTab === "Shareholding" || activeTab === "Promoter Activity"),
    staleTime: 10 * 60 * 1000,
  });
  const { data: bulkDeals = [], isLoading: bulkDealsLoading, isError: bulkDealsError } = useQuery<BulkDeal[]>({
    queryKey: ["stock", "bulk-deals", rawSymbol],
    queryFn: () => fetchStockData(apiUrl(`/stocks/bulk-deals/${encodeURIComponent(rawSymbol)}`)),
    enabled: !!rawSymbol && activeTab === "Bulk Deal",
    staleTime: 5 * 60 * 1000,
  });
  const { data: watchlist, isError: watchlistError } = useQuery<WatchlistItem[]>({
    queryKey: ["watchlist"],
    queryFn: getWatchlist,
  });

  const isWatched = (watchlist ?? []).some(w => w.symbol === rawSymbol);
  const addMutation = useMutation({
    mutationFn: () => addWatchlistItem(rawSymbol),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["watchlist"] }); toast.success("Added to watchlist"); },
    onError: (error: Error) => toast.error(error.message),
  });
  const removeMutation = useMutation({
    mutationFn: () => removeWatchlistItem(rawSymbol),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["watchlist"] }); toast.success("Removed"); },
    onError: (error: Error) => toast.error(error.message),
  });

  /* Chart data */
  const closes = (history ?? []).map(h => h.close);
  const rsiArr = computeRSI(closes);
  const chartData = (history ?? []).map((h, i) => ({
    date: new Date(h.timestamp * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    close: h.close,
    volume: h.volume,
    rsi: rsiArr[i] ?? null,
  }));
  const technicalData = computeTechnicalData(chartData);
  const latestTechnical = technicalData[technicalData.length - 1];
  const averageVolume = technicalData.length
    ? technicalData.reduce((sum, point) => sum + point.volume, 0) / technicalData.length
    : 0;
  const volumeRatio = latestTechnical && averageVolume > 0
    ? latestTechnical.volume / averageVolume
    : null;
  const trendIsPositive = latestTechnical?.ema20 != null && latestTechnical.close >= latestTechnical.ema20;
  const rsiLabel = latestTechnical?.rsi == null
    ? "Building"
    : latestTechnical.rsi > 70
      ? "Overbought"
      : latestTechnical.rsi < 30
        ? "Oversold"
        : "Neutral";

  const chg = quote?.regularMarketChangePercent ?? 0;
  const lineColor = chg >= 0 ? "#22c55e" : "#ef4444";
  const isPos = chg >= 0;

  /* 52W range pct */
  const low52 = quote?.fiftyTwoWeekLow ?? 0;
  const high52 = quote?.fiftyTwoWeekHigh ?? 0;
  const price = quote?.regularMarketPrice ?? 0;
  const rangePct = high52 > low52 ? ((price - low52) / (high52 - low52)) * 100 : 50;

  return (
    <div className="stock-detail-page space-y-5 max-w-7xl">
      {/* Back */}
      <Link href="/screener" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />Back to Screener
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="stock-detail-title text-2xl font-bold tracking-tight">{displaySymbol(rawSymbol)}</h1>
            {quote?.shortName && <span className="text-base font-normal text-muted-foreground">{quote.shortName}</span>}
            {fundamentals?.sector && (
              <span className="rounded-full bg-primary/10 text-primary text-xs font-semibold px-2.5 py-0.5">{fundamentals.sector}</span>
            )}
            {isFno(rawSymbol) && (
              <span className="rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-xs font-bold px-2.5 py-0.5 tracking-wide">
                F&amp;O
              </span>
            )}
          </div>
          {fundamentals?.industry && <p className="text-xs text-muted-foreground mt-1">{fundamentals.industry}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm"
            onClick={() => (isWatched ? removeMutation.mutate() : addMutation.mutate())}
            disabled={addMutation.isPending || removeMutation.isPending}
            className={isWatched ? "border-primary/30 text-primary" : ""}>
            {isWatched ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
            {isWatched ? "Unwatch" : "Watchlist"}
          </Button>
          {watchlistError && <span className="text-xs text-destructive">Watchlist unavailable</span>}
        </div>
      </div>

      {/* Price + stats */}
        <div className="stock-detail-overview grid gap-4 lg:grid-cols-3">
        <div className="stock-price-card lg:col-span-2 rounded-lg border bg-card p-5">
          {quoteLoading ? (
            <div className="h-24 animate-pulse bg-accent/40 rounded-lg" />
          ) : (
            <>
              <div className="text-4xl font-bold tabular-nums">{formatPrice(quote?.regularMarketPrice)}</div>
              <div className={`mt-2 flex items-center gap-2 text-lg font-semibold ${changeColor(chg)}`}>
                {isPos ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                <span className="tabular-nums">{chg >= 0 ? "+" : ""}{(quote?.regularMarketChange ?? 0).toFixed(2)}</span>
                <span className={`text-sm rounded-full px-2 py-0.5 ${changeBg(chg)}`}>{formatChangePercent(chg)}</span>
              </div>
              {/* 52W range bar */}
              {high52 > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>52W Low: {formatPrice(low52)}</span>
                    <span>52W High: {formatPrice(high52)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(2, Math.min(100, rangePct))}%` }} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="stock-stats-card rounded-lg border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Today's Stats</h3>
          <StatRow label="Open" value={formatPrice(quote?.regularMarketOpen)} />
          <StatRow label="Prev Close" value={formatPrice(quote?.regularMarketPreviousClose)} />
          <StatRow label="High" value={formatPrice(quote?.regularMarketDayHigh)} />
          <StatRow label="Low" value={formatPrice(quote?.regularMarketDayLow)} />
          <StatRow label="Volume" value={formatVolume(quote?.regularMarketVolume)} />
          <StatRow
            label="Market Cap"
            value={
              (quote?.marketCap ?? fundamentals?.marketCap) != null
                ? formatMarketCap((quote?.marketCap ?? fundamentals?.marketCap)! / 1e7)
                : "—"
            }
          />
        </div>
      </div>

      {/* Reference-style insight tabs */}
      <div className="stock-insight-tab-rail overflow-x-auto border-b border-border" role="group" aria-label="Stock insight sections">
        <div className="flex min-w-max gap-0.5">
          {INSIGHT_TABS.map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              type="button"
              aria-pressed={activeTab === t}
              className={`px-3 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>{t}</button>
          ))}
        </div>
      </div>

      {activeTab !== "Technicals" && activeTab !== "Filings" && (
        <StockInsightsDashboard
          tab={activeTab}
          insights={insights}
          insightsLoading={insightsLoading}
          insightsError={insightsError}
          fundamentals={fundamentals}
          ownership={ownership}
          bulkDeals={bulkDeals}
          bulkDealsLoading={bulkDealsLoading}
          bulkDealsError={bulkDealsError}
          symbol={rawSymbol}
        />
      )}

      {activeTab === "Technicals" && (
        <div className="stock-technical-view-rail flex items-center gap-2 border-b border-border/60 pb-3 overflow-x-auto" role="group" aria-label="Technical analysis view">
          {TECHNICAL_VIEWS.map((view) => (
            <button
              key={view}
              onClick={() => setTechnicalView(view)}
              type="button"
              aria-pressed={technicalView === view}
              className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                technicalView === view ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      )}

      {/* Technical charts */}
      {activeTab === "Technicals" && technicalView === "Charts" && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-semibold text-sm">{displaySymbol(rawSymbol)} — PRICE</h2>
              <div className="flex gap-1">
                {PERIODS.map(p => (
                  <button key={p.value} onClick={() => setPeriod(p)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      period.value === p.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}>{p.label}</button>
                ))}
              </div>
            </div>
            {historyLoading ? (
              <div className="h-52 animate-pulse bg-accent/40 rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
                  <YAxis yAxisId="price" domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickLine={false} axisLine={false}
                    tickFormatter={(v: number) => `₹${v.toFixed(0)}`} width={62} />
                  <YAxis yAxisId="volume" orientation="right" tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} tickLine={false} axisLine={false}
                    tickFormatter={(v: number) => formatVolume(v)} width={45} />
                  <Tooltip contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number, name: string) => name === "volume" ? [formatVolume(v), "Volume"] : [`₹${v.toFixed(2)}`, "Price"]} />
                  <Bar yAxisId="volume" dataKey="volume" fill={lineColor} opacity={0.25} radius={[1, 1, 0, 0]} maxBarSize={8} />
                  <Line yAxisId="price" type="monotone" dataKey="close" stroke={lineColor} strokeWidth={2} dot={false} activeDot={{ r: 3, fill: lineColor }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* RSI chart */}
          {!historyLoading && chartData.length > 14 && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-sm">RSI (14)</h2>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Above 70: Overbought</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Below 30: Oversold</span>
                </div>
              </div>
              <RSIChart data={chartData} />
            </div>
          )}
        </div>
      )}

      {/* Technical dashboard */}
      {activeTab === "Technicals" && technicalView === "Charts" && !historyLoading && technicalData.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Technical Dashboard
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Trend, momentum, volatility and volume signals from the selected period
              </p>
            </div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {technicalData.length} observations · {period.label}
            </span>
          </div>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-primary" /> Trend
              </div>
              <div className={`text-lg font-bold ${trendIsPositive ? "text-green-400" : "text-red-400"}`}>
                {trendIsPositive ? "Bullish" : "Bearish"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Price vs EMA 20
              </div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Gauge className="h-3.5 w-3.5 text-amber-400" /> RSI (14)
              </div>
              <div className="text-lg font-bold tabular-nums">
                {latestTechnical?.rsi != null ? latestTechnical.rsi.toFixed(1) : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">{rsiLabel}</div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Zap className="h-3.5 w-3.5 text-cyan-400" /> MACD
              </div>
              <div className={`text-lg font-bold tabular-nums ${(latestTechnical?.macd ?? 0) >= (latestTechnical?.signal ?? 0) ? "text-green-400" : "text-red-400"}`}>
                {(latestTechnical?.macd ?? 0).toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {(latestTechnical?.macd ?? 0) >= (latestTechnical?.signal ?? 0) ? "Positive momentum" : "Negative momentum"}
              </div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <BarChart3 className="h-3.5 w-3.5 text-purple-400" /> Volume
              </div>
              <div className="text-lg font-bold tabular-nums">
                {volumeRatio != null ? `${volumeRatio.toFixed(1)}x` : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">vs selected-period average</div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MiniLineCard
              title="RSI (14)"
              subtitle="Momentum oscillator · 30 / 70 bands"
              data={technicalData}
              dataKey="rsi"
              color="#f59e0b"
              value={latestTechnical?.rsi != null ? latestTechnical.rsi.toFixed(1) : "—"}
              formatter={(value) => value.toFixed(1)}
            />
            <MiniLineCard
              title="MACD"
              subtitle="12 / 26 / 9 momentum"
              data={technicalData}
              dataKey="macd"
              color="#22d3ee"
              value={latestTechnical?.macd != null ? latestTechnical.macd.toFixed(2) : "—"}
            />
            <MiniLineCard
              title="20D Momentum"
              subtitle="Rate of change"
              data={technicalData}
              dataKey="roc20"
              color="#a78bfa"
              value={latestTechnical?.roc20 != null ? `${latestTechnical.roc20 >= 0 ? "+" : ""}${latestTechnical.roc20.toFixed(2)}%` : "—"}
              formatter={(value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`}
            />
            <MiniLineCard
              title="EMA 20"
              subtitle="Short-term trend"
              data={technicalData}
              dataKey="ema20"
              color="#22c55e"
              value={latestTechnical?.ema20 != null ? formatPrice(latestTechnical.ema20) : "—"}
              formatter={(value) => formatPrice(value)}
            />
            <MiniLineCard
              title="Volatility"
              subtitle="20D standard deviation"
              data={technicalData}
              dataKey="volatility"
              color="#fb7185"
              value={latestTechnical?.volatility != null ? `${latestTechnical.volatility.toFixed(2)}%` : "—"}
              formatter={(value) => `${value.toFixed(2)}%`}
            />
            <MiniLineCard
              title="Volume"
              subtitle="Daily traded volume"
              data={technicalData}
              dataKey="volume"
              color="#60a5fa"
              value={latestTechnical ? formatVolume(latestTechnical.volume) : "—"}
              formatter={(value) => formatVolume(value)}
              bar
            />
          </div>
        </div>
      )}

      {/* Volume & Delivery view */}
      {activeTab === "Technicals" && technicalView === "Volume & Delivery" && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-semibold text-sm">{displaySymbol(rawSymbol)} — 70-DAY VOLUME ANALYSIS</h2>
            <div className="flex gap-1">
              {PERIODS.filter(p => ["1M","3M","6M"].includes(p.label)).map(p => (
                <button key={p.value} onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    period.value === p.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}>{p.label}</button>
              ))}
            </div>
          </div>
          {historyLoading ? (
            <div className="h-64 animate-pulse bg-accent/40 rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => formatVolume(v)} width={50} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, name: string) => [
                  name === "close" ? `₹${v.toFixed(2)}` : formatVolume(v),
                  name === "close" ? "Price" : "Volume"
                ]} />
                <Bar dataKey="volume" fill="#22d3ee" opacity={0.5} radius={[2, 2, 0, 0]} name="Volume" />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Price History view */}
      {activeTab === "Technicals" && technicalView === "Price History" && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="font-semibold text-sm">Historical Data</span>
            <span className="text-xs text-muted-foreground">{historyTable.length} days · Date | Open | High | Low | Close | 1D% | 5D% | 22D% | 66D% | RSI | Volume</span>
          </div>
          {tableLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading historical data…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {["Date","Open","High","Low","Close","1D%","5D%","22D%","66D%","RSI","Volume"].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historyTable.slice(0, 80).map(row => {
                    const rsiColor = row.rsi == null ? "" : row.rsi > 70 ? "text-red-500" : row.rsi < 30 ? "text-green-500" : "text-amber-400";
                    return (
                      <tr key={row.timestamp} className="border-b hover:bg-accent/30 transition-colors">
                        <td className="px-3 py-2 font-medium tabular-nums">{row.date}</td>
                        <td className="px-3 py-2 tabular-nums">₹{row.open.toFixed(2)}</td>
                        <td className="px-3 py-2 tabular-nums">₹{row.high.toFixed(2)}</td>
                        <td className="px-3 py-2 tabular-nums">₹{row.low.toFixed(2)}</td>
                        <td className="px-3 py-2 tabular-nums font-semibold">₹{row.close.toFixed(2)}</td>
                        <td className={`px-3 py-2 tabular-nums ${changeColor(row.change1d)}`}>{pctCell(row.change1d)}</td>
                        <td className={`px-3 py-2 tabular-nums ${changeColor(row.change5d)}`}>{pctCell(row.change5d)}</td>
                        <td className={`px-3 py-2 tabular-nums ${changeColor(row.change22d)}`}>{pctCell(row.change22d)}</td>
                        <td className={`px-3 py-2 tabular-nums ${changeColor(row.change66d)}`}>{pctCell(row.change66d)}</td>
                        <td className={`px-3 py-2 tabular-nums font-semibold ${rsiColor}`}>{row.rsi != null ? row.rsi.toFixed(0) : "—"}</td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{formatVolume(row.volume)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Filings tab */}
      {activeTab === "Filings" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Corporate Filings — {displaySymbol(rawSymbol)}</h2>
            <span className="text-xs text-muted-foreground">(NSE India)</span>
          </div>
          <div className="rounded-lg border bg-card overflow-hidden">
            {filingsLoading ? (
              <div className="space-y-0 divide-y">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="p-4 flex gap-4">
                    <div className="h-4 w-20 bg-accent/40 animate-pulse rounded" />
                    <div className="flex-1 h-4 bg-accent/40 animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : filings.length === 0 ? (
              <div className="py-16 text-center">
                <AlertTriangle className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No filings available</p>
                <p className="text-xs text-muted-foreground/60 mt-1">NSE India API may be unavailable or the symbol is not listed on NSE</p>
                <a
                  href={`https://www.nseindia.com/get-quotes/equity?symbol=${rawSymbol.replace(".NS","")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  View on NSE India
                </a>
              </div>
            ) : (
              <div className="divide-y">
                {filings.map((f, i) => {
                  const catColor: Record<string, string> = {
                    "Corporate Action": "bg-blue-500/15 text-blue-400",
                    "Board Meeting": "bg-purple-500/15 text-purple-400",
                    "Announcement": "bg-amber-500/15 text-amber-400",
                  };
                  return (
                    <div key={i} className="flex items-start gap-4 px-4 py-3 hover:bg-accent/20 transition-colors">
                      <div className="shrink-0 text-center w-16">
                        {f.date ? (
                          <>
                            <div className="text-xs font-bold tabular-nums">
                              {new Date(f.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {new Date(f.date).getFullYear()}
                            </div>
                          </>
                        ) : <div className="text-xs text-muted-foreground">—</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${catColor[f.category] ?? "bg-secondary/60 text-muted-foreground"}`}>
                            {f.category}
                          </span>
                          {f.type && f.type !== "Filing" && (
                            <span className="text-[10px] text-muted-foreground bg-secondary/40 rounded px-1.5 py-0.5">{f.type}</span>
                          )}
                        </div>
                        <p className="text-sm font-medium leading-snug">{f.title}</p>
                      </div>
                      {f.url && (
                        <a href={f.url} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 p-1.5 rounded-md hover:bg-accent/60 text-muted-foreground hover:text-primary transition-colors">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <a
              href={`https://www.nseindia.com/get-quotes/equity?symbol=${rawSymbol.replace(".NS","")}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              View all filings on NSE India
            </a>
          </div>
        </div>
      )}

      {/* Stock-specific news */}
      <div className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          Latest News for {displaySymbol(rawSymbol)}
        </h2>
        <div className="rounded-lg border bg-card divide-y overflow-hidden">
          {newsLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading news…</div>
          ) : stockNews.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No news found</div>
          ) : (
            stockNews.slice(0, 10).map(item => (
              <div key={item.uuid} className="p-3 hover:bg-accent/20 transition-colors flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />{timeAgo(item.providerPublishTime)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">· {item.publisher}</span>
                  </div>
                  <p className="text-sm leading-snug font-medium">{item.title}</p>
                </div>
                <a href={item.link} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 p-1.5 rounded-md hover:bg-accent/60 text-muted-foreground hover:text-primary transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
