export type OptionType = "call" | "put";

export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export const OPTION_GREEKS_ASSUMPTIONS = {
  model: "Black-Scholes",
  riskFreeRate: 0.065,
  dividendYield: 0,
} as const;
const DAYS_PER_YEAR = 365;
const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function expiryTimestamp(expiry: string): number | undefined {
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(expiry);
  if (!match) return undefined;
  const month = MONTHS[match[2].toLowerCase()];
  if (month == null) return undefined;
  return Date.UTC(Number(match[3]), month, Number(match[1]), 10);
}

function normalPdf(value: number): number {
  return Math.exp(-0.5 * value * value) / Math.sqrt(2 * Math.PI);
}

function normalCdf(value: number): number {
  const absValue = Math.abs(value);
  const t = 1 / (1 + 0.2316419 * absValue);
  const polynomial =
    0.31938153 * t -
    0.356563782 * t ** 2 +
    1.781477937 * t ** 3 -
    1.821255978 * t ** 4 +
    1.330274429 * t ** 5;
  const tail = normalPdf(absValue) * polynomial;
  return value >= 0 ? 1 - tail : tail;
}

export function calculateOptionGreeks(
  spot: number,
  strike: number,
  impliedVolatilityPercent: number,
  expiry: string,
  type: OptionType,
): OptionGreeks | null {
  const expiryAt = expiryTimestamp(expiry);
  const timeToExpiry =
    expiryAt == null
      ? 0
      : (expiryAt - Date.now()) / (DAYS_PER_YEAR * 24 * 60 * 60 * 1000);
  const volatility = impliedVolatilityPercent / 100;
  if (
    !Number.isFinite(spot) ||
    !Number.isFinite(strike) ||
    !Number.isFinite(volatility) ||
    spot <= 0 ||
    strike <= 0 ||
    volatility <= 0 ||
    timeToExpiry <= 0
  ) {
    return null;
  }

  const sqrtTime = Math.sqrt(timeToExpiry);
  const discountRate = Math.exp(
    -OPTION_GREEKS_ASSUMPTIONS.riskFreeRate * timeToExpiry,
  );
  const discountDividend = Math.exp(
    -OPTION_GREEKS_ASSUMPTIONS.dividendYield * timeToExpiry,
  );
  const d1 =
    (Math.log(spot / strike) +
    (OPTION_GREEKS_ASSUMPTIONS.riskFreeRate -
      OPTION_GREEKS_ASSUMPTIONS.dividendYield +
      volatility ** 2 / 2) *
      timeToExpiry) /
    (volatility * sqrtTime);
  const d2 = d1 - volatility * sqrtTime;
  const density = normalPdf(d1);
  const gamma =
    (discountDividend * density) / (spot * volatility * sqrtTime);
  const vega = (spot * discountDividend * density * sqrtTime) / 100;

  if (type === "call") {
    return {
      delta: discountDividend * normalCdf(d1),
      gamma,
      theta:
        (-((spot * discountDividend * density * volatility) /
          (2 * sqrtTime)) -
          OPTION_GREEKS_ASSUMPTIONS.riskFreeRate *
            strike *
            discountRate *
            normalCdf(d2) +
          OPTION_GREEKS_ASSUMPTIONS.dividendYield *
            spot *
            discountDividend *
            normalCdf(d1)) /
        DAYS_PER_YEAR,
      vega,
      rho:
        (strike * timeToExpiry * discountRate * normalCdf(d2)) / 100,
    };
  }

  return {
    delta: discountDividend * (normalCdf(d1) - 1),
    gamma,
    theta:
      (-((spot * discountDividend * density * volatility) /
        (2 * sqrtTime)) +
        OPTION_GREEKS_ASSUMPTIONS.riskFreeRate *
          strike *
          discountRate *
          normalCdf(-d2) -
        OPTION_GREEKS_ASSUMPTIONS.dividendYield *
          spot *
          discountDividend *
          normalCdf(-d1)) /
      DAYS_PER_YEAR,
    vega,
    rho:
      (-strike * timeToExpiry * discountRate * normalCdf(-d2)) / 100,
  };
}
