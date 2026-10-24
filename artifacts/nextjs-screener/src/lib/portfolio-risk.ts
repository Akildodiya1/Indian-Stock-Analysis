export interface HistoricalPrice {
  timestamp: number;
  close: number;
  adjustedClose?: number;
}

export interface PortfolioRiskPositionInput {
  symbol: string;
  name: string;
  currentValue: number;
  quoteAvailable: boolean;
  history: HistoricalPrice[];
}

export interface PortfolioRiskPosition {
  symbol: string;
  name: string;
  sector: string;
  currentValue: number;
  weightPct: number;
  quoteAvailable: boolean;
  historyDays: number;
  annualizedVolatilityPct: number | null;
  betaToNifty: number | null;
}

export interface PortfolioRiskPoint {
  date: string;
  portfolioIndex: number;
  nifty50Index: number | null;
  drawdownPct: number;
}

export interface PortfolioRiskMetrics {
  annualizedVolatilityPct: number | null;
  historicalVaR95Pct: number | null;
  historicalVaR95Value: number | null;
  expectedShortfall95Pct: number | null;
  expectedShortfall95Value: number | null;
  maxDrawdownPct: number | null;
  betaToNifty: number | null;
  correlationToNifty: number | null;
  annualizedReturnPct: number | null;
  sharpeRatioRfZero: number | null;
  effectiveHoldings: number | null;
}

export interface PortfolioRiskResponse {
  asOf: string;
  benchmark: "Nifty 50";
  currentValue: number;
  riskCoveredValue: number;
  riskCoveragePct: number;
  sampleDays: number;
  periodStart: string | null;
  periodEnd: string | null;
  metrics: PortfolioRiskMetrics;
  series: PortfolioRiskPoint[];
  positions: PortfolioRiskPosition[];
  sectorExposure: { sector: string; currentValue: number; weightPct: number }[];
  missingHistorySymbols: string[];
  warnings: string[];
}

interface DailySample {
  date: string;
  portfolioReturn: number;
  niftyReturn: number | null;
  coverageWeight: number;
}

const MIN_DAILY_SAMPLES = 20;
const MIN_PORTFOLIO_COVERAGE = 0.8;
const TRADING_DAYS_PER_YEAR = 252;

