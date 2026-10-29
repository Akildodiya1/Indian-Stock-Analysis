"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Newspaper, ExternalLink, Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { apiUrl } from "@/lib/api-url";

interface NewsItem {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
  relatedTickers?: string[];
}

const CATEGORIES = ["All", "Macro", "Earnings", "Corporate", "Regulatory", "Market"] as const;
type Category = (typeof CATEGORIES)[number];
type Sentiment = "bullish" | "bearish" | "neutral";

const MACRO_KW = ["rbi","repo rate","inflation","gdp","economy","fiscal","monetary","interest rate","credit policy","forex","rupee","dollar","import","export","trade deficit","budget","government","ministry","policy","niti aayog","election","geopolit"];
const EARN_KW = ["q1","q2","q3","q4","profit","revenue","earnings","results","net income","ebitda","pat","quarterly","annual report","dividend","fy2","fy25","fy26","turnover","loss","income"];
const CORP_KW = ["merger","acquisition","deal","board","ceo","ipo","buyback","stake","shares","fundraise","joint venture","partnership","subsidiary","demerger","listing","qip","fpo","rights issue"];
const REG_KW = ["sebi","regulation","compliance","penalty","fine","nse","bse","circular","framework","guidelines","reform","tax","gst","ban","order","probe","investigation","court","tribunal"];

// Sentiment NLP keyword lists
const BULLISH_KW = [
  "surge","rally","soar","rise","gain","jump","record","high","profit","growth","beat",
  "upgrade","outperform","buy","strong","positive","boost","expand","recover","breakout",
  "above","exceed","milestone","win","partner","order","contract","deal","revenue up",
  "net profit","roaring","optimistic","bullish","overweight","accumulate","top picks",
  "upside","beat estimates","raise target","dividend","bonus","buyback","up","green",
];
const BEARISH_KW = [
  "fall","drop","decline","crash","sell","loss","weak","negative","miss","poor","below",
  "cut","reduce","risk","concern","warning","downgrade","underperform","plunge","slump",
  "worry","debt","default","fraud","probe","penalty","fine","ban","suspend","close","down",
  "red","bearish","underweight","avoid","drag","write-off","impairment","resign","lawsuit",
  "losses","declining","pressure","headwind","downside","miss estimates","downgrade",
];

function analyzeSentiment(title: string): Sentiment {
  const t = title.toLowerCase();
  let bull = 0, bear = 0;
  for (const kw of BULLISH_KW) if (t.includes(kw)) bull++;
  for (const kw of BEARISH_KW) if (t.includes(kw)) bear++;
  if (bull > bear) return "bullish";
  if (bear > bull) return "bearish";
  return "neutral";
}

function classifyNews(title: string): Category {
  const t = title.toLowerCase();
  if (REG_KW.some(k => t.includes(k))) return "Regulatory";
  if (EARN_KW.some(k => t.includes(k))) return "Earnings";
  if (CORP_KW.some(k => t.includes(k))) return "Corporate";
  if (MACRO_KW.some(k => t.includes(k))) return "Macro";
  return "Market";
}

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const CATEGORY_COLOR: Record<Category, string> = {
  All: "bg-primary/10 text-primary",
  Macro: "bg-purple-500/10 text-purple-400",
  Earnings: "bg-green-500/10 text-green-400",
  Corporate: "bg-blue-500/10 text-blue-400",
  Regulatory: "bg-amber-500/10 text-amber-400",
  Market: "bg-secondary/60 text-muted-foreground",
};

