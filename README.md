# Indian Stock Screener — Project README / Dev Log

This file documents the full history of this project: what was built, in what order,
what was tested, what broke, and how it was fixed. It exists so any future
contributor — human or AI — can pick up the project without re-discovering the
same bugs or re-asking the same questions.

For a quick technical overview (stack, run commands, folder layout), see `replit.md`.
This file is the **story**, not the reference sheet.

---

## 1. What this project is

A personal-use, full-stack **Indian stock market screener and analytics dashboard**
("FinTrack" — dark navy theme) covering NSE/BSE equities, indices, sectors, gold ETFs,
forex, and FII/DII institutional flows. Built with Next.js 15 App Router, PostgreSQL,
and free Yahoo Finance / NSE India data sources — no paid API keys, no login/auth.

The workspace contains one product artifact:

- **`artifacts/nextjs-screener`** — the actively developed app mounted at `/` on port 24507.

The canvas preview service is infrastructure for visual mockups and is not a second product app.

---

## 2. Timeline of work (chronological)

### Phase 0 — Foundation
- Initial commit: scaffolded the Next.js app, PostgreSQL schema (watchlist table via
  Drizzle ORM), and the core Yahoo Finance client (`src/lib/yahoo-finance.ts`).
- Built server-side in-memory TTL caching (`src/lib/cache.ts`) early on, because Yahoo
  Finance/NSE calls are slow and rate-limit-sensitive. Market data: 60s TTL,
  fundamentals: 5min TTL, screener quotes: 2min TTL.

### Phase 1 — Core 13 features (original scope)
Built and verified working end-to-end:
1. **Market Overview** — Nifty 50, Sensex, Bank Nifty, IT, Auto, Pharma index cards + top gainers/losers/most-active.
2. **Stock Screener** — filter 109+ NSE stocks by exchange, sector, P/E, P/B, market cap; sortable.
3. **Stock Detail** — live price, OHLCV stats, 52-week range, price chart with period selector.
4. **RSI(14) chart** — computed client-side from OHLCV history.
5. **Fundamentals panel** — analyst consensus, computed via Yahoo `quoteSummary` v10 (needs a session crumb).
6. **Watchlist** — PostgreSQL-backed; add/remove stocks, live price refresh.
7. **News** — headlines + sentiment tagging per stock.
8. **Scans** — pre-built technical/fundamental scan presets.
9. **Portfolio** — manual holdings tracker.
10. **Alerts** — price alert configuration (client-side, no push notifications).
11. **Calendar** — economic/earnings calendar events.
12. **Sectors** — heatmap, RRG (relative rotation graph) chart, sector performance, sector indices.
13. **Navbar/Sidebar shell** — grouped navigation, dark navy theme throughout.

All 13 verified via screenshots and manual API checks (HTTP 200 on every route).

### Phase 2 — 4 new features (this session's main task)
Added on top of the working core:

1. **Forex / USD-INR page** (`/forex`, `api/market/forex`) — 10 major currency pairs.
2. **Gold ETFs by NSE** (`/gold-etf`, `api/market/gold-etf`) — live NSE gold ETF prices, 1M return, 52W range, volume, sparkline trend.
3. **FII/DII activity** (`/fii-dii`, `api/market/fii-dii`) — Foreign/Domestic Institutional Investor daily net buy/sell flows, sourced from NSE India's `fiidiiTradeReact` endpoint.
4. **Formula query screener** (`/query`, `api/screener/advanced`) — a `screener.in`-style screener where you write filter expressions against a 95–109-stock dataset, with 9 preset queries.

Sidebar was reorganized into groups: **Markets** (Market, Sectors, FII/DII, Forex/USD-INR, Gold ETFs), **Screener** (Screener, Query Screener, Scans), **Portfolio** (Watchlist, Portfolio, Alerts), **Research** (News, Calendar).

### Phase 3 — Bug hunt and fixes (this session)
After building the 4 new features, every page in the app was re-verified end-to-end
with live screenshots and curl checks. Two real bugs were found and fixed:

#### Bug 1: Gold ETF page only showed 4 of 10 funds
- **Symptom:** the Gold ETFs table rendered only 4 rows instead of the expected list.
- **Root cause:** 6 of the 10 hardcoded NSE ETF ticker symbols didn't actually exist on
  Yahoo Finance's chart API and returned HTTP 404: `HDFCMFGETF.NS`, `ICICIPHYGLD.NS`,
  `SBIGOLD.NS`, `KOTAKGOLD.NS`, `ABSLGOLDETF.NS`, `CRMFGOLD.NS`. Yahoo's actual ticker
  suffixes for these funds don't match their NSE trading symbols.
