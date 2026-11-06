export interface OhlcvBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type CandlePattern = {
  name: string;
  bias: "Bullish" | "Bearish" | "Neutral";
  index: number;
  bars: number;
  description: string;
};

export type PriceLevel = {
  price: number;
  touches: number;
  kind: "Support" | "Resistance";
  distancePct: number;
};

export type ChartPattern = {
  name: string;
  bias: "Bullish" | "Bearish" | "Neutral";
  startIndex: number;
  endIndex: number;
};

export type WeeklyBase = {
  startIndex: number;
  endIndex: number;
  startTimestamp: number;
  endTimestamp: number;
  weeks: number;
  high: number;
  low: number;
  depthPct: number;
  breakout: "Confirmed breakout" | "Potential base" | "Failed breakout";
  quality: "High" | "Medium" | "Low";
  breakoutVolumeMultiple: number;
};

const mean = (values: number[]) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function simpleMovingAverage(values: number[], period: number): (number | null)[] {
  return values.map((_, index) =>
    index + 1 < period ? null : mean(values.slice(index + 1 - period, index + 1)),
  );
}

export function exponentialMovingAverage(
  values: number[],
  period: number,
): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return result;
  let average = mean(values.slice(0, period));
  result[period - 1] = average;
  const multiplier = 2 / (period + 1);
  for (let index = period; index < values.length; index++) {
    average = (values[index] - average) * multiplier + average;
    result[index] = average;
  }
  return result;
}

export function relativeStrengthIndex(
  values: number[],
  period = 14,
): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return result;
  let gain = 0;
  let loss = 0;
  for (let index = 1; index <= period; index++) {
    const change = values[index] - values[index - 1];
    gain += Math.max(change, 0);
    loss += Math.max(-change, 0);
  }
  let averageGain = gain / period;
  let averageLoss = loss / period;
  result[period] =
    averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  for (let index = period + 1; index < values.length; index++) {
    const change = values[index] - values[index - 1];
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
    result[index] =
      averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }
  return result;
}

function rollingExtrema(values: number[], period: number, min: boolean) {
  return values.map((_, index) => {
    const start = Math.max(0, index + 1 - period);
    const window = values.slice(start, index + 1);
    return min ? Math.min(...window) : Math.max(...window);
  });
}

function exponentialMovingAverageNullable(
  values: (number | null)[],
  period: number,
): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  const firstValid = values.findIndex((value) => value != null);
  if (firstValid < 0 || values.length - firstValid < period) return result;

  const seed = values.slice(firstValid, firstValid + period);
  if (seed.some((value) => value == null)) return result;
  let average = mean(seed as number[]);
  const firstAverageIndex = firstValid + period - 1;
  result[firstAverageIndex] = average;
  const multiplier = 2 / (period + 1);
  for (let index = firstAverageIndex + 1; index < values.length; index++) {
    const value = values[index];
    if (value == null) continue;
    average += (value - average) * multiplier;
    result[index] = average;
  }
  return result;
}

function wilderAverage(values: (number | null)[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  let seed: number[] = [];
  let average: number | null = null;
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (value == null) {
      seed = [];
      average = null;
      continue;
    }
    if (average == null) {
      seed.push(value);
      if (seed.length === period) {
        average = mean(seed);
        result[index] = average;
      }
      continue;
    }
    average = (average * (period - 1) + value) / period;
    result[index] = average;
  }
  return result;
}

function calculateKdj(bars: OhlcvBar[]) {
  const highest = rollingExtrema(bars.map((bar) => bar.high), 9, false);
  const lowest = rollingExtrema(bars.map((bar) => bar.low), 9, true);
  const kValues: (number | null)[] = new Array(bars.length).fill(null);
  const dValues: (number | null)[] = new Array(bars.length).fill(null);
  const jValues: (number | null)[] = new Array(bars.length).fill(null);
  let k = 50;
  let d = 50;
  for (let index = 8; index < bars.length; index++) {
    const range = highest[index] - lowest[index];
    const rsv = range === 0 ? 50 : ((bars[index].close - lowest[index]) / range) * 100;
    k = (2 * k + rsv) / 3;
    d = (2 * d + k) / 3;
    kValues[index] = k;
    dValues[index] = d;
    jValues[index] = 3 * k - 2 * d;
  }
  return { k: kValues, d: dValues, j: jValues };
}

