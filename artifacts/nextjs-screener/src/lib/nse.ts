/**
 * NSE India API helper — establishes a browser-like session before each call.
 * NSE requires cookies set from the homepage to accept API requests.
 */

export const NSE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  Referer: "https://www.nseindia.com/",
};

/** Establish NSE session cookie string */
async function getNseSession(): Promise<string> {
  const sessionRes = await fetch("https://www.nseindia.com", {
    headers: NSE_HEADERS,
    next: { revalidate: 0 },
  });
  const raw = sessionRes.headers.get("set-cookie") ?? "";
  return raw
    .split(",")
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

/** Fetch a JSON endpoint from NSE India with session cookies */
export async function fetchNseApi<T = unknown>(
  path: string,
  delayMs = 350,
): Promise<T> {
  const cookieStr = await getNseSession();
  await new Promise((r) => setTimeout(r, delayMs));
  const res = await fetch(`https://www.nseindia.com/api/${path}`, {
    headers: { ...NSE_HEADERS, Cookie: cookieStr },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`NSE API ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export interface NseBulkDeal {
  date?: string;
  symbol?: string;
  secName?: string;
  clientName?: string;
  buySell?: string;
  buyOrSellFlag?: string;
  quantityTraded?: number | string;
  wgtAvgPrice?: number | string;
  tradePrice?: number | string;
  remarks?: string;
}

type NseBulkDealResponse =
  | {
      data?: NseBulkDeal[];
      deals?: NseBulkDeal[];
      bulkDeals?: NseBulkDeal[];
    }
  | NseBulkDeal[];

export async function fetchNseBulkDeals(
  fromDate: string,
  toDate: string,
): Promise<NseBulkDeal[]> {
  let historyError: unknown;
  for (const from of dateVariants(fromDate)) {
    for (const to of dateVariants(toDate)) {
      const historyQuery = new URLSearchParams({ from, to });
      try {
        const response = await fetchNseApi<NseBulkDealResponse>(
          `historical/bulk-deals?${historyQuery}`,
        );
        const deals = getNseBulkDealRows(response);
        if (deals) return deals;
      } catch (error) {
        historyError = error;
      }
    }
  }
  console.warn("NSE historical bulk-deals endpoint failed; trying live deals", historyError);

  try {
    const response = await fetchNseApi<NseBulkDealResponse>("bulk-deals");
    const deals = getNseBulkDealRows(response);
    if (deals) {
      const start = parseNseDate(fromDate);
      const end = parseNseDate(toDate);
      return deals.filter((deal) => {
        const date = deal.date ? parseNseDate(deal.date) : null;
        return date != null && date >= start && date <= end;
      });
    }
  } catch (error) {
    console.warn("NSE live bulk-deals endpoint failed; trying archive endpoint", error);
  }

  const archiveQuery = new URLSearchParams({
    number: "500",
    series: "EQ",
    from: fromDate,
    to: toDate,
    symbol: "",
    csv: "false",
  });
  const response = await fetchNseApi<NseBulkDealResponse>(
    `bulk-deal-archives?${archiveQuery}`,
  );
  const deals = getNseBulkDealRows(response);
  if (!deals) throw new Error("Unexpected NSE bulk deal response format");
  return deals;
}

function parseNseDate(value: string): number {
  const numericDate = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (numericDate) {
    return Date.UTC(
      Number(numericDate[3]),
      Number(numericDate[2]) - 1,
      Number(numericDate[1]),
    );
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid NSE deal date: ${value}`);
  }
  return timestamp;
}

function dateVariants(value: string): string[] {
  const dayFirst = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (dayFirst) {
    return [value, `${dayFirst[3]}-${dayFirst[2]}-${dayFirst[1]}`];
  }
  const yearFirst = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (yearFirst) {
    return [value, `${yearFirst[3]}-${yearFirst[2]}-${yearFirst[1]}`];
  }
  return [value];
}

function getNseBulkDealRows(
  response: NseBulkDealResponse,
): NseBulkDeal[] | null {
  if (Array.isArray(response)) return response;
  const rows = response.data ?? response.deals ?? response.bulkDeals;
  return Array.isArray(rows) ? rows : null;
}

/** Today and N days ago as "DD-MM-YYYY" strings */
export function nseDate(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