- **How it was diagnosed:** brute-force curl'd each candidate symbol against
  `https://query1.finance.yahoo.com/v8/finance/chart/<SYMBOL>?interval=1d&range=1d`
  and checked the HTTP status, then cross-checked `shortName` in the JSON response to
  confirm each surviving symbol was actually a gold ETF (not some unrelated fund).
- **Fix:** replaced the broken symbols with 8 verified working ones: `GOLDBEES.NS`
  (Nippon India), `AXISGOLD.NS` (Axis), `HDFCGOLD.NS` (HDFC — correct suffix, not
  `HDFCMFGETF.NS`), `GOLDIETF.NS` (ICICI Prudential — correct suffix, not
  `ICICIPHYGLD.NS`), `MGOLD.NS` (Motilal Oswal), `QGOLDHALF.NS` (Quantum),
  `BSLGOLDETF.NS` (Bandhan/BSL), `LICMFGOLD.NS` (LIC Mutual Fund).
- **Lesson for future work:** never assume an NSE trading symbol maps 1:1 to a Yahoo
  Finance ticker suffix. Always verify with a live HTTP check before hardcoding a
  symbol list, especially for ETFs/mutual funds where naming conventions vary a lot
  between AMCs.

#### Bug 2: FII/DII hero cards showed blank on first load
- **Symptom:** the two big "FII / FPI" and "DII" summary cards at the top of the
  FII/DII page rendered empty/skeleton for several seconds (and looked broken in
  quick screenshots), even though the chart below them displayed fine.
- **Root cause:** the NSE India API requires establishing a session (fetching
  `nseindia.com` first to get cookies, waiting ~400ms, then calling
  `/api/fiidiiTradeReact` with those cookies) before it returns real data. That
  round trip takes 3–5 seconds on a cold cache. During that window, React Query's
  `data` was `undefined`, so the hero cards' render condition (`if (!e && !isLoading) return null`)
  hid them entirely once `isLoading` briefly ticked to `false` before data resolved,
  and otherwise showed an empty skeleton.
- **How it was diagnosed:** confirmed via curl that the API endpoint itself returns
  correct, real data (`FII/FPI` and `DII` net values) — so the bug was purely a
  client-side loading-state/UX issue, not a data problem.
- **Fix:** removed fabricated FII/DII placeholder values and the generated weekly
  history chart. The page now shows live NSE data only and reports when the source
  is unavailable.
- **Lesson for future work:** any page that depends on NSE India's session-cookie
  dance can have a multi-second cold-start delay. Use a clear loading state rather
  than presenting placeholder values as market data.

### Phase 4 — Full regression pass (this session, final)
The market screener and heatmap now load the live Yahoo Finance NSE equity universe
instead of a bundled stock sample. Market-data routes no longer substitute fabricated
records when NSE or Yahoo Finance is unavailable; they return an explicit error and
the affected page reports that live data could not be loaded.

### Phase 5 — EOD stock and index analytics
- Stock detail now supports five years of daily history and a Corporate Actions tab
  for Yahoo Finance dividend and split events.
- Added Index Analytics for daily close, period returns, five-year range, and drawdown
  across six configured benchmarks. Daily history and analytics use a 12-hour
  process-local cache; this is not durable EOD storage.
- The stock screener can request both NSE and BSE listings. If one exchange source
  fails, it displays available results and a partial-coverage warning.
- BSE announcements are not integrated: the official endpoint returned HTTP 403 in
  source-access checks, so no unverified or mock data is shown.

---

## 3. Known non-issues (do not "fix" these again)

These look like problems but are expected/harmless — documented so nobody wastes time
re-investigating them:

- **Recharts sparkline console warning**: `"The width(X) and height(Y) are both fixed
  numbers, maybe you don't need to use a ResponsiveContainer."` — appears on every
  sparkline mini-chart (Gold ETF trend column, etc.). Purely a console warning, no
  visual or functional effect. Pre-existing since the sparklines were added.
- **Fundamentals panel sometimes shows "—" for PE/PB/ROE**: `fetchQuotes` (Yahoo chart
  API v8) only returns price/change/volume/52w range — it does NOT return fundamentals.
  Fundamentals come from a separate `quoteSummary` v10 call that needs a session
  "crumb." If that crumb fetch fails (Yahoo session expired), fundamentals silently
  come back empty. This is a non-fatal, expected fallback, not a bug to chase.
