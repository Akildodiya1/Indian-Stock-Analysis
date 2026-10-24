"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, CircleHelp } from "lucide-react";
import {
  formatMarketCap,
  formatPercent,
  formatPrice,
  formatRatio,
  formatVolume,
} from "@/lib/format";

export const INSIGHT_TABS = [
  "Advanced Insights",
  "Technicals",
  "Quarterly",
  "Profit & Loss",
  "Balance Sheet",
  "Cashflow",
  "Shareholding",
  "Filings",
  "Bulk Deal",
  "Promoter Activity",
] as const;

export type InsightTab = (typeof INSIGHT_TABS)[number];

export interface FinancialSeriesPoint {
  period: string;
  date: string;
  revenue?: number;
  grossProfit?: number;
  operatingIncome?: number;
  operatingExpense?: number;
  otherIncome?: number;
  netIncome?: number;
  eps?: number;
  ebitda?: number;
  operatingCashFlow?: number;
  freeCashFlow?: number;
  investingCashFlow?: number;
  financingCashFlow?: number;
  capitalExpenditure?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  currentAssets?: number;
  currentLiabilities?: number;
  inventory?: number;
  receivables?: number;
  payables?: number;
  cash?: number;
  debt?: number;
  equity?: number;
  commonStock?: number;
  reserves?: number;
  fixedAssets?: number;
  capitalWorkInProgress?: number;
  costOfRevenue?: number;
  inventoryDays?: number;
  receivableDays?: number;
  payableDays?: number;
  workingCapital?: number;
  operatingMargin?: number;
  netMargin?: number;
}

export interface StockInsights {
  annual: FinancialSeriesPoint[];
  quarterly: FinancialSeriesPoint[];
  metrics: {
    faceValue?: number;
    sharesOutstanding?: number;
    deliveryPct?: number;
    annualVolatility?: number;
    vwap?: number;
    enterpriseValue?: number;
    priceToSales?: number;
    evToSales?: number;
    evToEbitda?: number;
    bookValue?: number;
    heldPercentInsiders?: number;
    heldPercentInstitutions?: number;
    returnOnEquity?: number;
    returnOnAssets?: number;
    currentRatio?: number;
    quickRatio?: number;
    debtToEquity?: number;
    marketCapToSales?: number;
    inventoryDays?: number;
    receivableDays?: number;
    payableDays?: number;
  };
  relativePerformance: {
    stock: { oneMonth?: number; threeMonth?: number; oneYear?: number };
    nifty50: { oneMonth?: number; threeMonth?: number; oneYear?: number };
    vsNifty50: { oneMonth?: number; threeMonth?: number; oneYear?: number };
  };
}

export interface FundamentalSnapshot {
  trailingPE?: number;
  forwardPE?: number;
  priceToBook?: number;
  trailingEps?: number;
  forwardEps?: number;
  dividendYield?: number;
  dividendRate?: number;
  beta?: number;
  marketCap?: number;
  payoutRatio?: number;
  returnOnEquity?: number;
  returnOnAssets?: number;
  grossMargins?: number;
  operatingMargins?: number;
  profitMargins?: number;
  currentRatio?: number;
  debtToEquity?: number;
  revenueGrowth?: number;
  targetMeanPrice?: number;
  recommendationKey?: string;
  longBusinessSummary?: string;
}

export interface OwnershipData {
  symbol: string;
  promoterHolding: number | null;
  promoterPledged: number | null;
  institutionalHolding: number | null;
  publicHolding: number | null;
  quarterlyChange: number | null;
  quarter?: string | null;
  source?: string;
  error?: string;
}

export interface BulkDeal {
  date: string;
  symbol: string;
  name: string;
  clientName: string;
  dealType: string;
  quantity: number;
  price: number;
  remarks: string;
}

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(222,47%,10%)",
  border: "1px solid hsl(217,33%,17%)",
  borderRadius: 6,
  fontSize: 11,
  color: "hsl(213,31%,91%)",
};

