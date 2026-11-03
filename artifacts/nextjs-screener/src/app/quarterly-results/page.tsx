"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PieChart as PieChartIcon } from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { changeColor, displaySymbol, formatChangePercent } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface QuarterlyResult {
  symbol: string; name: string; sector: string; period: string;
  revenue: number | null;
  profit: number | null;
  revenueGrowth: number | null;
  profitGrowth: number | null;
  eps: number | null;
  beat: "beat" | "miss" | "inline" | null;
}

function formatCr(val: number | null) {
  if (val == null) return "—";
  return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
}

export default function QuarterlyResultsPage() {
  const [sectorFilter, setSectorFilter] = useState("All");

  const { data: results = [], isLoading, isError } = useQuery<QuarterlyResult[]>({
    queryKey: ["market", "quarterly-results"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/quarterly-results"));
      if (!response.ok) throw new Error("Quarterly results request failed");
      return response.json();
    },
    staleTime: 30 * 60 * 1000,
  });

  const sectors = useMemo(() => ["All", ...Array.from(new Set(results.map(r => r.sector))).filter(Boolean).sort()], [results]);

  const filteredResults = useMemo(() => {
    let res = results;
    if (sectorFilter !== "All") res = res.filter(r => r.sector === sectorFilter);
    return res;
  }, [results, sectorFilter]);

  const total = results.length;
  
  const validRevGrowth = results.map(r => r.revenueGrowth).filter((g): g is number => g != null);
  const avgRevGrowth = validRevGrowth.length ? validRevGrowth.reduce((a, b) => a + b, 0) / validRevGrowth.length : 0;

  const top10Growth = useMemo(() => {
    return [...results]
      .filter(r => r.revenueGrowth != null)
      .sort((a, b) => (b.revenueGrowth ?? 0) - (a.revenueGrowth ?? 0))
      .slice(0, 10)
      .map(r => ({ name: displaySymbol(r.symbol), growth: r.revenueGrowth }));
  }, [results]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <PieChartIcon className="h-6 w-6 text-primary" />
          Quarterly Results
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Quarterly financial statements for up to 30 largest NSE listings · source: Yahoo Finance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Total Companies</div>
          <div className="text-2xl font-bold">{total}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Avg Revenue Growth %</div>
          <div className={`text-2xl font-bold ${changeColor(avgRevGrowth)}`}>{avgRevGrowth > 0 ? '+' : ''}{avgRevGrowth.toFixed(1)}%</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="w-48">
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Sector" />
            </SelectTrigger>
            <SelectContent>
              {sectors.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {isError ? (
          <div role="alert" className="text-center py-16 text-amber-500 text-sm">Live quarterly financial statements are unavailable. Please try again later.</div>
        ) : isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Loading...</div>
        ) : filteredResults.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No data available</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Revenue (₹Cr)</TableHead>
                <TableHead className="text-right">Rev Growth</TableHead>
                <TableHead className="text-right">Profit (₹Cr)</TableHead>
                <TableHead className="text-right">Profit Growth</TableHead>
                <TableHead className="text-right">EPS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="font-semibold text-sm text-cyan-400">{displaySymbol(r.symbol)}</div>
                    <div className="text-[10px] text-muted-foreground truncate max-w-37.5">{r.name}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.sector}</TableCell>
                  <TableCell className="text-xs">{r.period}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCr(r.revenue)}</TableCell>
                  <TableCell className={`text-right font-mono text-xs ${changeColor(r.revenueGrowth)}`}>
                    {formatChangePercent(r.revenueGrowth)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCr(r.profit)}</TableCell>
                  <TableCell className={`text-right font-mono text-xs ${changeColor(r.profitGrowth)}`}>
                    {formatChangePercent(r.profitGrowth)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{r.eps?.toFixed(2) ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {top10Growth.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-4">Top 10 Companies by Revenue Growth</h2>
          <div className="h-75">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10Growth} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" horizontal={false} />
                <XAxis type="number" stroke="hsl(215,20%,55%)" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
                <YAxis dataKey="name" type="category" stroke="hsl(215,20%,55%)" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} width={80} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                  contentStyle={{ backgroundColor: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,17%)", borderRadius: 6, fontSize: 11 }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, "Growth"]}
                />
                <Bar dataKey="growth" fill="#22c55e" radius={[0, 4, 4, 0]}>
                  {top10Growth.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.growth && entry.growth > 0 ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