function calculateDmi(bars: OhlcvBar[]) {
  const trueRanges: (number | null)[] = new Array(bars.length).fill(null);
  const positiveMoves: (number | null)[] = new Array(bars.length).fill(null);
  const negativeMoves: (number | null)[] = new Array(bars.length).fill(null);
  for (let index = 1; index < bars.length; index++) {
    const current = bars[index];
    const previous = bars[index - 1];
    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;
    trueRanges[index] = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close),
    );
    positiveMoves[index] = upMove > downMove && upMove > 0 ? upMove : 0;
    negativeMoves[index] = downMove > upMove && downMove > 0 ? downMove : 0;
  }

  const averageTrueRange = wilderAverage(trueRanges, 14);
  const averagePositiveMove = wilderAverage(positiveMoves, 14);
  const averageNegativeMove = wilderAverage(negativeMoves, 14);
  const positiveDi = bars.map((_, index) => {
    const atr = averageTrueRange[index];
    const move = averagePositiveMove[index];
    return atr == null || move == null || atr === 0 ? null : (move / atr) * 100;
  });
  const negativeDi = bars.map((_, index) => {
    const atr = averageTrueRange[index];
    const move = averageNegativeMove[index];
    return atr == null || move == null || atr === 0 ? null : (move / atr) * 100;
  });
  const dx = bars.map((_, index) => {
    const plus = positiveDi[index];
    const minus = negativeDi[index];
    if (plus == null || minus == null || plus + minus === 0) return null;
    return (Math.abs(plus - minus) / (plus + minus)) * 100;
  });
  return { positiveDi, negativeDi, adx: wilderAverage(dx, 14) };
}

function calculateBrar(bars: OhlcvBar[]) {
  const ar: (number | null)[] = new Array(bars.length).fill(null);
  const br: (number | null)[] = new Array(bars.length).fill(null);
  for (let index = 0; index < bars.length; index++) {
    if (index < 25) continue;
    const start = Math.max(0, index - 25);
    let arUp = 0;
    let arDown = 0;
    let brUp = 0;
    let brDown = 0;
    for (let cursor = start; cursor <= index; cursor++) {
      const bar = bars[cursor];
      arUp += bar.high - bar.open;
      arDown += bar.open - bar.low;
      if (cursor > 0) {
        const previousClose = bars[cursor - 1].close;
        brUp += Math.max(0, bar.high - previousClose);
        brDown += Math.max(0, previousClose - bar.low);
      }
    }
    ar[index] = arDown === 0 ? null : (arUp / arDown) * 100;
    br[index] = brDown === 0 ? null : (brUp / brDown) * 100;
  }
  return { ar, br };
}

function calculateEmv(bars: OhlcvBar[]) {
  const emv: (number | null)[] = new Array(bars.length).fill(null);
  for (let index = 1; index < bars.length; index++) {
    const current = bars[index];
    const previous = bars[index - 1];
    const midpointMove =
      (current.high + current.low - previous.high - previous.low) / 2;
    const priceRange = current.high - current.low;
    const boxRatio =
      priceRange === 0 ? 0 : current.volume / 100_000_000 / priceRange;
    emv[index] = boxRatio === 0 ? null : midpointMove / boxRatio;
  }
  return { emv, average: simpleMovingAverageNullable(emv, 14) };
}

function simpleMovingAverageNullable(
  values: (number | null)[],
  period: number,
): (number | null)[] {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    const window = values.slice(index + 1 - period, index + 1);
    return window.some((value) => value == null) ? null : mean(window as number[]);
  });
}

