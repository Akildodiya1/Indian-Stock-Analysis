"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap, TrendingUp, TrendingDown, BarChart2, BookOpen, Activity, Shield, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import Link from "next/link";
import { apiUrl } from "@/lib/api-url";
import { formatPrice, formatChangePercent, formatVolume, changeColor, displaySymbol } from "@/lib/format";
import { isFno } from "@/lib/fno-stocks";

interface Stock {
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
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

type ScanResult = { stock: Stock; reason: string; value: string };

interface ScanCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  scans: {
    id: string;
    label: string;
    description: string;
    run: (stocks: Stock[]) => ScanResult[];
  }[];
}

function pct52wHigh(s: Stock) {
  if (!s.regularMarketPrice || !s.fiftyTwoWeekHigh) return null;
  return (s.regularMarketPrice / s.fiftyTwoWeekHigh) * 100;
}
function pct52wLow(s: Stock) {
  if (!s.regularMarketPrice || !s.fiftyTwoWeekLow) return null;
  return (s.regularMarketPrice / s.fiftyTwoWeekLow) * 100;
}

const SCAN_CATEGORIES: ScanCategory[] = [
  {
    id: "price",
    title: "Price Scans",
    description: "Monitor significant price movements, patterns, and threshold breaching.",
    icon: TrendingUp,
    color: "text-blue-500",
    scans: [
      {
        id: "near52wHigh", label: "Near 52-Week High", description: "Stocks within 5% of their 52-week high",
        run: (s) => s.filter((x) => { const p = pct52wHigh(x); return p != null && p >= 95; })
          .sort((a, b) => (pct52wHigh(b) ?? 0) - (pct52wHigh(a) ?? 0))
          .map((x) => ({ stock: x, reason: "Near 52W High", value: `${pct52wHigh(x)?.toFixed(1)}% of 52W High` })),
      },
      {
        id: "near52wLow", label: "Near 52-Week Low", description: "Stocks within 10% of their 52-week low",
        run: (s) => s.filter((x) => { const p = pct52wLow(x); return p != null && p <= 110; })
          .sort((a, b) => (pct52wLow(a) ?? 999) - (pct52wLow(b) ?? 999))
          .map((x) => ({ stock: x, reason: "Near 52W Low", value: `${pct52wLow(x)?.toFixed(1)}% of 52W Low` })),
      },
      {
        id: "strongMomentum", label: "Strong Momentum (+3%)", description: "Stocks gaining more than 3% today",
        run: (s) => s.filter((x) => (x.regularMarketChangePercent ?? 0) >= 3)
          .sort((a, b) => (b.regularMarketChangePercent ?? 0) - (a.regularMarketChangePercent ?? 0))
          .map((x) => ({ stock: x, reason: "Strong Momentum", value: formatChangePercent(x.regularMarketChangePercent) })),
      },
      {
        id: "sharpDecline", label: "Sharp Decline (-3%)", description: "Stocks falling more than 3% today",
        run: (s) => s.filter((x) => (x.regularMarketChangePercent ?? 0) <= -3)
          .sort((a, b) => (a.regularMarketChangePercent ?? 0) - (b.regularMarketChangePercent ?? 0))
          .map((x) => ({ stock: x, reason: "Sharp Decline", value: formatChangePercent(x.regularMarketChangePercent) })),
      },
    ],
  },
  {
    id: "volume",
    title: "Volume Scans",
    description: "Monitor highly traded and delivered stocks.",
    icon: BarChart2,
    color: "text-purple-500",
    scans: [
      {
        id: "highVolume", label: "High Volume (>10M)", description: "Stocks with exceptional volume activity",
        run: (s) => s.filter((x) => (x.regularMarketVolume ?? 0) >= 10_000_000)
          .sort((a, b) => (b.regularMarketVolume ?? 0) - (a.regularMarketVolume ?? 0))
          .map((x) => ({ stock: x, reason: "High Volume", value: formatVolume(x.regularMarketVolume) })),
      },
      {
        id: "largeCap", label: "Large Cap Gainers", description: "Large caps (>₹1L Cr) gaining today",
        run: (s) => s.filter((x) => (x.marketCap ?? 0) >= 1e13 && (x.regularMarketChangePercent ?? 0) > 0)
          .sort((a, b) => (b.regularMarketChangePercent ?? 0) - (a.regularMarketChangePercent ?? 0))
          .map((x) => ({ stock: x, reason: "Large Cap", value: formatChangePercent(x.regularMarketChangePercent) })),
      },
    ],
  },
  {
    id: "technical",
    title: "Technical Scans",
    description: "Get scans when technical conditions are met for NSE & BSE stocks.",
    icon: Activity,
    color: "text-yellow-500",
    scans: [
      {
        id: "highPe", label: "High P/E (>50)", description: "Stocks with high valuation multiples",
        run: (s) => s.filter((x) => (x.trailingPE ?? 0) > 50)
          .sort((a, b) => (b.trailingPE ?? 0) - (a.trailingPE ?? 0))
          .map((x) => ({ stock: x, reason: "High P/E", value: `P/E ${x.trailingPE?.toFixed(1)}x` })),
      },
      {
        id: "lowPe", label: "Low P/E (<15)", description: "Potentially undervalued stocks",
        run: (s) => s.filter((x) => x.trailingPE != null && x.trailingPE > 0 && x.trailingPE < 15)
          .sort((a, b) => (a.trailingPE ?? 0) - (b.trailingPE ?? 0))
          .map((x) => ({ stock: x, reason: "Low P/E", value: `P/E ${x.trailingPE?.toFixed(1)}x` })),
      },
      {
        id: "breakout", label: "Breakout (Hit 52W High Today)", description: "Stocks hitting new yearly highs",
        run: (s) => s.filter((x) => {
          const p = pct52wHigh(x);
          return p != null && p >= 98 && (x.regularMarketChangePercent ?? 0) > 0;
        })
          .sort((a, b) => (pct52wHigh(b) ?? 0) - (pct52wHigh(a) ?? 0))
          .map((x) => ({ stock: x, reason: "52W Breakout", value: `${pct52wHigh(x)?.toFixed(1)}% of High` })),
      },
    ],
  },
  {
    id: "fundamental",
    title: "Fundamental Scans",
    description: "Identify companies based on various fundamental parameters.",
    icon: BookOpen,
    color: "text-green-500",
    scans: [
      {
        id: "highRoe", label: "High ROE (>20%)", description: "Stocks with strong returns on equity",
        run: (s) => s.filter((x) => (x.returnOnEquity ?? 0) > 0.20)
          .sort((a, b) => (b.returnOnEquity ?? 0) - (a.returnOnEquity ?? 0))
          .map((x) => ({ stock: x, reason: "High ROE", value: `ROE ${((x.returnOnEquity ?? 0) * 100).toFixed(1)}%` })),
      },
      {
        id: "valueStock", label: "Value Stocks (P/E<20 & P/B<3)", description: "Classic value investing criteria",
        run: (s) => s.filter((x) =>
          x.trailingPE != null && x.trailingPE > 0 && x.trailingPE < 20 &&
          x.priceToBook != null && x.priceToBook > 0 && x.priceToBook < 3
        )
          .sort((a, b) => (a.trailingPE ?? 0) - (b.trailingPE ?? 0))
          .map((x) => ({ stock: x, reason: "Value Stock", value: `P/E ${x.trailingPE?.toFixed(1)}x, P/B ${x.priceToBook?.toFixed(1)}x` })),
      },
      {
        id: "highDividend", label: "High Dividend (>3%)", description: "Income-generating stocks",
        run: (s) => s.filter((x) => (x.dividendYield ?? 0) > 0.03)
          .sort((a, b) => (b.dividendYield ?? 0) - (a.dividendYield ?? 0))
          .map((x) => ({ stock: x, reason: "High Dividend", value: `Yield ${((x.dividendYield ?? 0) * 100).toFixed(2)}%` })),
      },
      {
        id: "lowPb", label: "Low P/B (<1.5)", description: "Trading near or below book value",
        run: (s) => s.filter((x) => x.priceToBook != null && x.priceToBook > 0 && x.priceToBook < 1.5)
          .sort((a, b) => (a.priceToBook ?? 0) - (b.priceToBook ?? 0))
          .map((x) => ({ stock: x, reason: "Low P/B", value: `P/B ${x.priceToBook?.toFixed(2)}x` })),
      },
    ],
  },
  {
    id: "fno",
    title: "F&O Scans",
    description: "Monitor exceptional activity in Futures and Options segment.",
    icon: Shield,
    color: "text-cyan-500",
    scans: [
      {
        id: "fnoGainers", label: "F&O Gainers", description: "F&O stocks gaining strongly today",
        run: (s) => s.filter((x) => isFno(x.symbol) && (x.regularMarketChangePercent ?? 0) >= 2)
          .sort((a, b) => (b.regularMarketChangePercent ?? 0) - (a.regularMarketChangePercent ?? 0))
          .map((x) => ({ stock: x, reason: "F&O Gainer", value: formatChangePercent(x.regularMarketChangePercent) })),
      },
      {
        id: "fnoLosers", label: "F&O Losers", description: "F&O stocks falling sharply today",
        run: (s) => s.filter((x) => isFno(x.symbol) && (x.regularMarketChangePercent ?? 0) <= -2)
          .sort((a, b) => (a.regularMarketChangePercent ?? 0) - (b.regularMarketChangePercent ?? 0))
          .map((x) => ({ stock: x, reason: "F&O Loser", value: formatChangePercent(x.regularMarketChangePercent) })),
      },
      {
        id: "fnoHighVol", label: "F&O High Volume", description: "F&O stocks with exceptional volume",
        run: (s) => s.filter((x) => isFno(x.symbol) && (x.regularMarketVolume ?? 0) >= 5_000_000)
          .sort((a, b) => (b.regularMarketVolume ?? 0) - (a.regularMarketVolume ?? 0))
          .map((x) => ({ stock: x, reason: "High Volume", value: formatVolume(x.regularMarketVolume) })),
      },
    ],
  },
];