function shortNumber(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}

function crore(value?: number | null): string {
  return value == null ? "—" : formatMarketCap(value / 1e7);
}

function rupees(value?: number | null): string {
  return value == null ? "—" : formatPrice(value);
}

function changeLabel(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function latest<T>(data: T[]): T | undefined {
  return data[data.length - 1];
}

function growth(current?: number, previous?: number): number | undefined {
  return current != null && previous != null && previous !== 0
    ? ((current - previous) / Math.abs(previous)) * 100
    : undefined;
}

function toIndexedSeries(
  data: FinancialSeriesPoint[],
  first: keyof FinancialSeriesPoint,
  second: keyof FinancialSeriesPoint,
) {
  const baseA = data.find((point) => typeof point[first] === "number")?.[first];
  const baseB = data.find((point) => typeof point[second] === "number")?.[second];
  return data.map((point) => ({
    period: point.period,
    first:
      typeof point[first] === "number" && typeof baseA === "number" && baseA !== 0
        ? ((point[first] as number) / baseA) * 100
        : null,
    second:
      typeof point[second] === "number" && typeof baseB === "number" && baseB !== 0
        ? ((point[second] as number) / baseB) * 100
        : null,
  }));
}

function MetricCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "positive" | "negative" | "warning";
}) {
  const toneClass = {
    default: "text-foreground",
    positive: "text-emerald-400",
    negative: "text-rose-400",
    warning: "text-amber-300",
  }[tone];
  return (
    <div className="insight-metric-card rounded-lg border bg-card p-3 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</div>
      <div className={`mt-1 text-base font-bold tabular-nums ${toneClass}`}>{value}</div>
      {detail && <div className="mt-1 text-[10px] text-muted-foreground truncate">{detail}</div>}
    </div>
  );
}