function calcParabolicSar(bars: OhlcvBar[]): (number | null)[] {
  const result: (number | null)[] = new Array(bars.length).fill(null);
  if (bars.length < 2) return result;
  let rising = bars[1].close >= bars[0].close;
  let extreme = rising ? Math.max(bars[0].high, bars[1].high) : Math.min(bars[0].low, bars[1].low);
  let sar = rising ? Math.min(bars[0].low, bars[1].low) : Math.max(bars[0].high, bars[1].high);
  let acceleration = 0.02;
  result[1] = sar;
  for (let index = 2; index < bars.length; index++) {
    sar += acceleration * (extreme - sar);
    if (rising) {
      sar = Math.min(sar, bars[index - 1].low, bars[index - 2].low);
      if (bars[index].low < sar) {
        rising = false;
        sar = extreme;
        extreme = bars[index].low;
        acceleration = 0.02;
      } else if (bars[index].high > extreme) {
        extreme = bars[index].high;
        acceleration = Math.min(0.2, acceleration + 0.02);
      }
    } else {
      sar = Math.max(sar, bars[index - 1].high, bars[index - 2].high);
      if (bars[index].high > sar) {
        rising = true;
        sar = extreme;
        extreme = bars[index].high;
        acceleration = 0.02;
      } else if (bars[index].low < extreme) {
        extreme = bars[index].low;
        acceleration = Math.min(0.2, acceleration + 0.02);
      }
    }
    result[index] = sar;
  }
  return result;
}

export const INDICATORS = [
  { id: "ma", label: "MA (Moving Average)", group: "Main" },
  { id: "ema", label: "EMA (Exponential Moving Average)", group: "Main" },
  { id: "sma", label: "SMA (Simple Moving Average)", group: "Main" },
  { id: "boll", label: "BOLL (Bollinger Bands)", group: "Main" },
  { id: "sar", label: "SAR (Stop And Reverse)", group: "Main" },
  { id: "bbi", label: "BBI (Bull And Bear Index)", group: "Main" },
  { id: "vol", label: "VOL (Volume)", group: "Sub" },
  { id: "macd", label: "MACD", group: "Sub" },
  { id: "kdj", label: "KDJ", group: "Sub" },
  { id: "rsi", label: "RSI (Relative Strength Index)", group: "Sub" },
  { id: "bias", label: "BIAS (Bias Ratio)", group: "Sub" },
  { id: "brar", label: "BRAR (Emotion Index)", group: "Sub" },
  { id: "cci", label: "CCI (Commodity Channel Index)", group: "Sub" },
  { id: "dmi", label: "DMI (Directional Movement Index)", group: "Sub" },
  { id: "cr", label: "CR (Energy Index)", group: "Sub" },
  { id: "psy", label: "PSY (Psychological Line)", group: "Sub" },
  { id: "dma", label: "DMA (Different of Moving Average)", group: "Sub" },
  { id: "trix", label: "TRIX (Triple Smoothed EMA)", group: "Sub" },
  { id: "obv", label: "OBV (On Balance Volume)", group: "Sub" },
  { id: "vr", label: "VR (Volume Ratio)", group: "Sub" },
  { id: "wr", label: "WR (Williams %R)", group: "Sub" },
  { id: "mtm", label: "MTM (Momentum Index)", group: "Sub" },
  { id: "emv", label: "EMV (Ease of Movement)", group: "Sub" },
  { id: "roc", label: "ROC (Price Rate of Change)", group: "Sub" },
  { id: "pvt", label: "PVT (Price and Volume Trend)", group: "Sub" },
  { id: "avp", label: "AVP (Average Price)", group: "Sub" },
  { id: "ao", label: "AO (Awesome Oscillator)", group: "Sub" },
] as const;

export type IndicatorId = (typeof INDICATORS)[number]["id"];

