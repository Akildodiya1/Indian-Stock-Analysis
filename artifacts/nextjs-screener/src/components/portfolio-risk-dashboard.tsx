"use client";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CircleHelp,
  Info,
  RefreshCw,
  Shield,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PortfolioRiskResponse } from "@/lib/portfolio-risk";

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(222, 37%, 13%)",
  border: "1px solid hsl(217, 24%, 25%)",
  borderRadius: 8,
  color: "hsl(210, 25%, 92%)",
  fontSize: 11,
};

function number(value: number | null | undefined, digits = 2): string {
  return value == null || !Number.isFinite(value)
    ? "Unavailable"
    : value.toLocaleString("en-IN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
}

function currency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Unavailable";
  const absolute = Math.abs(value);
  if (absolute >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
  if (absolute >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function dateLabel(value: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Unavailable";
  return parsed.toLocaleDateString("en-IN", options ?? {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

function SectionHeading({
  eyebrow,
  title,
  detail,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-400/80">
            {eyebrow}
          </p>
        )}
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      </div>
      {detail && <p className="text-[10px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  helper,
  tone = "default",
}: {
  label: string;
  value: string;
  unit?: string;
  helper?: string;
  tone?: "default" | "risk" | "good" | "warm";
}) {
  const colors = {
    default: "text-foreground",
    risk: "text-rose-300",
    good: "text-emerald-300",
    warm: "text-amber-200",
  };
  return (
    <div className="min-w-0 border-l border-border/70 pl-3 first:border-l-0 first:pl-0">
      <div className="truncate text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 flex flex-wrap items-baseline gap-x-1.5 tabular-nums ${colors[tone]}`}>
        <span className="text-[19px] font-semibold leading-tight tracking-tight sm:text-[21px]">{value}</span>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
      {helper && <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{helper}</p>}
    </div>
  );
}

function StatePanel({
  kind,
  title,
  description,
  onRetry,
}: {
  kind: "loading" | "error" | "empty";
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  if (kind === "loading") {
    return (
      <section aria-label="Loading portfolio risk" aria-busy="true" className="space-y-4">
        <div className="motion-safe:animate-pulse rounded-xl border border-border/80 bg-card p-5 sm:p-6">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="mt-3 h-8 w-64 max-w-full rounded bg-muted" />
          <div className="mt-3 h-3 w-80 max-w-full rounded bg-muted/70" />
          <div className="mt-7 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index}>
                <div className="h-2 w-20 rounded bg-muted" />
                <div className="mt-3 h-6 w-24 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="h-72 motion-safe:animate-pulse rounded-xl border border-border/80 bg-card" />
          <div className="h-72 motion-safe:animate-pulse rounded-xl border border-border/80 bg-card" />
        </div>
      </section>
    );
  }

  const Icon = kind === "error" ? ShieldAlert : kind === "empty" ? BarChart3 : CircleHelp;
  return (
    <section className="rounded-xl border border-border/80 bg-card px-5 py-12 text-center sm:px-8">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary/60 text-cyan-300">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-secondary/70 px-4 text-xs font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
          Try again
        </button>
      )}
    </section>
  );
}

function PartialNotice({ data }: { data: PortfolioRiskResponse }) {
  const hasPartial = data.warnings.length > 0 || data.missingHistorySymbols.length > 0 || data.riskCoveragePct < 99.9;
  if (!hasPartial) return null;
  return (
    <aside className="rounded-lg border border-amber-400/25 bg-amber-300/[0.055] px-3.5 py-3" role="status">
      <div className="flex items-start gap-2.5">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-amber-100">Some risk inputs are incomplete</p>
          <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-amber-100/70">
            {data.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
            {data.missingHistorySymbols.length > 0 && (
              <li>
                No price history: <span className="font-medium text-amber-100">{data.missingHistorySymbols.join(", ")}</span>
              </li>
            )}
            {data.warnings.length === 0 && data.missingHistorySymbols.length === 0 && (
              <li>Risk calculations cover {number(data.riskCoveragePct, 1)}% of current portfolio value.</li>
            )}
          </ul>
        </div>
      </div>
    </aside>
  );
}

function RiskChart({ data }: { data: PortfolioRiskResponse }) {
  const chartData = data.series.map((point) => ({
    ...point,
    label: dateLabel(point.date),
  }));
  const hasNifty = chartData.some((point) => point.nifty50Index != null);

  return (
    <section className="min-w-0 rounded-xl border border-border/80 bg-card p-4 sm:p-5">
      <SectionHeading
        eyebrow="Historical path"
        title="Portfolio vs Nifty 50"
        detail={data.sampleDays ? `${data.sampleDays.toLocaleString("en-IN")} daily observations` : undefined}
      />
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-muted-foreground" aria-label="Chart legend">
        <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-0.5 w-4 rounded bg-cyan-400" />Portfolio</span>
        <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-0.5 w-4 rounded bg-amber-300" />Nifty 50</span>
      </div>
      {chartData.length > 1 ? (
        <div role="img" aria-label="Historical indexed value of the current portfolio mix compared with the Nifty 50, both rebased to 100">
          <ResponsiveContainer width="100%" height={238}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid stroke="hsl(217, 20%, 23%)" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(215, 13%, 62%)" }} tickLine={false} axisLine={false} minTickGap={32} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "hsl(215, 13%, 62%)" }} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "hsl(210, 25%, 92%)", marginBottom: 4 }}
                formatter={(value, name) => [
                  typeof value === "number" ? value.toFixed(2) : "Unavailable",
                  name === "portfolioIndex" ? "Portfolio index" : "Nifty 50 index",
                ]}
              />
              <ReferenceLine y={100} stroke="hsl(215, 13%, 42%)" strokeDasharray="3 4" />
              <Line type="monotone" dataKey="portfolioIndex" name="portfolioIndex" stroke="#42d3d2" strokeWidth={2.3} dot={false} activeDot={{ r: 4, fill: "#42d3d2", stroke: "hsl(222, 37%, 13%)", strokeWidth: 2 }} />
              {hasNifty && <Line type="monotone" dataKey="nifty50Index" name="nifty50Index" stroke="#e8b75b" strokeWidth={1.7} dot={false} connectNulls activeDot={{ r: 4, fill: "#e8b75b", stroke: "hsl(222, 37%, 13%)", strokeWidth: 2 }} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[238px] flex-col items-center justify-center rounded-md border border-dashed border-border/80 text-center">
          <TrendingUp aria-hidden="true" className="mb-2 h-5 w-5 text-muted-foreground/70" />
          <p className="text-xs font-medium text-muted-foreground">Historical path unavailable</p>
          <p className="mt-1 max-w-xs text-[10px] text-muted-foreground/70">At least two usable daily observations are needed to draw the series.</p>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
        <span>{dateLabel(data.periodStart)} – {dateLabel(data.periodEnd)}</span>
        <span>Both series rebased to 100</span>
      </div>
      {!hasNifty && chartData.length > 0 && (
        <p className="mt-2 text-[10px] text-amber-200/80">Nifty 50 daily history is not available for this period.</p>
      )}
    </section>
  );
}

function DrawdownChart({ data }: { data: PortfolioRiskResponse }) {
  const chartData = data.series.map((point) => ({ ...point, label: dateLabel(point.date) }));
  return (
    <section className="min-w-0 rounded-xl border border-border/80 bg-card p-4 sm:p-5">
      <SectionHeading eyebrow="Capital decline" title="Drawdown evolution" detail="From each prior portfolio peak" />
      {chartData.length > 1 ? (
        <div role="img" aria-label="Portfolio drawdown percentage over historical observations, measured from each prior peak">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 10, right: 4, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="portfolio-drawdown-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e97870" stopOpacity={0.05} />
                  <stop offset="100%" stopColor="#e97870" stopOpacity={0.35} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(217, 20%, 23%)" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(215, 13%, 62%)" }} tickLine={false} axisLine={false} minTickGap={30} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(215, 13%, 62%)" }} tickLine={false} axisLine={false} width={42} tickFormatter={(value: number) => `${value}%`} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value) => [typeof value === "number" ? `${value.toFixed(2)}%` : "Unavailable", "Drawdown"]}
              />
              <ReferenceLine y={0} stroke="hsl(215, 13%, 42%)" />
              <Area type="monotone" dataKey="drawdownPct" stroke="#e97870" strokeWidth={1.8} fill="url(#portfolio-drawdown-fill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[180px] items-center justify-center rounded-md border border-dashed border-border/80 text-xs text-muted-foreground">
          Drawdown history is unavailable
        </div>
      )}
      <div className="mt-2 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
        Peak-to-trough decline; not a forecast of future loss.
      </div>
    </section>
  );
}

function ExposureSection({ data }: { data: PortfolioRiskResponse }) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[0.82fr_1.55fr]">
      <section className="min-w-0 rounded-xl border border-border/80 bg-card p-4 sm:p-5">
        <SectionHeading eyebrow="Allocation" title="Sector exposure" detail={`${data.sectorExposure.length} sectors`} />
        {data.sectorExposure.length ? (
          <div className="space-y-3.5">
            {data.sectorExposure.map((sector, index) => (
              <div key={sector.sector}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
                  <span className="min-w-0 truncate font-medium">{sector.sector}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {number(sector.weightPct, 1)}% <span className="ml-1 text-foreground/80">{currency(sector.currentValue)}</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full ${index === 0 ? "bg-cyan-400" : index === 1 ? "bg-amber-300" : "bg-cyan-700/80"}`}
                    style={{ width: `${Math.min(100, Math.max(0, sector.weightPct))}%` }}
                    role="img"
                    aria-label={`${sector.sector}, ${number(sector.weightPct, 1)} percent of portfolio`}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-xs text-muted-foreground">Sector exposure is unavailable.</p>
        )}
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="px-4 pt-4 sm:px-5">
          <SectionHeading eyebrow="Constituents" title="Position-level risk" detail={`${data.positions.length} holdings`} />
        </div>
        {data.positions.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[690px] border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-y border-border/70 bg-secondary/30 text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">Holding</th>
                    <th className="px-3 py-2.5 text-right font-medium">Weight</th>
                    <th className="px-3 py-2.5 text-right font-medium">Value</th>
                    <th className="px-3 py-2.5 text-right font-medium">Ann. vol.</th>
                    <th className="px-3 py-2.5 text-right font-medium">Beta</th>
                    <th className="px-5 py-2.5 text-right font-medium">History</th>
                  </tr>
                </thead>
                <tbody>
                  {data.positions.map((position) => (
                    <tr key={position.symbol} className="border-b border-border/50 last:border-0 hover:bg-secondary/20">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-foreground">{position.symbol}</div>
                        <div className="mt-0.5 max-w-[220px] truncate text-[10px] text-muted-foreground">{position.name} · {position.sector}</div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{number(position.weightPct, 1)}%</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{currency(position.currentValue)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{position.annualizedVolatilityPct == null ? "Unavailable" : `${number(position.annualizedVolatilityPct, 1)}%`}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{number(position.betaToNifty, 2)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                        <span>{position.historyDays.toLocaleString("en-IN")} days</span>
                        {!position.quoteAvailable && <span className="ml-1.5 rounded bg-amber-300/10 px-1.5 py-0.5 text-[9px] text-amber-200">Quote unavailable</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-border/60 md:hidden">
              {data.positions.map((position) => (
                <article key={position.symbol} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{position.symbol}</p>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{position.name} · {position.sector}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold tabular-nums">{number(position.weightPct, 1)}%</p>
                      <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">{currency(position.currentValue)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                    <div><span className="block text-muted-foreground">Annual vol.</span><span className="mt-0.5 block tabular-nums">{position.annualizedVolatilityPct == null ? "Unavailable" : `${number(position.annualizedVolatilityPct, 1)}%`}</span></div>
                    <div><span className="block text-muted-foreground">Nifty beta</span><span className="mt-0.5 block tabular-nums">{number(position.betaToNifty)}</span></div>
                    <div><span className="block text-muted-foreground">History</span><span className="mt-0.5 block tabular-nums">{position.historyDays.toLocaleString("en-IN")} days</span></div>
                  </div>
                  {!position.quoteAvailable && <p className="mt-2 text-[9px] text-amber-200">Live quote unavailable; invested value used for exposure.</p>}
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="px-5 py-10 text-center text-xs text-muted-foreground">Position-level risk is unavailable.</p>
        )}
        <div className="border-t border-border/60 px-4 py-2.5 text-[10px] text-muted-foreground sm:px-5">
          Position volatility and beta are estimated individually when sufficient price history is available.
        </div>
      </section>
    </div>
  );
}

export default function PortfolioRiskDashboard({
  data,
  isLoading,
  error,
  onRetry,
}: {
  data: PortfolioRiskResponse | undefined;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <StatePanel
        kind="loading"
        title="Loading risk history"
        description="Preparing portfolio and benchmark history."
      />
    );
  }

  if (error) {
    return (
      <StatePanel
        kind="error"
        title="Risk history could not be loaded"
        description={error}
        onRetry={onRetry}
      />
    );
  }

  if (!data) {
    return (
      <StatePanel
        kind="error"
        title="Risk data is unavailable"
        description="No response was returned. Try loading the portfolio history again."
        onRetry={onRetry}
      />
    );
  }

  if (data.currentValue <= 0 || data.positions.length === 0) {
    return (
      <StatePanel
        kind="empty"
        title="No portfolio exposure to assess"
        description="Add holdings to your portfolio to see historical risk, benchmark-relative performance, and exposure details."
      />
    );
  }

  const insufficientHistory = data.sampleDays < 20;
  const metrics = data.metrics;

  return (
    <div className="space-y-4 text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <header className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="relative p-4 sm:p-5">
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-14 h-44 w-44 rounded-full border border-cyan-400/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-2 -top-8 h-32 w-32 rounded-full border border-cyan-400/[0.07]" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                <Shield aria-hidden="true" className="h-3.5 w-3.5" />
                Historical risk · India equities
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">Know the drawdown, not just the return.</h2>
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                A holdings-weighted view of historical price risk, measured against the Nifty 50.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-md border border-border/80 bg-background/30 px-2.5 py-1.5 text-[10px] text-muted-foreground">
              <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 text-cyan-300/80" />
              <span>Updated {dateLabel(data.asOf, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-y-4 sm:grid-cols-4 sm:gap-0">
            <Metric label="Portfolio value" value={currency(data.currentValue)} helper="Current holdings value" />
            <Metric label="Risk-covered value" value={currency(data.riskCoveredValue)} helper={`${number(data.riskCoveragePct, 1)}% of portfolio`} />
            <Metric label="Observations" value={data.sampleDays.toLocaleString("en-IN")} helper={data.periodStart && data.periodEnd ? `${dateLabel(data.periodStart)} – ${dateLabel(data.periodEnd)}` : "Daily history"} />
            <Metric label="Effective holdings" value={number(metrics.effectiveHoldings, 1)} helper="Concentration-adjusted count" />
          </div>
        </div>
      </header>

      {insufficientHistory && (
        <aside className="flex items-start gap-2.5 rounded-lg border border-amber-400/25 bg-amber-300/[0.055] px-3.5 py-3" role="status">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div>
            <p className="text-xs font-semibold text-amber-100">Insufficient history for reliable risk estimates</p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-100/70">
              {data.sampleDays} usable daily observations; at least 20 are required for most historical risk metrics. Unavailable metrics are shown as such, not estimated.
            </p>
          </div>
        </aside>
      )}

      <PartialNotice data={data} />

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3 sm:px-5">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">Downside lens</p>
            <h3 className="mt-0.5 text-sm font-semibold">Loss estimates & risk profile</h3>
          </div>
          <span className="rounded border border-rose-300/20 bg-rose-300/[0.06] px-2 py-1 text-[9px] font-medium text-rose-200/90">
            Historical · one trading day · 95%
          </span>
        </div>
        <div className="grid grid-cols-2 gap-y-4 p-4 sm:grid-cols-3 sm:gap-y-5 sm:px-5 lg:grid-cols-6">
          <Metric label="Historical VaR" value={metrics.historicalVaR95Pct == null ? "Unavailable" : `${number(metrics.historicalVaR95Pct, 2)}%`} helper="Loss threshold, 95% of observed days" tone="risk" />
          <Metric label="95% VaR (₹)" value={currency(metrics.historicalVaR95Value)} helper="On risk-covered value" tone="risk" />
          <Metric label="Expected shortfall" value={metrics.expectedShortfall95Pct == null ? "Unavailable" : `${number(metrics.expectedShortfall95Pct, 2)}%`} helper="Average loss beyond VaR" tone="risk" />
          <Metric label="Expected shortfall (₹)" value={currency(metrics.expectedShortfall95Value)} helper="Average tail-loss amount" tone="risk" />
          <Metric label="Annualized volatility" value={metrics.annualizedVolatilityPct == null ? "Unavailable" : `${number(metrics.annualizedVolatilityPct, 2)}%`} helper="Historical daily variation" tone="warm" />
          <Metric label="Maximum drawdown" value={metrics.maxDrawdownPct == null ? "Unavailable" : `${number(metrics.maxDrawdownPct, 2)}%`} helper="Largest peak-to-trough decline" tone="risk" />
        </div>
        <div className="grid grid-cols-2 gap-y-4 border-t border-border/60 px-4 py-3 sm:grid-cols-4 sm:gap-y-0 sm:px-5">
          <Metric label="Beta to Nifty" value={number(metrics.betaToNifty)} helper="Sensitivity to benchmark" />
          <Metric label="Correlation" value={number(metrics.correlationToNifty)} helper="Co-movement with benchmark" />
          <Metric
            label="Annualized return"
            value={metrics.annualizedReturnPct == null ? "Unavailable" : `${metrics.annualizedReturnPct >= 0 ? "+" : ""}${number(metrics.annualizedReturnPct, 2)}%`}
            helper="Historical, annualized"
            tone={metrics.annualizedReturnPct == null ? "default" : metrics.annualizedReturnPct >= 0 ? "good" : "risk"}
          />
          <Metric label="Sharpe ratio" value={number(metrics.sharpeRatioRfZero)} helper="Risk-free rate assumed zero" />
        </div>
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.55fr_1fr]">
        <RiskChart data={data} />
        <DrawdownChart data={data} />
      </div>

      <ExposureSection data={data} />

      <footer className="rounded-lg border border-border/70 bg-secondary/20 px-3.5 py-3">
        <div className="flex items-start gap-2.5">
          <CircleHelp aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-foreground/90">How to read these estimates</p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              Historical estimates apply today&apos;s holdings mix to available one-year daily price history, using adjusted closes where the data source provides them. They are not a forecast and do not represent actual transaction-level portfolio returns. One-day 95% VaR is the historical loss threshold; expected shortfall is the average loss in the worst 5% of sampled days. Coverage can vary when holdings lack matching prices.
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-2 text-[9px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ArrowDownRight aria-hidden="true" className="h-3 w-3 text-rose-300" />Risk measures describe historical downside</span>
          <span className="inline-flex items-center gap-1"><ArrowUpRight aria-hidden="true" className="h-3 w-3 text-cyan-300" />Benchmark: {data.benchmark}</span>
          <span>As of {dateLabel(data.asOf, { day: "2-digit", month: "short", year: "numeric" })}</span>
        </div>
      </footer>
    </div>
  );
}
