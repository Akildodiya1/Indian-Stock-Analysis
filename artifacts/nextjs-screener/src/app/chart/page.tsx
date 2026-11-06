"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignJustify,
  Activity,
  Download,
  Eye,
  EyeOff,
  GitBranch,
  Grid3X3,
  Hash,
  Lock,
  Maximize2,
  MessageSquare,
  MousePointer2,
  Search,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  TrendingUp,
  Unlock,
  X,
  Waves,
} from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import {
  calculateIndicator,
  calculateIndicatorComponents,
  findChartPatterns,
  findSupportResistance,
  findWeeklyBases,
  INDICATORS,
  scanCandlestickPatterns,
  simpleMovingAverage,
  type CandlePattern,
  type IndicatorId,
  type PriceLevel,
  type WeeklyBase,
} from "@/lib/chart-analysis";

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type Period = "D" | "W" | "M" | "3M" | "6M" | "1Y";
type ChartStyle = "Candles" | "Line" | "Area" | "Bars" | "Baseline";
type DrawPoint = { index: number; price: number };
type Drawing = { id: string; tool: string; points: DrawPoint[]; text?: string };
type MagicTab = "Signals" | "Patterns" | "Candles" | "Levels" | "Base";
type AxisType = "Linear" | "Logarithmic";

const DRAWING_GROUPS = [
  { name: "Lines", icon: TrendingUp, tools: ["Trend Line", "Ray", "Extended Line", "H. Straight Line", "V. Straight Line", "H. Ray Line", "V. Ray Line", "H. Segment", "V. Segment", "Arrow"] },
  { name: "Channels", icon: AlignJustify, tools: ["Price Channel", "Parallel Lines", "Price Line", "Brush"] },
  { name: "Fibonacci", icon: GitBranch, tools: ["Fib Retracement", "Fib Segment", "Fib Extension", "Fib Circles", "Fib Spiral", "Speed Resistance Fan"] },
  { name: "Shapes", icon: Square, tools: ["Circle", "Rectangle", "Triangle", "Parallelogram"] },
  { name: "Waves", icon: Waves, tools: ["3-Wave", "5-Wave", "8-Wave", "Any Wave"] },
  { name: "Harmonic", icon: Hash, tools: ["ABCD", "XABCD"] },
  { name: "Gann", icon: Grid3X3, tools: ["Gann Box"] },
  { name: "Annotations", icon: MessageSquare, tools: ["Annotation", "Price Tag", "Measure"] },
] as const;

const mean = (values: number[]) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;