export function calculateIndicator(
  bars: OhlcvBar[],
  indicator: IndicatorId,
): (number | null)[] {
  const closes = bars.map((bar) => bar.close);
  const highs = bars.map((bar) => bar.high);
  const lows = bars.map((bar) => bar.low);
  const volumes = bars.map((bar) => bar.volume);
  const sma = (period: number) => simpleMovingAverage(closes, period);
  const ema = (period: number) => exponentialMovingAverage(closes, period);

  switch (indicator) {
    case "ma":
    case "sma":
      return sma(20);
    case "ema":
      return ema(20);
    case "boll": {
      const averages = sma(20);
      return averages.map((average, index) => {
        if (average == null) return null;
        const window = closes.slice(index - 19, index + 1);
        const deviation = Math.sqrt(mean(window.map((price) => (price - average) ** 2)));
        return average + 2 * deviation;
      });
    }
    case "sar":
      return calcParabolicSar(bars);
    case "bbi": {
      const averages = [3, 6, 12, 24].map((period) => sma(period));
      return bars.map((_, index) => {
        const values = averages.map((line) => line[index]);
        return values.every((value) => value != null)
          ? mean(values as number[])
          : null;
      });
    }
    case "vol":
      return volumes;
    case "rsi":
      return relativeStrengthIndex(closes);
    case "macd": {
      const fast = ema(12);
      const slow = ema(26);
      return fast.map((value, index) =>
        value == null || slow[index] == null ? null : value - (slow[index] as number),
      );
    }
    case "kdj":
      return calculateKdj(bars).k;
    case "wr": {
      const highest = rollingExtrema(highs, 14, false);
      const lowest = rollingExtrema(lows, 14, true);
      return bars.map((bar, index) =>
        index < 13 || highest[index] === lowest[index]
          ? null
          : ((highest[index] - bar.close) / (highest[index] - lowest[index])) * -100,
      );
    }
    case "bias": {
      const average = sma(20);
      return average.map((value, index) =>
        value == null || value === 0 ? null : ((closes[index] - value) / value) * 100,
      );
    }
    case "cci": {
      const typical = bars.map((bar) => (bar.high + bar.low + bar.close) / 3);
      return typical.map((value, index) => {
        if (index < 19) return null;
        const window = typical.slice(index - 19, index + 1);
        const average = mean(window);
        const deviation = mean(window.map((entry) => Math.abs(entry - average)));
        return deviation === 0 ? 0 : (value - average) / (0.015 * deviation);
      });
    }
    case "psy":
      return closes.map((_, index) => {
        if (index < 12) return null;
        let advancing = 0;
        for (let cursor = index - 11; cursor <= index; cursor++) {
          if (closes[cursor] > closes[cursor - 1]) advancing++;
        }
        return (advancing / 12) * 100;
      });
    case "dma": {
      const short = sma(10);
      const long = sma(50);
      return short.map((value, index) =>
        value == null || long[index] == null ? null : value - (long[index] as number),
      );
    }
    case "trix": {
      const first = exponentialMovingAverage(closes, 12);
      const second = exponentialMovingAverageNullable(first, 12);
      const third = exponentialMovingAverageNullable(second, 12);
      return third.map((value, index) =>
        value == null || index === 0 || third[index - 1] == null || third[index - 1] === 0
          ? null
          : ((value - (third[index - 1] as number)) / (third[index - 1] as number)) * 100,
      );
    }
    case "obv": {
      let total = 0;
      return bars.map((bar, index) => {
        if (index > 0) {
          if (bar.close > bars[index - 1].close) total += bar.volume;
          else if (bar.close < bars[index - 1].close) total -= bar.volume;
        }
        return total;
      });
    }
    case "vr": {
      return bars.map((_, index) => {
        if (index < 26) return null;
        let up = 0;
        let down = 0;
        let unchanged = 0;
        for (let cursor = index - 25; cursor <= index; cursor++) {
          if (closes[cursor] > closes[cursor - 1]) up += volumes[cursor];
          else if (closes[cursor] < closes[cursor - 1]) down += volumes[cursor];
          else unchanged += volumes[cursor];
        }
        return down + unchanged / 2 === 0 ? null : ((up + unchanged / 2) / (down + unchanged / 2)) * 100;
      });
    }
    case "mtm":
    case "roc":
      return closes.map((close, index) =>
        index < 10
          ? null
          : indicator === "mtm"
            ? close - closes[index - 10]
            : closes[index - 10] === 0
              ? null
              : ((close - closes[index - 10]) / closes[index - 10]) * 100,
      );
    case "pvt": {
      let total = 0;
      return bars.map((bar, index) => {
        if (index > 0 && closes[index - 1] !== 0) {
          total += ((bar.close - closes[index - 1]) / closes[index - 1]) * bar.volume;
        }
        return total;
      });
    }
    case "avp":
      return bars.map((bar) => (bar.high + bar.low + bar.close) / 3);
    case "ao": {
      const median = bars.map((bar) => (bar.high + bar.low) / 2);
      const fast = simpleMovingAverage(median, 5);
      const slow = simpleMovingAverage(median, 34);
      return fast.map((value, index) =>
        value == null || slow[index] == null ? null : value - (slow[index] as number),
      );
    }
    case "brar":
      return calculateBrar(bars).ar;
    case "dmi":
      return calculateDmi(bars).positiveDi;
    case "cr":
      return bars.map((_, index) => {
        if (index < 26) return null;
        let numerator = 0;
        let denominator = 0;
        for (let cursor = index - 25; cursor <= index; cursor++) {
          const previous = bars[cursor - 1];
          if (!previous) continue;
          const previousMidpoint = (previous.high + previous.low) / 2;
          numerator += Math.max(0, bars[cursor].high - previousMidpoint);
          denominator += Math.max(0, previousMidpoint - bars[cursor].low);
        }
        return denominator === 0 ? null : (numerator / denominator) * 100;
      });
    case "emv":
      return calculateEmv(bars).emv;
  }

  throw new Error(`Unsupported indicator: ${indicator}`);
}

