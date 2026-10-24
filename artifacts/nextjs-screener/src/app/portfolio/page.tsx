"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase, Plus, Trash2, Search, X, ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiUrl } from "@/lib/api-url";
import type { PortfolioRiskResponse } from "@/lib/portfolio-risk";
import PortfolioRiskDashboard from "@/components/portfolio-risk-dashboard";
import {
  formatPrice, formatChangePercent, changeColor, changeBg, displaySymbol,
} from "@/lib/format";
import { toast } from "sonner";

interface Holding {
  id: number;
  symbol: string;
  name: string;
  exchange: string;
  quantity: number;
  avgPrice: number;
  purchaseDate: string | null;
  notes: string | null;
  shortName: string;
  currentPrice: number | null;
  currentValue: number | null;
  invested: number;
  pnl: number | null;
  pnlPct: number | null;
  cagr: number | null;
  regularMarketChangePercent: number | null;
}

interface SearchResult { symbol: string; shortname: string; exchDisp: string }

const PIE_COLORS = [
  "#22d3ee","#22c55e","#f59e0b","#ef4444","#a78bfa",
  "#f97316","#ec4899","#14b8a6","#3b82f6","#84cc16",
];

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtL(n: number | null | undefined): string {
  if (n == null) return "—";
  const lakh = n / 100000;
  if (Math.abs(lakh) >= 100) return `₹${(n / 10000000).toFixed(2)}Cr`;
  return `₹${lakh.toFixed(2)}L`;
}

type Tab = "holdings" | "risk" | "allocation";

