# FinTrack — Indian Stock Analytics

A full-stack Next.js 15 App Router app for Indian stock market analytics. Covers live NSE/BSE screening, market breadth, option chain analysis, sector rotation, bulk deals, corporate filings, promoter activity, quarterly results, FII/DII flows, and more — all with live Yahoo Finance + NSE India data and a PostgreSQL watchlist.

## Run & Operate

- `pnpm --filter @workspace/nextjs-screener run dev` — Next.js dev server (port 24507, path `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

### Deploy to Netlify

Connect the repository to Netlify with the repository root as the base directory.
The root `netlify.toml` builds the Next.js screener workspace and enables Netlify's
Next.js runtime for its server-rendered pages and API routes. Do not set the base
directory to `artifacts/nextjs-screener`; the app depends on workspace packages at
the repository root.

Set `DATABASE_URL` in Netlify's production environment to a reachable, persistent
PostgreSQL database, then apply the Drizzle schema with
`pnpm --filter @workspace/db run push` using that database URL. The local
`.env.local` file and local development database are not deployed to Netlify.

### Configure PostgreSQL for Watchlist and Portfolio

The watchlist and portfolio are stored in PostgreSQL. Create a PostgreSQL database,
then set `DATABASE_URL` in the environment used to start the Next.js server. Do not
commit the connection string to source control.

On Windows PowerShell, set the connection string in the same terminal used to run
the schema push and app:

```powershell
$env:DATABASE_URL = "postgresql://USERNAME:PASSWORD@localhost:5432/fintrack"
pnpm --filter @workspace/db run push
pnpm --filter @workspace/nextjs-screener run dev
```

Replace `USERNAME` and `PASSWORD` with a PostgreSQL role that can create tables,
and create the `fintrack` database first. For a hosted database, use the provider's
connection string, including any required SSL options. The database must be
reachable before running `push`; it creates or updates the tables defined by the
Drizzle schema. For deployments, configure `DATABASE_URL` in the hosting provider's
server environment and run the schema push as a deployment step. Watchlist and
Portfolio APIs return HTTP 503 when the variable is missing.

For this Windows development environment, a local PostgreSQL cluster is provisioned
under `%LOCALAPPDATA%\FinTrack\postgres-data`, bound to `127.0.0.1:5433`. Its
connection string is stored in the ignored
`artifacts/nextjs-screener/.env.local`; the Drizzle schema has already been pushed.
After a machine restart, start the database before the app if it is not already
running:

```powershell
$pgctl = "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe"
& $pgctl -D "$env:LOCALAPPDATA\FinTrack\postgres-data" status
& $pgctl -D "$env:LOCALAPPDATA\FinTrack\postgres-data" -l "$env:LOCALAPPDATA\FinTrack\postgres.log" start
pnpm --filter @workspace/nextjs-screener run dev
```

The database uses a separate cluster and port from any PostgreSQL service already
installed on the machine.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **Next.js 15** App Router (primary app at `/`)
- DB: PostgreSQL + Drizzle ORM (`@workspace/db`)
- Styling: Tailwind CSS v4 + shadcn/ui components
- Charts: Recharts (price + RSI charts)
- Data fetching: React Query (@tanstack/react-query)
- Data sources: Yahoo Finance API + NSE India API

## Where things live

```
artifacts/nextjs-screener/
  src/
    app/                          # Next.js App Router pages
      page.tsx                    # Market overview (indices + movers)
      screener/page.tsx           # Stock screener with filters
      watchlist/page.tsx          # Watchlist management
      portfolio/page.tsx          # Portfolio tracker
      alerts/page.tsx             # Price alerts (localStorage-backed)
      scans/page.tsx              # Pre-built market scans
      query/page.tsx              # Custom query screener
      sectors/page.tsx            # Sector performance heatmap
      fii-dii/page.tsx            # FII/DII flow data
      forex/page.tsx              # USD-INR and major pairs
      gold-etf/page.tsx           # Gold ETF tracker
      news/page.tsx               # Market news feed
      calendar/page.tsx           # Economic/earnings calendar
      stock/[symbol]/page.tsx     # Stock detail (chart + fundamentals)
      bulk-deals/page.tsx         # Institutional bulk trade reports
      market-breadth/page.tsx     # Advance/decline, EMA participation
      industry-rotation/page.tsx  # RRG sector rotation chart + table
      futures/page.tsx            # Nifty/BankNifty option chain & OI
      corporate-filings/page.tsx  # NSE corporate announcements
      promoter-activity/page.tsx  # Promoter shareholding trends
      quarterly-results/page.tsx  # Earnings beat/miss/inline table
      api/
        market/
          overview/               # Index quotes + movers
          top-gainers/            # Top gaining stocks
          top-losers/             # Top losing stocks
          most-active/            # Most active by volume
          bulk-deals/             # NSE bulk deal archives
          market-breadth/         # A/D ratio + EMA + 52W metrics
          industry-rotation/      # Sector RRG + rotation data
          futures-dashboard/      # Option chain PCR + OI profile
          corporate-filings/      # NSE corporate announcements
          promoter-activity/      # NSE promoter holding data
          quarterly-results/      # Quarterly earnings results
        screener/{route,sectors}/
        stocks/{quote,fundamentals,history,quotes,search}/[symbol]/
        watchlist/{route,[symbol]}/
    lib/
      yahoo-finance.ts       # Yahoo Finance + NSE India API client
      nse.ts                 # NSE India session helper (cookie + fetchNseApi)
      stock-list.ts          # 109 NSE stocks + index symbols + sectors
      cache.ts               # Simple in-memory TTL cache
      format.ts              # Price/change/volume formatters
      api-url.ts             # Client-side URL helper (uses NEXT_PUBLIC_BASE_PATH)
    components/
      sidebar.tsx            # Collapsible sidebar with nav groups
      providers.tsx          # React Query + Sonner providers
      ui/                    # shadcn/ui components (scaffolded)

lib/db/src/schema/watchlist.ts  # PostgreSQL watchlist schema
```

## Architecture decisions

- **Next.js at the root path**: the app owns `/` and its internal API routes own `/api`. Client fetches use `apiUrl('/...')` so this remains safe if the artifact is mounted under another path later.
- **Server-side caching**: In-memory TTL cache (`src/lib/cache.ts`) per Next.js process. Market data: 60s TTL, fundamentals: 5min TTL, screener quotes: 2min TTL.
- **Yahoo Finance**: Uses chart API v8 (no auth required) for quotes/history. Uses quoteSummary v10 with crumb for fundamentals, falling back to a crumbless `v7/finance/quote` call (`fetchQuoteFallback` in `yahoo-finance.ts`) if the crumb/session fails.
- **NSE India session**: `src/lib/nse.ts` establishes a cookie session by first hitting the NSE homepage (stores cookies), waits 350ms, then fires the API call. All NSE-specific routes use `fetchNseApi<T>(path)` from this helper.
- **NSE mock fallbacks**: Every NSE-specific API route (bulk deals, corporate filings, promoter activity, quarterly results, futures dashboard) has a hardcoded mock fallback that fires when the live NSE call fails or returns no data — so the UI always renders.
- **API response caching**: Cache plain data objects, not `NextResponse` instances. Each request creates a fresh JSON response so cached response bodies remain readable.
- **Screener search**: `api/screener/route.ts` falls back to the full `NSE_STOCKS` static list when no search query is provided (fixes blank Screener and Scans pages).
- **Fundamentals fallback chain**: `api/stocks/fundamentals/[symbol]/route.ts` merges `fetchSummary` (quoteSummary), `fetchQuotes`, and `fetchNseData` (NSE India quote-equity API) results, since any one source can be missing fields or blocked.
- **RSI(14)**: Computed client-side from OHLCV history data in the stock detail page.
- **DB imports in API routes**: `@workspace/db` is a workspace package imported directly into Next.js API routes — no need for a separate Express layer.

## Product

### Markets
- **Market Overview**: Live Nifty 50, Sensex, Bank Nifty, IT, Auto, Pharma index cards; top gainers/losers/most-active
- **Sectors**: Sector performance heatmap with 1D/1W/1M/3M view
- **FII/DII**: Foreign and domestic institutional flow data
- **Forex**: USD-INR and major currency pairs
- **Gold ETFs**: Sovereign gold bond and ETF tracker
- **Bulk Deals**: Institutional buy/sell reports with date range filter and BUY/SELL badges

### Screener
- **Stock Screener**: Filter 109+ NSE stocks by exchange, sector, P/E, P/B, market cap; sort by any metric
- **Query Screener**: Custom formula-based screener
- **Scans**: Pre-built scans (52W high/low breakouts, RSI overbought/oversold, volume surges, etc.)

### Analytics
- **Market Breadth**: Live A/D ratio, Nifty EMA 20/50/200 participation, 52-week range counts, top movers
- **Industry Rotation**: RRG (Relative Rotation Graph) scatter chart + sector table with quadrant classification (Leading/Weakening/Lagging/Improving)
- **Futures Dashboard**: Nifty & BankNifty option chain — OI profile bar chart, PCR, max pain strike, ATM straddle, per-strike OI table

### Research
- **Corporate Filings**: NSE announcements filtered by category (Board Meeting, Dividend, M&A, AGM, Buyback, etc.)
- **Promoter Activity**: Promoter holding %, pledged %, institutional %, quarterly change, Buying/Selling trend badges
- **Quarterly Results**: Revenue, profit, EPS with YoY growth and Beat/Miss/Inline classification

### Portfolio & Tools
- **Stock Detail**: Live price, OHLCV stats, 52-week range, price chart with period selector, RSI(14) chart, full fundamentals panel with analyst consensus
- **Watchlist**: PostgreSQL-backed; search + add stocks, remove stocks, live price updates
- **Portfolio**: Holdings tracker with P&L
- **Alerts**: Price alerts (localStorage-backed, browser-side polling)
- **News**: Market news feed
- **Calendar**: Economic and earnings calendar

## User preferences

- Personal use only — no auth required
- Dark navy theme throughout
- NSE/BSE data via Yahoo Finance + NSE India APIs (no paid API keys)

## Gotchas

- `NEXT_PUBLIC_BASE_PATH` is empty for the root-mounted app so client-side fetch calls target the Next.js `/api` routes
- Yahoo Finance crumb is session-bound; if `fetchSummary` fails, fundamentals will return empty (non-fatal)
- The in-memory cache resets on each Next.js server restart (dev) — that's expected behavior
- Do not run `pnpm dev` at workspace root; use the workflow or `pnpm --filter` syntax

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
