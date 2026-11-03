"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { ArrowDown, ArrowUp, Globe2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { apiUrl } from "@/lib/api-url";
import { formatPrice, formatChangePercent, changeColor } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SectorIndex {
  symbol: string;
  shortName: string;
  sectorName: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
}

interface SectorPerf {
  sector: string;
  symbol: string;
  name: string;
  change1d: number;
  change1w: number;
  change1m: number;
  change3m: number;
  rsRatio: number;
  rsMomentum: number;
  quadrant: "Leading" | "Weakening" | "Lagging" | "Improving";
}

interface IndustryRrgPoint {
  industry: string;
  stockCount: number;
  historyCount: number;
  change1d: number | null;
  change1w: number | null;
  change1m: number | null;
  change3m: number | null;
  rsRatio: number | null;
  rsMomentum: number | null;
  quadrant: "Leading" | "Weakening" | "Lagging" | "Improving" | null;
  snapshots: {
    date: string;
    return5d: number | null;
    trend14v66: number | null;
    signal: "Strong" | "Moderate" | "Mixed / Weak" | "Bearish" | null;
  }[];
}

interface HeatmapIndustry {
  industry: string;
  change1d: number | null;
  stockCount: number;
  pricedCount: number;
  stocks: {
    symbol: string;
    name: string;
    sector: string | null;
    change1d: number | null;
  }[];
}

interface HeatmapData {
  totalStocks: number;
  industryCount: number;
  unclassifiedCount: number;
  industries: HeatmapIndustry[];
}

const QUADRANT_COLOR: Record<string, string> = {
  Leading: "#22c55e",
  Weakening: "#f59e0b",
  Lagging: "#ef4444",
  Improving: "#22d3ee",
};

const QUADRANT_BG: Record<string, string> = {
  Leading: "bg-green-500/10 text-green-500",
  Weakening: "bg-amber-500/10 text-amber-500",
  Lagging: "bg-red-500/10 text-red-500",
  Improving: "bg-cyan-500/10 text-cyan-500",
};

const TABS = ["Heatmap", "Performance Matrix", "RRG Chart", "Sector Performance", "Indices"] as const;
type Tab = (typeof TABS)[number];
type IndustrySortMetric = "1D" | "1W" | "1M" | "3M";
type IndustrySortDirection = "asc" | "desc";

const INDUSTRY_SORT_OPTIONS: { value: IndustrySortMetric; label: string }[] = [
  { value: "1D", label: "Daily growth" },
  { value: "1W", label: "1-week growth" },
  { value: "1M", label: "1-month growth" },
  { value: "3M", label: "3-month growth" },
];

const MATRIX_SIGNAL_STYLES: Record<string, string> = {
  Strong: "bg-emerald-500/25 text-emerald-300",
  Moderate: "bg-green-500/15 text-green-300",
  "Mixed / Weak": "bg-amber-500/20 text-amber-300",
  Bearish: "bg-red-500/20 text-red-300",
};

function heatColor(chg: number): string {
  if (chg >= 2) return "bg-green-600/80";
  if (chg >= 1) return "bg-green-500/60";
  if (chg >= 0.3) return "bg-green-500/40";
  if (chg >= 0) return "bg-green-500/20";
  if (chg >= -0.3) return "bg-red-500/20";
  if (chg >= -1) return "bg-red-500/40";
  if (chg >= -2) return "bg-red-500/60";
  return "bg-red-700/80";
}