export default function PortfolioPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<Tab>("holdings");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [form, setForm] = useState({ quantity: "", avgPrice: "", purchaseDate: "", notes: "" });

  const { data: holdings = [], isLoading } = useQuery<Holding[]>({
    queryKey: ["portfolio"],
    queryFn: () => fetch(apiUrl("/portfolio")).then(r => r.json()),
    refetchInterval: 60_000,
  });
  const {
    data: riskData,
    isLoading: isRiskLoading,
    error: riskError,
    refetch: refetchRisk,
  } = useQuery<PortfolioRiskResponse>({
    queryKey: ["portfolio-risk"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/portfolio/risk"));
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Risk analytics could not be loaded");
      }
      return body as PortfolioRiskResponse;
    },
    enabled: tab === "risk" && holdings.length > 0,
    staleTime: 5 * 60_000,
    refetchInterval: tab === "risk" ? 5 * 60_000 : false,
  });

  const addMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(apiUrl("/portfolio"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      qc.invalidateQueries({ queryKey: ["portfolio-risk"] });
      setShowAdd(false); setSelected(null); setForm({ quantity: "", avgPrice: "", purchaseDate: "", notes: "" });
      toast.success("Holding added");
    },
    onError: (e: unknown) => toast.error(typeof e === "object" && e && "error" in e ? String((e as { error: unknown }).error) : "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(apiUrl(`/portfolio/${id}`), { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      qc.invalidateQueries({ queryKey: ["portfolio-risk"] });
      toast.success("Removed");
    },
  });

  const handleSearch = async () => {
    if (!searchQ.trim()) return;
    try {
      const r = await fetch(apiUrl(`/stocks/search?q=${encodeURIComponent(searchQ)}`));
      setSearchResults(await r.json());
    } catch { toast.error("Search failed"); }
  };

  const handleAdd = () => {
    if (!selected || !form.quantity || !form.avgPrice) return toast.error("Fill all required fields");
    addMutation.mutate({
      symbol: selected.symbol, name: selected.shortname, exchange: selected.exchDisp,
      quantity: parseFloat(form.quantity), avgPrice: parseFloat(form.avgPrice),
      purchaseDate: form.purchaseDate || null, notes: form.notes || null,
    });
  };

  // Portfolio calculations
  const totalInvested = holdings.reduce((s, h) => s + h.invested, 0);
  const totalCurrent = holdings.reduce((s, h) => s + (h.currentValue ?? h.invested), 0);
  const totalPnl = totalCurrent - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  // Allocation by exchange/sector
  const sectorMap: Record<string, number> = {};
  for (const h of holdings) {
    const sector = h.exchange || "Other";
    sectorMap[sector] = (sectorMap[sector] ?? 0) + (h.currentValue ?? h.invested);
  }
  const pieData = Object.entries(sectorMap).map(([name, value]) => ({ name, value }));

  // PnL bar chart data
  const pnlBarData = holdings.map(h => ({
    name: displaySymbol(h.symbol),
    pnlPct: h.pnlPct ?? 0,
  })).sort((a, b) => b.pnlPct - a.pnlPct);

  const statCard = (label: string, value: string, sub?: string, subColor?: string) => (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className={`text-xs mt-0.5 font-medium ${subColor ?? "text-muted-foreground"}`}>{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-5 max-w-screen-xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Portfolio
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track holdings, P&L, and risk metrics in INR</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(v => !v)}>
          {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showAdd ? "Cancel" : "Add Holding"}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {statCard("Total Invested", fmtL(totalInvested))}
        {statCard("Current Value", fmtL(totalCurrent))}
        {statCard("Total P&L", fmtL(totalPnl), `${totalPnlPct >= 0 ? "+" : ""}${fmt(totalPnlPct)}%`, totalPnl >= 0 ? "text-green-500" : "text-red-500")}
        {statCard("Holdings", String(holdings.length))}
      </div>

      {/* Add holding */}
      {showAdd && (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h2 className="font-semibold text-sm">Add a Holding</h2>
          {!selected ? (
            <>
              <div className="flex gap-2">
                <Input placeholder="Search stock symbol or name…" value={searchQ}
                  onChange={e => setSearchQ(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()}
                  className="max-w-sm" />
                <Button size="sm" onClick={handleSearch}><Search className="h-4 w-4" />Search</Button>
              </div>
              {searchResults.length > 0 && (
                <div className="rounded-lg border divide-y overflow-hidden max-w-lg">
                  {searchResults.slice(0, 6).map(r => (
                    <button key={r.symbol} onClick={() => { setSelected(r); setSearchResults([]); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-accent/30 transition-colors">
                      <div>
                        <span className="font-semibold text-sm">{displaySymbol(r.symbol)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{r.shortname}</span>
                      </div>
                      <span className="text-xs rounded bg-secondary/60 px-2 py-0.5 text-muted-foreground">{r.exchDisp}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-primary">{displaySymbol(selected.symbol)}</span>
                <span className="text-sm text-muted-foreground">{selected.shortname}</span>
                <button className="ml-auto text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelected(null)}>Change stock</button>
              </div>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <div><label className="text-xs text-muted-foreground block mb-1">Quantity *</label>
                  <Input type="number" min="0.01" step="0.01" placeholder="e.g. 10" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Avg Buy Price (₹) *</label>
                  <Input type="number" min="0.01" step="0.01" placeholder="e.g. 2500" value={form.avgPrice} onChange={e => setForm(f => ({ ...f, avgPrice: e.target.value }))} /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Purchase Date</label>
                  <Input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} /></div>
                <div><label className="text-xs text-muted-foreground block mb-1">Notes</label>
                  <Input placeholder="Optional" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              </div>
              <Button size="sm" onClick={handleAdd} disabled={addMutation.isPending}><Plus className="h-4 w-4" />Add Holding</Button>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["holdings", "risk", "allocation"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t === "risk" ? "Risk Analytics" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Holdings tab */}
      {tab === "holdings" && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <span className="font-semibold text-sm">Holdings</span>
            <span className="ml-auto text-xs text-muted-foreground">{holdings.length} stocks</span>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : holdings.length === 0 ? (
            <div className="py-20 text-center">
              <Briefcase className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">No holdings yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {["Stock","Qty","Avg Price","Cur Price","Invested","Cur Value","P&L","P&L%","Day%",""].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(h => (
                    <tr key={h.id} className="border-b hover:bg-accent/30 transition-colors">
                      <td className="px-3 py-2.5">
                        <Link href={`/stock/${encodeURIComponent(h.symbol)}`} className="group">
                          <div className="font-semibold group-hover:text-primary transition-colors text-xs">{displaySymbol(h.symbol)}</div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{h.shortName}</div>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-xs">{fmt(h.quantity, 0)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-xs">₹{fmt(h.avgPrice)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-xs font-semibold">{h.currentPrice ? `₹${fmt(h.currentPrice)}` : "—"}</td>
                      <td className="px-3 py-2.5 tabular-nums text-xs text-muted-foreground">₹{fmt(h.invested, 0)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-xs">{h.currentValue ? `₹${fmt(h.currentValue, 0)}` : "—"}</td>
                      <td className={`px-3 py-2.5 tabular-nums text-xs font-semibold ${changeColor(h.pnl)}`}>
                        {h.pnl != null ? `${h.pnl >= 0 ? "+" : ""}₹${fmt(Math.abs(h.pnl), 0)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${changeBg(h.pnlPct)}`}>
                          {h.pnlPct != null ? `${h.pnlPct >= 0 ? "+" : ""}${fmt(h.pnlPct)}%` : "—"}
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 text-xs tabular-nums ${changeColor(h.regularMarketChangePercent)}`}>
                        {formatChangePercent(h.regularMarketChangePercent)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500"
                          onClick={() => deleteMutation.mutate(h.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Risk Analytics tab */}
      {tab === "risk" && (
        <div className="space-y-4">
          {holdings.length === 0 ? (
            <div className="py-16 text-center rounded-lg border bg-card">
              <ShieldAlert className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground">Add holdings to see risk analytics</p>
            </div>
          ) : (
            <>
              <PortfolioRiskDashboard
                data={riskData}
                isLoading={isRiskLoading}
                error={riskError instanceof Error ? riskError.message : riskError ? "Risk analytics could not be loaded" : null}
                onRetry={() => void refetchRisk()}
              />

              {/* P&L bar chart */}
              {pnlBarData.length > 0 && (
                <div className="rounded-lg border bg-card p-4">
                  <h3 className="font-semibold text-sm mb-4">P&L by Holding (%)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={pnlBarData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickFormatter={v => `${v}%`} />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, "P&L"]}
                        contentStyle={{ backgroundColor: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,17%)", borderRadius: 6, fontSize: 11 }} />
                      <Bar dataKey="pnlPct" radius={[4, 4, 0, 0]}
                        fill="hsl(199,89%,48%)"
                        label={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

            </>
          )}
        </div>
      )}

      {/* Allocation tab */}
      {tab === "allocation" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-semibold text-sm mb-4">Exchange Allocation</h3>
            {holdings.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-xs">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`₹${(v / 100000).toFixed(2)}L`, ""]}
                    contentStyle={{ backgroundColor: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,17%)", borderRadius: 6, fontSize: 11 }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h3 className="font-semibold text-sm mb-4">Holdings Breakdown</h3>
            <div className="space-y-2">
              {holdings.map(h => {
                const weight = totalCurrent > 0 ? ((h.currentValue ?? h.invested) / totalCurrent) * 100 : 0;
                return (
                  <div key={h.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold">{displaySymbol(h.symbol)}</span>
                        <span className="text-muted-foreground">{weight.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${weight}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">P&L</span>
                <span className={changeColor(totalPnl)}>{totalPnl >= 0 ? "+" : ""}₹{fmt(totalPnl, 0)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Overall Return</span>
                <span className={changeColor(totalPnlPct)}>{totalPnlPct >= 0 ? "+" : ""}{fmt(totalPnlPct)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
