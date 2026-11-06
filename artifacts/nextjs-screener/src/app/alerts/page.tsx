"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiUrl } from "@/lib/api-url";
import { formatPrice, displaySymbol } from "@/lib/format";
import { toast } from "sonner";

interface Alert {
  id: string;
  symbol: string;
  condition: "above" | "below" | "change_pct_above" | "change_pct_below";
  value: number;
  createdAt: string;
  triggered: boolean;
  triggeredAt?: string;
}

interface StockQuote {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  shortName?: string;
}

const CONDITIONS = [
  { value: "above", label: "Price above ₹" },
  { value: "below", label: "Price below ₹" },
  { value: "change_pct_above", label: "% Change above %" },
  { value: "change_pct_below", label: "% Change below %" },
];

function loadAlerts(): Alert[] {
  try {
    return JSON.parse(
      localStorage.getItem("fintrack_alerts") ?? "[]",
    ) as Alert[];
  } catch {
    return [];
  }
}
function saveAlerts(alerts: Alert[]) {
  localStorage.setItem("fintrack_alerts", JSON.stringify(alerts));
}

function checkAlert(alert: Alert, quote: StockQuote): boolean {
  const price = quote.regularMarketPrice ?? 0;
  const pct = quote.regularMarketChangePercent ?? 0;
  switch (alert.condition) {
    case "above":
      return price >= alert.value;
    case "below":
      return price <= alert.value;
    case "change_pct_above":
      return pct >= alert.value;
    case "change_pct_below":
      return pct <= alert.value;
    default:
      return false;
  }
}