export type IndicatorComponent = {
  name: string;
  values: (number | null)[];
  color: string;
  style?: "line" | "histogram";
};

export function calculateIndicatorComponents(
  bars: OhlcvBar[],
  indicator: IndicatorId,
): IndicatorComponent[] {
  if (indicator === "macd") {
    const closes = bars.map((bar) => bar.close);
    const fast = exponentialMovingAverage(closes, 12);
    const slow = exponentialMovingAverage(closes, 26);
    const macd = fast.map((value, index) =>
      value == null || slow[index] == null ? null : value - slow[index]!,
    );
    const signal = exponentialMovingAverageNullable(macd, 9);
    const histogram = macd.map((value, index) =>
      value == null || signal[index] == null ? null : 2 * (value - signal[index]!),
    );
    return [
      { name: "DIF", values: macd, color: "#f59e0b" },
      { name: "DEA", values: signal, color: "#3b82f6" },
      { name: "Histogram", values: histogram, color: "#22c55e", style: "histogram" },
    ];
  }
  if (indicator === "kdj") {
    const { k, d, j } = calculateKdj(bars);
    return [
      { name: "K", values: k, color: "#f59e0b" },
      { name: "D", values: d, color: "#3b82f6" },
      { name: "J", values: j, color: "#a855f7" },
    ];
  }
  if (indicator === "dmi") {
    const { positiveDi, negativeDi, adx } = calculateDmi(bars);
    return [
      { name: "+DI", values: positiveDi, color: "#22c55e" },
      { name: "-DI", values: negativeDi, color: "#ef4444" },
      { name: "ADX", values: adx, color: "#3b82f6" },
    ];
  }
  if (indicator === "brar") {
    const { ar, br } = calculateBrar(bars);
    return [
      { name: "AR", values: ar, color: "#f59e0b" },
      { name: "BR", values: br, color: "#3b82f6" },
    ];
  }
  if (indicator === "emv") {
    const { emv, average } = calculateEmv(bars);
    return [
      { name: "EMV", values: emv, color: "#f59e0b" },
      { name: "MA(14)", values: average, color: "#3b82f6" },
    ];
  }
  return [{
    name: INDICATORS.find((item) => item.id === indicator)?.label ?? indicator,
    values: calculateIndicator(bars, indicator),
    color: "#f59e0b",
  }];
}