function toDailyReturns(history: HistoricalPrice[]): Map<string, number> {
  const ordered = [...history]
    .map((point) => ({
      timestamp: point.timestamp,
      close:
        point.adjustedClose != null &&
        Number.isFinite(point.adjustedClose) &&
        point.adjustedClose > 0
          ? point.adjustedClose
          : point.close,
    }))
    .filter((point) => Number.isFinite(point.close) && point.close > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  const returns = new Map<string, number>();

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const dailyReturn = current.close / previous.close - 1;
    if (!Number.isFinite(dailyReturn)) continue;
    const date = new Date(current.timestamp * 1000).toISOString().slice(0, 10);
    returns.set(date, dailyReturn);
  }
  return returns;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStandardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const average = mean(values);
  if (average == null) return null;
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function covariance(left: number[], right: number[]): number | null {
  if (left.length !== right.length || left.length < 2) return null;
  const leftMean = mean(left);
  const rightMean = mean(right);
  if (leftMean == null || rightMean == null) return null;
  return left.reduce(
    (sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean),
    0,
  ) / (left.length - 1);
}

function quantile(values: number[], probability: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * fraction;
}

function roundedPositiveLoss(loss: number | null): number | null {
  if (loss == null || !Number.isFinite(loss)) return null;
  return Math.max(0, -loss);
}

function nonNegativeFinite(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function buildPortfolioRisk(
  positions: PortfolioRiskPositionInput[],
  niftyHistory: HistoricalPrice[],
  sectorsBySymbol: Map<string, string>,
): PortfolioRiskResponse {
  const currentValue = positions.reduce(
    (sum, position) => sum + nonNegativeFinite(position.currentValue),
    0,
  );
  const emptyMetrics: PortfolioRiskMetrics = {
    annualizedVolatilityPct: null,
    historicalVaR95Pct: null,
    historicalVaR95Value: null,
    expectedShortfall95Pct: null,
    expectedShortfall95Value: null,
    maxDrawdownPct: null,
    betaToNifty: null,
    correlationToNifty: null,
    annualizedReturnPct: null,
    sharpeRatioRfZero: null,
    effectiveHoldings: null,
  };

  if (positions.length === 0 || currentValue <= 0) {
    return {
      asOf: new Date().toISOString(),
      benchmark: "Nifty 50",
      currentValue: 0,
      riskCoveredValue: 0,
      riskCoveragePct: 0,
      sampleDays: 0,
      periodStart: null,
      periodEnd: null,
      metrics: emptyMetrics,
      series: [],
      positions: [],
      sectorExposure: [],
      missingHistorySymbols: [],
      warnings: [],
    };
  }

  const weights = positions.map((position) => ({
    ...position,
    currentValue: nonNegativeFinite(position.currentValue),
    weight: nonNegativeFinite(position.currentValue) / currentValue,
    returns: toDailyReturns(position.history),
  }));
  const benchmarkReturns = toDailyReturns(niftyHistory);
  const allDates = new Set<string>(benchmarkReturns.keys());
  for (const position of weights) {
    for (const date of position.returns.keys()) allDates.add(date);
  }

  const samples: DailySample[] = [];
  for (const date of [...allDates].sort()) {
    const available = weights.filter((position) => position.returns.has(date));
    const coverageWeight = available.reduce((sum, position) => sum + position.weight, 0);
    if (coverageWeight < MIN_PORTFOLIO_COVERAGE) continue;
    const portfolioReturn = available.reduce(
      (sum, position) =>
        sum + (position.weight / coverageWeight) * (position.returns.get(date) ?? 0),
      0,
    );
    if (!Number.isFinite(portfolioReturn)) continue;
    samples.push({
      date,
      portfolioReturn,
      niftyReturn: benchmarkReturns.get(date) ?? null,
      coverageWeight,
    });
  }

  const portfolioReturns = samples.map((sample) => sample.portfolioReturn);
  const matchedBenchmarkSamples = samples.filter(
    (sample): sample is DailySample & { niftyReturn: number } =>
      sample.niftyReturn != null,
  );
  const matchedPortfolioReturns = matchedBenchmarkSamples.map(
    (sample) => sample.portfolioReturn,
  );
  const matchedNiftyReturns = matchedBenchmarkSamples.map(
    (sample) => sample.niftyReturn,
  );
  const matchedPortfolioStdDev =
    matchedPortfolioReturns.length >= MIN_DAILY_SAMPLES
      ? sampleStandardDeviation(matchedPortfolioReturns)
      : null;

  const dailyStdDev =
    portfolioReturns.length >= MIN_DAILY_SAMPLES
      ? sampleStandardDeviation(portfolioReturns)
      : null;
  const annualizedVolatility =
    dailyStdDev == null ? null : dailyStdDev * Math.sqrt(TRADING_DAYS_PER_YEAR);
  const tailCutoff =
    portfolioReturns.length >= MIN_DAILY_SAMPLES
      ? quantile(portfolioReturns, 0.05)
      : null;
  const tailReturns =
    tailCutoff == null
      ? []
      : portfolioReturns.filter((dailyReturn) => dailyReturn <= tailCutoff);
  const expectedTailReturn = mean(tailReturns);
  const historyCoverageWeight = weights.reduce(
    (sum, position) =>
      sum + (position.returns.size > 0 ? position.weight : 0),
    0,
  );
  const averageCoverage =
    samples.length > 0
      ? samples.reduce((sum, sample) => sum + sample.coverageWeight, 0) /
        samples.length
      : historyCoverageWeight;
  const riskCoveredValue = currentValue * averageCoverage;
  const benchmarkVariance =
    matchedNiftyReturns.length >= MIN_DAILY_SAMPLES
      ? covariance(matchedNiftyReturns, matchedNiftyReturns)
      : null;
  const portfolioBenchmarkCovariance =
    matchedPortfolioReturns.length >= MIN_DAILY_SAMPLES
      ? covariance(matchedPortfolioReturns, matchedNiftyReturns)
      : null;
  const portfolioBenchmarkCorrelation =
    portfolioBenchmarkCovariance != null &&
    benchmarkVariance != null &&
    matchedPortfolioStdDev != null &&
    benchmarkVariance > 0 &&
    matchedPortfolioStdDev > 0
      ? portfolioBenchmarkCovariance /
        (matchedPortfolioStdDev * Math.sqrt(benchmarkVariance))
      : null;
  const betaToNifty =
    portfolioBenchmarkCovariance != null &&
    benchmarkVariance != null &&
    benchmarkVariance > 0
      ? portfolioBenchmarkCovariance / benchmarkVariance
      : null;

  let portfolioIndex = 100;
  let peak = 100;
  let maxDrawdown = 0;
  for (const sample of samples) {
    portfolioIndex *= 1 + sample.portfolioReturn;
    peak = Math.max(peak, portfolioIndex);
    maxDrawdown = Math.min(maxDrawdown, (portfolioIndex / peak - 1) * 100);
  }

  const firstBenchmarkIndex = samples.findIndex(
    (sample) => sample.niftyReturn != null,
  );
  const chartSamples = samples.slice(
    firstBenchmarkIndex >= 0 ? firstBenchmarkIndex : 0,
  );
  let chartPortfolioIndex = 100;
  let niftyIndex = 100;
  let hasNiftyIndex = false;
  let chartPeak = 100;
  const series: PortfolioRiskPoint[] = chartSamples.map((sample) => {
    chartPortfolioIndex *= 1 + sample.portfolioReturn;
    if (sample.niftyReturn != null) {
      hasNiftyIndex = true;
      niftyIndex *= 1 + sample.niftyReturn;
    }
    chartPeak = Math.max(chartPeak, chartPortfolioIndex);
    const drawdownPct = (chartPortfolioIndex / chartPeak - 1) * 100;
    return {
      date: sample.date,
      portfolioIndex: chartPortfolioIndex,
      nifty50Index: hasNiftyIndex && sample.niftyReturn != null ? niftyIndex : null,
      drawdownPct,
    };
  });

  const averageDailyReturn = mean(portfolioReturns);
  const annualizedReturnPct =
    portfolioReturns.length >= MIN_DAILY_SAMPLES && portfolioIndex > 0
      ? (Math.pow(portfolioIndex / 100, TRADING_DAYS_PER_YEAR / portfolioReturns.length) -
          1) *
        100
      : null;
  const sharpeRatioRfZero =
    averageDailyReturn != null && dailyStdDev != null && dailyStdDev > 0
      ? (averageDailyReturn / dailyStdDev) * Math.sqrt(TRADING_DAYS_PER_YEAR)
      : null;
  const historicalVaR95Pct = roundedPositiveLoss(tailCutoff);
  const expectedShortfall95Pct = roundedPositiveLoss(expectedTailReturn);
  const effectiveHoldings =
    weights.reduce((sum, position) => sum + position.weight ** 2, 0) > 0
      ? 1 / weights.reduce((sum, position) => sum + position.weight ** 2, 0)
      : null;

  const sectorTotals = new Map<string, number>();
  for (const position of weights) {
    const sector = sectorsBySymbol.get(position.symbol.toUpperCase()) ?? "Unclassified";
    sectorTotals.set(sector, (sectorTotals.get(sector) ?? 0) + position.currentValue);
  }

  const riskPositions: PortfolioRiskPosition[] = weights
    .map((position) => {
      const ownReturns = [...position.returns.values()];
      const ownDailyStdDev =
        ownReturns.length >= MIN_DAILY_SAMPLES
          ? sampleStandardDeviation(ownReturns)
          : null;
      const paired = matchedDates(position.returns, benchmarkReturns);
      const ownBenchmarkCovariance =
        paired.positionReturns.length >= MIN_DAILY_SAMPLES
          ? covariance(paired.positionReturns, paired.benchmarkReturns)
          : null;
      const ownBenchmarkVariance =
        paired.benchmarkReturns.length >= MIN_DAILY_SAMPLES
          ? covariance(paired.benchmarkReturns, paired.benchmarkReturns)
          : null;
      return {
        symbol: position.symbol,
        name: position.name,
        sector: sectorsBySymbol.get(position.symbol.toUpperCase()) ?? "Unclassified",
        currentValue: position.currentValue,
        weightPct: position.weight * 100,
        quoteAvailable: position.quoteAvailable,
        historyDays: position.returns.size,
        annualizedVolatilityPct:
          ownDailyStdDev == null
            ? null
            : ownDailyStdDev * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100,
        betaToNifty:
          ownBenchmarkCovariance != null &&
          ownBenchmarkVariance != null &&
          ownBenchmarkVariance > 0
            ? ownBenchmarkCovariance / ownBenchmarkVariance
            : null,
      };
    })
    .sort((a, b) => b.weightPct - a.weightPct);

  const warnings: string[] = [];
  const missingHistorySymbols = riskPositions
    .filter((position) => position.historyDays === 0)
    .map((position) => position.symbol);
  if (missingHistorySymbols.length > 0) {
    warnings.push(
      `No usable one-year price history for ${missingHistorySymbols.length} holding${missingHistorySymbols.length === 1 ? "" : "s"}; excluded from risk calculations.`,
    );
  }
  if (averageCoverage < 0.999) {
    warnings.push(
      `Usable price history covers about ${Math.round(averageCoverage * 100)}% of current portfolio value. Positions without matching daily prices are excluded.`,
    );
  }
  if (riskPositions.some((position) => !position.quoteAvailable)) {
    warnings.push(
      "A live quote was unavailable for some holdings; invested value was used as the exposure weight for those positions.",
    );
  }
  if (matchedBenchmarkSamples.length < MIN_DAILY_SAMPLES) {
    warnings.push(
      "Nifty 50 comparison needs at least 20 matched daily observations; beta and correlation are unavailable until then.",
    );
  }
  if (samples.length > 0 && samples.length < 60) {
    warnings.push(
      `Only ${samples.length} usable daily observations are available; risk estimates may be less stable than a full-year sample.`,
    );
  }
  if (niftyHistory.length === 0) {
    warnings.push("Nifty 50 history is unavailable; benchmark-relative metrics are omitted.");
  }

  return {
    asOf: new Date().toISOString(),
    benchmark: "Nifty 50",
    currentValue,
    riskCoveredValue,
    riskCoveragePct: averageCoverage * 100,
    sampleDays: samples.length,
    periodStart: series[0]?.date ?? null,
    periodEnd: series.at(-1)?.date ?? null,
    metrics: {
      annualizedVolatilityPct:
        annualizedVolatility == null ? null : annualizedVolatility * 100,
      historicalVaR95Pct,
      historicalVaR95Value:
        historicalVaR95Pct == null
          ? null
          : historicalVaR95Pct * riskCoveredValue,
      expectedShortfall95Pct,
      expectedShortfall95Value:
        expectedShortfall95Pct == null
          ? null
          : expectedShortfall95Pct * riskCoveredValue,
      maxDrawdownPct: samples.length >= 2 ? maxDrawdown : null,
      betaToNifty:
        matchedBenchmarkSamples.length >= MIN_DAILY_SAMPLES ? betaToNifty : null,
      correlationToNifty:
        matchedBenchmarkSamples.length >= MIN_DAILY_SAMPLES
          ? portfolioBenchmarkCorrelation
          : null,
      annualizedReturnPct,
      sharpeRatioRfZero:
        samples.length >= MIN_DAILY_SAMPLES ? sharpeRatioRfZero : null,
      effectiveHoldings,
    },
    series,
    positions: riskPositions,
    sectorExposure: [...sectorTotals.entries()]
      .map(([sector, value]) => ({
        sector,
        currentValue: value,
        weightPct: (value / currentValue) * 100,
      }))
      .sort((a, b) => b.currentValue - a.currentValue),
    missingHistorySymbols,
    warnings,
  };
}

function matchedDates(
  positionReturns: Map<string, number>,
  benchmarkReturns: Map<string, number>,
): { positionReturns: number[]; benchmarkReturns: number[] } {
  const dates = [...positionReturns.keys()]
    .filter((date) => benchmarkReturns.has(date))
    .sort();
  return {
    positionReturns: dates.map((date) => positionReturns.get(date) ?? 0),
    benchmarkReturns: dates.map((date) => benchmarkReturns.get(date) ?? 0),
  };
}
