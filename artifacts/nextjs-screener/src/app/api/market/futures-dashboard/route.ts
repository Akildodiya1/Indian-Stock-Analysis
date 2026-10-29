import { NextResponse } from "next/server";
import { fetchNseApi } from "@/lib/nse";
import { cache } from "@/lib/cache";
import {
  calculateOptionGreeks,
  OPTION_GREEKS_ASSUMPTIONS,
  type OptionGreeks,
} from "@/lib/option-greeks";

export const dynamic = "force-dynamic";

interface OptionEntry {
  openInterest?: number;
  changeinOpenInterest?: number;
  totalTradedVolume?: number;
  impliedVolatility?: number;
  lastPrice?: number;
  pChange?: number;
}

interface OptionChainRow {
  strikePrice?: number;
  expiryDate?: string;
  CE?: OptionEntry;
  PE?: OptionEntry;
}

interface OptionChainResponse {
  filtered?: {
    data?: OptionChainRow[];
    CE?: { totOI?: number; totVol?: number };
    PE?: { totOI?: number; totVol?: number };
  };
  records?: {
    expiryDates?: string[];
    underlyingValue?: number;
  };
}

export interface OiStrike {
  strike: number;
  callOI: number;
  putOI: number;
  callOIChange: number;
  putOIChange: number;
  callLTP: number;
  putLTP: number;
  callIV: number;
  putIV: number;
  callGreeks: OptionGreeks | null;
  putGreeks: OptionGreeks | null;
}

export interface FuturesDashboard {
  symbol: string;
  spotPrice: number;
  expiry: string;
  pcr: number;
  totalCallOI: number;
  totalPutOI: number;
  maxCallOIStrike: number;
  maxPutOIStrike: number;
  straddle: number;
  oiStrikes: OiStrike[];
  greeksAssumptions: {
    model: "Black-Scholes";
    riskFreeRate: number;
    dividendYield: number;
  };
}

async function fetchFuturesData(symbol: "NIFTY" | "BANKNIFTY"): Promise<FuturesDashboard> {
  const raw = await fetchNseApi<OptionChainResponse>(`option-chain-indices?symbol=${symbol}`);

  const rows = raw?.filtered?.data ?? [];
  const totalCallOI = raw?.filtered?.CE?.totOI ?? 0;
  const totalPutOI = raw?.filtered?.PE?.totOI ?? 0;
  const pcr = totalCallOI > 0 ? parseFloat((totalPutOI / totalCallOI).toFixed(3)) : 0;
  const spotPrice = raw?.records?.underlyingValue ?? 0;
  const expiry =
    raw?.records?.expiryDates?.find(
      (date) => Date.parse(date) >= new Date().setHours(0, 0, 0, 0),
    ) ?? "";
  if (rows.length === 0 || spotPrice <= 0 || !expiry) {
    throw new Error(`NSE returned incomplete ${symbol} option-chain data`);
  }

  let maxCallOI = 0, maxCallOIStrike = 0;
  let maxPutOI = 0, maxPutOIStrike = 0;

  const oiStrikes: OiStrike[] = rows.map((row) => {
    const callOI = row.CE?.openInterest ?? 0;
    const putOI = row.PE?.openInterest ?? 0;
    if (callOI > maxCallOI) { maxCallOI = callOI; maxCallOIStrike = row.strikePrice ?? 0; }
    if (putOI > maxPutOI) { maxPutOI = putOI; maxPutOIStrike = row.strikePrice ?? 0; }
    return {
      strike: row.strikePrice ?? 0,
      callOI,
      putOI,
      callOIChange: row.CE?.changeinOpenInterest ?? 0,
      putOIChange: row.PE?.changeinOpenInterest ?? 0,
      callLTP: row.CE?.lastPrice ?? 0,
      putLTP: row.PE?.lastPrice ?? 0,
      callIV: row.CE?.impliedVolatility ?? 0,
      putIV: row.PE?.impliedVolatility ?? 0,
      callGreeks: calculateOptionGreeks(
        spotPrice,
        row.strikePrice ?? 0,
        row.CE?.impliedVolatility ?? 0,
        expiry,
        "call",
      ),
      putGreeks: calculateOptionGreeks(
        spotPrice,
        row.strikePrice ?? 0,
        row.PE?.impliedVolatility ?? 0,
        expiry,
        "put",
      ),
    };
  });

  // ATM straddle price (call + put LTP at closest strike to spot)
  const atm = oiStrikes.reduce((best, s) =>
    Math.abs(s.strike - spotPrice) < Math.abs(best.strike - spotPrice) ? s : best,
    oiStrikes[0] ?? { strike: 0, callLTP: 0, putLTP: 0, callOI: 0, putOI: 0, callOIChange: 0, putOIChange: 0, callIV: 0, putIV: 0 }
  );
  const straddle = parseFloat(((atm?.callLTP ?? 0) + (atm?.putLTP ?? 0)).toFixed(2));

  return {
    symbol,
    spotPrice,
    expiry,
    pcr,
    totalCallOI,
    totalPutOI,
    maxCallOIStrike,
    maxPutOIStrike,
    straddle,
    oiStrikes: oiStrikes.slice(0, 30), // 15 strikes above + below ATM
    greeksAssumptions: OPTION_GREEKS_ASSUMPTIONS,
  };
}

export async function GET() {
  try {
    const [nifty, bankNifty] = await cache.getOrSet("market:futures-dashboard:v2", async () => {
      const [n, b] = await Promise.all([fetchFuturesData("NIFTY"), fetchFuturesData("BANKNIFTY")]);
      return [n, b];
    }, 2 * 60 * 1000);
    return NextResponse.json({ nifty, bankNifty });
  } catch (error) {
    console.error("NSE option-chain data is unavailable", error);
    return NextResponse.json(
      { error: "NSE option-chain data is temporarily unavailable" },
      { status: 502 },
    );
  }
}