function bodySize(bar: OhlcvBar) {
  return Math.abs(bar.close - bar.open);
}
function candleRange(bar: OhlcvBar) {
  return Math.max(bar.high - bar.low, Number.EPSILON);
}
function bullish(bar: OhlcvBar) {
  return bar.close > bar.open;
}

export function scanCandlestickPatterns(bars: OhlcvBar[], lookback = 60): CandlePattern[] {
  const matches: CandlePattern[] = [];
  const start = Math.max(1, bars.length - lookback);
  const push = (name: string, bias: CandlePattern["bias"], index: number, count: number, description: string) =>
    matches.push({ name, bias, index, bars: count, description });

  for (let index = start; index < bars.length; index++) {
    const current = bars[index];
    const previous = bars[index - 1];
    const range = candleRange(current);
    const body = bodySize(current);
    const upper = current.high - Math.max(current.open, current.close);
    const lower = Math.min(current.open, current.close) - current.low;
    if (body / range <= 0.1) push("Doji", "Neutral", index, 1, "Open and close are nearly equal, showing indecision.");
    if (body / range <= 0.3 && lower >= body * 2 && upper <= body) {
      push(bullish(current) ? "Hammer" : "Hanging man", bullish(current) ? "Bullish" : "Bearish", index, 1, "Small real body with a long lower shadow.");
    }
    if (body / range <= 0.3 && upper >= body * 2 && lower <= body) {
      push(bullish(current) ? "Inverted hammer" : "Shooting star", bullish(current) ? "Bullish" : "Bearish", index, 1, "Small real body with a long upper shadow.");
    }
    if (body / range >= 0.9 && upper / range <= 0.05 && lower / range <= 0.05) {
      push(bullish(current) ? "Bullish marubozu" : "Bearish marubozu", bullish(current) ? "Bullish" : "Bearish", index, 1, "Strong real body with very small shadows.");
    }
    if (body / range < 0.35 && upper / range > 0.25 && lower / range > 0.25) {
      push("Spinning top", "Neutral", index, 1, "Small real body with shadows on both sides.");
    }
    if (!bullish(previous) && bullish(current) && current.open <= previous.close && current.close >= previous.open && bodySize(current) >= bodySize(previous)) {
      push("Bullish engulfing", "Bullish", index, 2, "Bullish body engulfs the preceding bearish body.");
    }
    if (bullish(previous) && !bullish(current) && current.open >= previous.close && current.close <= previous.open && bodySize(current) >= bodySize(previous)) {
      push("Bearish engulfing", "Bearish", index, 2, "Bearish body engulfs the preceding bullish body.");
    }
    if (index >= 2) {
      const first = bars[index - 2];
      const midpoint = (first.open + first.close) / 2;
      const smallMiddle = bodySize(previous) < bodySize(first) * 0.5;
      if (!bullish(first) && smallMiddle && bullish(current) && current.close > midpoint) {
        push("Morning star", "Bullish", index, 3, "Three-candle reversal structure after a decline.");
      }
      if (bullish(first) && smallMiddle && !bullish(current) && current.close < midpoint) {
        push("Evening star", "Bearish", index, 3, "Three-candle reversal structure after a rise.");
      }
      const three = bars.slice(index - 2, index + 1);
      if (three.every(bullish) && three[0].close < three[1].close && three[1].close < three[2].close) {
        push("Three white soldiers", "Bullish", index, 3, "Three consecutive advancing candles.");
      }
      if (three.every((bar) => !bullish(bar)) && three[0].close > three[1].close && three[1].close > three[2].close) {
        push("Three black crows", "Bearish", index, 3, "Three consecutive declining candles.");
      }
      if (!bullish(first) && bullish(current) && current.open < first.low && current.close > (first.open + first.close) / 2 && current.close < first.open) {
        push("Piercing line", "Bullish", index, 2, "Bullish candle recovers more than half of prior bearish body.");
      }
      if (bullish(first) && !bullish(current) && current.open > first.high && current.close < (first.open + first.close) / 2 && current.close > first.open) {
        push("Dark cloud cover", "Bearish", index, 2, "Bearish candle retraces more than half of prior bullish body.");
      }
      if (!bullish(first) && bullish(current) && bodySize(previous) < bodySize(first) * 0.3 && current.close > (first.open + first.close) / 2) {
        push("Three inside up", "Bullish", index, 3, "Inside candle followed by a close above the first candle.");
      }
      if (bullish(first) && !bullish(current) && bodySize(previous) < bodySize(first) * 0.3 && current.close < (first.open + first.close) / 2) {
        push("Three inside down", "Bearish", index, 3, "Inside candle followed by a close below the first candle.");
      }
    }
  }
  return matches.sort((a, b) => b.index - a.index);
}