function ScanResultRow({ result }: { result: ScanResult }) {
  const chg = result.stock.regularMarketChangePercent ?? 0;
  return (
    <tr className="border-b hover:bg-accent/20 transition-colors">
      <td className="px-3 py-2">
        <Link href={`/stock/${encodeURIComponent(result.stock.symbol)}`} className="group flex items-center gap-2">
          <div>
            <div className="font-semibold text-sm group-hover:text-primary transition-colors">
              {displaySymbol(result.stock.symbol)}
              {isFno(result.stock.symbol) && (
                <span className="ml-1 text-[9px] bg-cyan-500/20 text-cyan-400 px-1 rounded font-bold">F&O</span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground truncate max-w-30">{result.stock.name}</div>
          </div>
        </Link>
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-bold text-sm">{formatPrice(result.stock.regularMarketPrice)}</td>
      <td className={`px-3 py-2 text-right tabular-nums text-sm font-medium ${changeColor(chg)}`}>
        {formatChangePercent(chg)}
      </td>
      <td className="px-3 py-2 text-right text-xs text-muted-foreground">{result.value}</td>
    </tr>
  );
}

function ScanBlock({
  scan,
  stocks,
}: {
  scan: ScanCategory["scans"][0];
  stocks: Stock[];
}) {
  const [open, setOpen] = useState(false);
  const results = useMemo(() => scan.run(stocks), [scan, stocks]);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-accent/30 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <div className="font-semibold text-sm">{scan.label}</div>
          <div className="text-xs text-muted-foreground">{scan.description}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-bold bg-primary/10 text-primary rounded-full px-2 py-0.5">
            {results.length} stocks
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {open && results.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-t">
                <th className="text-left px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Stock</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Price</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Change</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Signal</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 20).map((r, i) => (
                <ScanResultRow key={i} result={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && results.length === 0 && (
        <div className="py-6 text-center text-xs text-muted-foreground">No stocks match this scan criteria today</div>
      )}
    </div>
  );
}

export default function ScansPage() {
  const { data: stocks, isLoading, isError } = useQuery<Stock[]>({
    queryKey: ["screener", "all-scans"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/screener?exchange=NSE&sortBy=marketCap&sortOrder=desc"));
      if (!response.ok) throw new Error("Stock scan data request failed");
      return response.json();
    },
    staleTime: 2 * 60_000,
  });

  const [expandedCat, setExpandedCat] = useState<string | null>("price");

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Zap className="h-6 w-6 text-yellow-500" />
          Stock Scans
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Pre-built scans across price, volume, technical, and fundamental criteria</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-500">
          Live NSE stock data is unavailable. Please try again later.
        </div>
      ) : (
        <div className="space-y-4">
          {SCAN_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isExpanded = expandedCat === cat.id;
            return (
              <div key={cat.id} className="rounded-xl border bg-card overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-accent/20 transition-colors text-left"
                  onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${cat.color}`} />
                  <div className="flex-1">
                    <div className="font-bold">{cat.title}</div>
                    <div className="text-xs text-muted-foreground">{cat.description}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-bold ${cat.color}`}>{cat.scans.length} Scans</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-3 border-t pt-4">
                    {cat.scans.map((scan) => (
                      <ScanBlock key={scan.id} scan={scan} stocks={stocks ?? []} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-dashed p-6 text-center">
        <ExternalLink className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="font-semibold text-muted-foreground">Custom Scans</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Use the <Link href="/screener" className="text-primary hover:underline">Screener</Link> to build your own custom scans with filters</p>
      </div>
    </div>
  );
}
