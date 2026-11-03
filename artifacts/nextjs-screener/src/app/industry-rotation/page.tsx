"use client";

import { useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { changeColor } from "@/lib/format";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

interface IndustryRotationSector {
  sector: string;
  stockCount: number;
  advances: number;
  declines: number;
  unchanged: number;
  adRatio: number;
  avgChange1d: number;
  strongUp: number;
  strongDown: number;
  topStock: string;
  topStockChange: number;
  worstStock: string;
  worstStockChange: number;
  change1w: number | null;
  change1m: number | null;
  change3m: number | null;
  rsRatio: number | null;
  rsMomentum: number | null;
  quadrant: "Leading" | "Weakening" | "Lagging" | "Improving" | null;
  momentum: "accelerating" | "decelerating" | "stable" | null;
}

const QUADRANT_COLORS = {
  Leading: "#22c55e",
  Weakening: "#f59e0b",
  Lagging: "#ef4444",
  Improving: "#22d3ee",
};

export default function IndustryRotationPage() {
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery<IndustryRotationSector[]>({
    queryKey: ["market", "industry-rotation"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/industry-rotation"));
      if (!response.ok) throw new Error("Industry rotation request failed");
      return response.json();
    },
    staleTime: 3 * 60 * 1000,
  });

  const leading = data.filter((d) => d.quadrant === "Leading").length;
  const weakening = data.filter((d) => d.quadrant === "Weakening").length;
  const lagging = data.filter((d) => d.quadrant === "Lagging").length;
  const improving = data.filter((d) => d.quadrant === "Improving").length;
  const chartData = data.filter(
    (sector) =>
      sector.rsRatio != null &&
      sector.rsMomentum != null &&
      sector.quadrant != null,
  );
  const formatPercent = (value: number | null) =>
    value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <RotateCcw className="h-6 w-6 text-primary" />
          Industry Rotation
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Sector momentum, relative strength, and rotation analysis
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Leading</div>
          <div className="text-2xl font-bold text-green-500">{leading}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Improving</div>
          <div className="text-2xl font-bold text-cyan-500">{improving}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Weakening</div>
          <div className="text-2xl font-bold text-amber-500">{weakening}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Lagging</div>
          <div className="text-2xl font-bold text-red-500">{lagging}</div>
        </div>
      </div>

      <Tabs defaultValue="chart">
        <TabsList className="mb-4">
          <TabsTrigger value="chart">Rotation Chart</TabsTrigger>
          <TabsTrigger value="table">Sector Table</TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="mt-0">
          <Card className="p-4">
            {isLoading ? (
              <div className="h-31.25 flex items-center justify-center text-muted-foreground text-sm">
                Loading...
              </div>
            ) : isError ? (
              <div
                role="alert"
                className="h-31.25 flex items-center justify-center text-amber-500 text-sm"
              >
                Live market data is unavailable. Please try again later.
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-31.25 flex items-center justify-center text-muted-foreground text-sm">
                Relative-strength history is unavailable for these sectors.
              </div>
            ) : (
              <div className="h-105 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(217,33%,17%)"
                      opacity={0.5}
                    />
                    <XAxis
                      type="number"
                      dataKey="rsRatio"
                      name="RS-Ratio"
                      domain={["auto", "auto"]}
                      stroke="hsl(215,20%,55%)"
                      tick={{ fill: "hsl(215,20%,55%)", fontSize: 11 }}
                      label={{
                        value: "RS-Ratio",
                        position: "insideBottom",
                        offset: -10,
                        fill: "hsl(215,20%,55%)",
                        fontSize: 12,
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="rsMomentum"
                      name="RS-Momentum"
                      domain={["auto", "auto"]}
                      stroke="hsl(215,20%,55%)"
                      tick={{ fill: "hsl(215,20%,55%)", fontSize: 11 }}
                      label={{
                        value: "RS-Momentum",
                        angle: -90,
                        position: "insideLeft",
                        offset: 15,
                        fill: "hsl(215,20%,55%)",
                        fontSize: 12,
                      }}
                    />
                    <ReferenceLine
                      x={100}
                      stroke="hsl(217,33%,25%)"
                      strokeWidth={1.5}
                    />
                    <ReferenceLine
                      y={100}
                      stroke="hsl(217,33%,25%)"
                      strokeWidth={1.5}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={{
                        backgroundColor: "hsl(222,47%,10%)",
                        border: "1px solid hsl(217,33%,17%)",
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0]
                            .payload as IndustryRotationSector;
                          return (
                            <div className="bg-card border border-border p-3 rounded-lg shadow-xl text-xs space-y-1">
                              <p className="font-bold text-base mb-1">
                                {d.sector}
                              </p>
                              <p className="text-muted-foreground">
                                Quadrant:{" "}
                                <span
                                  style={{
                                    color: d.quadrant
                                      ? QUADRANT_COLORS[d.quadrant]
                                      : undefined,
                                  }}
                                  className="font-bold"
                                >
                                  {d.quadrant ?? "Unavailable"}
                                </span>
                              </p>
                              <p>
                                RS-Ratio:{" "}
                                <span className="font-mono">
                                  {d.rsRatio?.toFixed(2) ?? "—"}
                                </span>
                              </p>
                              <p>
                                RS-Momentum:{" "}
                                <span className="font-mono">
                                  {d.rsMomentum?.toFixed(2) ?? "—"}
                                </span>
                              </p>
                              <p>
                                1D Change:{" "}
                                <span
                                  className={`font-mono ${changeColor(d.avgChange1d)}`}
                                >
                                  {d.avgChange1d > 0 ? "+" : ""}
                                  {d.avgChange1d.toFixed(2)}%
                                </span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter data={chartData}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.quadrant
                              ? QUADRANT_COLORS[entry.quadrant]
                              : "#888"
                          }
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
                {/* Visual labels for quadrants */}
                <div className="absolute top-4 left-10 text-cyan-500/40 font-bold text-xl pointer-events-none uppercase tracking-widest">
                  Improving
                </div>
                <div className="absolute top-4 right-10 text-green-500/40 font-bold text-xl pointer-events-none uppercase tracking-widest">
                  Leading
                </div>
                <div className="absolute bottom-10 left-10 text-red-500/40 font-bold text-xl pointer-events-none uppercase tracking-widest">
                  Lagging
                </div>
                <div className="absolute bottom-10 right-10 text-amber-500/40 font-bold text-xl pointer-events-none uppercase tracking-widest">
                  Weakening
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="table" className="mt-0">
          <Card className="overflow-hidden">
            {isLoading ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                Loading...
              </div>
            ) : isError ? (
              <div
                role="alert"
                className="text-center py-16 text-amber-500 text-sm"
              >
                Live market data is unavailable. Please try again later.
              </div>
            ) : data.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                No market data available
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sector</TableHead>
                    <TableHead className="text-right">Stocks</TableHead>
                    <TableHead className="text-center">A/D</TableHead>
                    <TableHead className="text-right">Today</TableHead>
                    <TableHead className="text-right">1W</TableHead>
                    <TableHead className="text-right">1M</TableHead>
                    <TableHead className="text-right">3M</TableHead>
                    <TableHead className="text-right">RS</TableHead>
                    <TableHead>Quadrant</TableHead>
                    <TableHead>Momentum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((d) => (
                    <TableRow key={d.sector}>
                      <TableCell className="font-medium text-cyan-400">
                        {d.sector}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.stockCount}
                      </TableCell>
                      <TableCell className="text-center text-xs tabular-nums">
                        <span className="text-green-500">{d.advances}</span> /{" "}
                        <span className="text-red-500">{d.declines}</span>
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${d.avgChange1d == null ? "" : changeColor(d.avgChange1d)}`}
                      >
                        {formatPercent(d.avgChange1d)}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${d.change1w == null ? "" : changeColor(d.change1w)}`}
                      >
                        {formatPercent(d.change1w)}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${d.change1m == null ? "" : changeColor(d.change1m)}`}
                      >
                        {formatPercent(d.change1m)}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${d.change3m == null ? "" : changeColor(d.change3m)}`}
                      >
                        {formatPercent(d.change3m)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {d.rsRatio?.toFixed(1) ?? "—"}
                      </TableCell>
                      <TableCell>
                        {d.quadrant ? (
                          <Badge
                            variant="outline"
                            style={{
                              color: QUADRANT_COLORS[d.quadrant],
                              borderColor: QUADRANT_COLORS[d.quadrant],
                            }}
                          >
                            {d.quadrant}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {d.momentum ? (
                          <Badge
                            variant="outline"
                            className={
                              d.momentum === "accelerating"
                                ? "bg-green-500/10 text-green-500 border-green-500/30"
                                : d.momentum === "decelerating"
                                  ? "bg-red-500/10 text-red-500 border-red-500/30"
                                  : "bg-muted/40 text-muted-foreground border-muted"
                            }
                          >
                            {d.momentum}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