const PERIOD_QUERY: Record<Period, { range: string; interval: string }> = {
  D: { range: "1y", interval: "1d" },
  W: { range: "5y", interval: "1wk" },
  M: { range: "10y", interval: "1mo" },
  "3M": { range: "3mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
};

const WIDTH = 1100;
const HEIGHT = 600;
const LEFT = 24;
const RIGHT = 84;
const TOP = 24;
const PRICE_BOTTOM = 440;
const VOLUME_TOP = 456;
const VOLUME_BOTTOM = 570;

function getSma(data: Candle[], period: number): (number | null)[] {
  return data.map((_, index) => {
    if (index + 1 < period) return null;
    const window = data.slice(index + 1 - period, index + 1);
    return window.reduce((sum, item) => sum + item.close, 0) / period;
  });
}

function getVolumeSma(data: Candle[], period: number): (number | null)[] {
  return data.map((_, index) => {
    if (index + 1 < period) return null;
    const window = data.slice(index + 1 - period, index + 1);
    return window.reduce((sum, item) => sum + item.volume, 0) / period;
  });
}

function formatPrice(value: number): string {
  return `₹${value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function formatVolume(value: number): string {
  if (value >= 10_000_000) return `${(value / 10_000_000).toFixed(1)}Cr`;
  if (value >= 100_000) return `${(value / 100_000).toFixed(1)}L`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toString();
}

function formatDate(timestamp: number, interval: string): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-IN", {
    day: interval === "1mo" ? undefined : "2-digit",
    month: "short",
    year: interval === "1mo" || interval === "1wk" ? "2-digit" : undefined,
  });
}

export default function ChartPage() {
  const [symbolInput, setSymbolInput] = useState("RELIANCE");
  const [exchange, setExchange] = useState<"NSE" | "BSE">("NSE");
  const [period, setPeriod] = useState<Period>("D");
  const [chartStyle, setChartStyle] = useState<ChartStyle>("Candles");
  const [candleStyle, setCandleStyle] = useState<"Solid" | "Hollow">("Solid");
  const [indicators, setIndicators] = useState<IndicatorId[]>(["ma", "vol"]);
  const [showIndicators, setShowIndicators] = useState(false);
  const [indicatorSearch, setIndicatorSearch] = useState("");
  const [indicatorGroup, setIndicatorGroup] = useState<"All" | "Main" | "Sub">("All");
  const [showSettings, setShowSettings] = useState(false);
  const [showLatestPrice, setShowLatestPrice] = useState(true);
  const [showHighLow, setShowHighLow] = useState(true);
  const [showLatestIndicator, setShowLatestIndicator] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [axisType, setAxisType] = useState<AxisType>("Linear");
  const [invertAxis, setInvertAxis] = useState(false);
  const [symbol, setSymbol] = useState("RELIANCE.NS");
  const [data, setData] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadSequence, setReloadSequence] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [horizontalLevels, setHorizontalLevels] = useState<number[]>([]);
  const [drawingLevel, setDrawingLevel] = useState(false);
  const [drawingTool, setDrawingTool] = useState<string | null>(null);
  const [openDrawingMenu, setOpenDrawingMenu] = useState<string | null>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [pendingDrawingPoints, setPendingDrawingPoints] = useState<DrawPoint[]>([]);
  const [drawingsLocked, setDrawingsLocked] = useState(false);
  const [drawingsHidden, setDrawingsHidden] = useState(false);
  const [overlaySymbol, setOverlaySymbol] = useState<string | null>(null);
  const [magicOpen, setMagicOpen] = useState(false);
  const [magicTab, setMagicTab] = useState<MagicTab>("Patterns");
  const [magicResult, setMagicResult] = useState(false);
  const [selectedHighlight, setSelectedHighlight] = useState<{ start: number; end: number } | null>(null);
  const [signalStart, setSignalStart] = useState<DrawPoint | null>(null);
  const [signalEnd, setSignalEnd] = useState<DrawPoint | null>(null);
  const [signalDrawing, setSignalDrawing] = useState(false);
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number } | null>(null);
  const [baseFiltersOpen, setBaseFiltersOpen] = useState(false);
  const [showBaseOverlay, setShowBaseOverlay] = useState(true);
  const [breakoutBasesOnly, setBreakoutBasesOnly] = useState(true);
  const [baseMinWeeks, setBaseMinWeeks] = useState(4);
  const [baseMaxWeeks, setBaseMaxWeeks] = useState(26);
  const [baseMaxDepth, setBaseMaxDepth] = useState(15);
  const [minimumBaseQuality, setMinimumBaseQuality] = useState<"High" | "Medium" | "Low">("High");
  const [breakoutBuffer, setBreakoutBuffer] = useState(0.5);
  const [minimumBreakoutVolume, setMinimumBreakoutVolume] = useState(0);
  const [includeFailedBases, setIncludeFailedBases] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const querySymbol = params.get("symbol");
    const queryExchange = params.get("exchange")?.toUpperCase();
    const nextExchange = queryExchange === "BSE" ? "BSE" : "NSE";
    if (!querySymbol) return;
    const ticker = querySymbol.toUpperCase().replace(/\.(NS|BO)$/i, "");
    setSymbolInput(ticker);
    setExchange(nextExchange);
    setSymbol(
      /\.(NS|BO)$/i.test(querySymbol)
        ? querySymbol.toUpperCase()
        : `${ticker}.${nextExchange === "NSE" ? "NS" : "BO"}`,
    );
  }, []);

  useEffect(() => {
    const onFullscreenChange = () =>
      setFullscreen(document.fullscreenElement === chartRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`fintrack-chart-drawings:${symbol}`);
      setDrawings(saved ? (JSON.parse(saved) as Drawing[]) : []);
      const savedLevels = localStorage.getItem(`fintrack-chart-levels:${symbol}`);
      setHorizontalLevels(savedLevels ? (JSON.parse(savedLevels) as number[]) : []);
    } catch (cause) {
      console.warn("Unable to load saved chart overlays.", cause);
      setDrawings([]);
      setHorizontalLevels([]);
    }
    setOverlaySymbol(symbol);
    setPendingDrawingPoints([]);
    setSignalStart(null);
    setSignalEnd(null);
  }, [symbol]);

  useEffect(() => {
    if (overlaySymbol !== symbol) return;
    try {
      localStorage.setItem(`fintrack-chart-drawings:${symbol}`, JSON.stringify(drawings));
      localStorage.setItem(`fintrack-chart-levels:${symbol}`, JSON.stringify(horizontalLevels));
    } catch (cause) {
      console.warn("Unable to save chart overlays.", cause);
    }
  }, [drawings, horizontalLevels, overlaySymbol, symbol]);

  useEffect(() => {
    const controller = new AbortController();
    const query = PERIOD_QUERY[period];
    setLoading(true);
    setError(null);
    setHoverIndex(null);
    fetch(
      apiUrl(
        `/stocks/history/${encodeURIComponent(symbol)}?period=${query.range}&interval=${query.interval}`,
      ),
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`Chart data unavailable (HTTP ${response.status})`);
        return (await response.json()) as Candle[];
      })
      .then((candles) => {
        if (candles.length === 0)
          throw new Error("No price history is available for this symbol.");
        setData(candles);
        const visibleBars = 100;
        setVisibleRange(
          candles.length > visibleBars
            ? { start: candles.length - visibleBars, end: candles.length - 1 }
            : null,
        );
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        setError(
          cause instanceof Error ? cause.message : "Unable to load chart data.",
        );
        setData([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [symbol, period, reloadSequence]);

  const indicatorSeries = useMemo(
    () => new Map(indicators.map((indicator) => [indicator, calculateIndicator(data, indicator)])),
    [data, indicators],
  );
  const indicatorComponents = useMemo(
    () => new Map(indicators.map((indicator) => [indicator, calculateIndicatorComponents(data, indicator)])),
    [data, indicators],
  );

  const activeCandle =
    hoverIndex == null ? data[data.length - 1] : data[hoverIndex];
  const query = PERIOD_QUERY[period];
  const hasVolume = indicators.includes("vol");
  const priceBottom = hasVolume ? PRICE_BOTTOM : VOLUME_BOTTOM + 24;
  const highs = data.map((candle) => candle.high);
  const lows = data.map((candle) => candle.low);
  const visibleStart = Math.max(0, Math.min(visibleRange?.start ?? 0, Math.max(0, data.length - 1)));
  const visibleEnd = Math.max(visibleStart, Math.min(visibleRange?.end ?? data.length - 1, data.length - 1));
  const visibleCount = Math.max(1, visibleEnd - visibleStart + 1);
  const priceMin = Math.min(...lows.slice(visibleStart, visibleEnd + 1));
  const priceMax = Math.max(...highs.slice(visibleStart, visibleEnd + 1));
  const pricePad = (priceMax - priceMin) * 0.06 || priceMax * 0.01 || 1;
  const minPrice = priceMin - pricePad;
  const maxPrice = priceMax + pricePad;
  const plotWidth = WIDTH - LEFT - RIGHT;
  const step = plotWidth / visibleCount;
  const xAt = (index: number) => LEFT + step * (index - visibleStart + 0.5);
  const axisTransform = (value: number) =>
    axisType === "Logarithmic" ? Math.log(Math.max(value, Number.MIN_VALUE)) : value;
  const axisMin = axisTransform(minPrice);
  const axisMax = axisTransform(maxPrice);
  const yPrice = (value: number) => {
    const ratio = (axisTransform(value) - axisMin) / (axisMax - axisMin || 1);
    return TOP + (invertAxis ? ratio : 1 - ratio) * (priceBottom - TOP);
  };
  const yToPrice = (y: number) => {
    const ratio = (y - TOP) / (priceBottom - TOP);
    const value = axisMin + (invertAxis ? ratio : 1 - ratio) * (axisMax - axisMin);
    return axisType === "Logarithmic" ? Math.exp(value) : value;
  };
  const maxVolume = Math.max(...data.slice(visibleStart, visibleEnd + 1).map((candle) => candle.volume), 1);
  const yVolume = (value: number) =>
    VOLUME_BOTTOM - (value / maxVolume) * (VOLUME_BOTTOM - VOLUME_TOP);
  const volumeAverageLines = [5, 10, 20].map((periodValue, seriesIndex) => {
    const values = getVolumeSma(data, periodValue);
    const path = values
      .slice(visibleStart, visibleEnd + 1)
      .map((value, localIndex) =>
        value == null
          ? ""
          : `${localIndex === 0 || values[visibleStart + localIndex - 1] == null ? "M" : "L"}${xAt(visibleStart + localIndex)},${yVolume(value)}`,
      )
      .filter(Boolean)
      .join(" ");
    return {
      period: periodValue,
      color: ["#f59e0b", "#a855f7", "#3b82f6"][seriesIndex],
      path,
    };
  });
  const pathFor = (values: (number | null)[]) =>
    values.slice(visibleStart, visibleEnd + 1)
      .map((value, localIndex, visibleValues) => {
        const index = visibleStart + localIndex;
        return (
        value == null
          ? ""
          : `${localIndex === 0 || visibleValues[localIndex - 1] == null ? "M" : "L"}${xAt(index)},${yPrice(value)}`
        );
      })
      .filter(Boolean)
      .join(" ");
  const lowerIndicators = indicators.filter(
    (indicator) =>
      indicator !== "vol" &&
      INDICATORS.find((item) => item.id === indicator)?.group === "Sub",
  );
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (data.length < 2 || step === 0) return;
      const bounds = svg.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
      const centerIndex = Math.max(
        visibleStart,
        Math.min(visibleEnd, visibleStart + Math.floor((x - LEFT) / step)),
      );
      const nextCount = Math.max(
        20,
        Math.min(data.length, Math.round(visibleCount * (event.deltaY < 0 ? 0.75 : 1.33))),
      );
      const ratio = (centerIndex - visibleStart) / visibleCount;
      const start = Math.max(
        0,
        Math.min(data.length - nextCount, Math.round(centerIndex - nextCount * ratio)),
      );
      setVisibleRange(nextCount >= data.length ? null : { start, end: start + nextCount - 1 });
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [data.length, step, visibleCount, visibleEnd, visibleStart]);
  const mainIndicatorLines: { key: string; color: string; values: (number | null)[] }[] = [];
  for (const indicator of indicators) {
    const definition = INDICATORS.find((item) => item.id === indicator);
    if (!definition || definition.group !== "Main") continue;
    if (indicator === "ma") {
      for (const [periodValue, color] of [[5, "#f59e0b"], [10, "#a855f7"], [30, "#3b82f6"], [60, "#ec4899"]] as const) {
        mainIndicatorLines.push({ key: `MA ${periodValue}`, color, values: getSma(data, periodValue) });
      }
    } else if (indicator === "boll") {
      const middle = simpleMovingAverage(data.map((bar) => bar.close), 20);
      const upper = middle.map((value, index) => {
        if (value == null) return null;
        const sample = data.slice(index - 19, index + 1).map((bar) => bar.close);
        const deviation = Math.sqrt(sample.reduce((sum, item) => sum + (item - value) ** 2, 0) / sample.length);
        return value + 2 * deviation;
      });
      const lower = middle.map((value, index) => {
        if (value == null) return null;
        const sample = data.slice(index - 19, index + 1).map((bar) => bar.close);
        const deviation = Math.sqrt(sample.reduce((sum, item) => sum + (item - value) ** 2, 0) / sample.length);
        return value - 2 * deviation;
      });
      mainIndicatorLines.push({ key: "BOLL upper", color: "#a78bfa", values: upper });
      mainIndicatorLines.push({ key: "BOLL middle", color: "#818cf8", values: middle });
      mainIndicatorLines.push({ key: "BOLL lower", color: "#a78bfa", values: lower });
    } else {
      mainIndicatorLines.push({
        key: definition.label.split(" ")[0],
        color: indicator === "ema" ? "#f97316" : indicator === "sar" ? "#22d3ee" : "#f59e0b",
        values: indicatorSeries.get(indicator) ?? [],
      });
    }
  }
  const candlePatterns = useMemo(() => scanCandlestickPatterns(data), [data]);
  const chartPatterns = useMemo(() => findChartPatterns(data), [data]);
  const supportResistance = useMemo(() => findSupportResistance(data), [data]);
  const weeklyBases = useMemo(
    () => period === "M" ? [] : findWeeklyBases(data, breakoutBuffer),
    [data, period, breakoutBuffer],
  );
  const patternForDisplay = chartPatterns.filter((pattern) => pattern.endIndex >= Math.max(0, data.length - 250));
  const signalMovePct = signalStart && signalEnd && data[signalStart.index]
    ? ((signalEnd.price - signalStart.price) / signalStart.price) * 100
    : null;
  const signalBars = signalStart && signalEnd ? Math.abs(signalEnd.index - signalStart.index) + 1 : 0;
  const signalVolumeMultiple = signalStart && signalEnd && signalBars > 0
    ? mean(data.slice(Math.min(signalStart.index, signalEnd.index), Math.max(signalStart.index, signalEnd.index) + 1).map((bar) => bar.volume)) /
      Math.max(mean(data.slice(Math.max(0, Math.min(signalStart.index, signalEnd.index) - 20), Math.min(signalStart.index, signalEnd.index)).map((bar) => bar.volume)), 1)
    : null;
  const qualityRank = { Low: 0, Medium: 1, High: 2 };
  const visibleWeeklyBases = weeklyBases.filter((base) =>
    base.weeks >= baseMinWeeks &&
    base.weeks <= baseMaxWeeks &&
    base.depthPct <= baseMaxDepth &&
    qualityRank[base.quality] >= qualityRank[minimumBaseQuality] &&
    base.breakoutVolumeMultiple >= minimumBreakoutVolume &&
    (includeFailedBases || base.breakout !== "Failed breakout") &&
    (!breakoutBasesOnly || base.breakout === "Confirmed breakout"),
  );

  function applySymbol() {
    const ticker = symbolInput
      .trim()
      .toUpperCase()
      .replace(/\.(NS|BO)$/i, "");
    if (!ticker) return;
    setSymbolInput(ticker);
    setSymbol(`${ticker}.${exchange === "NSE" ? "NS" : "BO"}`);
    window.history.replaceState(
      null,
      "",
      `/chart?symbol=${encodeURIComponent(ticker)}&exchange=${exchange}`,
    );
  }

  function toggleIndicator(indicator: IndicatorId) {
    setIndicators((current) =>
      current.includes(indicator)
        ? current.filter((value) => value !== indicator)
        : [...current, indicator],
    );
  }

  function selectDrawingTool(tool: string) {
    setDrawingTool(tool);
    setPendingDrawingPoints([]);
    setDrawingLevel(false);
    setOpenDrawingMenu(null);
    setMagicOpen(false);
  }

  function onChartPointer(event: React.PointerEvent<SVGSVGElement>) {
    if (data.length === 0 || step === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    const index = visibleStart + Math.floor((x - LEFT) / step);
    setHoverIndex(Math.max(visibleStart, Math.min(visibleEnd, index)));
  }

  function onChartClick(event: React.MouseEvent<SVGSVGElement>) {
    if (data.length === 0 || step === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    const y = ((event.clientY - bounds.top) / bounds.height) * HEIGHT;
    const point = {
      index: Math.max(visibleStart, Math.min(visibleEnd, visibleStart + Math.floor((x - LEFT) / step))),
      price: yToPrice(y),
    };
    if (x < LEFT || x > WIDTH - RIGHT || y < TOP || y > priceBottom) return;
    if (signalDrawing) {
      if (!signalStart) setSignalStart(point);
      else {
        setSignalEnd(point);
        setSignalDrawing(false);
      }
      return;
    }
    if (drawingsLocked) return;
    if (drawingTool && !drawingsLocked) {
      const singleClickTools = ["H. Straight Line", "V. Straight Line", "H. Ray Line", "V. Ray Line", "Price Line", "Price Tag", "Annotation"];
      if (singleClickTools.includes(drawingTool)) {
        const text = drawingTool === "Annotation"
          ? window.prompt("Annotation text", "Note") ?? undefined
          : drawingTool === "Price Tag"
            ? formatPrice(point.price)
            : undefined;
        if (drawingTool !== "Annotation" || text) {
          setDrawings((items) => [...items, { id: crypto.randomUUID(), tool: drawingTool, points: [point], text }]);
        }
        setDrawingTool(null);
        return;
      }
      const requiredPoints =
        drawingTool === "3-Wave" ? 3 :
        drawingTool === "5-Wave" || drawingTool === "Any Wave" ? 5 :
        drawingTool === "8-Wave" ? 8 :
        drawingTool === "ABCD" ? 4 :
        drawingTool === "XABCD" ? 5 :
        drawingTool === "Triangle" ||
        drawingTool === "Parallelogram" ||
        drawingTool === "Price Channel" ||
        drawingTool === "Parallel Lines" ? 3 :
        drawingTool === "Fib Extension" ? 3 : 2;
      const nextPoints = [...pendingDrawingPoints, point];
      if (nextPoints.length < requiredPoints) {
        setPendingDrawingPoints(nextPoints);
        return;
      }
      const start = nextPoints[0];
      const text = drawingTool === "Measure"
        ? `${point.price >= start.price ? "+" : ""}${(((point.price - start.price) / start.price) * 100).toFixed(2)}% · ${Math.abs(point.index - start.index)} bars`
        : undefined;
      setDrawings((items) => [...items, { id: crypto.randomUUID(), tool: drawingTool, points: nextPoints, text }]);
      setPendingDrawingPoints([]);
      setDrawingTool(null);
      return;
    }
    if (!drawingLevel) return;
    const value = point.price;
    if (value >= minPrice && value <= maxPrice) {
      setHorizontalLevels((levels) => [...levels, value]);
    }
    setDrawingLevel(false);
  }

  function zoomChart(direction: "in" | "out", centerIndex = visibleEnd) {
    if (data.length < 2) return;
    const currentCount = visibleCount;
    const nextCount = Math.max(20, Math.min(data.length, Math.round(currentCount * (direction === "in" ? 0.75 : 1.33))));
    const ratio = (centerIndex - visibleStart) / currentCount;
    const start = Math.max(0, Math.min(data.length - nextCount, Math.round(centerIndex - nextCount * ratio)));
    setVisibleRange(nextCount >= data.length ? null : { start, end: start + nextCount - 1 });
  }

  function scanMagicTab() {
    setMagicResult(true);
    setSelectedHighlight(null);
    if (magicTab === "Signals") {
      setSignalStart(null);
      setSignalEnd(null);
      setSignalDrawing(true);
    }
  }

  async function toggleFullscreen() {
    if (!chartRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await chartRef.current.requestFullscreen();
    }
  }

  function downloadChart() {
    if (!svgRef.current) return;
    setDownloadError(null);
    const chartComputedStyle = getComputedStyle(chartRef.current ?? document.body);
    const svg = new XMLSerializer()
      .serializeToString(svgRef.current)
      .replaceAll("currentColor", chartComputedStyle.color)
      .replaceAll("var(--card)", chartComputedStyle.backgroundColor);
    const sourceUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = WIDTH * 2;
        canvas.height = HEIGHT * 2;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Unable to create an image canvas.");
        context.scale(2, 2);
        context.fillStyle = chartComputedStyle.backgroundColor;
        context.fillRect(0, 0, WIDTH, HEIGHT);
        context.drawImage(image, 0, 0, WIDTH, HEIGHT);
        canvas.toBlob((blob) => {
          if (!blob) {
            setDownloadError("Unable to encode the chart screenshot.");
            return;
          }
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `${symbol.replace(".", "-")}-chart.png`;
          anchor.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, "image/png");
      } catch (cause) {
        console.error("Unable to download chart screenshot.", cause);
        setDownloadError("Unable to download the chart screenshot.");
      } finally {
        URL.revokeObjectURL(sourceUrl);
      }
    };
    image.onerror = (cause) => {
      console.error("Unable to render chart screenshot.", cause);
      setDownloadError("Unable to render the chart screenshot.");
      URL.revokeObjectURL(sourceUrl);
    };
    image.src = sourceUrl;
  }

  const change =
    data.length > 1
      ? ((data[data.length - 1].close - data[0].close) / data[0].close) * 100
      : 0;

  return (
    <div className="h-full w-full">
      <section
        ref={chartRef}
        className={`relative flex h-full min-h-0 flex-col overflow-hidden border border-[#292a2d] bg-[#0f0f10] text-[#f6f7f9] ${fullscreen ? "rounded-none" : ""}`}
        aria-label={`${symbolInput} stock chart`}
      >
        <div className="flex h-11 shrink-0 items-center gap-1.5 overflow-x-auto border-b border-[#303135] px-3">
          <form
            className="flex h-8 shrink-0 items-center gap-1 rounded border border-[#34363a] bg-[#17181a] px-2"
            onSubmit={(event) => {
              event.preventDefault();
              applySymbol();
            }}
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              aria-label="Stock symbol"
              value={symbolInput}
              onChange={(event) => setSymbolInput(event.target.value)}
              className="w-24 bg-transparent py-1 text-sm font-semibold outline-none"
            />
            <select
              aria-label="Exchange"
              value={exchange}
              onChange={(event) =>
                setExchange(event.target.value as "NSE" | "BSE")
              }
              className="bg-transparent text-xs text-[#b8bbc2] outline-none"
            >
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
            </select>
            <button
              type="submit"
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Load symbol"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          </form>
          <div
            className="flex shrink-0 items-center border-l border-[#34363a] pl-2"
            role="group"
            aria-label="Chart period"
          >
            {(["D", "W", "M", "3M", "6M", "1Y"] as Period[]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={period === value}
                onClick={() => setPeriod(value)}
                className={`rounded px-2.5 py-1.5 text-xs font-medium ${
                  period === value
                    ? "bg-[#292b30] text-[#66a3ff]"
                    : "text-[#a6acb5] hover:bg-[#24262a] hover:text-white"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <select
            aria-label="Chart type"
            value={chartStyle}
            onChange={(event) => setChartStyle(event.target.value as ChartStyle)}
            className="h-8 shrink-0 rounded border border-[#34363a] bg-[#17181a] px-2 text-xs"
          >
            {(["Candles", "Bars", "Line", "Area", "Baseline"] as ChartStyle[]).map((style) => (
              <option key={style} value={style}>{style}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowIndicators(true)}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded border border-[#34363a] px-2.5 text-xs text-[#c2c5cb] hover:bg-[#24262a]"
          >
            <Activity className="h-3.5 w-3.5" /> Indicator ({indicators.length})
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded border border-[#34363a] px-2.5 text-xs text-[#c2c5cb] hover:bg-[#24262a]"
          >
            <Settings2 className="h-3.5 w-3.5" /> Settings
          </button>
          {showIndicators && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={(event) => {
              if (event.target === event.currentTarget) setShowIndicators(false);
            }}>
              <section role="dialog" aria-modal="true" aria-labelledby="indicator-dialog-title" className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border bg-card shadow-2xl">
                <header className="flex items-start justify-between border-b p-4">
                  <div>
                    <h2 id="indicator-dialog-title" className="font-semibold">Indicators</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Select indicators computed from the chart’s OHLCV history.</p>
                  </div>
                  <button type="button" aria-label="Close indicators" onClick={() => setShowIndicators(false)}><X className="h-4 w-4" /></button>
                </header>
                <div className="flex flex-wrap items-center gap-2 border-b p-3">
                  <label className="flex min-w-56 flex-1 items-center gap-2 rounded-md border px-2.5">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                    <input aria-label="Search indicators" value={indicatorSearch} onChange={(event) => setIndicatorSearch(event.target.value)} placeholder="Search indicators" className="w-full bg-transparent py-2 text-sm outline-none" />
                  </label>
                  {(["All", "Main", "Sub"] as const).map((group) => (
                    <button key={group} type="button" aria-pressed={indicatorGroup === group} onClick={() => setIndicatorGroup(group)} className={`rounded-md px-3 py-2 text-xs ${indicatorGroup === group ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{group}</button>
                  ))}
                </div>
                <div className="grid gap-4 overflow-y-auto p-4 sm:grid-cols-2">
                  {(["Main", "Sub"] as const).map((group) => {
                    const options = INDICATORS.filter((indicator) =>
                      indicator.group === group &&
                      (indicatorGroup === "All" || indicatorGroup === group) &&
                      indicator.label.toLowerCase().includes(indicatorSearch.toLowerCase()),
                    );
                    if (options.length === 0) return null;
                    return (
                      <fieldset key={group} className="space-y-1">
                        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group === "Main" ? "Main indicator" : "Sub indicator"}</legend>
                        {options.map((indicator) => (
                          <label key={indicator.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent">
                            <input type="checkbox" checked={indicators.includes(indicator.id)} onChange={() => toggleIndicator(indicator.id)} />
                            <span>{indicator.label}</span>
                          </label>
                        ))}
                      </fieldset>
                    );
                  })}
                </div>
                <footer className="flex justify-between border-t p-3">
                  <button type="button" onClick={() => setIndicators([])} className="text-xs text-muted-foreground hover:text-foreground">Clear indicators</button>
                  <button type="button" onClick={() => setShowIndicators(false)} className="rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground">Done</button>
                </footer>
              </section>
            </div>
          )}
          {showSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={(event) => {
              if (event.target === event.currentTarget) setShowSettings(false);
            }}>
              <section role="dialog" aria-modal="true" aria-labelledby="chart-settings-title" className="w-full max-w-lg rounded-xl border bg-card shadow-2xl">
                <header className="flex items-start justify-between border-b p-4">
                  <div>
                    <h2 id="chart-settings-title" className="font-semibold">Chart settings</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Changes apply to this chart immediately.</p>
                  </div>
                  <button type="button" aria-label="Close settings" onClick={() => setShowSettings(false)}><X className="h-4 w-4" /></button>
                </header>
                <div className="space-y-3 p-4">
                  <label className="flex items-center justify-between gap-4 text-sm">
                    Candlestick type
                    <select aria-label="Candlestick type" value={candleStyle} onChange={(event) => setCandleStyle(event.target.value as "Solid" | "Hollow")} className="rounded border bg-background px-2 py-1 text-xs">
                      <option>Solid</option><option>Hollow</option>
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-4 text-sm">
                    Price axis type
                    <select aria-label="Price axis type" value={axisType} onChange={(event) => setAxisType(event.target.value as AxisType)} className="rounded border bg-background px-2 py-1 text-xs">
                      <option>Linear</option><option>Logarithmic</option>
                    </select>
                  </label>
                  {[
                    ["Show latest price", showLatestPrice, setShowLatestPrice],
                    ["Show highest and lowest prices", showHighLow, setShowHighLow],
                    ["Show latest indicator values", showLatestIndicator, setShowLatestIndicator],
                    ["Invert axis", invertAxis, setInvertAxis],
                    ["Show grid lines", showGrid, setShowGrid],
                  ].map(([label, checked, setter]) => (
                    <label key={label as string} className="flex items-center justify-between gap-4 text-sm">
                      {label as string}
                      <input type="checkbox" checked={checked as boolean} onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)} />
                    </label>
                  ))}
                </div>
                <footer className="flex justify-between border-t p-3">
                  <button type="button" onClick={() => {
                    setCandleStyle("Solid"); setAxisType("Linear"); setShowLatestPrice(true);
                    setShowHighLow(true); setShowLatestIndicator(true); setInvertAxis(false); setShowGrid(true);
                  }} className="text-xs text-muted-foreground hover:text-foreground">Restore defaults</button>
                  <button type="button" onClick={() => setShowSettings(false)} className="rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground">Done</button>
                </footer>
              </section>
            </div>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button type="button" onClick={downloadChart} className="rounded p-1.5 text-[#a6acb5] hover:bg-[#24262a] hover:text-white" aria-label="Download screenshot" title="Download screenshot"><Download className="h-4 w-4" /></button>
            <button type="button" onClick={() => void toggleFullscreen()} className="rounded p-1.5 text-[#a6acb5] hover:bg-[#24262a] hover:text-white" aria-label={fullscreen ? "Exit full screen" : "Full screen"} title={fullscreen ? "Exit full screen" : "Full screen"}>
              {fullscreen ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {downloadError && <p role="alert" className="px-3 py-2 text-xs text-destructive">{downloadError}</p>}
        <div className="flex min-h-0 flex-1">
          <div className="relative z-20 flex w-11 shrink-0 flex-col items-center gap-1 border-r border-[#34363a] bg-[#212326] py-1.5" role="toolbar" aria-label="Drawing tools">
            <button type="button" onClick={() => { setDrawingTool(null); setDrawingLevel(false); setPendingDrawingPoints([]); }} aria-label="Pointer: stop drawing" aria-pressed={!drawingTool && !drawingLevel} className={`flex h-8 w-8 items-center justify-center rounded ${!drawingTool && !drawingLevel ? "bg-[#2e3035] text-[#66a3ff]" : "text-[#a6acb5] hover:bg-[#2b2d31]"}`} title="Pointer"><MousePointer2 className="h-4 w-4" /></button>
            {DRAWING_GROUPS.map((group) => {
              const Icon = group.icon;
              return (
                <div key={group.name} className="relative">
                  <button type="button" aria-label={group.name} title={group.name} aria-expanded={openDrawingMenu === group.name} onClick={() => setOpenDrawingMenu((current) => current === group.name ? null : group.name)} className={`flex h-8 w-8 items-center justify-center rounded ${openDrawingMenu === group.name ? "bg-[#2e3035] text-[#66a3ff]" : "text-[#a6acb5] hover:bg-[#2b2d31]"}`}>
                    <Icon className="h-4 w-4" />
                  </button>
                  {openDrawingMenu === group.name && (
                    <div className="absolute left-full top-0 z-30 ml-1 max-h-[70vh] w-52 overflow-y-auto rounded-md border border-[#34363a] bg-[#212326] p-1 text-[#f6f7f9] shadow-xl">
                      <p className="px-2 py-1.5 text-[10px] font-semibold uppercase text-[#9298a2]">{group.name}</p>
                      {group.tools.map((tool) => (
                        <button key={tool} type="button" onClick={() => selectDrawingTool(tool)} className="block w-full rounded px-2 py-2 text-left text-xs hover:bg-[#2b2d31]">{tool}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <button type="button" disabled={drawingsLocked} onClick={() => { setDrawingTool(null); setDrawingLevel((active) => !active); }} aria-label="Horizontal level" aria-pressed={drawingLevel} title="Horizontal level" className={`flex h-8 w-8 items-center justify-center rounded disabled:opacity-40 ${drawingLevel ? "bg-[#2e3035] text-[#66a3ff]" : "text-[#a6acb5] hover:bg-[#2b2d31]"}`}><Activity className="h-4 w-4" /></button>
            <div className="my-1 w-6 border-t border-[#45474c]" />
            <button type="button" onClick={() => setDrawingsLocked((locked) => !locked)} aria-label={drawingsLocked ? "Unlock drawings" : "Lock all drawings"} title={drawingsLocked ? "Unlock drawings" : "Lock all drawings"} className="flex h-8 w-8 items-center justify-center rounded text-[#a6acb5] hover:bg-[#2b2d31]">{drawingsLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}</button>
            <button type="button" onClick={() => setDrawingsHidden((hidden) => !hidden)} aria-label={drawingsHidden ? "Show all drawings" : "Hide all drawings"} title={drawingsHidden ? "Show all drawings" : "Hide all drawings"} className="flex h-8 w-8 items-center justify-center rounded text-[#a6acb5] hover:bg-[#2b2d31]">{drawingsHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            <button type="button" onClick={() => { setDrawings([]); setHorizontalLevels([]); }} aria-label="Clear all drawings" title="Clear all drawings" className="flex h-8 w-8 items-center justify-center rounded text-[#a6acb5] hover:bg-[#2b2d31] hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
            <div className="mt-auto flex flex-col gap-1">
              <button type="button" onClick={() => zoomChart("in")} aria-label="Zoom in" title="Zoom in" className="flex h-8 w-8 items-center justify-center rounded text-sm text-[#a6acb5] hover:bg-[#2b2d31]">+</button>
              <button type="button" onClick={() => zoomChart("out")} aria-label="Zoom out" title="Zoom out" className="flex h-8 w-8 items-center justify-center rounded text-sm text-[#a6acb5] hover:bg-[#2b2d31]">−</button>
              {visibleRange && <button type="button" onClick={() => setVisibleRange(null)} aria-label="Reset zoom" title="Reset zoom" className="flex h-8 w-8 items-center justify-center rounded text-[10px] text-[#a6acb5] hover:bg-[#2b2d31]">1:1</button>}
            </div>
          </div>
          <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-10 items-center justify-between gap-2 border-b border-[#26272a] px-3">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold">{symbolInput}</span>
              <span className="text-xs text-[#8b9099]">
                {exchange} · {query.interval}
              </span>
              {data.length > 0 && (
                <span className="ml-1 text-[11px] font-semibold tabular-nums text-[#b8bbc2]">
                  {formatPrice(data[data.length - 1].close)}
                  <span className={`ml-1 ${change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                  </span>
                </span>
              )}
            </div>
            {activeCandle && (
              <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[10px] tabular-nums text-[#a6acb5]">
                <span>
                  {formatDate(activeCandle.timestamp, query.interval)}
                </span>
                <span>O {formatPrice(activeCandle.open)}</span>
                <span>H {formatPrice(activeCandle.high)}</span>
                <span>L {formatPrice(activeCandle.low)}</span>
                <span className="font-semibold text-[#f6f7f9]">
                  C {formatPrice(activeCandle.close)}
                </span>
                {hasVolume && (
                  <span>Vol {formatVolume(activeCandle.volume)}</span>
                )}
              </div>
            )}
          </div>
          {loading ? (
            <div className="flex min-h-80 flex-1 animate-pulse items-center justify-center bg-[#111214] text-sm text-[#9298a2]" role="status">
              Loading chart data…
            </div>
          ) : error ? (
            <div
              className="flex min-h-80 flex-1 flex-col items-center justify-center gap-2 text-sm text-[#9298a2]"
              role="alert"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setReloadSequence((current) => current + 1)}
                className="text-primary hover:underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden cursor-crosshair">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                preserveAspectRatio="none"
                className="block h-[calc(100dvh-7rem)] min-h-[300px] w-full touch-none"
                role="img"
                aria-label={`${symbolInput} ${chartStyle.toLowerCase()} chart`}
                onPointerMove={onChartPointer}
                onPointerLeave={() => setHoverIndex(null)}
                onClick={onChartClick}
              >
                <rect width={WIDTH} height={HEIGHT} fill="transparent" />
              {showLatestIndicator && mainIndicatorLines.map((line, index) => {
                const value = line.values[hoverIndex ?? data.length - 1];
                if (value == null) return null;
                return (
                  <text key={`latest-${line.key}`} x={LEFT + index * 138} y={TOP + 12} fill={line.color} fontSize="11">
                    {line.key}: {formatPrice(value)}
                  </text>
                );
              })}
              {[0, 1, 2, 3, 4].map((line) => {
                  const y = TOP + ((priceBottom - TOP) * line) / 4;
                  const value = yToPrice(y);
                  return (
                    <g key={line}>
                      {showGrid && <line x1={LEFT} x2={WIDTH - RIGHT} y1={y} y2={y} stroke="#c8cbd0" strokeDasharray="3 4" opacity="0.34" />}
                      <text
                        x={WIDTH - RIGHT + 8}
                        y={y + 4}
                        fill="currentColor"
                        opacity="0.6"
                        fontSize="11"
                      >
                        {formatPrice(value)}
                      </text>
                    </g>
                  );
                })}
                {data.map((candle, index) => {
                  if (index < visibleStart || index > visibleEnd) return null;
                  const x = xAt(index);
                  const rising = candle.close >= candle.open;
                  const color = rising ? "#22c55e" : "#ef4444";
                  const bodyTop = yPrice(Math.max(candle.open, candle.close));
                  const bodyBottom = yPrice(
                    Math.min(candle.open, candle.close),
                  );
                  const candleWidth = Math.max(1.5, Math.min(12, step * 0.62));
                  if (chartStyle === "Candles") {
                    return (
                      <g key={candle.timestamp} stroke={color} fill={candleStyle === "Hollow" && rising ? "var(--card)" : color}>
                        <line x1={x} x2={x} y1={yPrice(candle.high)} y2={yPrice(candle.low)} strokeWidth="1" />
                        <rect x={x - candleWidth / 2} y={bodyTop} width={candleWidth} height={Math.max(1, bodyBottom - bodyTop)} strokeWidth="1" />
                      </g>
                    );
                  }
                  if (chartStyle === "Bars") {
                    return (
                      <g key={candle.timestamp} stroke={color} strokeWidth="1.2">
                        <line x1={x} x2={x} y1={yPrice(candle.high)} y2={yPrice(candle.low)} />
                        <line x1={x - candleWidth / 2} x2={x} y1={yPrice(candle.open)} y2={yPrice(candle.open)} />
                        <line x1={x} x2={x + candleWidth / 2} y1={yPrice(candle.close)} y2={yPrice(candle.close)} />
                      </g>
                    );
                  }
                  return null;
                })}
                {(chartStyle === "Line" || chartStyle === "Baseline" || chartStyle === "Area") && (
                  <path
                    d={chartStyle === "Area"
                      ? `${pathFor(data.map((candle) => candle.close))} L${xAt(visibleEnd)},${priceBottom} L${xAt(visibleStart)},${priceBottom} Z`
                      : pathFor(data.map((candle) => candle.close))}
                    fill={chartStyle === "Area" ? "rgba(56,189,248,0.12)" : "none"}
                    stroke={chartStyle === "Baseline" && change < 0 ? "#ef4444" : "#38bdf8"}
                    strokeWidth={chartStyle === "Baseline" ? "1.5" : "2"}
                  />
                )}
                {mainIndicatorLines.map((line) => (
                  <path key={line.key} d={pathFor(line.values)} fill="none" stroke={line.color} strokeWidth="1.5" />
                ))}
                {hasVolume &&
                  data.map((candle, index) => {
                    if (index < visibleStart || index > visibleEnd) return null;
                    const x = xAt(index);
                    const candleWidth = Math.max(
                      1.5,
                      Math.min(12, step * 0.62),
                    );
                    const color =
                      candle.close >= candle.open ? "#22c55e" : "#ef4444";
                    return (
                      <rect
                        key={`volume-${candle.timestamp}`}
                        x={x - candleWidth / 2}
                        y={yVolume(candle.volume)}
                        width={candleWidth}
                        height={VOLUME_BOTTOM - yVolume(candle.volume)}
                        fill={color}
                        opacity="0.45"
                      />
                    );
                  })}
                {hasVolume && volumeAverageLines.map((line) => (
                  <path key={`volume-average-${line.period}`} d={line.path} fill="none" stroke={line.color} strokeWidth="1.25" />
                ))}
                {hasVolume && <>
                  <text x={LEFT} y={VOLUME_TOP - 5} fill="#858a93" fontSize="10">VOL (5, 10, 20)</text>
                  {volumeAverageLines.map((line, index) => {
                    const value = getVolumeSma(data, line.period)[hoverIndex ?? data.length - 1];
                    return value == null ? null : (
                      <text key={`volume-label-${line.period}`} x={LEFT + 145 + index * 120} y={VOLUME_TOP - 5} fill={line.color} fontSize="10">
                        MA{line.period}: {formatVolume(value)}
                      </text>
                    );
                  })}
                  <text x={LEFT + 505} y={VOLUME_TOP - 5} fill="#42a989" fontSize="10">
                    VOLUME: {formatVolume((hoverIndex == null ? data[data.length - 1] : data[hoverIndex])?.volume ?? 0)}
                  </text>
                </>}
                {!drawingsHidden && horizontalLevels.map((level, index) => (
                  <g key={`level-${index}`}>
                    <line
                      x1={LEFT}
                      x2={WIDTH - RIGHT}
                      y1={yPrice(level)}
                      y2={yPrice(level)}
                      stroke="#f59e0b"
                      strokeDasharray="5 4"
                    />
                    <text
                      x={WIDTH - RIGHT + 8}
                      y={yPrice(level) - 4}
                      fill="#f59e0b"
                      fontSize="10"
                    >
                      {formatPrice(level)}
                    </text>
                  </g>
                ))}
                {showHighLow && data.length > 0 && [
                  { name: "High", value: priceMax, color: "#f97316" },
                  { name: "Low", value: priceMin, color: "#38bdf8" },
                ].map((level) => (
                  <g key={level.name}>
                    <line x1={LEFT} x2={WIDTH - RIGHT} y1={yPrice(level.value)} y2={yPrice(level.value)} stroke={level.color} strokeDasharray="2 5" opacity="0.55" />
                    <text x={WIDTH - RIGHT + 7} y={yPrice(level.value) - 3} fill={level.color} fontSize="9">{level.name} {formatPrice(level.value)}</text>
                  </g>
                ))}
                {showLatestPrice && data.length > 0 && (
                  <g>
                    <line x1={LEFT} x2={WIDTH - RIGHT} y1={yPrice(data[data.length - 1].close)} y2={yPrice(data[data.length - 1].close)} stroke="#14b8a6" strokeDasharray="4 4" opacity="0.8" />
                    <rect x={WIDTH - RIGHT + 2} y={yPrice(data[data.length - 1].close) - 9} width={RIGHT - 5} height="18" rx="3" fill="#14b8a6" />
                    <text x={WIDTH - RIGHT + 6} y={yPrice(data[data.length - 1].close) + 4} fill="white" fontSize="9">{formatPrice(data[data.length - 1].close)}</text>
                  </g>
                )}
                {!drawingsHidden && drawings.map((drawing) => {
                  const first = drawing.points[0];
                  const second = drawing.points[1] ?? first;
                  if (!first || !data.length) return null;
                  if (drawing.points.every((point) => point.index < visibleStart) || drawing.points.every((point) => point.index > visibleEnd)) return null;
                  const coordinates = drawing.points.map((point) => [xAt(point.index), yPrice(point.price)] as const);
                  const x1 = xAt(first.index);
                  const x2 = xAt(second.index);
                  const y1 = yPrice(first.price);
                  const y2 = yPrice(second.price);
                  const third = drawing.points[2];
                  const x3 = third ? xAt(third.index) : x2;
                  const y3 = third ? yPrice(third.price) : y2;
                  const stroke = drawing.tool === "Price Tag" ? "#f59e0b" : "#38bdf8";
                  if (drawing.tool === "Rectangle" || drawing.tool === "Gann Box") {
                    return <g key={drawing.id}>
                      <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.max(1, Math.abs(x2 - x1))} height={Math.max(1, Math.abs(y2 - y1))} fill="rgba(56,189,248,0.08)" stroke={stroke} strokeDasharray={drawing.tool === "Gann Box" ? "4 3" : undefined} />
                      {drawing.tool === "Gann Box" && <>
                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} opacity="0.7" />
                        <line x1={x1} y1={y2} x2={x2} y2={y1} stroke={stroke} opacity="0.7" />
                        <line x1={(x1 + x2) / 2} y1={Math.min(y1, y2)} x2={(x1 + x2) / 2} y2={Math.max(y1, y2)} stroke={stroke} opacity="0.45" />
                        <line x1={Math.min(x1, x2)} y1={(y1 + y2) / 2} x2={Math.max(x1, x2)} y2={(y1 + y2) / 2} stroke={stroke} opacity="0.45" />
                      </>}
                    </g>;
                  }
                  if (drawing.tool === "Price Channel" || drawing.tool === "Parallel Lines") {
                    if (!third) return null;
                    const parallelEndX = x3 + x2 - x1;
                    const parallelEndY = y3 + y2 - y1;
                    return <g key={drawing.id}>
                      {drawing.tool === "Price Channel" && <polygon points={`${x1},${y1} ${x2},${y2} ${parallelEndX},${parallelEndY} ${x3},${y3}`} fill="rgba(56,189,248,0.08)" stroke="none" />}
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} />
                      <line x1={x3} y1={y3} x2={parallelEndX} y2={parallelEndY} stroke={stroke} />
                    </g>;
                  }
                  if (drawing.tool === "Circle") {
                    return <ellipse key={drawing.id} cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} rx={Math.max(2, Math.abs(x2 - x1) / 2)} ry={Math.max(2, Math.abs(y2 - y1) / 2)} fill="none" stroke={stroke} />;
                  }
                  if (drawing.tool === "Fib Circles") {
                    return <g key={drawing.id}>
                      {[0.25, 0.382, 0.5, 0.618, 0.786, 1].map((ratio) => (
                        <ellipse key={ratio} cx={x1} cy={y1} rx={Math.max(2, Math.abs(x2 - x1) * ratio)} ry={Math.max(2, Math.abs(y2 - y1) * ratio)} fill="none" stroke={stroke} opacity="0.8" />
                      ))}
                    </g>;
                  }
                  if (drawing.tool === "Fib Spiral") {
                    const centerX = (x1 + x2) / 2;
                    const centerY = (y1 + y2) / 2;
                    const radiusX = Math.max(2, Math.abs(x2 - x1) / 2);
                    const radiusY = Math.max(2, Math.abs(y2 - y1) / 2);
                    const points = Array.from({ length: 81 }, (_, index) => {
                      const progress = index / 80;
                      const angle = progress * Math.PI * 4;
                      return `${centerX + Math.cos(angle) * radiusX * progress},${centerY + Math.sin(angle) * radiusY * progress}`;
                    }).join(" ");
                    return <polyline key={drawing.id} points={points} fill="none" stroke={stroke} />;
                  }
                  if (drawing.tool === "Triangle") {
                    if (!third) return null;
                    return <polygon key={drawing.id} points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`} fill="none" stroke={stroke} />;
                  }
                  if (drawing.tool === "Parallelogram") {
                    if (!third) return null;
                    return <polygon key={drawing.id} points={`${x1},${y1} ${x2},${y2} ${x3},${y3} ${x1 + x3 - x2},${y1 + y3 - y2}`} fill="none" stroke={stroke} />;
                  }
                  if (drawing.tool.includes("Wave") || drawing.tool === "ABCD" || drawing.tool === "XABCD" || drawing.tool === "Brush") {
                    const points = coordinates.map(([x, y]) => `${x},${y}`).join(" ");
                    return <polyline key={drawing.id} points={points} fill="none" stroke={stroke} />;
                  }
                  if (drawing.tool === "Speed Resistance Fan") {
                    return <g key={drawing.id}>
                      {[0.382, 0.5, 0.618].map((ratio) => (
                        <g key={ratio}>
                          <line x1={x1} y1={y1} x2={x2} y2={y1 + (y2 - y1) * ratio} stroke={stroke} />
                          <text x={x2 + 3} y={y1 + (y2 - y1) * ratio - 2} fill={stroke} fontSize="8">{(ratio * 100).toFixed(1)}%</text>
                        </g>
                      ))}
                    </g>;
                  }
                  if (drawing.tool.startsWith("Fib")) {
                    const extensionAnchor = drawing.points[2]?.price ?? second.price;
                    return <g key={drawing.id}>
                      {[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map((ratio) => {
                        const level = drawing.tool === "Fib Extension"
                          ? extensionAnchor + (second.price - first.price) * ratio
                          : first.price + (second.price - first.price) * ratio;
                        return <g key={ratio}><line x1={x1} x2={x2} y1={yPrice(level)} y2={yPrice(level)} stroke={stroke} opacity="0.7" /><text x={x2 + 3} y={yPrice(level) - 2} fill={stroke} fontSize="8">{(ratio * 100).toFixed(1)}%</text></g>;
                      })}
                    </g>;
                  }
                  if (drawing.tool.startsWith("V.")) {
                    const isFullLine = drawing.tool === "V. Straight Line" || drawing.tool === "V. Ray Line";
                    return <line key={drawing.id} x1={x1} x2={x1} y1={isFullLine ? TOP : Math.min(y1, y2)} y2={isFullLine ? priceBottom : Math.max(y1, y2)} stroke={stroke} strokeDasharray={drawing.tool.includes("Ray") ? "5 4" : undefined} />;
                  }
                  if (drawing.tool === "H. Straight Line" || drawing.tool === "H. Ray Line" || drawing.tool === "H. Segment" || drawing.tool === "Price Line") {
                    const isFullLine = drawing.tool === "H. Straight Line" || drawing.tool === "Price Line";
                    const isRay = drawing.tool === "H. Ray Line";
                    return <line key={drawing.id} x1={isFullLine ? LEFT : x1} x2={isFullLine || isRay ? WIDTH - RIGHT : x2} y1={y1} y2={y1} stroke={stroke} strokeDasharray={isRay ? "5 4" : undefined} />;
                  }
                  if (drawing.tool === "Price Tag") {
                    return <g key={drawing.id}>
                      <line x1={x1} x2={WIDTH - RIGHT} y1={y1} y2={y1} stroke={stroke} strokeDasharray="4 4" />
                      <rect x={WIDTH - RIGHT + 2} y={y1 - 9} width={RIGHT - 5} height="18" rx="3" fill={stroke} />
                      <text x={WIDTH - RIGHT + 5} y={y1 + 4} fill="white" fontSize="9">{drawing.text}</text>
                    </g>;
                  }
                  if (drawing.tool === "Annotation") {
                    return <text key={drawing.id} x={x1 + 4} y={y1 - 5} fill={stroke} fontSize="11">{drawing.text}</text>;
                  }
                  if (drawing.tool === "Arrow") {
                    const angle = Math.atan2(y2 - y1, x2 - x1);
                    const arrowX1 = x2 - 10 * Math.cos(angle - Math.PI / 6);
                    const arrowY1 = y2 - 10 * Math.sin(angle - Math.PI / 6);
                    const arrowX2 = x2 - 10 * Math.cos(angle + Math.PI / 6);
                    const arrowY2 = y2 - 10 * Math.sin(angle + Math.PI / 6);
                    return <g key={drawing.id}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} />
                      <polygon points={`${x2},${y2} ${arrowX1},${arrowY1} ${arrowX2},${arrowY2}`} fill={stroke} />
                    </g>;
                  }
                  return <g key={drawing.id}>
                    <line
                      x1={drawing.tool === "Extended Line" || (drawing.tool === "Ray" && x2 < x1) ? LEFT : x1}
                      x2={drawing.tool === "Extended Line" || (drawing.tool === "Ray" && x2 >= x1) ? WIDTH - RIGHT : x2}
                      y1={drawing.tool === "Extended Line" || (drawing.tool === "Ray" && x2 < x1) ? y1 + ((drawing.tool === "Extended Line" ? LEFT : LEFT) - x1) * ((y2 - y1) / (x2 - x1 || 1)) : y1}
                      y2={drawing.tool === "Extended Line" || (drawing.tool === "Ray" && x2 >= x1) ? y1 + ((WIDTH - RIGHT) - x1) * ((y2 - y1) / (x2 - x1 || 1)) : y2}
                      stroke={stroke}
                      strokeDasharray={drawing.tool === "Ray" || drawing.tool === "Extended Line" ? "5 4" : undefined}
                    />
                    {drawing.text && <text x={x1 + 5} y={y1 - 5} fill={stroke} fontSize="10">{drawing.text}</text>}
                  </g>;
                })}
                {!drawingsHidden && magicResult && magicTab === "Levels" && supportResistance.map((level) => (
                  <g key={`${level.price}-${level.kind}`}>
                    <line x1={LEFT} x2={WIDTH - RIGHT} y1={yPrice(level.price)} y2={yPrice(level.price)} stroke={level.kind === "Support" ? "#22c55e" : "#ef4444"} strokeDasharray="4 4" opacity="0.8" />
                    <text x={WIDTH - RIGHT + 5} y={yPrice(level.price) - 4} fill={level.kind === "Support" ? "#22c55e" : "#ef4444"} fontSize="9">{level.kind} {formatPrice(level.price)}</text>
                  </g>
                ))}
                {!drawingsHidden && magicResult && selectedHighlight && (
                  <rect x={xAt(Math.max(visibleStart, selectedHighlight.start)) - step / 2} y={TOP} width={Math.max(step, step * (Math.min(visibleEnd, selectedHighlight.end) - Math.max(visibleStart, selectedHighlight.start) + 1))} height={priceBottom - TOP} fill="rgba(59,130,246,0.10)" stroke="#3b82f6" />
                )}
                {!drawingsHidden && magicResult && magicTab === "Base" && showBaseOverlay && visibleWeeklyBases.map((base, index) => {
                  const rawStart = data.findIndex((bar) => bar.timestamp >= base.startTimestamp);
                  const rawEnd = data.findIndex((bar) => bar.timestamp >= base.endTimestamp);
                  if (rawStart < 0 || rawEnd < 0 || rawEnd < visibleStart || rawStart > visibleEnd) return null;
                  const start = Math.max(visibleStart, rawStart);
                  const end = Math.min(visibleEnd, rawEnd);
                  return <g key={`base-overlay-${base.startTimestamp}-${index}`}>
                    <rect x={xAt(start) - step / 2} y={yPrice(base.high)} width={Math.max(step, (end - start + 1) * step)} height={Math.max(1, yPrice(base.low) - yPrice(base.high))} fill="rgba(34,197,94,0.08)" stroke="#22c55e" strokeDasharray="4 3" />
                  </g>;
                })}
                {drawingTool && pendingDrawingPoints.map((point, index) => (
                  <circle key={`${point.index}-${index}`} cx={xAt(point.index)} cy={yPrice(point.price)} r="4" fill="#f59e0b" />
                ))}
                {signalStart && signalEnd && (
                  <g>
                    <line x1={xAt(signalStart.index)} x2={xAt(signalEnd.index)} y1={yPrice(signalStart.price)} y2={yPrice(signalEnd.price)} stroke="#f59e0b" strokeWidth="2" />
                    <text x={xAt(signalEnd.index)} y={yPrice(signalEnd.price) - 8} fill="#f59e0b" fontSize="10">{signalMovePct?.toFixed(2)}%</text>
                  </g>
                )}
                {hoverIndex != null && data[hoverIndex] && (
                  <g pointerEvents="none">
                    <line
                      x1={xAt(hoverIndex)}
                      x2={xAt(hoverIndex)}
                      y1={TOP}
                      y2={hasVolume ? VOLUME_BOTTOM : priceBottom}
                      stroke="currentColor"
                      strokeDasharray="3 4"
                      opacity="0.45"
                    />
                  </g>
                )}
                {Array.from({ length: 6 }, (_, index) => {
                  const candleIndex = Math.min(visibleEnd, Math.floor(visibleStart + (visibleCount - 1) * index / 5));
                  const candle = data[candleIndex];
                  if (!candle) return null;
                  return (
                    <text
                      key={`date-${index}`}
                      x={xAt(candleIndex)}
                      y={HEIGHT - 8}
                      fill="currentColor"
                      opacity="0.55"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      {formatDate(candle.timestamp, query.interval)}
                    </text>
                  );
                })}
              </svg>
            </div>
          )}
          <div className="flex h-7 shrink-0 flex-wrap items-center gap-4 border-t border-[#292a2d] px-3 text-[10px] text-[#9298a2]">
            <span className={chartStyle === "Candles" ? "text-foreground" : ""}>
              {chartStyle === "Candles" ? `${candleStyle} candles · Green up / red down` : chartStyle}
            </span>
            {mainIndicatorLines.map((line) => <span key={line.key} style={{ color: line.color }}>{line.key}</span>)}
            {hasVolume && <span>Volume</span>}
            <span className="ml-auto">
              Source: Yahoo Finance · NSE/BSE listed symbols
            </span>
          </div>
          {lowerIndicators.length > 0 && (
            <div className="max-h-40 shrink-0 space-y-2 overflow-y-auto border-t border-[#292a2d] p-2">
              {lowerIndicators.map((indicator) => {
                const components = indicatorComponents.get(indicator) ?? [];
                const visibleValues = components.flatMap((component) =>
                  component.values.slice(visibleStart, visibleEnd + 1)
                    .filter((value): value is number => value != null),
                );
                const min = Math.min(0, ...visibleValues);
                const max = Math.max(0, ...visibleValues);
                const label = INDICATORS.find((item) => item.id === indicator)?.label ?? indicator;
                const valueToY = (value: number) =>
                  36 - ((value - min) / (max - min || 1)) * 27;
                const currentIndex = hoverIndex ?? data.length - 1;
                return (
                  <div key={indicator} className="rounded border bg-background/50 px-3 py-2">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{label}</span>
                      <span className="flex flex-wrap justify-end gap-x-2 tabular-nums">
                        {components.map((component) => {
                          const current = component.values[currentIndex];
                          return (
                            <span key={component.name} style={{ color: component.color }}>
                              {component.name}: {current == null ? "—" : current.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                            </span>
                          );
                        })}
                      </span>
                    </div>
                    <svg viewBox={`0 0 ${WIDTH} 44`} className="mt-1 h-10 w-full" aria-label={`${label} indicator panel`}>
                      <line x1={LEFT} x2={WIDTH - RIGHT} y1="9" y2="9" stroke="currentColor" opacity="0.08" />
                      <line x1={LEFT} x2={WIDTH - RIGHT} y1="36" y2="36" stroke="currentColor" opacity="0.08" />
                      {components.map((component) => {
                        const values = component.values.slice(visibleStart, visibleEnd + 1);
                        if (component.style === "histogram") {
                          return values.map((value, index) => {
                            if (value == null) return null;
                            const zeroY = valueToY(0);
                            const valueY = valueToY(value);
                            return (
                              <rect
                                key={`${component.name}-${visibleStart + index}`}
                                x={xAt(visibleStart + index) - Math.max(1, step * 0.3)}
                                y={Math.min(zeroY, valueY)}
                                width={Math.max(1, step * 0.6)}
                                height={Math.max(1, Math.abs(zeroY - valueY))}
                                fill={value >= 0 ? component.color : "#ef4444"}
                                opacity="0.65"
                              />
                            );
                          });
                        }
                        const path = values.map((value, index) => {
                          if (value == null) return "";
                          const x = xAt(visibleStart + index);
                          const y = valueToY(value);
                          return `${index === 0 || values[index - 1] == null ? "M" : "L"}${x},${y}`;
                        }).filter(Boolean).join(" ");
                        return <path key={component.name} d={path} fill="none" stroke={component.color} strokeWidth="1.5" />;
                      })}
                    </svg>
                  </div>
                );
              })}
            </div>
          )}
          <button type="button" onClick={() => setMagicOpen((open) => !open)} className={`absolute bottom-4 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#44464b] bg-[#33363b] px-5 py-2.5 text-sm font-semibold text-white shadow-xl hover:bg-[#41444a] ${magicOpen ? "hidden" : ""}`}>
            <Sparkles className="h-4 w-4" /> Magic
          </button>
        </div>
        {magicOpen && (
          <section aria-label="Magic chart analysis" className="absolute bottom-16 left-1/2 z-30 flex max-h-[70dvh] w-[min(760px,calc(100%-4rem))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-[#45474c] bg-[#1d1e20] text-[#f6f7f9] shadow-2xl">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#34363a] px-4 py-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Magic analysis</h2>
                <p className="mt-1 text-[10px] text-muted-foreground">Transparent OHLCV-based heuristics. Results describe historical patterns, not predictions.</p>
              </div>
              <button type="button" onClick={() => setMagicOpen(false)} aria-label="Close Magic analysis"><X className="h-4 w-4" /></button>
            </header>
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#34363a] px-3 py-2" role="tablist" aria-label="Magic analysis tabs">
              {(["Signals", "Patterns", "Candles", "Levels", "Base"] as MagicTab[]).map((tab) => (
                <button key={tab} type="button" role="tab" aria-selected={magicTab === tab} onClick={() => { setMagicTab(tab); setMagicResult(false); setSelectedHighlight(null); setSignalDrawing(false); }} className={`rounded-md px-3 py-1.5 text-xs ${magicTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>{tab}</button>
              ))}
            </div>
            <div className="min-h-0 space-y-3 overflow-y-auto p-4">
              {magicTab === "Signals" && (
                <>
                  <p className="text-xs text-muted-foreground">Mark two points on the chart to measure price move, elapsed bars and relative volume.</p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={scanMagicTab} className="rounded-md border px-3 py-2 text-xs hover:bg-accent">{signalDrawing ? "Click two points on chart…" : "Draw a range"}</button>
                    {signalStart && <button type="button" onClick={() => { setSignalStart(null); setSignalEnd(null); setSignalDrawing(false); }} className="text-xs text-muted-foreground hover:text-foreground">Clear measurement</button>}
                  </div>
                  {signalEnd && <div className="grid gap-2 text-xs sm:grid-cols-3">
                    <div className="rounded border p-3">Move <strong className={signalMovePct != null && signalMovePct >= 0 ? "text-emerald-500" : "text-rose-500"}>{signalMovePct?.toFixed(2)}%</strong></div>
                    <div className="rounded border p-3">Duration <strong>{signalBars} bars</strong></div>
                    <div className="rounded border p-3">Relative volume <strong>{signalVolumeMultiple?.toFixed(2)}×</strong></div>
                  </div>}
                </>
              )}
              {magicTab === "Patterns" && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">Rule-based ranges include rectangles, triangles, and double tops/bottoms.</p>
                    <button type="button" onClick={scanMagicTab} className="rounded-md border px-3 py-2 text-xs hover:bg-accent">{magicResult ? "Re-scan" : "Scan patterns"}</button>
                  </div>
                  {magicResult && <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{patternForDisplay.length} pattern candidates</span>
                    <button type="button" onClick={() => setSelectedHighlight(null)} className="text-xs text-muted-foreground hover:text-foreground">Clear highlights</button>
                  </div>}
                  {magicResult && <ul className="max-h-64 space-y-1 overflow-y-auto">
                    {patternForDisplay.map((pattern, index) => (
                      <li key={`${pattern.name}-${pattern.startIndex}-${index}`}>
                        <button type="button" onClick={() => setSelectedHighlight({ start: pattern.startIndex, end: pattern.endIndex })} className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-accent">
                          <span><strong className="text-xs">{pattern.name}</strong><span className="ml-2 text-[10px] text-muted-foreground">{pattern.bias} · {formatDate(data[pattern.startIndex]?.timestamp ?? 0, query.interval)} – {formatDate(data[pattern.endIndex]?.timestamp ?? 0, query.interval)}</span></span>
                          <span className="text-xs text-primary">Highlight</span>
                        </button>
                      </li>
                    ))}
                    {patternForDisplay.length === 0 && <li className="p-3 text-xs text-muted-foreground">No pattern candidates in the current range.</li>}
                  </ul>}
                </>
              )}
              {magicTab === "Candles" && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">Scan the last 60 bars for standard single-, double- and triple-candle formations.</p>
                    <button type="button" onClick={scanMagicTab} className="rounded-md border px-3 py-2 text-xs hover:bg-accent">{magicResult ? "Re-scan" : "Scan candlesticks"}</button>
                  </div>
                  {magicResult && <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{candlePatterns.length} formations found</span>
                    <button type="button" onClick={() => setSelectedHighlight(null)} className="text-xs text-muted-foreground hover:text-foreground">Clear highlights</button>
                  </div>}
                  {magicResult && <ul className="max-h-64 space-y-1 overflow-y-auto">
                    {candlePatterns.map((pattern: CandlePattern, index) => (
                      <li key={`${pattern.name}-${pattern.index}-${index}`}>
                        <button type="button" onClick={() => setSelectedHighlight({ start: Math.max(0, pattern.index - pattern.bars + 1), end: pattern.index })} className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-accent">
                          <span><strong className="text-xs">{pattern.name}</strong><span className="ml-2 text-[10px] text-muted-foreground">{formatDate(data[pattern.index]?.timestamp ?? 0, query.interval)} · {pattern.bars} bar{pattern.bars === 1 ? "" : "s"} · {pattern.description}</span></span>
                          <span className={`text-[10px] ${pattern.bias === "Bullish" ? "text-emerald-500" : pattern.bias === "Bearish" ? "text-rose-500" : "text-muted-foreground"}`}>{pattern.bias}</span>
                        </button>
                      </li>
                    ))}
                    {candlePatterns.length === 0 && <li className="p-3 text-xs text-muted-foreground">No matching formations in the last 60 bars.</li>}
                  </ul>}
                </>
              )}
              {magicTab === "Levels" && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">Cluster swing highs/lows into nearby support and resistance levels.</p>
                    <button type="button" onClick={scanMagicTab} className="rounded-md border px-3 py-2 text-xs hover:bg-accent">{magicResult ? "Re-scan" : "Find support and resistance"}</button>
                  </div>
                  {magicResult && <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{supportResistance.length} levels found</span>
                    <button type="button" onClick={() => setHorizontalLevels([])} className="text-xs text-muted-foreground hover:text-foreground">Clear lines</button>
                  </div>}
                  {magicResult && <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {supportResistance.map((level: PriceLevel) => (
                      <li key={`${level.kind}-${level.price}`}><button type="button" onClick={() => setHorizontalLevels((current) => [...current, level.price])} className="flex w-full items-center justify-between rounded-md border p-3 text-left hover:bg-accent">
                        <span className={`text-xs font-semibold ${level.kind === "Support" ? "text-emerald-500" : "text-rose-500"}`}>{level.kind}</span>
                        <span className="text-xs tabular-nums">{formatPrice(level.price)}</span>
                        <span className="text-[10px] text-muted-foreground">{level.touches} touches</span>
                        <span className="text-[10px] tabular-nums">{level.distancePct >= 0 ? "+" : ""}{level.distancePct.toFixed(1)}%</span>
                      </button></li>
                    ))}
                    {supportResistance.length === 0 && <li className="text-xs text-muted-foreground">No clustered swing levels found for this range.</li>}
                  </ul>}
                </>
              )}
              {magicTab === "Base" && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">Detect sideways weekly bases and estimate depth, quality and breakout status.</p>
                    <button type="button" onClick={scanMagicTab} className="rounded-md border px-3 py-2 text-xs hover:bg-accent">{magicResult ? "Re-scan" : "Find weekly bases"}</button>
                  </div>
                  <button type="button" aria-expanded={baseFiltersOpen} onClick={() => setBaseFiltersOpen((open) => !open)} className="text-xs text-primary hover:underline">Filters</button>
                  {baseFiltersOpen && <div className="grid gap-3 rounded-md border p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={showBaseOverlay} onChange={(event) => setShowBaseOverlay(event.target.checked)} />Show bases on chart</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={breakoutBasesOnly} onChange={(event) => setBreakoutBasesOnly(event.target.checked)} />Breakout bases only</label>
                    <label className="flex items-center justify-between gap-2">Minimum weeks<input type="number" min="4" max="26" value={baseMinWeeks} onChange={(event) => setBaseMinWeeks(Number(event.target.value))} className="w-16 rounded border bg-background px-2 py-1" /></label>
                    <label className="flex items-center justify-between gap-2">Maximum weeks<input type="number" min="4" max="52" value={baseMaxWeeks} onChange={(event) => setBaseMaxWeeks(Number(event.target.value))} className="w-16 rounded border bg-background px-2 py-1" /></label>
                    <label className="flex items-center justify-between gap-2">Maximum depth<select value={baseMaxDepth} onChange={(event) => setBaseMaxDepth(Number(event.target.value))} className="rounded border bg-background px-2 py-1"><option value={15}>15%</option><option value={20}>20%</option><option value={25}>25%</option></select></label>
                    <label className="flex items-center justify-between gap-2">Minimum quality<select value={minimumBaseQuality} onChange={(event) => setMinimumBaseQuality(event.target.value as "High" | "Medium" | "Low")} className="rounded border bg-background px-2 py-1"><option>High</option><option>Medium</option><option>Low</option></select></label>
                    <label className="flex items-center justify-between gap-2">Breakout buffer %<input type="number" step="0.1" min="0" max="5" value={breakoutBuffer} onChange={(event) => setBreakoutBuffer(Number(event.target.value))} className="w-16 rounded border bg-background px-2 py-1" /></label>
                    <label className="flex items-center justify-between gap-2">Minimum breakout volume<input type="number" step="0.1" min="0" value={minimumBreakoutVolume} onChange={(event) => setMinimumBreakoutVolume(Number(event.target.value))} className="w-16 rounded border bg-background px-2 py-1" /></label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={includeFailedBases} onChange={(event) => setIncludeFailedBases(event.target.checked)} />Include failed/broken bases</label>
                  </div>}
                  {magicResult && <>
                    <p className="text-xs text-muted-foreground">{visibleWeeklyBases.length} bases match filters · {period === "M" ? "Switch to D or W to analyze weekly bases." : "Weekly data aggregated from available OHLCV bars."}</p>
                    <ul className="max-h-64 space-y-1 overflow-y-auto">
                      {visibleWeeklyBases.map((base: WeeklyBase, index) => {
                        const rawStartIndex = data.findIndex((bar) => bar.timestamp >= base.startTimestamp);
                        const rawEndIndex = data.findIndex((bar) => bar.timestamp >= base.endTimestamp);
                        const startIndex = rawStartIndex < 0 ? 0 : rawStartIndex;
                        const endIndex = rawEndIndex < startIndex ? startIndex : rawEndIndex;
                        return <li key={`${base.startTimestamp}-${index}`}><button type="button" onClick={() => setSelectedHighlight({ start: startIndex, end: endIndex })} className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-accent">
                          <span className="text-xs font-semibold">{base.breakout}</span>
                          <span className="text-[10px] text-muted-foreground">{base.weeks}-week · Depth {base.depthPct.toFixed(1)}% · Quality {base.quality} · Vol {base.breakoutVolumeMultiple.toFixed(1)}×</span>
                          <span className="text-[10px] text-muted-foreground">{formatDate(base.startTimestamp, "1wk")} – {formatDate(base.endTimestamp, "1wk")}</span>
                        </button></li>;
                      })}
                      {visibleWeeklyBases.length === 0 && <li className="p-3 text-xs text-muted-foreground">No weekly bases match these filters.</li>}
                    </ul>
                  </>}
                  {magicResult && period === "M" && <p className="text-[10px] text-amber-500">The monthly chart has no weekly bars; switch to D or W for this analysis.</p>}
                </>
              )}
            </div>
          </section>
        )}
        </div>
      </section>
    </div>
  );
}