export function findSupportResistance(bars: OhlcvBar[]): PriceLevel[] {
  if (bars.length < 5) return [];
  const pivots: number[] = [];
  const lookback = Math.min(250, bars.length);
  const start = bars.length - lookback;
  for (let index = Math.max(start + 2, 2); index < bars.length - 2; index++) {
    const current = bars[index];
    if (current.high >= Math.max(...bars.slice(index - 2, index + 3).map((bar) => bar.high))) pivots.push(current.high);
    if (current.low <= Math.min(...bars.slice(index - 2, index + 3).map((bar) => bar.low))) pivots.push(current.low);
  }
  const clusters: { price: number; count: number }[] = [];
  for (const pivot of pivots.sort((a, b) => a - b)) {
    const cluster = clusters.find((item) => Math.abs(item.price - pivot) / pivot <= 0.012);
    if (cluster) {
      cluster.price = (cluster.price * cluster.count + pivot) / (cluster.count + 1);
      cluster.count++;
    } else clusters.push({ price: pivot, count: 1 });
  }
  const currentPrice = bars[bars.length - 1].close;
  return clusters
    .filter((cluster) => cluster.count >= 2)
    .map((cluster) => ({
      price: cluster.price,
      touches: cluster.count,
      kind: (cluster.price >= currentPrice ? "Resistance" : "Support") as PriceLevel["kind"],
      distancePct: ((cluster.price - currentPrice) / currentPrice) * 100,
    }))
    .sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct))
    .slice(0, 12);
}

export function findChartPatterns(bars: OhlcvBar[]): ChartPattern[] {
  const matches: ChartPattern[] = [];
  const windowSize = Math.min(40, bars.length);
  if (windowSize < 12) return matches;
  for (let end = windowSize - 1; end < bars.length; end += Math.max(5, Math.floor(windowSize / 3))) {
    const start = end - windowSize + 1;
    const window = bars.slice(start, end + 1);
    const highs = window.map((bar) => bar.high);
    const lows = window.map((bar) => bar.low);
    const high = Math.max(...highs);
    const low = Math.min(...lows);
    const depth = (high - low) / low;
    const firstHalfHigh = Math.max(...highs.slice(0, Math.floor(windowSize / 2)));
    const secondHalfHigh = Math.max(...highs.slice(Math.floor(windowSize / 2)));
    const firstHalfLow = Math.min(...lows.slice(0, Math.floor(windowSize / 2)));
    const secondHalfLow = Math.min(...lows.slice(Math.floor(windowSize / 2)));
    const tolerance = (high - low) * 0.12;
    if (depth <= 0.18) {
      matches.push({ name: "Rectangle", bias: "Neutral", startIndex: start, endIndex: end });
    }
    if (Math.abs(firstHalfHigh - secondHalfHigh) / high < 0.012 && Math.abs(firstHalfLow - secondHalfLow) / low < 0.025) {
      matches.push({ name: "Double top / bottom", bias: "Neutral", startIndex: start, endIndex: end });
    }
    const risingLows = firstHalfLow < secondHalfLow - tolerance * 0.15;
    const flatHighs = Math.abs(firstHalfHigh - secondHalfHigh) < tolerance;
    if (risingLows && flatHighs) {
      matches.push({ name: "Ascending triangle", bias: "Bullish", startIndex: start, endIndex: end });
    } else if (!risingLows && flatHighs && firstHalfLow > secondHalfLow + tolerance * 0.15) {
      matches.push({ name: "Descending triangle", bias: "Bearish", startIndex: start, endIndex: end });
    }
  }
  return matches.slice(-30);
}

