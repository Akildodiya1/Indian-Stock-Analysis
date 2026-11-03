"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, ArrowUp, ArrowDown } from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { displaySymbol } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface PromoterRecord {
  symbol: string; name: string; exchange: string; sector: string;
  promoterHolding: number | null;
  promoterPledged: number | null;
  institutionalHolding: number | null;
  publicHolding: number | null;
  quarterlyChange: number | null;
  trend: "buying" | "selling" | "neutral";
}

export default function PromoterActivityPage() {
  const [tab, setTab] = useState("All");

  const { data: records = [], isLoading, isError } = useQuery<PromoterRecord[]>({
    queryKey: ["market", "promoter-activity"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/promoter-activity"));
      if (!response.ok) throw new Error("Promoter activity request failed");
      return response.json();
    },
    staleTime: 15 * 60 * 1000,
  });

  const filteredRecords = useMemo(() => {
    let result = records;
    if (tab === "Buying") result = result.filter(r => r.trend === "buying");
    if (tab === "Selling") result = result.filter(r => r.trend === "selling");
    if (tab === "High Pledged") result = result.filter(r => (r.promoterPledged ?? 0) > 10);
    
    return result.sort((a, b) => (b.promoterHolding ?? 0) - (a.promoterHolding ?? 0));
  }, [records, tab]);

  const buyingCount = records.filter(r => r.trend === "buying").length;
  const sellingCount = records.filter(r => r.trend === "selling").length;
  const avgHolding = records.length > 0 
    ? records.reduce((acc, r) => acc + (r.promoterHolding ?? 0), 0) / records.length 
    : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Promoter Activity
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Up to 30 largest NSE listings with reported promoter shareholding data</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Total Companies Tracked</div>
          <div className="text-2xl font-bold">{records.length}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Promoter Buying</div>
          <div className="text-2xl font-bold text-green-500">{buyingCount}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Promoter Selling</div>
          <div className="text-2xl font-bold text-red-500">{sellingCount}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Avg Promoter Holding</div>
          <div className="text-2xl font-bold">{avgHolding.toFixed(1)}%</div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="All">All</TabsTrigger>
          <TabsTrigger value="Buying">Buying</TabsTrigger>
          <TabsTrigger value="Selling">Selling</TabsTrigger>
          <TabsTrigger value="High Pledged">High Pledged (&gt;10%)</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="rounded-lg border bg-card overflow-hidden">
        {isError ? (
          <div role="alert" className="text-center py-16 text-amber-500 text-sm">Live NSE promoter holding data is unavailable. Please try again later.</div>
        ) : isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Loading...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No data available</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead className="w-37.5">Promoter %</TableHead>
                <TableHead className="text-right">Pledged %</TableHead>
                <TableHead className="text-right">Inst %</TableHead>
                <TableHead className="text-right">Public %</TableHead>
                <TableHead className="text-right">Quarterly Change</TableHead>
                <TableHead>Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="font-semibold text-sm text-cyan-400">{displaySymbol(r.symbol)}</div>
                    <div className="text-[10px] text-muted-foreground truncate max-w-37.5">{r.name}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.sector}</TableCell>
                  <TableCell>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-mono">{r.promoterHolding?.toFixed(2) ?? "—"}%</span>
                    </div>
                    {r.promoterHolding != null && (
                      <div className="h-1.5 rounded-full bg-muted mt-1 w-full overflow-hidden">
                        <div className="h-1.5 rounded-full bg-cyan-500" style={{ width: `${Math.min(100, r.promoterHolding)}%` }} />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className={`text-right text-xs font-mono ${(r.promoterPledged ?? 0) > 10 ? 'text-red-500 font-bold' : ''}`}>
                    {r.promoterPledged?.toFixed(2) ?? "—"}{r.promoterPledged != null ? "%" : ""}
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono text-muted-foreground">
                    {r.institutionalHolding?.toFixed(2) ?? "—"}%
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono text-muted-foreground">
                    {r.publicHolding?.toFixed(2) ?? "—"}%
                  </TableCell>
                  <TableCell className="text-right">
                    {r.quarterlyChange != null && r.quarterlyChange !== 0 ? (
                      <div className={`flex items-center justify-end gap-1 text-xs font-medium tabular-nums ${r.quarterlyChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {r.quarterlyChange > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {Math.abs(r.quarterlyChange).toFixed(2)}%
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.trend === "buying" && <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Buying</Badge>}
                    {r.trend === "selling" && <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Selling</Badge>}
                    {r.trend === "neutral" && <Badge variant="outline" className="bg-muted/40 text-muted-foreground border-muted">Neutral</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
