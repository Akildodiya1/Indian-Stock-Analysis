"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { changeColor } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface OiStrike {
  strike: number; callOI: number; putOI: number;
  callOIChange: number; putOIChange: number;
  callLTP: number; putLTP: number;
  callIV: number; putIV: number;
  callGreeks: OptionGreeks | null;
  putGreeks: OptionGreeks | null;
}
interface OptionGreeks {
  delta: number; gamma: number; theta: number; vega: number; rho: number;
}
interface FuturesDashboard {
  symbol: string; spotPrice: number; expiry: string;
  pcr: number; totalCallOI: number; totalPutOI: number;
  maxCallOIStrike: number; maxPutOIStrike: number;
  straddle: number; oiStrikes: OiStrike[];
  greeksAssumptions: {
    model: string; riskFreeRate: number; dividendYield: number;
  };
}

export default function FuturesPage() {
  const [symbol, setSymbol] = useState<"nifty" | "bankNifty">("nifty");

  const { data, isLoading, isError, error } = useQuery<{ nifty: FuturesDashboard, bankNifty: FuturesDashboard }>({
    queryKey: ["market", "futures-dashboard"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/futures-dashboard"));
      if (!response.ok) throw new Error(`NSE option-chain data unavailable (HTTP ${response.status})`);
      return response.json();
    },
    refetchInterval: 60_000,
  });

  const dashboard = data?.[symbol];

  return (
    <div className="space-y-6 max-w-screen-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="h-6 w-6 text-primary" />
          Futures Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Option chain analysis — OI buildup, PCR, and key strikes</p>
      </div>

      <Tabs value={symbol} onValueChange={(v: string) => setSymbol(v as "nifty" | "bankNifty")}>
        <TabsList>
          <TabsTrigger value="nifty">NIFTY</TabsTrigger>
          <TabsTrigger value="bankNifty">BANKNIFTY</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading...</div>
      ) : isError || !dashboard ? (
        <div className="text-center py-16 text-destructive text-sm" role="alert">
          {error instanceof Error ? error.message : "NSE option-chain data is temporarily unavailable."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs text-muted-foreground mb-1">Spot Price</div>
              <div className="text-2xl font-bold">{dashboard.spotPrice.toLocaleString('en-IN')}</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs text-muted-foreground mb-1">PCR Ratio</div>
              <div className={`text-2xl font-bold ${dashboard.pcr > 1 ? 'text-green-500' : dashboard.pcr < 0.8 ? 'text-red-500' : 'text-amber-500'}`}>
                {dashboard.pcr.toFixed(2)}
              </div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs text-muted-foreground mb-1">Max Pain Strike</div>
              <div className="text-2xl font-bold">{dashboard.maxCallOIStrike}</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs text-muted-foreground mb-1">ATM Straddle</div>
              <div className="text-2xl font-bold">{dashboard.straddle.toFixed(1)}</div>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="text-xs text-muted-foreground mb-1">Expiry Date</div>
              <div className="text-xl font-bold mt-1 text-cyan-400">{dashboard.expiry}</div>
            </div>
          </div>

          <Card className="p-4">
            <h2 className="font-semibold text-sm mb-4">Open Interest (OI) Profile</h2>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.oiStrikes} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" horizontal={false} />
                  <XAxis type="number" stroke="hsl(215,20%,55%)" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} tickFormatter={v => (v / 100000).toFixed(1) + 'L'} />
                  <YAxis dataKey="strike" type="category" stroke="hsl(215,20%,55%)" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "hsl(222,47%,10%)", border: "1px solid hsl(217,33%,17%)", borderRadius: 6, fontSize: 11 }}
                    formatter={(value: number, name: string) => [(value / 100000).toFixed(2) + 'L', name]}
                  />
                  <ReferenceLine y={Math.round(dashboard.spotPrice / 100) * 100} stroke="#22c55e" strokeDasharray="3 3" />
                  <Bar dataKey="putOI" name="Put OI" fill="#3b82f6" barSize={12} radius={[0, 2, 2, 0]} />
                  <Bar dataKey="callOI" name="Call OI" fill="#f97316" barSize={12} radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-4 pt-4 text-xs text-muted-foreground">
              Black-Scholes estimates · risk-free rate {(dashboard.greeksAssumptions.riskFreeRate * 100).toFixed(1)}% · dividend yield {(dashboard.greeksAssumptions.dividendYield * 100).toFixed(1)}% · theta per day · vega/rho per 1%
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-center">Call OI</TableHead>
                  <TableHead className="text-center">Call Change</TableHead>
                  <TableHead className="text-center">Call LTP</TableHead>
                  <TableHead className="text-center">Call IV</TableHead>
                  <TableHead className="text-center">Call Delta</TableHead>
                  <TableHead className="text-center">Call Gamma</TableHead>
                  <TableHead className="text-center">Call Theta</TableHead>
                  <TableHead className="text-center">Call Vega</TableHead>
                  <TableHead className="text-center">Call Rho</TableHead>
                  <TableHead className="text-center font-bold border-x border-border">Strike</TableHead>
                  <TableHead className="text-center">Put Delta</TableHead>
                  <TableHead className="text-center">Put Gamma</TableHead>
                  <TableHead className="text-center">Put Theta</TableHead>
                  <TableHead className="text-center">Put Vega</TableHead>
                  <TableHead className="text-center">Put Rho</TableHead>
                  <TableHead className="text-center">Put IV</TableHead>
                  <TableHead className="text-center">Put LTP</TableHead>
                  <TableHead className="text-center">Put Change</TableHead>
                  <TableHead className="text-center">Put OI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.oiStrikes.map((strike, i) => {
                  const isAtm = Math.abs(strike.strike - dashboard.spotPrice) < (symbol === 'nifty' ? 50 : 100);
                  const isMaxCall = strike.strike === dashboard.maxCallOIStrike;
                  const isMaxPut = strike.strike === dashboard.maxPutOIStrike;
                  return (
                    <TableRow key={i} className={isAtm ? "bg-accent/30" : ""}>
                      <TableCell className={`text-center font-mono text-xs ${isMaxCall ? "bg-orange-500/10 text-orange-400" : ""}`}>
                        {(strike.callOI / 100000).toFixed(2)}L
                      </TableCell>
                      <TableCell className={`text-center font-mono text-xs ${changeColor(strike.callOIChange)}`}>
                        {strike.callOIChange > 0 ? '+' : ''}{(strike.callOIChange / 100000).toFixed(2)}L
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">{strike.callLTP.toFixed(1)}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{strike.callIV.toFixed(1)}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{formatGreek(strike.callGreeks?.delta, 3)}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{formatGreek(strike.callGreeks?.gamma, 5)}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{formatGreek(strike.callGreeks?.theta, 2)}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{formatGreek(strike.callGreeks?.vega, 2)}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{formatGreek(strike.callGreeks?.rho, 2)}</TableCell>
                      
                      <TableCell className="text-center font-bold bg-muted/10 border-x border-border tabular-nums text-sm">{strike.strike}</TableCell>
                      
                      <TableCell className="text-center font-mono text-xs">{formatGreek(strike.putGreeks?.delta, 3)}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{formatGreek(strike.putGreeks?.gamma, 5)}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{formatGreek(strike.putGreeks?.theta, 2)}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{formatGreek(strike.putGreeks?.vega, 2)}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{formatGreek(strike.putGreeks?.rho, 2)}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{strike.putIV.toFixed(1)}</TableCell>
                      <TableCell className="text-center font-mono text-xs">{strike.putLTP.toFixed(1)}</TableCell>
                      <TableCell className={`text-center font-mono text-xs ${changeColor(strike.putOIChange)}`}>
                        {strike.putOIChange > 0 ? '+' : ''}{(strike.putOIChange / 100000).toFixed(2)}L
                      </TableCell>
                      <TableCell className={`text-center font-mono text-xs ${isMaxPut ? "bg-blue-500/10 text-blue-400" : ""}`}>
                        {(strike.putOI / 100000).toFixed(2)}L
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}

function formatGreek(value: number | undefined, decimals: number): string {
  return value != null && Number.isFinite(value) ? value.toFixed(decimals) : "—";
}