function toWeekly(bars: OhlcvBar[]): OhlcvBar[] {
  const weeks = new Map<string, OhlcvBar>();
  for (const bar of bars) {
    const date = new Date(bar.timestamp * 1000);
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - day + 1);
    const key = date.toISOString().slice(0, 10);
    const current = weeks.get(key);
    if (!current) weeks.set(key, { ...bar });
    else {
      current.high = Math.max(current.high, bar.high);
      current.low = Math.min(current.low, bar.low);
      current.close = bar.close;
      current.volume += bar.volume;
    }
  }
  return [...weeks.values()];
}

export function findWeeklyBases(bars: OhlcvBar[], breakoutBufferPct = 0.5): WeeklyBase[] {
  const weekly = toWeekly(bars);
  const candidates: WeeklyBase[] = [];
  for (let weeks = 4; weeks <= 26; weeks++) {
    for (let start = 0; start + weeks <= weekly.length; start += Math.max(1, Math.floor(weeks / 2))) {
      const end = start + weeks - 1;
      const window = weekly.slice(start, end + 1);
      const high = Math.max(...window.map((bar) => bar.high));
      const low = Math.min(...window.map((bar) => bar.low));
      const depthPct = ((high - low) / high) * 100;
      if (depthPct > 25) continue;
      let breakoutIndex = -1;
      let breakout: WeeklyBase["breakout"] = "Potential base";
      for (let index = end + 1; index < weekly.length; index++) {
        if (weekly[index].close > high * (1 + breakoutBufferPct / 100)) {
          breakout = "Confirmed breakout";
          breakoutIndex = index;
          break;
        }
        if (weekly[index].close < low * (1 - breakoutBufferPct / 100)) {
          breakout = "Failed breakout";
          breakoutIndex = index;
          break;
        }
      }
      const priorVolumes = breakoutIndex < 0
        ? []
        : weekly.slice(Math.max(0, breakoutIndex - 20), breakoutIndex).map((bar) => bar.volume);
      const averagePriorVolume = mean(priorVolumes);
      const breakoutVolumeMultiple =
        breakoutIndex < 0 || averagePriorVolume === 0
          ? 0
          : weekly[breakoutIndex].volume / averagePriorVolume;
      candidates.push({
        startIndex: start,
        endIndex: end,
        startTimestamp: window[0].timestamp,
        endTimestamp: window[window.length - 1].timestamp,
        weeks,
        high,
        low,
        depthPct,
        breakout,
        quality: depthPct <= 12 && weeks >= 5 ? "High" : depthPct <= 20 ? "Medium" : "Low",
        breakoutVolumeMultiple,
      });
    }
  }
  return candidates
    .sort((a, b) => {
      const score = (base: WeeklyBase) =>
        (base.breakout === "Confirmed breakout" ? 100 : base.breakout === "Potential base" ? 20 : 0) +
        base.weeks -
        base.depthPct;
      return score(b) - score(a);
    })
    .slice(0, 30);
}

export function clampIndex(index: number, length: number) {
  return clamp(Math.round(index), 0, Math.max(0, length - 1));
}
