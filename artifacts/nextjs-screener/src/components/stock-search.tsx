"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Search, TrendingUp, X } from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { displaySymbol } from "@/lib/format";

interface SearchResult {
  symbol: string;
  shortname: string;
  exchDisp: string;
  typeDisp?: string;
  sector?: string;
}

export function StockSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearchError, setHasSearchError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const results = remoteResults;
  const showDropdown = isOpen && query.trim().length > 0;

  useEffect(() => {
    const trimmedQuery = query.trim();
    requestRef.current?.abort();
    setRemoteResults([]);
    setHasSearchError(false);
    setActiveIndex(-1);

    if (trimmedQuery.length < 2) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setIsLoading(true);

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          apiUrl(`/stocks/search?q=${encodeURIComponent(trimmedQuery)}`),
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search request failed");
        const data = (await response.json()) as SearchResult[];
        if (!controller.signal.aborted) setRemoteResults(data);
      } catch {
        if (!controller.signal.aborted) {
          setRemoteResults([]);
          setHasSearchError(true);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    setQuery("");
    setRemoteResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
  }, [pathname]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.key === "/" && !isTypingTarget) {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  const goToStock = (result: SearchResult) => {
    setIsOpen(false);
    setQuery("");
    router.push(`/stock/${encodeURIComponent(result.symbol)}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      const selectedResult = results[activeIndex >= 0 ? activeIndex : 0];
      if (selectedResult) {
        event.preventDefault();
        goToStock(selectedResult);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div
        className={`flex h-10 items-center gap-2 rounded-lg border bg-card px-3 shadow-sm transition-colors ${
          showDropdown
            ? "border-primary/60 ring-2 ring-primary/10"
            : "border-border hover:border-primary/40"
        }`}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(event.target.value.trim().length > 0);
          }}
          onFocus={() => query.trim() && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search stocks by name or symbol..."
          aria-label="Search stocks by name or symbol"
          aria-expanded={showDropdown}
          aria-controls="stock-search-results"
          role="combobox"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Clear stock search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-block">
          /
        </kbd>
      </div>

      {showDropdown && (
        <div
          id="stock-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-70 overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
        >
          {isLoading ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm font-medium">Searching...</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Looking for matching stocks.
              </p>
            </div>
          ) : hasSearchError ? (
            <div role="alert" className="px-4 py-5 text-center">
              <p className="text-sm font-medium">Search is unavailable</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Live stock search could not be reached. Please try again.
              </p>
            </div>
          ) : results.length > 0 ? (
            <div className="p-1.5">
              <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Stocks
              </p>
              {results.map((result, index) => (
                <button
                  type="button"
                  key={`${result.symbol}-${index}`}
                  role="option"
                  aria-selected={activeIndex === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => goToStock(result)}
                  className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${
                    activeIndex === index ? "bg-accent" : "hover:bg-accent/70"
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {result.shortname || displaySymbol(result.symbol)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {displaySymbol(result.symbol)} · {result.exchDisp || "NSE"}
                    </span>
                  </span>
                  {result.sector && (
                    <span className="hidden max-w-32 truncate text-[10px] text-muted-foreground sm:block">
                      {result.sector}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-5 text-center">
              <p className="text-sm font-medium">No stocks found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try a company name or NSE symbol.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}