const SENTIMENT_CONFIG: Record<Sentiment, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  bullish: { label: "Bullish", icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/10 border border-green-500/30" },
  bearish: { label: "Bearish", icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/10 border border-red-500/30" },
  neutral: { label: "Neutral", icon: Minus, color: "text-muted-foreground", bg: "bg-muted/60" },
};

type SentimentFilter = "all" | Sentiment;

export default function NewsPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");

  const { data: news = [], isLoading, isError, error } = useQuery<NewsItem[]>({
    queryKey: ["market", "news"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/market/news"));
      if (!response.ok) throw new Error(`Market news unavailable (HTTP ${response.status})`);
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const enriched = news.map(n => ({
    ...n,
    category: classifyNews(n.title),
    sentiment: analyzeSentiment(n.title),
  }));

  const filtered = enriched.filter(n => {
    if (activeCategory !== "All" && n.category !== activeCategory) return false;
    if (sentimentFilter !== "all" && n.sentiment !== sentimentFilter) return false;
    return true;
  });

  const counts: Record<string, number> = { All: news.length };
  for (const n of enriched) counts[n.category] = (counts[n.category] ?? 0) + 1;

  const sentimentCounts = { bullish: 0, bearish: 0, neutral: 0 };
  for (const n of enriched) sentimentCounts[n.sentiment]++;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          Market News
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Live NSE/BSE news with NLP sentiment analysis</p>
      </div>

      {/* Sentiment Summary */}
      {news.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {(["bullish", "bearish", "neutral"] as Sentiment[]).map(s => {
            const cfg = SENTIMENT_CONFIG[s];
            const Icon = cfg.icon;
            const count = sentimentCounts[s];
            const pct = news.length > 0 ? Math.round((count / news.length) * 100) : 0;
            return (
              <button
                key={s}
                onClick={() => setSentimentFilter(sentimentFilter === s ? "all" : s)}
                className={`rounded-lg p-3 text-left transition-colors ${sentimentFilter === s ? cfg.bg : "border bg-card hover:bg-accent/30"}`}
              >
                <div className={`flex items-center gap-1.5 text-xs font-bold mb-1 ${cfg.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {cfg.label}
                </div>
                <div className="text-lg font-bold tabular-nums">{count}</div>
                <div className="text-xs text-muted-foreground">{pct}% of articles</div>
                <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${s === "bullish" ? "bg-green-500" : s === "bearish" ? "bg-red-500" : "bg-gray-500"}`} style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              activeCategory === cat
                ? CATEGORY_COLOR[cat]
                : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {cat}
            {counts[cat] ? <span className="ml-1 opacity-60">({counts[cat]})</span> : null}
          </button>
        ))}
        {sentimentFilter !== "all" && (
          <button
            onClick={() => setSentimentFilter("all")}
            className="rounded-full px-3 py-1 text-xs font-semibold bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
          >
            ✕ Clear filter
          </button>
        )}
      </div>

      {/* News list */}
      <div className="rounded-lg border bg-card divide-y overflow-hidden">
        {isLoading ? (
          <div className="space-y-0 divide-y">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-4 w-24 rounded bg-accent/40 animate-pulse mb-2" />
                <div className="h-4 w-full rounded bg-accent/40 animate-pulse mb-1" />
                <div className="h-4 w-3/4 rounded bg-accent/30 animate-pulse" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-destructive" role="alert">
            {error instanceof Error ? error.message : "Market news is temporarily unavailable."}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            {news.length === 0 ? "No market news is available right now" : "No news in this category"}
          </div>
        ) : (
          filtered.map(item => {
            const sc = SENTIMENT_CONFIG[item.sentiment];
            const SIcon = sc.icon;
            return (
              <div key={item.uuid} className="p-4 hover:bg-accent/20 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_COLOR[item.category as Category]}`}>
                        {item.category}
                      </span>
                      <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.bg} ${sc.color}`}>
                        <SIcon className="h-2.5 w-2.5" />
                        {sc.label}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(item.providerPublishTime)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">· {item.publisher}</span>
                    </div>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-left hover:text-primary transition-colors leading-snug block"
                    >
                      {item.title}
                    </a>
                    {(item.relatedTickers ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(item.relatedTickers ?? []).slice(0, 5).map(t => (
                          <span key={t} className="rounded bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5">
                            {t.replace(/\.(NS|BO)$/i, "")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <a href={item.link} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 p-1.5 rounded-md hover:bg-accent/60 text-muted-foreground hover:text-primary transition-colors">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