function TrendCard({
  title,
  data,
  dataKey,
  color,
  formatter = shortNumber,
  description,
  unit = "currencyCr",
}: {
  title: string;
  data: FinancialSeriesPoint[];
  dataKey: keyof FinancialSeriesPoint;
  color: string;
  formatter?: (value?: number | null) => string;
  description?: string;
  unit?: "currencyCr" | "percent" | "eps" | "days";
}) {
  const last = latest(data)?.[dataKey];
  const previous = data.length > 1 ? data[data.length - 2]?.[dataKey] : undefined;
  const delta = typeof last === "number" && typeof previous === "number" ? growth(last, previous) : undefined;
  const chartData = data.map((point) => ({
    period: point.period,
    value: typeof point[dataKey] === "number" ? point[dataKey] : null,
  }));
  const formatValue =
    formatter !== shortNumber
      ? formatter
      : unit === "currencyCr"
        ? crore
        : unit === "eps"
          ? rupees
          : unit === "percent"
            ? (value?: number | null) =>
                value == null ? "—" : `${value.toFixed(1)}%`
            : unit === "days"
              ? (value?: number | null) =>
                  value == null ? "—" : `${value.toFixed(0)} days`
              : shortNumber;
  const hasValues = chartData.some((point) => point.value != null);
  return (
    <div className="insight-chart-card rounded-lg border bg-card p-3 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold">{title}</div>
          {description && <div className="text-[10px] text-muted-foreground mt-0.5">{description}</div>}
        </div>
        <div className="text-right">
          <div className="text-sm font-bold tabular-nums">{formatValue(last as number | undefined)}</div>
          <div className={`text-[10px] tabular-nums ${delta == null ? "text-muted-foreground" : delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {changeLabel(delta)}
          </div>
        </div>
      </div>
      {hasValues ? (
        <div role="img" aria-label={`${title} trend chart across reported periods`}>
        <ResponsiveContainer width="100%" height={132}>
          <LineChart data={chartData} margin={{ top: 12, right: 2, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="hsl(217,33%,17%)" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} tickLine={false} axisLine={false} />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value) => [formatValue(typeof value === "number" ? value : null), title]}
            />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 2, fill: color }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[132px] flex items-center justify-center text-xs text-muted-foreground">
          No reported data for this metric
        </div>
      )}
    </div>
  );
}

function CompareCard({
  title,
  data,
  leftKey,
  rightKey,
  leftLabel,
  rightLabel,
  colors = ["#38bdf8", "#34d399"],
}: {
  title: string;
  data: FinancialSeriesPoint[];
  leftKey: keyof FinancialSeriesPoint;
  rightKey: keyof FinancialSeriesPoint;
  leftLabel: string;
  rightLabel: string;
  colors?: string[];
}) {
  const chartData = toIndexedSeries(data, leftKey, rightKey);
  return (
    <div className="insight-compare-card rounded-lg border bg-card p-3 min-w-0">
      <div className="text-xs font-semibold mb-1">{title}</div>
      <div className="flex gap-3 text-[10px] text-muted-foreground mb-2">
        <span className="flex items-center gap-1"><i aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: colors[0] }} />{leftLabel}</span>
        <span className="flex items-center gap-1"><i aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: colors[1] }} />{rightLabel}</span>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={chartData} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="hsl(217,33%,17%)" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="period" tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9, fill: "hsl(215,20%,55%)" }} tickLine={false} axisLine={false} width={32} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [typeof value === "number" ? `${value.toFixed(0)} index` : "—", name === "first" ? leftLabel : rightLabel]} />
          <Line type="monotone" dataKey="first" stroke={colors[0]} strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="second" stroke={colors[1]} strokeWidth={2} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DataNotice({ children = "Yahoo Finance or NSE did not return this dataset for the selected stock." }: { children?: string }) {
  return (
    <div className="insight-data-notice rounded-lg border border-dashed bg-card/50 p-8 text-center" role="status">
      <CircleHelp aria-hidden="true" className="h-7 w-7 text-muted-foreground/60 mx-auto mb-2" />
      <p className="text-sm font-medium text-muted-foreground">Data not available</p>
      <p className="text-xs text-muted-foreground/70 mt-1 max-w-md mx-auto">{children}</p>
    </div>
  );
}

function FundamentalCards({ fundamentals, insights }: { fundamentals?: FundamentalSnapshot; insights: StockInsights }) {
  const m = insights.metrics;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      <MetricCard label="P/E (TTM)" value={formatRatio(fundamentals?.trailingPE)} />
      <MetricCard label="P/E (Forward)" value={formatRatio(fundamentals?.forwardPE)} />
      <MetricCard label="PEG Ratio" value={formatRatio((fundamentals as { pegRatio?: number } | undefined)?.pegRatio)} />
      <MetricCard label="Price / Book" value={formatRatio(fundamentals?.priceToBook)} />
      <MetricCard label="EPS (TTM)" value={rupees(fundamentals?.trailingEps)} />
      <MetricCard label="EPS (Forward)" value={rupees(fundamentals?.forwardEps)} />
      <MetricCard label="Beta" value={formatRatio(fundamentals?.beta)} />
      <MetricCard label="Dividend Yield" value={fundamentals?.dividendYield != null ? formatPercent(fundamentals.dividendYield * 100) : "—"} />
      <MetricCard label="Payout Ratio" value={fundamentals?.payoutRatio != null ? formatPercent(fundamentals.payoutRatio * 100) : "—"} />
      <MetricCard label="ROE" value={fundamentals?.returnOnEquity != null ? formatPercent(fundamentals.returnOnEquity * 100) : "—"} tone="positive" />
      <MetricCard label="ROA" value={fundamentals?.returnOnAssets != null ? formatPercent(fundamentals.returnOnAssets * 100) : "—"} />
      <MetricCard label="Gross Margin" value={fundamentals?.grossMargins != null ? formatPercent(fundamentals.grossMargins * 100) : "—"} />
      <MetricCard label="Operating Margin" value={fundamentals?.operatingMargins != null ? formatPercent(fundamentals.operatingMargins * 100) : "—"} />
      <MetricCard label="Net Margin" value={fundamentals?.profitMargins != null ? formatPercent(fundamentals.profitMargins * 100) : "—"} />
      <MetricCard label="Revenue Growth" value={fundamentals?.revenueGrowth != null ? formatPercent(fundamentals.revenueGrowth * 100) : "—"} />
      <MetricCard label="Book Value" value={formatPrice(m.bookValue)} />
      <MetricCard label="Face Value" value={m.faceValue != null ? formatPrice(m.faceValue) : "—"} />
      <MetricCard label="Market Cap / Sales" value={formatRatio(m.marketCapToSales)} />
      <MetricCard label="Price / Sales" value={formatRatio(m.priceToSales)} />
      <MetricCard label="EV / Sales" value={formatRatio(m.evToSales)} />
      <MetricCard label="EV / EBITDA" value={formatRatio(m.evToEbitda)} />
      <MetricCard label="Current Ratio" value={formatRatio(m.currentRatio)} />
      <MetricCard label="Quick Ratio" value={formatRatio(m.quickRatio)} />
      <MetricCard label="Debt / Equity" value={formatRatio(m.debtToEquity)} />
      <MetricCard label="Inventory Days" value={m.inventoryDays != null ? `${m.inventoryDays.toFixed(0)} days` : "—"} />
      <MetricCard label="Receivable Days" value={m.receivableDays != null ? `${m.receivableDays.toFixed(0)} days` : "—"} />
      <MetricCard label="Payable Days" value={m.payableDays != null ? `${m.payableDays.toFixed(0)} days` : "—"} />
      <MetricCard label="Delivery" value={m.deliveryPct != null ? formatPercent(m.deliveryPct) : "—"} />
    </div>
  );
}

function AdvancedPanel({ insights, fundamentals }: { insights: StockInsights; fundamentals?: FundamentalSnapshot }) {
  const annual = insights.annual;
  const last = latest(annual);
  const prev = annual.length > 1 ? annual[annual.length - 2] : undefined;
  const checks = [
    { label: "Revenue momentum", value: growth(last?.revenue, prev?.revenue), good: (value: number) => value >= 0 },
    { label: "Profit momentum", value: growth(last?.netIncome, prev?.netIncome), good: (value: number) => value >= 0 },
    { label: "Operating cash flow", value: last?.operatingCashFlow, good: (value: number) => value > 0, currency: true },
    { label: "Debt trend", value: growth(last?.debt, prev?.debt), good: (value: number) => value <= 0 },
    { label: "Working capital", value: last?.workingCapital, good: (value: number) => value > 0, currency: true },
  ];
  const relative = insights.relativePerformance;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">Advanced Insights</h2>
          <p className="text-xs text-muted-foreground mt-1">Live valuation, quality, trend and financial context</p>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {annual.length ? `${annual.length} annual periods` : "Live snapshot"}
        </span>
      </div>

      <FundamentalCards fundamentals={fundamentals} insights={insights} />

      {(fundamentals?.recommendationKey || fundamentals?.targetMeanPrice != null || fundamentals?.longBusinessSummary) && (
        <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
          {fundamentals?.recommendationKey && (
            <div className="rounded-lg border bg-card p-4 flex flex-wrap items-center gap-4">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Analyst Consensus</p>
                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                  fundamentals.recommendationKey === "buy" || fundamentals.recommendationKey === "strong_buy"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : fundamentals.recommendationKey === "sell" || fundamentals.recommendationKey === "strong_sell"
                      ? "bg-rose-500/10 text-rose-400"
                      : "bg-secondary text-muted-foreground"
                }`}>{fundamentals.recommendationKey.replace(/_/g, " ")}</span>
              </div>
              {fundamentals.targetMeanPrice != null && (
                <div className="border-l pl-4">
                  <p className="text-[10px] text-muted-foreground mb-1">Mean Price Target</p>
                  <p className="font-bold text-sm">{formatPrice(fundamentals.targetMeanPrice)}</p>
                </div>
              )}
            </div>
          )}
          {fundamentals?.longBusinessSummary && (
            <div className="rounded-lg border bg-card p-4 min-w-0">
              <h3 className="text-xs font-semibold mb-1">Company Overview</h3>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{fundamentals.longBusinessSummary}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Trend & Quality Checks</h3>
            <span className="text-[10px] text-muted-foreground">Derived from reported values</span>
          </div>
          <div className="space-y-2">
            {checks.map((check) => (
              <div key={check.label} className="flex items-center justify-between gap-3 border-b border-border/50 last:border-0 pb-2 last:pb-0">
                <span className="flex items-center gap-2 text-xs">
                  {check.value == null
                    ? <CircleHelp className="h-3.5 w-3.5 text-muted-foreground" />
                    : check.good(check.value)
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      : <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />}
                  {check.label}
                </span>
                <span className={`text-xs font-semibold tabular-nums ${check.value == null ? "text-muted-foreground" : check.good(check.value) ? "text-emerald-400" : "text-amber-300"}`}>
                  {check.value == null ? "Not available" : "currency" in check && check.currency ? crore(check.value) : changeLabel(check.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Relative Performance vs Nifty 50</h3>
          <div className="grid grid-cols-3 gap-2">
            {([
              { label: "1M", stock: relative.stock.oneMonth, nifty: relative.nifty50.oneMonth, vs: relative.vsNifty50.oneMonth },
              { label: "3M", stock: relative.stock.threeMonth, nifty: relative.nifty50.threeMonth, vs: relative.vsNifty50.threeMonth },
              { label: "1Y", stock: relative.stock.oneYear, nifty: relative.nifty50.oneYear, vs: relative.vsNifty50.oneYear },
            ] satisfies { label: string; stock?: number; nifty?: number; vs?: number }[]).map(({ label, stock, nifty, vs }) => (
              <div key={label} className="rounded-md bg-secondary/40 p-3">
                <div className="text-[10px] text-muted-foreground">{label}</div>
                <div className={`text-sm font-bold mt-1 ${vs == null ? "text-muted-foreground" : vs >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {changeLabel(vs)}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Stock {changeLabel(stock)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Nifty {changeLabel(nifty)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {annual.length > 0 ? (
        <>
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="text-sm font-semibold">Growth Trends</h3>
            <span className="text-[10px] text-muted-foreground">Indexed to first reported period = 100</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <CompareCard title="Sales vs Assets" data={annual} leftKey="revenue" rightKey="totalAssets" leftLabel="Sales" rightLabel="Assets" />
            <CompareCard title="Operating Cash Flow vs PAT" data={annual} leftKey="operatingCashFlow" rightKey="netIncome" leftLabel="OCF" rightLabel="PAT" colors={["#34d399", "#f59e0b"]} />
            <CompareCard title="Sales vs Net Profit" data={annual} leftKey="revenue" rightKey="netIncome" leftLabel="Sales" rightLabel="Net profit" colors={["#38bdf8", "#a78bfa"]} />
            <CompareCard title="Sales vs Debt" data={annual} leftKey="revenue" rightKey="debt" leftLabel="Sales" rightLabel="Debt" colors={["#38bdf8", "#fb7185"]} />
          </div>
        </>
      ) : (
        <DataNotice />
      )}
    </div>
  );
}

function FinancialPanel({
  title,
  description,
  data,
  charts,
}: {
  title: string;
  description: string;
  data: FinancialSeriesPoint[];
  charts: {
    key: keyof FinancialSeriesPoint;
    title: string;
    color: string;
    unit?: "currencyCr" | "percent" | "eps" | "days";
  }[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{data.length} reported periods</span>
      </div>
      {data.length === 0 ? (
        <DataNotice />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {charts.map((chart) => (
            <TrendCard
              key={String(chart.key)}
              title={chart.title}
              data={data}
              dataKey={chart.key}
              color={chart.color}
              unit={chart.unit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ShareholdingPanel({ ownership, insights }: { ownership?: OwnershipData; insights: StockInsights }) {
  const m = insights.metrics;
  const hasOwnershipData =
    ownership != null &&
    [
      ownership.promoterHolding,
      ownership.promoterPledged,
      ownership.institutionalHolding,
      ownership.publicHolding,
      ownership.quarterlyChange,
    ].some((value) => value != null);
  if (!hasOwnershipData && m.heldPercentInsiders == null && m.heldPercentInstitutions == null) {
    return <DataNotice>Ownership data is not available from the current NSE/Yahoo response for this symbol.</DataNotice>;
  }
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">Shareholding</h2>
        <p className="text-xs text-muted-foreground mt-1">Reported ownership and pledge data, when available</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Promoter Holding" value={ownership?.promoterHolding != null ? formatPercent(ownership.promoterHolding) : "—"} />
        <MetricCard label="Promoter Pledged" value={ownership?.promoterPledged != null ? formatPercent(ownership.promoterPledged) : "—"} tone="warning" />
        <MetricCard label="Institutional Holding" value={ownership?.institutionalHolding != null ? formatPercent(ownership.institutionalHolding) : m.heldPercentInstitutions != null ? formatPercent(m.heldPercentInstitutions) : "—"} />
        <MetricCard label="Public Holding" value={ownership?.publicHolding != null ? formatPercent(ownership.publicHolding) : "—"} />
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between text-xs">
          <span>Quarterly promoter change</span>
          <span className={(ownership?.quarterlyChange ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}>
            {ownership?.quarterlyChange == null
              ? "—"
              : `${ownership.quarterlyChange >= 0 ? "+" : ""}${ownership.quarterlyChange.toFixed(2)} pp`}
          </span>
        </div>
          <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden" role={ownership?.promoterHolding != null ? "progressbar" : undefined} aria-label={ownership?.promoterHolding != null ? "Promoter holding" : undefined} aria-valuemin={ownership?.promoterHolding != null ? 0 : undefined} aria-valuemax={ownership?.promoterHolding != null ? 100 : undefined} aria-valuenow={ownership?.promoterHolding != null ? Math.min(100, Math.max(0, ownership.promoterHolding)) : undefined}>
          <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, Math.max(0, ownership?.promoterHolding ?? 0))}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          {ownership?.quarter ?? "Latest available quarter"} · {ownership?.source ?? "Yahoo Finance"}
          {ownership?.institutionalHolding == null && m.heldPercentInstitutions != null
            ? " (institutional estimate from Yahoo Finance)"
            : ""}
        </p>
      </div>
    </div>
  );
}

function PromoterActivityPanel({ ownership }: { ownership?: OwnershipData }) {
  const hasData =
    ownership != null &&
    [ownership.promoterHolding, ownership.promoterPledged, ownership.quarterlyChange].some(
      (value) => value != null,
    );
  if (!hasData) {
    return <DataNotice>Promoter holding and quarter-over-quarter movement are not available from the NSE response for this symbol.</DataNotice>;
  }

  const change = ownership?.quarterlyChange;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">Promoter Activity</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Latest reported NSE shareholding movement{ownership?.quarter ? ` · ${ownership.quarter}` : ""}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Promoter Holding" value={ownership?.promoterHolding != null ? formatPercent(ownership.promoterHolding) : "—"} />
        <MetricCard label="Pledged Shares" value={ownership?.promoterPledged != null ? formatPercent(ownership.promoterPledged) : "—"} tone="warning" />
        <MetricCard
          label="Quarterly Change"
          value={change != null ? `${change >= 0 ? "+" : ""}${change.toFixed(2)} pp` : "—"}
          tone={change == null ? "default" : change >= 0 ? "positive" : "negative"}
        />
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between text-xs">
          <span>Promoter holding</span>
          <span className="font-semibold tabular-nums">
            {ownership?.promoterHolding != null ? formatPercent(ownership.promoterHolding) : "—"}
          </span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden" role={ownership?.promoterHolding != null ? "progressbar" : undefined} aria-label={ownership?.promoterHolding != null ? "Promoter holding" : undefined} aria-valuemin={ownership?.promoterHolding != null ? 0 : undefined} aria-valuemax={ownership?.promoterHolding != null ? 100 : undefined} aria-valuenow={ownership?.promoterHolding != null ? Math.min(100, Math.max(0, ownership.promoterHolding)) : undefined}>
          <div
            className="h-full rounded-full bg-cyan-400"
            style={{ width: `${Math.min(100, Math.max(0, ownership?.promoterHolding ?? 0))}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Source: {ownership?.source ?? "NSE India"}. This endpoint reports quarter-level holding changes, not individual promoter transactions.
        </p>
      </div>
    </div>
  );
}

function BulkDealsPanel({ deals, symbol }: { deals: BulkDeal[]; symbol: string }) {
  const filtered = deals.filter((deal) => deal.symbol.replace(/\.(NS|BO)$/i, "").toUpperCase() === symbol.replace(/\.(NS|BO)$/i, "").toUpperCase());
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-semibold">Bulk Deals</h2>
        <p className="text-xs text-muted-foreground mt-1">NSE bulk deal records for {symbol.replace(/\.(NS|BO)$/i, "")}</p>
      </div>
      {filtered.length === 0 ? (
        <DataNotice>There are no matching NSE bulk-deal records in the current lookback window.</DataNotice>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b bg-muted/30">
              {["Date", "Client", "Type", "Quantity", "Price", "Remarks"].map((header) => <th key={header} scope="col" className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{header}</th>)}
            </tr></thead>
            <tbody>{filtered.map((deal, index) => (
              <tr key={`${deal.date}-${deal.clientName}-${index}`} className="border-b last:border-0 hover:bg-accent/20">
                <td className="px-3 py-2 whitespace-nowrap">{deal.date || "—"}</td>
                <td className="px-3 py-2 font-medium">{deal.clientName || "—"}</td>
                <td className={`px-3 py-2 font-semibold ${deal.dealType === "BUY" ? "text-emerald-400" : "text-rose-400"}`}>{deal.dealType || "—"}</td>
                <td className="px-3 py-2 tabular-nums">{formatVolume(deal.quantity)}</td>
                <td className="px-3 py-2 tabular-nums">{formatPrice(deal.price)}</td>
                <td className="px-3 py-2 text-muted-foreground">{deal.remarks || "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function StockInsightsDashboard({
  tab,
  insights,
  insightsLoading,
  insightsError,
  fundamentals,
  ownership,
  bulkDeals,
  bulkDealsLoading,
  symbol,
}: {
  tab: InsightTab;
  insights?: StockInsights;
  insightsLoading?: boolean;
  insightsError?: boolean;
  fundamentals?: FundamentalSnapshot;
  ownership?: OwnershipData;
  bulkDeals?: BulkDeal[];
  bulkDealsLoading?: boolean;
  symbol: string;
}) {
  if (!insights && tab !== "Bulk Deal") {
    if (insightsError) {
      return <DataNotice>Yahoo Finance or NSE could not be reached for this request. Please try again shortly.</DataNotice>;
    }
    return <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
      {insightsLoading === false ? "No insights returned for this symbol." : "Loading live insight data…"}
    </div>;
  }
  if (tab === "Advanced Insights" && insights) return <AdvancedPanel insights={insights} fundamentals={fundamentals} />;
  if (tab === "Quarterly" && insights) {
    return <FinancialPanel title="Quarterly Results" description="Quarterly revenue, profitability and earnings trends from Yahoo Finance." data={insights.quarterly} charts={[
      { key: "revenue", title: "Revenue", color: "#38bdf8" },
      { key: "operatingIncome", title: "Operating Profit", color: "#34d399" },
      { key: "operatingMargin", title: "Operating Margin", color: "#f59e0b", unit: "percent" },
      { key: "netIncome", title: "Net Profit", color: "#a78bfa" },
      { key: "otherIncome", title: "Other Non-operating Income / Expense", color: "#f97316" },
      { key: "eps", title: "EPS", color: "#fb7185", unit: "eps" },
    ]} />;
  }
  if (tab === "Profit & Loss" && insights) {
    return <FinancialPanel title="Profit & Loss Trends" description="Annual income statement history with margin and earnings context." data={insights.annual} charts={[
      { key: "revenue", title: "Sales / Revenue", color: "#38bdf8" },
      { key: "grossProfit", title: "Gross Profit", color: "#60a5fa" },
      { key: "operatingIncome", title: "Operating Profit", color: "#34d399" },
      { key: "operatingExpense", title: "Operating Expense", color: "#fb7185" },
      { key: "otherIncome", title: "Other Non-operating Income / Expense", color: "#f97316" },
      { key: "operatingMargin", title: "Operating Margin", color: "#f59e0b", unit: "percent" },
      { key: "netIncome", title: "Net Profit / PAT", color: "#a78bfa" },
      { key: "eps", title: "EPS", color: "#fb7185", unit: "eps" },
    ]} />;
  }
  if (tab === "Balance Sheet" && insights) {
    return <FinancialPanel title="Balance Sheet Trends" description="Annual assets, capital structure and working-capital history." data={insights.annual} charts={[
      { key: "totalAssets", title: "Total Assets", color: "#38bdf8" },
      { key: "commonStock", title: "Equity Capital", color: "#a78bfa" },
      { key: "reserves", title: "Reserves", color: "#c084fc" },
      { key: "fixedAssets", title: "Fixed Assets", color: "#94a3b8" },
      { key: "capitalWorkInProgress", title: "Capital Work in Progress", color: "#f97316" },
      { key: "currentAssets", title: "Current Assets", color: "#34d399" },
      { key: "inventory", title: "Inventory", color: "#f59e0b" },
      { key: "cash", title: "Cash & Equivalents", color: "#ec4899" },
      { key: "receivables", title: "Trade Receivables", color: "#22d3ee" },
      { key: "payables", title: "Trade Payables", color: "#fb923c" },
      { key: "workingCapital", title: "Working Capital", color: "#10b981" },
      { key: "debt", title: "Total Debt", color: "#fb7185" },
      { key: "inventoryDays", title: "Inventory Days", color: "#fbbf24", unit: "days" },
      { key: "receivableDays", title: "Receivable Days", color: "#22d3ee", unit: "days" },
      { key: "payableDays", title: "Payable Days", color: "#fb923c", unit: "days" },
    ]} />;
  }
  if (tab === "Cashflow" && insights) {
    return <FinancialPanel title="Cash Flow Trends" description="Operating, free, investing and financing cash flows over reported periods." data={insights.annual} charts={[
      { key: "operatingCashFlow", title: "Operating Cash Flow", color: "#34d399" },
      { key: "freeCashFlow", title: "Free Cash Flow", color: "#f59e0b" },
      { key: "investingCashFlow", title: "Investing Cash Flow", color: "#a78bfa" },
      { key: "financingCashFlow", title: "Financing Cash Flow", color: "#fb7185" },
      { key: "capitalExpenditure", title: "Capital Expenditure", color: "#60a5fa" },
    ]} />;
  }
  if (tab === "Shareholding" && insights) return <ShareholdingPanel ownership={ownership} insights={insights} />;
  if (tab === "Promoter Activity" && insights) return <PromoterActivityPanel ownership={ownership} />;
  if (tab === "Bulk Deal") {
    if (bulkDealsLoading) return <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">Loading NSE bulk deal records…</div>;
    return <BulkDealsPanel deals={bulkDeals ?? []} symbol={symbol} />;
  }
  return null;
}