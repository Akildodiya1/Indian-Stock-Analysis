"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft } from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { formatPrice, formatVolume, displaySymbol } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface BulkDeal {
  date: string;
  symbol: string;
  name: string;
  clientName: string;
  dealType: "BUY" | "SELL" | string;
  quantity: number;
  price: number;
  remarks: string;
}

function formatDateForApi(d: Date) {
  return `${d.getDate().toString().padStart(2, "0")}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getFullYear()}`;
}

export default function BulkDealsPage() {
  const [fromDateStr, setFromDateStr] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [toDateStr, setToDateStr] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  const [appliedFrom, setAppliedFrom] = useState(fromDateStr);
  const [appliedTo, setAppliedTo] = useState(toDateStr);
  const [tab, setTab] = useState("ALL");

  const apiFrom = useMemo(
    () => formatDateForApi(new Date(appliedFrom)),
    [appliedFrom],
  );
  const apiTo = useMemo(
    () => formatDateForApi(new Date(appliedTo)),
    [appliedTo],
  );

  const {
    data: deals = [],
    isLoading,
    isError,
  } = useQuery<BulkDeal[]>({
    queryKey: ["market", "bulk-deals", apiFrom, apiTo],
    queryFn: async () => {
      const response = await fetch(
        apiUrl(`/market/bulk-deals?from_date=${apiFrom}&to_date=${apiTo}`),
      );
      if (!response.ok) throw new Error("Bulk deal data request failed");
      return response.json();
    },
  });

  const filteredDeals = useMemo(() => {
    if (tab === "ALL") return deals;
    return deals.filter((d) => d.dealType === tab);
  }, [deals, tab]);

  const totalDeals = deals.length;
  const buyDeals = deals.filter((d) => d.dealType === "BUY").length;
  const sellDeals = deals.filter((d) => d.dealType === "SELL").length;
  const uniqueStocks = new Set(deals.map((d) => d.symbol)).size;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ArrowRightLeft className="h-6 w-6 text-primary" />
          Bulk Deals
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Institutional & high-volume trades reported to NSE
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Total Deals</div>
          <div className="text-2xl font-bold">{totalDeals}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Buy Deals</div>
          <div className="text-2xl font-bold text-green-500">{buyDeals}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Sell Deals</div>
          <div className="text-2xl font-bold text-red-500">{sellDeals}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">
            Unique Stocks
          </div>
          <div className="text-2xl font-bold">{uniqueStocks}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={fromDateStr}
            onChange={(e) => setFromDateStr(e.target.value)}
            className="w-40"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="date"
            value={toDateStr}
            onChange={(e) => setToDateStr(e.target.value)}
            className="w-40"
          />
          <Button
            onClick={() => {
              setAppliedFrom(fromDateStr);
              setAppliedTo(toDateStr);
            }}
          >
            Apply
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="ALL">All</TabsTrigger>
            <TabsTrigger value="BUY">BUY</TabsTrigger>
            <TabsTrigger value="SELL">SELL</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {isError ? (
          <div
            role="alert"
            className="text-center py-16 text-amber-500 text-sm"
          >
            Live NSE bulk deal data is unavailable. Please try again later.
          </div>
        ) : isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Loading...
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No data available
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Client Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Avg Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeals.map((deal, i) => (
                <TableRow key={i}>
                  <TableCell className="whitespace-nowrap">
                    {deal.date}
                  </TableCell>
                  <TableCell className="font-medium text-cyan-400">
                    {displaySymbol(deal.symbol)}
                  </TableCell>
                  <TableCell
                    className="max-w-50 truncate"
                    title={deal.name}
                  >
                    {deal.name}
                  </TableCell>
                  <TableCell
                    className="max-w-75 truncate"
                    title={deal.clientName}
                  >
                    {deal.clientName}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        deal.dealType === "BUY"
                          ? "bg-green-500/10 text-green-500 border-green-500/20"
                          : deal.dealType === "SELL"
                            ? "bg-red-500/10 text-red-500 border-red-500/20"
                            : ""
                      }
                    >
                      {deal.dealType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatVolume(deal.quantity)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPrice(deal.price)}
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
