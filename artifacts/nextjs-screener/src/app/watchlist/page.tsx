"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Plus, Trash2, Search, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiUrl } from "@/lib/api-url";
import { formatPrice, formatChangePercent, changeColor, changeBg, displaySymbol } from "@/lib/format";
import { toast } from "sonner";
import {
  addWatchlistItem,
  getWatchlist,
  removeWatchlistItem,
  type WatchlistItem,
} from "@/lib/watchlist-api";

export default function WatchlistPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ symbol: string; shortname: string; exchDisp: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const queryClient = useQueryClient();

  const { data: watchlist, isLoading, isError, error } = useQuery<WatchlistItem[]>({
    queryKey: ["watchlist"],
    queryFn: getWatchlist,
    refetchInterval: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: addWatchlistItem,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["watchlist"] }); setSearchQuery(""); setSearchResults([]); toast.success("Added to watchlist"); },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: removeWatchlistItem,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["watchlist"] }); toast.success("Removed"); },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(apiUrl(`/stocks/search?q=${encodeURIComponent(searchQuery)}`));
      setSearchResults(await res.json());
    } catch { toast.error("Search failed"); }
    finally { setIsSearching(false); }
  };

  const totalItems = watchlist?.length ?? 0;
  const totalPnlItems = watchlist?.filter(w => w.pricePct != null) ?? [];
  const avgPnlPct = totalPnlItems.length > 0
    ? totalPnlItems.reduce((s, w) => s + (w.pricePct ?? 0), 0) / totalPnlItems.length
    : null;

  return (
    <div className="space-y-5 max-w-screen-xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          Watchlist
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track your favourite stocks — added price vs current price</p>
      </div>

      {/* Summary bar */}
      {totalItems > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground mb-1">Watching</div>
            <div className="text-xl font-bold">{totalItems} stocks</div>
          </div>
          {avgPnlPct != null && (
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground mb-1">Avg P&L Since Added</div>
              <div className={`text-xl font-bold tabular-nums ${changeColor(avgPnlPct)}`}>
                {avgPnlPct >= 0 ? "+" : ""}{avgPnlPct.toFixed(2)}%
              </div>
            </div>
          )}
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground mb-1">Gainers Today</div>
            <div className="text-xl font-bold text-green-500">
              {watchlist?.filter(w => (w.regularMarketChangePercent ?? 0) > 0).length ?? 0}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground mb-1">Losers Today</div>
            <div className="text-xl font-bold text-red-500">
              {watchlist?.filter(w => (w.regularMarketChangePercent ?? 0) < 0).length ?? 0}
            </div>
          </div>
        </div>
      )}

      {/* Add stock */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold text-sm mb-3">Add a Stock</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Search by name or symbol…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="max-w-sm"
          />
          <Button size="sm" onClick={handleSearch} disabled={isSearching}>
            <Search className="h-4 w-4" />
            Search
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-3 rounded-lg border divide-y overflow-hidden">
            {searchResults.slice(0, 8).map((r) => (
              <div key={r.symbol} className="flex items-center justify-between px-3 py-2.5 bg-card hover:bg-accent/30 transition-colors">
                <div>
                  <span className="font-semibold text-sm">{displaySymbol(r.symbol)}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{r.shortname}</span>
                  <span className="ml-1.5 rounded bg-secondary/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">{r.exchDisp}</span>
                </div>
                <Button size="sm" variant="secondary" onClick={() => addMutation.mutate(r.symbol)} disabled={addMutation.isPending}>
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Watchlist table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {isError ? (
          <div className="p-8 text-center text-sm text-destructive" role="alert">
            Could not load your watchlist. {error instanceof Error ? error.message : "Please try again later."}
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : (watchlist ?? []).length === 0 ? (
          <div className="py-20 text-center">
            <Star className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">Your watchlist is empty</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Search for stocks above to add them</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Added At</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Added Price</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Since Added</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {(watchlist ?? []).map((item) => {
                  const dayChg = item.regularMarketChangePercent;
                  const sinceAdded = item.pricePct;
                  const priceDiff = item.priceDiff;
                  const isUpSinceAdded = (sinceAdded ?? 0) >= 0;
                  return (
                    <tr key={item.symbol} className="border-b hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/stock/${encodeURIComponent(item.symbol)}`} className="group">
                          <div className="font-semibold group-hover:text-primary transition-colors">{displaySymbol(item.symbol)}</div>
                          <div className="text-xs text-muted-foreground">{item.shortName ?? ""}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums">
                        {new Date(item.addedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-sm">
                        {item.addedPrice != null ? `₹${item.addedPrice.toFixed(2)}` : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold">{formatPrice(item.currentPrice)}</td>
                      <td className="px-4 py-3 text-right">
                        {sinceAdded != null ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${changeBg(sinceAdded)}`}>
                              {isUpSinceAdded ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {sinceAdded >= 0 ? "+" : ""}{sinceAdded.toFixed(2)}%
                            </span>
                            {priceDiff != null && (
                              <span className={`text-[10px] tabular-nums ${changeColor(priceDiff)}`}>
                                {priceDiff >= 0 ? "+" : ""}₹{priceDiff.toFixed(2)}
                              </span>
                            )}
                          </div>
                        ) : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${changeBg(dayChg)}`}>
                          {formatChangePercent(dayChg)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500 transition-colors" onClick={() => removeMutation.mutate(item.symbol)} disabled={removeMutation.isPending}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
