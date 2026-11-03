"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiUrl } from "@/lib/api-url";
import {
  formatPrice,
  formatChangePercent,
  formatVolume,
  formatMarketCap,
  formatRatio,
  changeColor,
  changeBg,
  displaySymbol,
} from "@/lib/format";
import { isFno } from "@/lib/fno-stocks";

interface ScreenerStock {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  marketCap?: number;
  trailingPE?: number;
  priceToBook?: number;
  dividendYield?: number;
  returnOnEquity?: number;
}

interface ScreenerResponse {
  stocks: ScreenerStock[];
  warning: string | null;
}

interface Filters {
  exchange: string;
  sector: string;
  minPe: string;
  maxPe: string;
  minPb: string;
  maxPb: string;
  minMarketCapCr: string;
  sortBy: string;
  sortOrder: string;
  fnoOnly: boolean;
}

const DEFAULT_FILTERS: Filters = {
  exchange: "NSE",
  sector: "",
  minPe: "",
  maxPe: "",
  minPb: "",
  maxPb: "",
  minMarketCapCr: "",
  sortBy: "marketCap",
  sortOrder: "desc",
  fnoOnly: false,
};

const SORT_OPTIONS = [
  { value: "marketCap", label: "Market Cap" },
  { value: "regularMarketChangePercent", label: "Change %" },
  { value: "regularMarketVolume", label: "Volume" },
  { value: "trailingPE", label: "P/E" },
  { value: "priceToBook", label: "P/B" },
];

export default function ScreenerPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: sectors = [] } = useQuery<string[]>({
    queryKey: ["screener", "sectors"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/screener/sectors"));
      if (!response.ok) throw new Error("Screener sectors request failed");
      return response.json();
    },
  });

  const params = new URLSearchParams();
  if (applied.exchange) params.set("exchange", applied.exchange);
  if (applied.sector) params.set("sector", applied.sector);
  if (applied.minPe) params.set("minPe", applied.minPe);
  if (applied.maxPe) params.set("maxPe", applied.maxPe);
  if (applied.minPb) params.set("minPb", applied.minPb);
  if (applied.maxPb) params.set("maxPb", applied.maxPb);
  if (applied.minMarketCapCr)
    params.set("minMarketCapCr", applied.minMarketCapCr);
  params.set("sortBy", applied.sortBy);
  params.set("sortOrder", applied.sortOrder);

  const searchQuery = searchTerm.trim();
  if (searchQuery) params.set("search", searchQuery);

  const { data: screenerData, isLoading, isError } = useQuery<ScreenerResponse>({
    queryKey: ["screener", "results", applied, searchQuery],
    queryFn: async () => {
      const response = await fetch(apiUrl(`/screener?${params}`));
      if (!response.ok) throw new Error("Screener data request failed");
      return {
        stocks: await response.json(),
        warning: response.headers.get("X-Data-Warning"),
      };
    },
    staleTime: 60_000,
  });

  const results = applied.fnoOnly
    ? (screenerData?.stocks ?? []).filter((s) => isFno(s.symbol))
    : screenerData?.stocks;

  const set = (k: keyof Filters, v: string) =>
    setFilters((f) => ({ ...f, [k]: v }));
  const toggleSort = (col: string) => {
    setFilters((f) => ({
      ...f,
      sortBy: col,
      sortOrder: f.sortBy === col && f.sortOrder === "desc" ? "asc" : "desc",
    }));
  };

  const labelClass = "text-xs font-medium text-muted-foreground mb-1 block";
  const selectClass =
    "screener-filter-select h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-colors";

  return (
    <div className="space-y-5 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          Stock Screener
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Search listed companies and apply filters to surface matching stocks
        </p>
      </div>

      {screenerData?.warning && !searchQuery && (
        <div
          role="status"
          className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-600 dark:text-amber-400"
        >
          {screenerData.warning}
        </div>
      )}

      {/* Filter panel */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Filters</span>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className={labelClass}>Exchange</label>
            <select
              value={filters.exchange}
              onChange={(e) => set("exchange", e.target.value)}
              className={selectClass}
            >
              <option value="">All</option>
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Sector</label>
            <select
              value={filters.sector}
              onChange={(e) => set("sector", e.target.value)}
              className={selectClass}
            >
              <option value="">All Sectors</option>
              {(sectors ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Min P/E</label>
            <Input
              type="number"
              placeholder="e.g. 5"
              value={filters.minPe}
              onChange={(e) => set("minPe", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Max P/E</label>
            <Input
              type="number"
              placeholder="e.g. 30"
              value={filters.maxPe}
              onChange={(e) => set("maxPe", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Min MCap (₹Cr)</label>
            <Input
              type="number"
              placeholder="e.g. 10000"
              value={filters.minMarketCapCr}
              onChange={(e) => set("minMarketCapCr", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => set("sortBy", e.target.value)}
              className={selectClass}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <Button size="sm" onClick={() => setApplied(filters)}>
            Apply Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              setApplied(DEFAULT_FILTERS);
            }}
          >
            Reset
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setFilters((f) => ({
                ...f,
                sortOrder: f.sortOrder === "asc" ? "desc" : "asc",
              }))
            }
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {filters.sortOrder === "asc" ? "Ascending" : "Descending"}
          </Button>
          <label className="flex items-center gap-2 ml-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.fnoOnly}
              onChange={(e) =>
                setFilters((f) => ({ ...f, fnoOnly: e.target.checked }))
              }
              className="h-3.5 w-3.5 accent-cyan-400"
            />
            <span className="text-xs font-semibold text-cyan-400">
              F&amp;O Only
            </span>
          </label>
        </div>
      </div>

      {/* Results */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex flex-col gap-3 px-4 py-3 border-b bg-card sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium">
            {isError
              ? "Live data unavailable"
              : isLoading
              ? "Loading..."
              : `${(results ?? []).length} stocks found`}
          </span>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search all listed stocks"
              className="h-9 pl-9"
              aria-label="Search stocks"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Stock
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Sector
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Price
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Chg%
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Volume
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  MCap
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  P/E
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  P/B
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b">
                      {[...Array(8)].map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 rounded bg-accent/40 animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : !isError && (results ?? []).map((s) => {
                    const chg = s.regularMarketChangePercent;
                    return (
                      <tr
                        key={s.symbol}
                        className="border-b hover:bg-accent/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/stock/${encodeURIComponent(s.symbol)}`}
                            className="group"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold group-hover:text-primary transition-colors">
                                {displaySymbol(s.symbol)}
                              </span>
                              {isFno(s.symbol) && (
                                <span className="text-[9px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded px-1 py-0.5 leading-none">
                                  F&amp;O
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate max-w-40">
                              {s.name}
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block rounded-md bg-secondary/60 px-2 py-0.5 text-xs text-muted-foreground">
                            {s.sector}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">
                          {formatPrice(s.regularMarketPrice)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${changeBg(chg)}`}
                          >
                            {formatChangePercent(chg)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">
                          {formatVolume(s.regularMarketVolume)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">
                          {s.marketCap
                            ? formatMarketCap((s.marketCap ?? 0) / 1e7)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">
                          {formatRatio(s.trailingPE)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs">
                          {formatRatio(s.priceToBook)}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          {isError ? (
            <div role="alert" className="py-16 text-center text-amber-500 text-sm">
              Live screener data is unavailable. Please try again later.
            </div>
          ) : !isLoading && (results ?? []).length === 0 && (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No stocks match the current filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