function IndustrySortControls({
  metric,
  direction,
  onMetricChange,
  onDirectionToggle,
}: {
  metric: IndustrySortMetric;
  direction: IndustrySortDirection;
  onMetricChange: (metric: IndustrySortMetric) => void;
  onDirectionToggle: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="space-y-1">
        <span className="block text-xs font-medium text-muted-foreground">Sort industries by</span>
        <Select value={metric} onValueChange={(value) => onMetricChange(value as IndustrySortMetric)}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRY_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <button
        type="button"
        onClick={onDirectionToggle}
        aria-label={`Sort ${direction === "desc" ? "ascending" : "descending"}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-accent"
      >
        {direction === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
        {direction === "desc" ? "Highest first" : "Lowest first"}
      </button>
    </div>
  );
}

function HeatmapCell({ item }: { item: HeatmapIndustry }) {
  const chg = item.change1d;
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold">{item.industry}</h3>
          <p className="text-[10px] text-muted-foreground">
            {item.stockCount} stocks · {item.pricedCount} with live data
          </p>
        </div>
        <span
          className={`rounded px-2 py-1 text-xs font-bold tabular-nums ${
            chg === null
              ? "bg-muted text-muted-foreground"
              : `${heatColor(chg)} text-white`
          }`}
        >
          {chg === null ? "—" : `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`}
        </span>
      </header>
      <div className="grid grid-cols-2 gap-1.5 p-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {item.stocks.map((stock) => (
          <Link
            key={stock.symbol}
            href={`/stock/${encodeURIComponent(stock.symbol)}`}
            title={`${stock.name}${stock.sector ? ` · ${stock.sector}` : ""}${stock.change1d === null ? "" : `: ${stock.change1d >= 0 ? "+" : ""}${stock.change1d.toFixed(2)}%`}`}
            className={`flex min-h-14 flex-col justify-between rounded-md border border-white/5 p-2 transition-opacity hover:opacity-80 ${
              stock.change1d === null
                ? "bg-muted/50 text-muted-foreground"
                : `${heatColor(stock.change1d)} text-white`
            }`}
          >
            <span className="truncate text-[10px] font-semibold">
              {stock.symbol.replace(/\.NS$/i, "")}
            </span>
            <span className="text-xs font-bold tabular-nums">
              {stock.change1d === null
                ? "—"
                : `${stock.change1d >= 0 ? "+" : ""}${stock.change1d.toFixed(2)}%`}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function IndustryOverviewRow({
  item,
  onSelect,
}: {
  item: HeatmapIndustry;
  onSelect: () => void;
}) {
  const change = item.change1d;
  const previewStocks = item.stocks.slice(0, 6);
  return (
    <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,4fr)] gap-2 border-b border-border/70 p-1.5 last:border-0 sm:grid-cols-[minmax(13rem,1fr)_minmax(0,5fr)]">
      <button
        type="button"
        onClick={onSelect}
        title={`Show all ${item.stockCount} ${item.industry} stocks`}
        className="min-w-0 rounded px-2 py-1 text-left transition-colors hover:bg-accent/50"
      >
        <span className="block truncate text-xs font-semibold text-primary">{item.industry}</span>
        <span className="block truncate text-[10px] text-muted-foreground">
          {item.stockCount} stocks · {change === null ? "—" : formatChangePercent(change)}
        </span>
      </button>
      <div className="grid min-w-0 grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
        {previewStocks.map((stock) => (
          <Link
            key={stock.symbol}
            href={`/stock/${encodeURIComponent(stock.symbol)}`}
            title={`${stock.name}${stock.change1d === null ? "" : `: ${formatChangePercent(stock.change1d)}`}`}
            className={`flex min-h-9 min-w-0 items-center justify-between gap-1 rounded px-1.5 py-1 text-[10px] text-white transition-opacity hover:opacity-80 ${
              stock.change1d === null ? "bg-muted/70 text-muted-foreground" : heatColor(stock.change1d)
            }`}
          >
            <span className="truncate font-semibold">{stock.symbol.replace(/\.NS$/i, "")}</span>
            <span className="shrink-0 tabular-nums">
              {stock.change1d === null ? "—" : `${stock.change1d >= 0 ? "+" : ""}${stock.change1d.toFixed(1)}%`}
            </span>
          </Link>
        ))}
        {item.stockCount > previewStocks.length && (
          <button
            type="button"
            onClick={onSelect}
            className="min-h-9 rounded border border-dashed border-border px-1 text-[10px] text-muted-foreground hover:bg-accent/50"
          >
            +{item.stockCount - previewStocks.length} more
          </button>
        )}
      </div>
    </div>
  );
}

function IndustryRRGDot(props: {
  cx?: number;
  cy?: number;
  payload?: IndustryRrgPoint;
  selectedIndustry: string;
}) {
  const { cx = 0, cy = 0, payload } = props;
  if (!payload?.quadrant) return null;
  const color = QUADRANT_COLOR[payload.quadrant];
  const selected = payload.industry === props.selectedIndustry;
  return (
    <g>
      {selected && (
        <circle
          cx={cx}
          cy={cy}
          r={10}
          fill="none"
          stroke="white"
          strokeOpacity={0.9}
          strokeWidth={2}
        />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={selected ? 6 : 4.5}
        fill={color}
        fillOpacity={selected ? 1 : 0.78}
        stroke="hsl(222,47%,10%)"
        strokeWidth={1}
      />
    </g>
  );
}

export default function SectorsPage() {
  const [tab, setTab] = useState<Tab>("Heatmap");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedSector, setSelectedSector] = useState("All sectors");
  const [selectedIndustry, setSelectedIndustry] = useState("All industries");
  const [industrySortMetric, setIndustrySortMetric] = useState<IndustrySortMetric>("1D");
  const [industrySortDirection, setIndustrySortDirection] = useState<IndustrySortDirection>("desc");
  const [matrixSignalFilter, setMatrixSignalFilter] = useState("All signals");
  const [selectedRrgIndustry, setSelectedRrgIndustry] = useState("All industries");
  const [rrgQuadrantFilter, setRrgQuadrantFilter] = useState<
    "All" | IndustryRrgPoint["quadrant"]
  >("All");

  const { data: indices = [], isLoading: indicesLoading, isError: indicesError } = useQuery<SectorIndex[]>({
    queryKey: ["market", "sector-indices"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/sector-indices"));
      if (!response.ok) throw new Error("Sector indices request failed");
      return response.json();
    },
    refetchInterval: 60_000,
  });

  const { data: performance = [], isLoading: perfLoading, isError: perfError } = useQuery<SectorPerf[]>({
    queryKey: ["market", "sector-performance"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/sector-performance"));
      if (!response.ok) throw new Error("Sector performance request failed");
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const {
    data: industryRrg = [],
    isLoading: industryRrgLoading,
    isError: industryRrgError,
  } = useQuery<IndustryRrgPoint[]>({
    queryKey: ["market", "industry-rrg"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/industry-rrg"));
      if (!response.ok) throw new Error("Industry RRG request failed");
      return response.json();
    },
    staleTime: 15 * 60 * 1000,
    enabled:
      tab === "RRG Chart" ||
      tab === "Performance Matrix" ||
      (tab === "Heatmap" && industrySortMetric !== "1D"),
  });

  const {
    data: heatmap,
    isLoading: heatLoading,
    isError: heatError,
  } = useQuery<HeatmapData>({
    queryKey: ["market", "heatmap", "all-nse-industries"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/heatmap"));
      if (!response.ok) throw new Error("Unable to load industry heatmap.");
      const data: unknown = await response.json();
      if (
        !data ||
        typeof data !== "object" ||
        !("industries" in data) ||
        !Array.isArray(data.industries)
      ) {
        throw new Error("Invalid industry heatmap data.");
      }
      return data as HeatmapData;
    },
    staleTime: 15 * 60 * 1000,
  });

  const quadrantShifts = performance.filter(s =>
    s.quadrant === "Weakening" || s.quadrant === "Improving"
  );
  const industryRrgPoints = industryRrg.filter(
    (point): point is IndustryRrgPoint & { rsRatio: number; rsMomentum: number; quadrant: NonNullable<IndustryRrgPoint["quadrant"]> } =>
      point.rsRatio != null && point.rsMomentum != null && point.quadrant != null,
  );
  const unavailableRrgIndustries = industryRrg.filter(
    (point) => point.rsRatio == null || point.rsMomentum == null || point.quadrant == null,
  );
  const visibleRrgPoints = industryRrgPoints.filter(
    (point) =>
      rrgQuadrantFilter === "All" || point.quadrant === rrgQuadrantFilter,
  );
  const selectedRrgPoint = industryRrgPoints.find(
    (point) => point.industry === selectedRrgIndustry,
  );
  const industryQuadrantCounts = industryRrgPoints.reduce(
    (counts, point) => {
      counts[point.quadrant]++;
      return counts;
    },
    { Leading: 0, Weakening: 0, Improving: 0, Lagging: 0 },
  );
  const industries = useMemo(() => heatmap?.industries ?? [], [heatmap?.industries]);
  const sectors = useMemo(
    () => [...new Set(industries.map((industry) =>
      industry.stocks.find((stock) => stock.sector)?.sector ?? "Unclassified",
    ))].sort(),
    [industries],
  );
  const availableIndustries = useMemo(
    () => industries.flatMap((industry) => {
      const stocks = selectedSector === "All sectors"
        ? industry.stocks
        : industry.stocks.filter(
          (stock) => (stock.sector ?? "Unclassified") === selectedSector,
        );
      if (stocks.length === 0) return [];
      const changes = stocks
        .map((stock) => stock.change1d)
        .filter((change): change is number => change !== null);
      return [{
        ...industry,
        stocks,
        stockCount: stocks.length,
        pricedCount: changes.length,
        change1d: changes.length > 0
          ? changes.reduce((total, change) => total + change, 0) / changes.length
          : null,
      }];
    }),
    [industries, selectedSector],
  );
  const industryGrowthByName = useMemo(
    () => new Map(industryRrg.map((industry) => [industry.industry, industry])),
    [industryRrg],
  );
  const sortedAvailableIndustries = useMemo(
    () => [...availableIndustries].sort((a, b) => {
      const getGrowth = (industry: HeatmapIndustry) => {
        if (industrySortMetric === "1D") return industry.change1d;
        const values = industryGrowthByName.get(industry.industry);
        if (!values) return null;
        if (industrySortMetric === "1W") return values.change1w;
        if (industrySortMetric === "1M") return values.change1m;
        return values.change3m;
      };
      const left = getGrowth(a);
      const right = getGrowth(b);
      if (left == null) return right == null ? a.industry.localeCompare(b.industry) : 1;
      if (right == null) return -1;
      const compared = (left - right) * (industrySortDirection === "desc" ? -1 : 1);
      return compared || a.industry.localeCompare(b.industry);
    }),
    [availableIndustries, industryGrowthByName, industrySortDirection, industrySortMetric],
  );
  const sortedRrgIndustries = useMemo(
    () => [...industryRrgPoints].sort((a, b) => {
      const left = industrySortMetric === "1D"
        ? a.change1d
        : industrySortMetric === "1W"
          ? a.change1w
          : industrySortMetric === "1M"
            ? a.change1m
            : a.change3m;
      const right = industrySortMetric === "1D"
        ? b.change1d
        : industrySortMetric === "1W"
          ? b.change1w
          : industrySortMetric === "1M"
            ? b.change1m
            : b.change3m;
      if (left == null) return right == null ? a.industry.localeCompare(b.industry) : 1;
      if (right == null) return -1;
      const compared = (left - right) * (industrySortDirection === "desc" ? -1 : 1);
      return compared || a.industry.localeCompare(b.industry);
    }),
    [industryRrgPoints, industrySortDirection, industrySortMetric],
  );
  const matrixDates = industryRrg[0]?.snapshots
    .map((snapshot) => snapshot.date)
    .reverse() ?? [];
  const visibleMatrixIndustries = sortedRrgIndustries.filter((industry) =>
    matrixSignalFilter === "All signals" ||
    industry.snapshots.some((snapshot) => snapshot.signal === matrixSignalFilter),
  );
  const selectedIndustryData = availableIndustries.find(
    (industry) => industry.industry === selectedIndustry,
  );
  const visibleIndustryCount = availableIndustries.length;
  const visibleStockCount = availableIndustries.reduce(
    (count, industry) => count + industry.stockCount,
    0,
  );

  const toggleExpand = (s: string) =>
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(s)) {
        n.delete(s);
      } else {
        n.add(s);
      }
      return n;
    });

  return (
    <div className="space-y-5 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-primary" />
          Sectors
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Sector indices, heatmap, and rotation analysis</p>
      </div>

      {/* Quadrant shifts alert */}
      {quadrantShifts.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-sm text-amber-400 font-medium">{quadrantShifts.length} sector quadrant shifts detected</span>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >{t}</button>
        ))}
      </div>

      {/* Heatmap tab */}
      {tab === "Heatmap" && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border bg-card p-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Sector</span>
                  <Select
                    value={selectedSector}
                    onValueChange={(value) => {
                      setSelectedSector(value);
                      setSelectedIndustry("All industries");
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All sectors">All sectors</SelectItem>
                      {sectors.map((sector) => (
                        <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Industry</span>
                  <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                    <SelectTrigger className="w-full sm:w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All industries">All industries</SelectItem>
                      {availableIndustries.map((industry) => (
                        <SelectItem key={industry.industry} value={industry.industry}>
                          {industry.industry} ({industry.stockCount})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <IndustrySortControls
                metric={industrySortMetric}
                direction={industrySortDirection}
                onMetricChange={setIndustrySortMetric}
                onDirectionToggle={() =>
                  setIndustrySortDirection((direction) => direction === "desc" ? "asc" : "desc")
                }
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Daily growth uses all priced stocks; 1W, 1M, and 3M growth use the largest available representatives weighted by market cap.
            </p>
            <p className="text-xs text-muted-foreground">
              {heatmap
                ? `${visibleStockCount.toLocaleString()} NSE stocks · ${visibleIndustryCount} industries${selectedIndustryData ? ` · ${selectedIndustryData.pricedCount.toLocaleString()} with live prices` : ""}`
                : "Loading live NSE industry data"}
            </p>
            {industrySortMetric !== "1D" && industryRrgLoading && (
              <p role="status" className="text-xs text-muted-foreground">
                Loading historical industry growth to sort the list…
              </p>
            )}
          </div>
          {!heatLoading && !heatError && (heatmap?.unclassifiedCount ?? 0) > 0 && (
            <p className="text-xs text-amber-500">
              Provider industry labels are missing for {heatmap?.unclassifiedCount.toLocaleString()} stocks; they remain included under Unclassified.
            </p>
          )}
          {heatLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-32 rounded-lg bg-accent/40 animate-pulse" />)}
            </div>
          ) : heatError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Industry heatmap data is currently unavailable. Please try again shortly.
            </div>
          ) : (
            <>
              {selectedIndustryData ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelectedIndustry("All industries")}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    ← All industries
                  </button>
                  <HeatmapCell item={selectedIndustryData} />
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border bg-card">
                  <div className="min-w-136">
                    <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,4fr)] gap-2 border-b bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid-cols-[minmax(13rem,1fr)_minmax(0,5fr)]">
                      <span>Industry · stocks</span>
                      <span>Top stocks by market cap · daily change</span>
                    </div>
                  {sortedAvailableIndustries.map((industry) => (
                    <IndustryOverviewRow
                      key={industry.industry}
                      item={industry}
                      onSelect={() => setSelectedIndustry(industry.industry)}
                    />
                  ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="font-medium">Color scale:</span>
                {[">+2%", "+1-2%", "0-1%", "-1-0%", "-2--1%", "<-2%"].map((l, i) => (
                  <span key={l} className="flex items-center gap-1">
                    <span className={`inline-block w-3 h-3 rounded ${["bg-green-600/80","bg-green-500/60","bg-green-500/30","bg-red-500/30","bg-red-500/60","bg-red-700/80"][i]}`} />
                    {l}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "Performance Matrix" && (
        <section className="space-y-4 rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold">Industry Performance Matrix</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Recent NSE sessions · market-cap-weighted top three stocks per industry · 5D return and 14D momentum versus the 66D pace
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <IndustrySortControls
                metric={industrySortMetric}
                direction={industrySortDirection}
                onMetricChange={setIndustrySortMetric}
                onDirectionToggle={() =>
                  setIndustrySortDirection((direction) => direction === "desc" ? "asc" : "desc")
                }
              />
              <label className="space-y-1">
                <span className="block text-xs font-medium text-muted-foreground">Signal</span>
                <Select value={matrixSignalFilter} onValueChange={setMatrixSignalFilter}>
                  <SelectTrigger className="h-9 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["All signals", "Strong", "Moderate", "Mixed / Weak", "Bearish"].map((signal) => (
                      <SelectItem key={signal} value={signal}>{signal}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 border-y py-3 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Signals:</span>
            <span><b className="text-emerald-300">Strong</b> — 14D pace improving and 5D &gt; 1.5%</span>
            <span><b className="text-green-300">Moderate</b> — improving and 5D ≥ 0.5%</span>
            <span><b className="text-amber-300">Mixed / Weak</b> — mixed momentum</span>
            <span><b className="text-red-300">Bearish</b> — below 66D pace and negative 5D</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            14D vs 66D pace is the 14-day return minus the 66-day return scaled to a 14-day period. Signal filters keep industries that matched on at least one displayed session.
          </p>

          {industryRrgLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Loading recent industry history…
            </div>
          ) : industryRrgError ? (
            <div role="alert" className="p-8 text-center text-sm text-amber-500">
              Industry history is unavailable. Please try again later.
            </div>
          ) : visibleMatrixIndustries.length === 0 || matrixDates.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              No industry sessions match this signal filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-300 border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/40 text-left">
                    <th className="sticky left-0 z-10 min-w-56 border-b border-r bg-muted/90 px-3 py-3 font-semibold">
                      Industry
                    </th>
                    {matrixDates.map((date) => (
                      <th key={date} className="min-w-44 border-b px-3 py-3 text-center font-semibold">
                        {new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleMatrixIndustries.map((industry) => {
                    const snapshotsByDate = new Map(
                      industry.snapshots.map((snapshot) => [snapshot.date, snapshot]),
                    );
                    const oneMonthGrowth = industry.change1m;
                    return (
                      <tr key={industry.industry} className="border-b last:border-0">
                        <th className="sticky left-0 z-10 border-r bg-card px-3 py-2 text-left">
                          <span className="block max-w-56 truncate font-semibold">{industry.industry}</span>
                          <span className={`text-[10px] font-normal ${oneMonthGrowth == null ? "text-muted-foreground" : changeColor(oneMonthGrowth)}`}>
                            1M {formatChangePercent(oneMonthGrowth)}
                          </span>
                        </th>
                        {matrixDates.map((date) => {
                          const snapshot = snapshotsByDate.get(date);
                          if (!snapshot || snapshot.signal == null) {
                            return (
                              <td key={date} className="border-l p-2 text-center text-muted-foreground">—</td>
                            );
                          }
                          const trendPositive = snapshot.trend14v66 != null && snapshot.trend14v66 > 0;
                          const fiveDayPositive = snapshot.return5d != null && snapshot.return5d >= 0;
                          return (
                            <td
                              key={date}
                              title={`${industry.industry} · ${date} · ${snapshot.signal}`}
                              className={`border-l p-2 ${MATRIX_SIGNAL_STYLES[snapshot.signal]}`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[9px] opacity-75">14D vs 66D pace</span>
                                  <span className={`font-semibold tabular-nums ${trendPositive ? "text-emerald-300" : "text-red-300"}`}>
                                    {formatChangePercent(snapshot.trend14v66)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[9px] opacity-75">5D</span>
                                  <span className={`font-semibold tabular-nums ${fiveDayPositive ? "text-emerald-300" : "text-red-300"}`}>
                                    {formatChangePercent(snapshot.return5d)}
                                  </span>
                                </div>
                                <div className="border-t border-current/10 pt-1 text-center text-[9px] font-semibold">
                                  {snapshot.signal}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* RRG Chart tab */}
      {tab === "RRG Chart" && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <div>
                <h2 className="font-semibold">Industry Relative Rotation Graph</h2>
                <p className="text-xs text-muted-foreground">
                  All NSE industries vs NIFTY 50 · up to 3 largest listings per industry, market-cap-weighted where available
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {Object.entries(QUADRANT_COLOR).map(([q, c]) => (
                  <span key={q} className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                    {q}
                  </span>
                ))}
              </div>
            </div>
            {industryRrgLoading ? (
              <div className="h-80 animate-pulse bg-accent/40 rounded-lg mt-4" />
            ) : industryRrgError ? (
              <div role="alert" className="p-8 text-center text-sm text-amber-500">
                Live industry history is unavailable. Please try again later.
              </div>
            ) : industryRrgPoints.length === 0 ? (
              <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
                No industries have enough live history to plot.
              </div>
            ) : (
              <div>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs text-muted-foreground">Quadrant</span>
                    {(["All", "Leading", "Weakening", "Improving", "Lagging"] as const).map((quadrant) => {
                      const count = quadrant === "All"
                        ? industryRrgPoints.length
                        : industryQuadrantCounts[quadrant];
                      const active = rrgQuadrantFilter === quadrant;
                      return (
                        <button
                          key={quadrant}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setRrgQuadrantFilter(quadrant)}
                          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            active
                              ? "border-primary/50 bg-primary/10 text-foreground"
                              : "border-border text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          {quadrant} <span className="tabular-nums">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Highlight
                    <Select value={selectedRrgIndustry} onValueChange={setSelectedRrgIndustry}>
                      <SelectTrigger className="h-8 w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All industries">None</SelectItem>
                        {industryRrgPoints.map((point) => (
                          <SelectItem key={point.industry} value={point.industry}>
                            {point.industry}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Showing {visibleRrgPoints.length} of {industryRrgPoints.length} industries with sufficient history. Hover a dot for details; choose an industry to highlight it.
                </p>
                <ResponsiveContainer width="100%" height={440}>
                <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" opacity={0.5} />
                  <XAxis type="number" dataKey="rsRatio" name="RS-Ratio" domain={["auto", "auto"]}
                    tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickLine={false} label={{ value: "RS-Ratio", position: "insideBottom", offset: -10, fontSize: 11, fill: "hsl(215,20%,55%)" }} />
                  <YAxis type="number" dataKey="rsMomentum" name="RS-Momentum" domain={["auto", "auto"]}
                    tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickLine={false} label={{ value: "RS-Momentum", angle: -90, position: "insideLeft", offset: 15, fontSize: 11, fill: "hsl(215,20%,55%)" }} />
                  <ReferenceLine x={100} stroke="hsl(217,33%,25%)" strokeDasharray="4 4" strokeWidth={1.5} />
                  <ReferenceLine y={100} stroke="hsl(217,33%,25%)" strokeDasharray="4 4" strokeWidth={1.5} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,17%)", borderRadius: 6, fontSize: 11 }}
                    cursor={{ strokeDasharray: "3 3" }}
                    content={({ payload }) => {
                      if (!payload?.length) return null;
                      const d = payload[0].payload as IndustryRrgPoint;
                      if (d.rsRatio == null || d.rsMomentum == null) return null;
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 text-xs space-y-1">
                          <div className="font-bold" style={{ color: d.quadrant ? QUADRANT_COLOR[d.quadrant] : undefined }}>{d.industry}</div>
                          <div className="text-muted-foreground">{d.quadrant ?? "History unavailable"}</div>
                          <div>{d.historyCount} representative stocks with history · {d.stockCount} stocks in group</div>
                          <div>RS-Ratio: <span className="font-semibold">{d.rsRatio.toFixed(2)}</span></div>
                          <div>RS-Momentum: <span className="font-semibold">{d.rsMomentum.toFixed(2)}</span></div>
                          <div>1D: <span className={d.change1d == null ? "" : changeColor(d.change1d)}>{d.change1d == null ? "—" : `${d.change1d >= 0 ? "+" : ""}${d.change1d.toFixed(2)}%`}</span></div>
                          <div>1M: <span className={d.change1m == null ? "" : changeColor(d.change1m)}>{d.change1m == null ? "—" : `${d.change1m >= 0 ? "+" : ""}${d.change1m.toFixed(2)}%`}</span></div>
                          <div>3M: <span className={d.change3m == null ? "" : changeColor(d.change3m)}>{d.change3m == null ? "—" : `${d.change3m >= 0 ? "+" : ""}${d.change3m.toFixed(2)}%`}</span></div>
                        </div>
                      );
                    }}
                  />
                  <Scatter
                    data={visibleRrgPoints}
                    shape={<IndustryRRGDot selectedIndustry={selectedRrgIndustry} />}
                  >
                    {visibleRrgPoints.map((entry) => (
                      <Cell key={entry.industry} fill={QUADRANT_COLOR[entry.quadrant]} />
                    ))}
                  </Scatter>
                  {/* Quadrant labels */}
                </ScatterChart>
              </ResponsiveContainer>
                {selectedRrgPoint && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-muted/20 px-3 py-2 text-xs">
                    <span className="font-semibold">{selectedRrgPoint.industry}</span>
                    <span className={`rounded px-1.5 py-0.5 font-medium ${QUADRANT_BG[selectedRrgPoint.quadrant]}`}>
                      {selectedRrgPoint.quadrant}
                    </span>
                    <span className="text-muted-foreground">
                      RS-Ratio <span className="font-mono text-foreground">{selectedRrgPoint.rsRatio.toFixed(2)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      RS-Momentum <span className="font-mono text-foreground">{selectedRrgPoint.rsMomentum.toFixed(2)}</span>
                    </span>
                  </div>
                )}
                {unavailableRrgIndustries.length > 0 && (
                  <p className="mt-2 text-xs text-amber-500">
                    Not plotted—insufficient three-month Yahoo history:{" "}
                    {unavailableRrgIndustries.map((point) => point.industry).join(", ")}.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Quadrant shifts */}
          {quadrantShifts.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Quadrant Shifts
              </h3>
              <div className="space-y-2">
                {quadrantShifts.map(s => (
                  <div key={s.sector} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <div className="font-semibold text-sm">{s.sector}</div>
                      <div className="text-xs text-muted-foreground">Sector shifted quadrant this period</div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${QUADRANT_BG[s.quadrant]}`}>
                      {s.quadrant}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sector Performance tab */}
      {tab === "Sector Performance" && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="font-semibold text-sm">SECTOR PERFORMANCE</span>
            <span className="text-xs text-muted-foreground">Click to expand</span>
          </div>
          {perfLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : perfError ? (
            <div role="alert" className="p-8 text-center text-sm text-amber-500">
              Live sector performance is unavailable. Please try again later.
            </div>
          ) : (
            <div className="divide-y">
              {[...performance].sort((a, b) => b.change1d - a.change1d).map(s => (
                <div key={s.sector}>
                  <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors text-left"
                    onClick={() => toggleExpand(s.sector)}>
                    {expanded.has(s.sector)
                      ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{s.sector}</div>
                      <div className="text-[10px] text-muted-foreground">{s.name}</div>
                    </div>
                    <span className={`font-bold tabular-nums text-sm ${changeColor(s.change1d)}`}>
                      {s.change1d >= 0 ? "+" : ""}{s.change1d.toFixed(2)}%
                    </span>
                  </button>
                  {expanded.has(s.sector) && (
                    <div className="px-10 py-3 bg-muted/20 grid grid-cols-3 gap-3">
                      {[["1D", s.change1d], ["1W", s.change1w], ["1M", s.change1m], ["3M", s.change3m],
                        ["RS-Ratio", s.rsRatio - 100], ["RS-Momentum", s.rsMomentum - 100]].map(([label, val]) => (
                        <div key={String(label)}>
                          <div className="text-[10px] text-muted-foreground">{label}</div>
                          <div className={`font-semibold text-sm tabular-nums ${changeColor(Number(val))}`}>
                            {Number(val) >= 0 ? "+" : ""}{Number(val).toFixed(2)}{String(label).includes("RS") ? "" : "%"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Indices tab */}
      {tab === "Indices" && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b">
            <span className="font-semibold text-sm tracking-wider uppercase">Sector Indices</span>
          </div>
          {indicesLoading ? (
            <div className="grid grid-cols-2 gap-3 p-4">
              {[...Array(10)].map((_, i) => <div key={i} className="h-20 rounded-lg bg-accent/40 animate-pulse" />)}
            </div>
          ) : indicesError ? (
            <div role="alert" className="p-8 text-center text-sm text-amber-500">
              Live sector index data is unavailable. Please try again later.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-0 divide-x divide-y">
              {indices.map(idx => {
                const chg = idx.regularMarketChangePercent ?? 0;
                return (
                  <div key={idx.symbol} className="p-4">
                    <div className="text-xs font-medium text-muted-foreground">{idx.shortName ?? idx.sectorName}</div>
                    <div className="text-lg font-bold tabular-nums mt-1">{formatPrice(idx.regularMarketPrice)}</div>
                    <div className={`text-sm font-semibold tabular-nums ${changeColor(chg)}`}>
                      {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
