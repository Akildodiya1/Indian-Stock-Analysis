import { NextRequest, NextResponse } from "next/server";
import { fetchNseApi, nseDate } from "@/lib/nse";
import { cache } from "@/lib/cache";

export const dynamic = "force-dynamic";

interface NseAnnouncement {
  symbol?: string;
  desc?: string;
  subject?: string;
  exchdisstime?: string;
  attchmntFile?: string;
  smIndustry?: string;
  sm_name?: string;
  comp?: string;
}

export interface FilingRecord {
  symbol: string;
  company: string;
  category: string;
  subject: string;
  date: string;
  attachmentUrl: string | null;
}

function categorise(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes("board meeting")) return "Board Meeting";
  if (s.includes("result") || s.includes("financial")) return "Financial Results";
  if (s.includes("dividend")) return "Dividend";
  if (s.includes("agm") || s.includes("annual general")) return "AGM";
  if (s.includes("buyback")) return "Buyback";
  if (s.includes("acquisition") || s.includes("merger")) return "M&A";
  if (s.includes("insider") || s.includes("promoter")) return "Promoter/Insider";
  if (s.includes("credit") || s.includes("rating")) return "Credit Rating";
  if (s.includes("basmati") || s.includes("record date")) return "Record Date";
  return "General";
}

async function fetchFilings(fromDate: string, toDate: string): Promise<FilingRecord[]> {
  const raw = await fetchNseApi<NseAnnouncement[]>(
    `corporate-announcements?index=equities&from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`
  );
  if (!Array.isArray(raw)) throw new Error("Unexpected filings format");
  return raw.map((r) => ({
    symbol: r.symbol ?? "",
    company: r.sm_name ?? r.comp ?? r.symbol ?? "",
    category: categorise(r.subject ?? r.desc ?? ""),
    subject: r.subject ?? r.desc ?? "",
    date: r.exchdisstime ?? "",
    attachmentUrl: r.attchmntFile
      ? `https://www.nseindia.com/corporate/Notice_${r.attchmntFile}`
      : null,
  }));
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fromDate = sp.get("from_date") ?? nseDate(7);
  const toDate = sp.get("to_date") ?? nseDate();
  const category = sp.get("category") ?? "";
  const cacheKey = `market:corporate-filings:${fromDate}:${toDate}`;
  try {
    let data = await cache.getOrSet(cacheKey, () => fetchFilings(fromDate, toDate), 5 * 60 * 1000);
    if (category) data = data.filter((d) => d.category === category);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Corporate filing data is unavailable", error);
    return NextResponse.json({ error: "Corporate filing data is temporarily unavailable" }, { status: 502 });
  }
}
