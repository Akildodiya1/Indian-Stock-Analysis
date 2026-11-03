"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, ExternalLink } from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { displaySymbol } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface FilingRecord {
  symbol: string;
  company: string;
  category: string;
  subject: string;
  date: string;
  attachmentUrl: string | null;
}

const CATEGORIES = [
  "All",
  "Board Meeting",
  "Financial Results",
  "Dividend",
  "AGM",
  "Buyback",
  "M&A",
  "Promoter/Insider",
  "Credit Rating",
  "Record Date",
  "General",
];

function formatDateForApi(d: Date) {
  return `${d.getDate().toString().padStart(2, "0")}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getFullYear()}`;
}

export default function CorporateFilingsPage() {
  const [fromDateStr, setFromDateStr] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [toDateStr, setToDateStr] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  const [appliedFrom, setAppliedFrom] = useState(fromDateStr);
  const [appliedTo, setAppliedTo] = useState(toDateStr);
  const [category, setCategory] = useState("All");

  const apiFrom = useMemo(
    () => formatDateForApi(new Date(appliedFrom)),
    [appliedFrom],
  );
  const apiTo = useMemo(
    () => formatDateForApi(new Date(appliedTo)),
    [appliedTo],
  );

  const {
    data: filings = [],
    isLoading,
    isError,
  } = useQuery<FilingRecord[]>({
    queryKey: ["market", "corporate-filings", apiFrom, apiTo, category],
    queryFn: () => {
      let url = `/market/corporate-filings?from_date=${apiFrom}&to_date=${apiTo}`;
      if (category !== "All")
        url += `&category=${encodeURIComponent(category)}`;
      return fetch(apiUrl(url)).then(async (response) => {
        if (!response.ok)
          throw new Error("Corporate filing data request failed");
        return response.json();
      });
    },
  });

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filings.forEach((f) => {
      counts[f.category] = (counts[f.category] || 0) + 1;
    });
    return counts;
  }, [filings]);

  let lastDate = "";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          Corporate Filings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Latest NSE announcements and corporate disclosures
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={fromDateStr}
            onChange={(e) => setFromDateStr(e.target.value)}
            className="w-40"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="date"
            value={toDateStr}
            onChange={(e) => setToDateStr(e.target.value)}
            className="w-40"
          />
          <Button
            onClick={() => {
              setAppliedFrom(fromDateStr);
              setAppliedTo(toDateStr);
            }}
          >
            Apply
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              category === cat
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "bg-card text-muted-foreground hover:bg-accent border-border"
            }`}
          >
            {cat}{" "}
            {cat !== "All" && categoryCounts[cat] ? (
              <span className="ml-1 opacity-70">({categoryCounts[cat]})</span>
            ) : (
              ""
            )}
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {isError ? (
          <div
            role="alert"
            className="text-center py-16 text-amber-500 text-sm"
          >
            Live NSE corporate filing data is unavailable. Please try again
            later.
          </div>
        ) : isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Loading...
          </div>
        ) : filings.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No data available
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-37.5">Date/Time</TableHead>
                <TableHead className="min-w-50">Company</TableHead>
                <TableHead className="w-37.5">Category</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="w-12.5"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filings.map((filing, i) => {
                const dateOnly = filing.date.split(" ")[0];
                const showHeader = dateOnly !== lastDate;
                if (showHeader) lastDate = dateOnly;

                return (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {showHeader && (
                        <span className="font-bold text-foreground block mb-0.5">
                          {dateOnly}
                        </span>
                      )}
                      {filing.date.split(" ")[1] || filing.date}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-sm text-cyan-400">
                        {displaySymbol(filing.symbol)}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-45">
                        {filing.company}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-accent/50 text-xs font-normal border-accent"
                      >
                        {filing.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-100">
                      <div className="truncate text-sm" title={filing.subject}>
                        {filing.subject}
                      </div>
                    </TableCell>
                    <TableCell>
                      {filing.attachmentUrl && (
                        <a
                          href={filing.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center text-muted-foreground hover:text-cyan-400 transition-colors bg-accent/30 hover:bg-accent rounded-md h-8 w-8"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