- **In-memory cache resets on every dev server restart** — expected. It's a per-process
  TTL cache (`src/lib/cache.ts`), not persisted anywhere. Don't try to "fix" data
  disappearing after a restart.
- **Pre-existing TypeScript warnings unrelated to new work**: `drizzle-orm` import
  typing quirks in portfolio/watchlist API routes, and an implicit `any` in
  `use-toast`. These existed before this session's work and were left alone since
  they don't affect runtime behavior.

---

## 4. Architecture decisions worth knowing

- **Next.js root mount**: the app owns `/` and its internal API routes own `/api`. All
  client fetches must go through `apiUrl('/...')` (`src/lib/api-url.ts`) so the artifact
  remains path-aware without relying on a separate API service.
- **Server-side caching over client caching**: because Yahoo/NSE endpoints are slow
  and can rate-limit, the TTL cache lives server-side (`cache.getOrSet(key, fn, ttlMs)`)
  so every user benefits from one shared fetch, not one per browser tab.
  React Query on the client is for request dedupe/refetch scheduling, not the source
  of truth for freshness.
- **`@workspace/db` imported directly into Next.js API routes** — no separate Express
  data layer needed for the primary app; only the legacy `api-server` artifact still
  uses Express.
- **Market data is live-only.** External source failures are returned as errors and
  shown as unavailable states; fabricated market values are not used as fallbacks.

---

## 5. Suggested next steps / open ideas

Not started yet — flagged here as a backlog for future sessions:

- Persist portfolio/alerts to PostgreSQL (currently client-side/in-memory-only for
  those two features, unlike the watchlist which is DB-backed).
- Real push/email notifications for price alerts (currently just UI, no delivery
  mechanism).
- Consider adding a durable shared cache for the full NSE equity feed to reduce
  repeated upstream requests across serverless cold starts.
- Consider periodic background refresh (e.g. a cron-like job) for FII/DII and Gold
  ETF data so the first user of the day doesn't pay the NSE session cold-start cost.

---

## 6. How to verify the app is healthy (quick checklist)

```bash
# 1. Typecheck everything
pnpm run typecheck

# 2. Confirm key API routes respond
curl -s localhost:80/api/market/overview
curl -s localhost:80/api/market/gold-etf
curl -s localhost:80/api/market/fii-dii
curl -s localhost:80/api/screener/advanced

# 3. Visually check pages via the screenshot tool for:
#    /, /screener, /stock/RELIANCE, /watchlist, /sectors,
#    /forex, /gold-etf, /fii-dii, /query
```

If a Yahoo Finance symbol ever starts 404ing again (AMCs occasionally rename or
delist ETFs), repeat the diagnosis method from Bug 1 above: curl the chart API
directly for that symbol and check the HTTP status before assuming the code is wrong.

---

## 7. Upstream sync notes (July 1, 2026)

A separate GitHub Copilot session had pushed commits directly to `origin/main`
independent of this workspace. Those commits were reconciled back in here:

- Reviewed backend fetch logic and Yahoo/NSE data handling for stock fundamentals
  and quote services.
- Confirmed Yahoo Finance requires a valid `cookie + crumb` for
  `query1/v7/finance/quote` and `query1/v10/finance/quoteSummary`; `v8/finance/chart`
  remains the most reliable endpoint for chart/quote data.
- Diagnosed an `HDFC.NS` edge case: Yahoo returns `quoteType: "NONE"` and no
  fundamentals for that ticker, while `HDFCBANK.NS` is the correct working symbol
  for HDFC Bank.
- Confirmed NSE India API access can be blocked from some hosts
  (`https://www.nseindia.com/api/quote-equity` returning `403 Forbidden`); the
  Yahoo Finance fallback path exists for this reason.
- Merged in the resulting source improvements: `fetchNseData`/`searchYahoo` helpers
  and a crumbless quote-fallback path in `yahoo-finance.ts`, live Yahoo-search-based
  stock listing in the screener API, NSE+quote fallback merging for the fundamentals
  API, and a search box on the screener page.
- Deliberately did **not** adopt that session's dependency/toolchain bumps (Next.js
  16, TypeScript 6.0, Tailwind 4.3, Windows-only native binaries like
  `@tailwindcss/oxide-win32-x64-msvc`) — those looked like accidental side effects of
  running `pnpm install` on Windows and would break installs in this Linux
  environment. If a real upgrade is wanted later, do it deliberately and test on
  Linux first.

---

*Last updated: July 1, 2026, after reconciling upstream Copilot-session commits
(Yahoo/NSE fundamentals fallback improvements, screener search).*
