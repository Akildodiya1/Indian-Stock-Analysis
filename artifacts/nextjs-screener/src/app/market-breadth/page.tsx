"use client";

import { useQuery } from "@tanstack/react-query";
import { Gauge } from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { formatChangePercent, changeColor } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface MarketBreadthData {
  total: number;
  advanceDecline: { advances: number; declines: number; unchanged: number; ratio: number };
  fiftyTwoWeek: { at52wHigh: number; near52wHigh: number; near52wLow: number; at52wLow: number };
  momentum: {
    strongUp: number; strongDown: number;
    topGainers: { symbol: string; name: string; changePercent: number }[];
    topLosers: { symbol: string; name: string; changePercent: number }[];
  };
  niftyEma: {
    price: number; ema20: number; ema50: number; ema200: number;
    aboveEma20: boolean; aboveEma50: boolean; aboveEma200: boolean;
  };
}

export default function MarketBreadthPage() {
  const { data, isLoading, isError, error } = useQuery<MarketBreadthData>({
    queryKey: ["market", "market-breadth"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/market-breadth"));
      if (!response.ok) throw new Error(`Market breadth unavailable (HTTP ${response.status})`);
      return response.json();
    },
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-screen-xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Gauge className="h-6 w-6 text-primary" />
          Market Breadth
        </h1>
        <div className="text-center py-16 text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6 max-w-screen-xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Gauge className="h-6 w-6 text-primary" />
          Market Breadth
        </h1>
        <div className="text-center py-16 text-destructive text-sm" role="alert">
          {error instanceof Error ? error.message : "Market breadth data is temporarily unavailable."}
        </div>
      </div>
    );
  }

  const ad = data.advanceDecline;
  const adTotal = ad.advances + ad.declines + ad.unchanged || 1;
  const advPct = (ad.advances / adTotal) * 100;
  const uncPct = (ad.unchanged / adTotal) * 100;
  const decPct = (ad.declines / adTotal) * 100;

  const barChartData = [
    { name: "Advances", count: ad.advances, color: "#22c55e" },
    { name: "Unchanged", count: ad.unchanged, color: "#64748b" },
    { name: "Declines", count: ad.declines, color: "#ef4444" },
  ];

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Gauge className="h-6 w-6 text-primary" />
          Market Breadth
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Advance/decline analysis and EMA participation for NSE 100</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Advances</div>
          <div className="text-2xl font-bold text-green-500">{ad.advances}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Declines</div>
          <div className="text-2xl font-bold text-red-500">{ad.declines}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Unchanged</div>
          <div className="text-2xl font-bold text-muted-foreground">{ad.unchanged}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">A/D Ratio</div>
          <div className={`text-2xl font-bold ${ad.ratio >= 1 ? "text-green-500" : "text-red-500"}`}>
            {ad.ratio.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Advances ({advPct.toFixed(1)}%)</span>
          <span>Unchanged ({uncPct.toFixed(1)}%)</span>
          <span>Declines ({decPct.toFixed(1)}%)</span>
        </div>
        <div className="h-4 flex rounded-full overflow-hidden">
          <div style={{ width: `${advPct}%` }} className="bg-green-500" />
          <div style={{ width: `${uncPct}%` }} className="bg-slate-500" />
          <div style={{ width: `${decPct}%` }} className="bg-red-500" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-4">Nifty 50 EMA Status</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Current Price</TableCell>
                <TableCell className="text-right font-medium">{data.niftyEma.price.toFixed(2)}</TableCell>
                <TableCell className="text-right">—</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>EMA 20</TableCell>
                <TableCell className="text-right">{data.niftyEma.ema20.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className={data.niftyEma.aboveEma20 ? "bg-green-500/10 text-green-500 border-green-500/50" : "bg-red-500/10 text-red-500 border-red-500/50"}>
                    {data.niftyEma.aboveEma20 ? "Above" : "Below"}
                  </Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>EMA 50</TableCell>
                <TableCell className="text-right">{data.niftyEma.ema50.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className={data.niftyEma.aboveEma50 ? "bg-green-500/10 text-green-500 border-green-500/50" : "bg-red-500/10 text-red-500 border-red-500/50"}>
                    {data.niftyEma.aboveEma50 ? "Above" : "Below"}
                  </Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>EMA 200</TableCell>
                <TableCell className="text-right">{data.niftyEma.ema200.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className={data.niftyEma.aboveEma200 ? "bg-green-500/10 text-green-500 border-green-500/50" : "bg-red-500/10 text-red-500 border-red-500/50"}>
                    {data.niftyEma.aboveEma200 ? "Above" : "Below"}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-4">52-Week Range</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded border p-3">
              <div className="text-xs text-muted-foreground">At 52W High</div>
              <div className="text-xl font-bold text-green-500 mt-1">{data.fiftyTwoWeek.at52wHigh}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-muted-foreground">Near 52W High (&lt;5%)</div>
              <div className="text-xl font-bold text-green-400 mt-1">{data.fiftyTwoWeek.near52wHigh}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-muted-foreground">Near 52W Low (&lt;10%)</div>
              <div className="text-xl font-bold text-red-400 mt-1">{data.fiftyTwoWeek.near52wLow}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-muted-foreground">At 52W Low</div>
              <div className="text-xl font-bold text-red-500 mt-1">{data.fiftyTwoWeek.at52wLow}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-semibold text-sm mb-4">Momentum Breakdown</h2>
        <div className="grid md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x">
          <div className="pt-4 md:pt-0 pr-0 md:pr-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Strong Up (&gt;+3%)</span>
              <Badge className="bg-green-500/20 text-green-500 border-green-500/30">{data.momentum.strongUp}</Badge>
            </div>
            <div className="space-y-3">
              {data.momentum.topGainers.map(s => (
                <div key={s.symbol} className="flex justify-between items-center text-sm">
                  <div className="flex flex-col">
                    <span className="font-bold text-cyan-400">{s.symbol}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{s.name}</span>
                  </div>
                  <span className={`font-mono ${changeColor(s.changePercent)}`}>{formatChangePercent(s.changePercent)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-4 md:pt-0 pl-0 md:pl-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Strong Down (&lt;-3%)</span>
              <Badge className="bg-red-500/20 text-red-500 border-red-500/30">{data.momentum.strongDown}</Badge>
            </div>
            <div className="space-y-3">
              {data.momentum.topLosers.map(s => (
                <div key={s.symbol} className="flex justify-between items-center text-sm">
                  <div className="flex flex-col">
                    <span className="font-bold text-cyan-400">{s.symbol}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{s.name}</span>
                  </div>
                  <span className={`font-mono ${changeColor(s.changePercent)}`}>{formatChangePercent(s.changePercent)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold text-sm mb-4">Breadth Summary</h2>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" vertical={false} />
              <XAxis dataKey="name" stroke="hsl(215,20%,55%)" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 12 }} />
              <YAxis stroke="hsl(215,20%,55%)" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 12 }} />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                contentStyle={{ backgroundColor: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,17%)", borderRadius: 6, fontSize: 11 }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {barChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
