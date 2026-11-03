import { NextResponse } from "next/server";
import { cache } from "@/lib/cache";

const NSE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Referer": "https://www.nseindia.com/",
};

interface FiiDiiRecord {
  category: string;
  buyValue: string;
  sellValue: string;
  netValue: string;
  date?: string;
}

async function fetchFiiDii() {
  // Step 1: Establish session with NSE
  const sessionRes = await fetch("https://www.nseindia.com", {
    headers: NSE_HEADERS,
    next: { revalidate: 0 },
  });
  const cookies = sessionRes.headers.get("set-cookie") ?? "";
  const cookieStr = cookies.split(",").map(c => c.split(";")[0]).join("; ");

  await new Promise(r => setTimeout(r, 400));

  // Step 2: Fetch FII/DII data
  const res = await fetch("https://www.nseindia.com/api/fiidiiTradeReact", {
    headers: { ...NSE_HEADERS, "Cookie": cookieStr },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`NSE FII/DII: ${res.status}`);
  const raw = await res.json() as FiiDiiRecord[];
  if (!Array.isArray(raw)) throw new Error("Unexpected NSE FII/DII response format");

  return raw.map((record) => {
    const parseValue = (value: string) => {
      const parsed = Number.parseFloat(value.replace(/,/g, ""));
      if (!Number.isFinite(parsed)) throw new Error("Invalid NSE FII/DII numeric value");
      return parsed;
    };
    return {
      category: record.category?.replace("*", "").trim() ?? "—",
      buyValue: parseValue(record.buyValue),
      sellValue: parseValue(record.sellValue),
      netValue: parseValue(record.netValue),
      date: record.date ?? null,
    };
  });
}

export async function GET() {
  try {
    const data = await cache.getOrSet("market:fii-dii", () => fetchFiiDii(), 10 * 60 * 1000);
    return NextResponse.json(data);
  } catch (error) {
    console.error("FII/DII data is unavailable", error);
    return NextResponse.json({ error: "FII/DII data is temporarily unavailable" }, { status: 502 });
  }
}