function conditionLabel(a: Alert) {
  const map: Record<string, string> = {
    above: `Price ≥ ₹${a.value.toFixed(2)}`,
    below: `Price ≤ ₹${a.value.toFixed(2)}`,
    change_pct_above: `Change ≥ +${a.value}%`,
    change_pct_below: `Change ≤ ${a.value}%`,
  };
  return map[a.condition] ?? "";
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { symbol: string; shortname: string }[]
  >([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [condition, setCondition] = useState<Alert["condition"]>("above");
  const [value, setValue] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    setAlerts(loadAlerts());
  }, []);

  const symbols = [
    ...new Set(alerts.filter((a) => !a.triggered).map((a) => a.symbol)),
  ];

  const { data: quotes } = useQuery<StockQuote[]>({
    queryKey: ["alerts-quotes", symbols.join(",")],
    queryFn: async () => {
      if (symbols.length === 0) return [];
      const results = await Promise.all(
        symbols.map(async (sym) => {
          try {
            const r = await fetch(
              apiUrl(`/stocks/quote/${encodeURIComponent(sym)}`),
            );
            return r.ok ? (r.json() as Promise<StockQuote>) : null;
          } catch {
            return null;
          }
        }),
      );
      return results.filter(Boolean) as StockQuote[];
    },
    enabled: symbols.length > 0,
    refetchInterval: 30_000,
  });

  // Check alerts against live quotes
  const checkAlerts = useCallback(() => {
    if (!quotes || quotes.length === 0) return;
    setAlerts((prev) => {
      let changed = false;
      const updated = prev.map((alert) => {
        if (alert.triggered) return alert;
        const quote = quotes.find((q) => q.symbol === alert.symbol);
        if (quote && checkAlert(alert, quote)) {
          changed = true;
          toast.success(
            `Alert triggered: ${displaySymbol(alert.symbol)} — ${conditionLabel(alert)}`,
            {
              duration: 8000,
            },
          );
          return {
            ...alert,
            triggered: true,
            triggeredAt: new Date().toISOString(),
          };
        }
        return alert;
      });
      if (changed) {
        saveAlerts(updated);
        return updated;
      }
      return prev;
    });
  }, [quotes]);

  useEffect(() => {
    checkAlerts();
  }, [checkAlerts]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        apiUrl(`/stocks/search?q=${encodeURIComponent(searchQuery)}`),
      );
      setSearchResults(await res.json());
    } catch {
      toast.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const addAlert = () => {
    if (!selectedSymbol) {
      toast.error("Select a stock first");
      return;
    }
    const v = parseFloat(value);
    if (isNaN(v)) {
      toast.error("Enter a valid threshold value");
      return;
    }
    const alert: Alert = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      symbol: selectedSymbol,
      condition,
      value: v,
      createdAt: new Date().toISOString(),
      triggered: false,
    };
    const updated = [alert, ...alerts];
    setAlerts(updated);
    saveAlerts(updated);
    setSelectedSymbol("");
    setValue("");
    setSearchQuery("");
    setSearchResults([]);
    toast.success("Alert created");
  };

  const removeAlert = (id: string) => {
    const updated = alerts.filter((a) => a.id !== id);
    setAlerts(updated);
    saveAlerts(updated);
  };

  const clearTriggered = () => {
    const updated = alerts.filter((a) => !a.triggered);
    setAlerts(updated);
    saveAlerts(updated);
  };

  const active = alerts.filter((a) => !a.triggered);
  const triggered = alerts.filter((a) => a.triggered);

  const quoteMap = new Map(quotes?.map((q) => [q.symbol, q]) ?? []);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-yellow-500" />
            Custom Alerts
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Set price and % change thresholds — alerts check every 30 seconds
          </p>
        </div>
        {triggered.length > 0 && (
          <Button variant="secondary" size="sm" onClick={clearTriggered}>
            Clear {triggered.length} triggered
          </Button>
        )}
      </div>

      {/* Create Alert */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm">Create New Alert</h2>

        {/* Step 1: Search stock */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            1. Search Stock
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="Search by name or symbol…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="max-w-xs"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSearch}
              disabled={isSearching}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {selectedSymbol && (
            <div className="flex items-center gap-2 text-sm text-primary font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              {displaySymbol(selectedSymbol)} selected
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="rounded-lg border divide-y overflow-hidden max-w-xs">
              {searchResults.slice(0, 6).map((r) => (
                <button
                  key={r.symbol}
                  className="w-full flex items-center justify-between px-3 py-2 bg-card hover:bg-accent/30 transition-colors text-left"
                  onClick={() => {
                    setSelectedSymbol(r.symbol);
                    setSearchResults([]);
                    setSearchQuery(r.symbol.replace(".NS", ""));
                  }}
                >
                  <div>
                    <span className="font-semibold text-sm">
                      {displaySymbol(r.symbol)}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {r.shortname}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: Set condition */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            2. Set Condition
          </label>
          <div className="flex gap-2 flex-wrap">
            <select
              value={condition}
              onChange={(e) =>
                setCondition(e.target.value as Alert["condition"])
              }
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <Input
              placeholder="Enter value…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-36"
              type="number"
              step="any"
            />
            <Button onClick={addAlert} disabled={!selectedSymbol || !value}>
              <Plus className="h-4 w-4" />
              Create Alert
            </Button>
          </div>
        </div>
      </div>

      {/* Active Alerts */}
      {active.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center gap-2">
            <Bell className="h-4 w-4 text-yellow-500" />
            <h2 className="font-semibold text-sm">
              Active Alerts ({active.length})
            </h2>
          </div>
          <div className="divide-y">
            {active.map((alert) => {
              const q = quoteMap.get(alert.symbol);
              return (
                <div
                  key={alert.id}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-accent/20 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">
                        {displaySymbol(alert.symbol)}
                      </span>
                      <span className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                        {conditionLabel(alert)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Current:{" "}
                      {q?.regularMarketPrice != null
                        ? formatPrice(q.regularMarketPrice)
                        : "—"}
                      {q?.regularMarketChangePercent != null && (
                        <span
                          className={
                            q.regularMarketChangePercent >= 0
                              ? "text-green-500 ml-2"
                              : "text-red-500 ml-2"
                          }
                        >
                          {q.regularMarketChangePercent >= 0 ? "+" : ""}
                          {q.regularMarketChangePercent.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {new Date(alert.createdAt).toLocaleDateString("en-IN")}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-500"
                    onClick={() => removeAlert(alert.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Triggered Alerts */}
      {triggered.length > 0 && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 overflow-hidden">
          <div className="px-5 py-3 border-b border-green-500/30 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <h2 className="font-semibold text-sm text-green-500">
              Triggered Alerts ({triggered.length})
            </h2>
          </div>
          <div className="divide-y divide-green-500/10">
            {triggered.map((alert) => (
              <div key={alert.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">
                      {displaySymbol(alert.symbol)}
                    </span>
                    <span className="text-xs bg-green-500/20 text-green-400 rounded px-1.5 py-0.5">
                      {conditionLabel(alert)}
                    </span>
                    <span className="text-[10px] text-green-500 font-bold">
                      ✓ TRIGGERED
                    </span>
                  </div>
                  {alert.triggeredAt && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Triggered at{" "}
                      {new Date(alert.triggeredAt).toLocaleString("en-IN")}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-red-500"
                  onClick={() => removeAlert(alert.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div className="py-20 text-center rounded-xl border bg-card">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">No alerts set</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Create an alert above to get notified when price or % change
            conditions are met
          </p>
        </div>
      )}
    </div>
  );
}
