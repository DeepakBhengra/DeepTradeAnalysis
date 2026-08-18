# DeepTradeAnalysis — Architecture

This document describes the project structure, frontend and backend layout, main API routes, API key / environment requirements, and core data flows.

For trading **rule semantics** (Deepak, Deeppro, RulePNB, etc.), see [`README.md`](./README.md).

---

## 1. Purpose

**DeepTradeAnalysis** (npm package `pnb-15m-signal-engine`) is an NSE **15-minute** signal and trading toolkit:

| Capability | Description |
|------------|-------------|
| Signal engine | BB / RSI / MACD / Stochastic Momentum rules on Kite 15m candles |
| Day Scan | Sector (and single-symbol) scans for a chosen IST date |
| Day Scan Simulator | Candle-by-candle replay of Day Scan signals |
| Day Order Simulator | Paper trading of those signals (₹1 crore capital) |
| Samco Trading | Optional MIS execution of Day Scan signals via Samco Trade API |

- **Kite Connect** — market data + OAuth (and optional CLI signal loop).
- **Samco StockNote Trade API** — order placement / square-off (execution only).

---

## 2. Repository layout

Not a formal npm workspaces monorepo: a **root Node backend** plus a nested **`web/`** Vite app.

```
/
├── src/                 # Backend (Express API, engine, rules, brokers)
├── web/                 # Frontend (React + Vite + Tailwind)
├── tests/               # Backend Vitest suites
├── scripts/             # Ad-hoc backtests / studies (tsx)
├── reports/             # Generated study artifacts
├── data/                # Runtime persistence (created on write; gitignored)
├── .env / .env.example  # Secrets and broker config
├── package.json         # Backend + dashboard scripts
└── README.md            # Rule documentation
```

### Root scripts (`package.json`)

| Script | Role |
|--------|------|
| `npm run dev:api` | API on port **3001** (`tsx src/api/server.ts`) |
| `npm run dev:web` | Vite UI on port **5173** |
| `npm run dev:dashboard` | API + web together |
| `npm run dev` | CLI poll loop (`src/main.ts`) |
| `npm test` | Backend Vitest |
| `npm run build` / `build:web` / `build:all` | Compile TypeScript / Vite |

### Backend (`src/`)

| Path | Role |
|------|------|
| `api/server.ts` | Express entry: routes, static `web/dist`, Samco poll |
| `api/` | Day-scan / dashboard payload builders, caches, `samcoPoll.ts` |
| `engine/` | Live trading cycle, Samco day-scan cycle, single-symbol `runCycle` |
| `rules/` | Deepak*, Deeppro*, RulePNB / RuleSUNPHARMA, favourable symbol rules |
| `indicators/` | Bollinger, RSI, MACD, Stochastic Momentum, volume |
| `backtest/` | Date-range backtest runners |
| `kite/` | Kite OAuth, session token store |
| `samco/` | Session, client, ledger, executor, day-scan bridge, settings, logs |
| `data/` | **Code** feeds (`pnbFeed.ts`, `quoteFeed.ts`) — not JSON storage |
| `symbols/` | Sector watchlist, aliases, study universe |
| `postMortem/` | Post-mortem grading + disk cache |
| `utils/` | IST/market time, stop-loss %, errors |
| `config.ts` | Central env + rule thresholds |
| `types.ts` | Shared domain types |
| `main.ts` | CLI: session + poll loop |

### Frontend (`web/`)

| Path | Role |
|------|------|
| `src/main.tsx` / `App.tsx` | App shell + widget tabs |
| `src/widgets/` | One widget per major tab |
| `src/components/` | Shared UI (tables, controls, panels) |
| `src/hooks/` | Data fetching, simulation, Samco, live refresh |
| `src/context/` | e.g. `DayScanSimulationContext` (shared sim state) |
| `src/api/` | `client.ts` (dashboard/day-scan), `samco.ts` |
| `src/utils/` | Formatting, filters, paper/day-order engines, IST helpers |
| `vite.config.ts` | Port **5173**, proxy `/api` → `localhost:3001` |

---

## 3. Frontend architecture

### Stack

- React 18 + TypeScript
- Vite 6
- Tailwind CSS 4 (`@tailwindcss/vite`)
- `lightweight-charts` for candle charts
- Vitest + Testing Library (jsdom)

### Dev networking

```
Browser (http://localhost:5173)
    │  fetch("/api/...")
    ▼
Vite proxy  ──►  Express API (http://localhost:3001)
```

Production: Express serves `web/dist` and the same `/api` routes on `PORT` (default **3001**).

### UI tabs (`WidgetTabs`)

| Tab id | Label | Primary widget |
|--------|-------|----------------|
| `stockDashboard` | Stock 15m Dashboard | Live / historical symbol dashboard |
| `deepakBacktest` / `deepak2Backtest` | Deepak / Deepak-2 Backtest | Date-range backtests |
| `deepakDayScan` | Deepak Day Scan | Unified Day Scan (rule variant selector) — **pushes to Samco** |
| `deepak2DayScan` / `deepak3DayScan` / `deepakWatchPartyDayScan` | Dedicated day-scan UIs | Variant-specific scans |
| `deepakPostMortem` / `dayScanPostMortem` | Post-Mortem | Signal grading / reports |
| `dayScanSimulator` | Day Scan Simulator | Candle replay |
| `dayOrderSimulator` | Day Order Simulator | Paper P&L from sim feed |
| `samcoTrading` | Samco Trading | Live/dry-run MIS controls + ledger |

### Shared Day Scan Simulation context

`DayScanSimulationProvider` holds analysis date, rule variant, entry-price filter, and the current simulation payload. **Day Scan Simulator** and **Day Order Simulator** both consume it so paper orders follow the same candle stream.

### Notable hooks

| Hook | Purpose |
|------|---------|
| `useVariantDayScan` / `useCancellableDayScan` | Run Day Scan APIs with cancel / timeout |
| `useDayScanLiveRefresh` | Auto re-scan every **10 min** when date = IST today (until 15:15) |
| `useDayScanSimulation` | Simulator play/pause + `reloadLatest` (15 min refresh for today) |
| `useDayOrderSimulation` | Paper portfolio driven by sim ticks |
| `useSamcoTrading` | Status, settings, ledger, orders, session refresh |

---

## 4. Backend architecture

### Process entrypoints

| Entry | Behavior |
|-------|----------|
| `src/api/server.ts` | HTTP API + Samco poll + optional static UI |
| `src/main.ts` | CLI: `runCycle()` + `processLiveTradingCycle()` every `pollIntervalMs` (60s) |

### Boot sequence (API)

1. Load `.env` (`loadEnv`)
2. Mount CORS + JSON routes
3. Start dashboard cache auto-refresh
4. `initializeSamcoSession()` (if keys present)
5. `startSamcoTradingPoll()` when dry-run **or** live trading is enabled
6. Listen on `PORT` (default **3001**); serve `web/dist` when built

### Broker integrations

```
┌─────────────┐     historical / quotes      ┌──────────────┐
│ Kite Connect│◄─────────────────────────────│  API / engine │
└─────────────┘                              └──────┬───────┘
                                                    │
┌─────────────┐     placeOrder / squareOff          │
│ Samco Trade │◄────────────────────────────────────┘
└─────────────┘
```

- **Kite** — OAuth login, access token (often written back into `.env`), 15m historical candles, quotes.
- **Samco** — session token, MIS limit/SL orders, positions, square-off; paper-like dry-run updates a local ledger without calling placeOrder.

### Live trading cycle (`processLiveTradingCycle`)

1. Reconcile pending ledger orders  
2. If inside EOD window (default 15:00–15:15 IST) → square off open positions  
3. Prefer today’s ingested Day Scan snapshot (matching Samco rule variant) → materialize with catch-up  
4. Else (live, no snapshot) → watchlist poll scan (`runSamcoDayScanCycle`)  
5. Apply configured stop-loss % on open marks when set  

---

## 5. API routes

Base URL (dev): `http://localhost:3001` (or via Vite proxy as `/api`).

### Health & Kite auth

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Liveness |
| GET | `/api/kite/status` | Connection / token status |
| GET | `/api/kite/login` | Start OAuth |
| GET | `/api/kite/callback` | OAuth redirect handler |
| POST | `/api/kite/token` | Set access token manually |

### Dashboard & simulation

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/dashboard` | Symbol dashboard payload |
| GET | `/api/dashboard/simulate` | Dashboard candle simulation |
| GET | `/api/backtest/day-scan/simulate` | Day Scan Simulator frame (`date`, `sessionIndex`, `variant`) |

### Day Scan (by rule)

| Method | Path |
|--------|------|
| GET | `/api/backtest/deepak/day-scan` |
| GET | `/api/backtest/deepak-2/day-scan` |
| GET | `/api/backtest/deepak-3/day-scan` |
| GET | `/api/backtest/deepak-watch-party/day-scan` |
| GET | `/api/backtest/deeppro/day-scan` |
| GET | `/api/backtest/deeppro1/day-scan` |
| GET | `/api/backtest/rule-pnb/day-scan` |
| GET | `/api/backtest/rule-sunpharma/day-scan` |
| GET | `/api/backtest/rule-sunpharma1/day-scan` |
| GET | `/api/backtest/symbol-rule/:ruleId/day-scan` |

Query: typically `date=YYYY-MM-DD` (IST session date).

### Range backtests

| Method | Path |
|--------|------|
| GET | `/api/backtest/deepak`, `deepak-2`, `deepak-watch-party`, `deeppro`, `deeppro1` |
| GET | `/api/backtest/rule-pnb`, `rule-sunpharma`, `rule-sunpharma1` |
| GET | `/api/backtest/symbol-rule/:ruleId` |

### Samco

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/samco/status` | Session, dry-run/live flags, open count, reported IP |
| POST | `/api/samco/session/refresh` | Refresh Samco session token |
| POST | `/api/samco/cycle` | Run one live trading cycle |
| GET | `/api/samco/positions` | Broker positions |
| GET | `/api/samco/ledger` | Local position ledger |
| POST | `/api/samco/ledger/:signalKey/square-off` | Manual square-off |
| GET | `/api/samco/orders` | Open / executed / rejected views |
| GET / POST | `/api/samco/day-scan-signals` | Read / ingest Day Scan feed → materialize |
| GET / PATCH | `/api/samco/settings` | Qty, entry range, dry-run, rule variant, stop-loss % |
| POST | `/api/samco/live-trading` | Enable/disable live trading |
| GET | `/api/samco/logs` | Trade logs |
| GET | `/api/samco/logs/download` | CSV / JSON download |

### Post-mortem cache

| Method | Path |
|--------|------|
| GET / PUT | `/api/post-mortem/signal-days` |
| GET / PUT | `/api/post-mortem/report` |

Unknown `/api/*` → JSON 404. Other paths → SPA `index.html` when static assets are present.

---

## 6. API keys & environment

Copy `.env.example` → `.env` and fill credentials.

### Required for market data (Kite)

| Variable | Purpose |
|----------|---------|
| `KITE_API_KEY` | Kite Connect API key |
| `KITE_API_SECRET` | Kite Connect API secret |
| `KITE_ACCESS_TOKEN` | Daily access token (OAuth or manual) |

| Variable | Default / notes |
|----------|-----------------|
| `KITE_REDIRECT_URL` | `http://localhost:3001/api/kite/callback` — must match Kite Developer Console |
| `KITE_APP_URL` | `http://localhost:5173` — browser return after login |
| `KITE_API_BASE_URL` | Optional; defaults to `http://localhost:${PORT}` |
| `KITE_INSTRUMENT_TOKEN` | Optional; skips instrument lookup |

Helpers: `assertKiteApiKeys()`, `assertKiteCredentials()` in `src/config.ts`.

### Required for live Samco execution

| Variable | Purpose |
|----------|---------|
| `SAMCO_API_KEY` | Samco StockNote API key |
| `SAMCO_API_SECRET` | Samco API secret |

| Variable | Default / notes |
|----------|-----------------|
| `SAMCO_SESSION_TOKEN` | Optional cached session; refreshed via login |
| `SAMCO_BASE_URL` | `https://tradeapi.samco.in` |
| `SAMCO_PRODUCT_TYPE` | `MIS` |
| `SAMCO_ORDER_TYPE` | `L` (limit); `MKT` mapped to `L` |
| `SAMCO_DEFAULT_QUANTITY` | `100` |
| `SAMCO_ENTRY_PRICE_MIN` / `MAX` | Entry filter for Samco (default max `3900`) |
| `SAMCO_DRY_RUN` | `true` — ledger only, no placeOrder |
| `SAMCO_LIVE_TRADING_ENABLED` | `false` — must be enabled (+ UI confirm) for real orders |
| `SAMCO_REQUIRED_STATIC_IP` | Optional allowlist; **off by default** |
| `SAMCO_EOD_SQUARE_OFF_START/END` | `15:00` / `15:15` IST |
| `SAMCO_LEDGER_PATH` | `data/samco-ledger.json` |

Helper: `assertSamcoApiKeys()`.

### Server / tuning (optional)

| Variable | Notes |
|----------|-------|
| `PORT` | API port (default **3001**) |
| `KITE_REQUEST_TIMEOUT_MS`, `KITE_MAX_CONCURRENT_REQUESTS`, `KITE_REQUEST_RETRIES` | Kite client tuning |
| `DAY_SCAN_CONCURRENCY`, `DAY_SCAN_SYMBOL_TIMEOUT_MS`, `DAY_SCAN_KITE_RETRIES`, … | Day Scan batching |

Rule thresholds (Deepak, Deeppro, Deeppro1, RulePNB, …) live in **`src/config.ts`**, not `.env`.

### Runtime Samco settings file

UI / PATCH `/api/samco/settings` persists overrides to `data/samco-settings.json` (quantity, dry-run, entry range, rule variant, stop-loss %) for the IST trading day.

---

## 7. Core data flows

### A. Day Scan → Samco Trading

```
User Run Scan (today or historical)
        │
        ▼
GET /api/backtest/<variant>/day-scan?date=…
        │
        ▼
Deepak Day Scan UI (entry-price filter)
        │
        ▼
POST /api/samco/day-scan-signals  { date, variant, trades[] }
        │
        ├─► save data/samco-day-scan-signals.json
        ├─► sync Samco rule variant
        └─► processDayScanSignalSnapshot
              • today + closed candle → mode catch_up
              • else → mode full
              • skip existing signalKey in ledger (no duplicate orders)
              • placeOrder only if live on + dry-run off
```

**Idempotency key:** `{strategy}-{tradingSymbol}-{entryTimeIst}-{scenarioNumber}`.

**Live today:** Day Scan auto-refreshes every **10 minutes** until **15:15 IST**; each push only applies **new** ledger keys.

### B. Day Scan Simulator → Day Order Simulator

```
DayScanSimulationProvider
        │
        ├─ Day Scan Simulator
        │     GET /api/backtest/day-scan/simulate?date&sessionIndex&variant
        │     Advances 09:15→15:00 IST (10s per candle)
        │     Today: reloadLatest every 15 min until 15:15 IST
        │
        └─ Day Order Simulator
              Consumes filtered sim payload + marks
              Client-side paper engine (dayOrderEngine)
              Realized P&L can include brokerage-charges
```

### C. Live poll (API or CLI)

```
Every 60s (pollIntervalMs)
  → processLiveTradingCycle()
       reconcile → EOD square-off window →
       Day Scan snapshot materialize OR watchlist poll scan →
       configured stop-loss % exits
```

---

## 8. Runtime data files (`data/`)

Created at runtime (typically gitignored):

| File / dir | Purpose |
|------------|---------|
| `data/samco-ledger.json` | Open / closed Samco positions |
| `data/samco-settings.json` | Per-day Samco UI/runtime settings |
| `data/samco-trade-log.json` | Executor trade log |
| `data/samco-day-scan-signals.json` | Last ingested Day Scan feed for Samco |
| `data/post-mortem/` | Cached post-mortem indexes and reports |

---

## 9. Mental model

```
                 ┌──────────────────────┐
                 │   React dashboard    │
                 │   (Vite :5173)       │
                 └──────────┬───────────┘
                            │ /api/*
                            ▼
                 ┌──────────────────────┐
     Kite ◄──────┤  Express API :3001   ├──────► Samco Trade API
   (candles)     │  rules + day-scan    │      (MIS orders)
                 │  + live poll 60s     │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │  data/*.json ledger  │
                 │  settings / signals  │
                 └──────────────────────┘
```

### Local development checklist

1. Copy `.env.example` → `.env`; set **Kite** keys + access token (and **Samco** keys if testing execution).  
2. `npm run dev:dashboard` — UI `http://localhost:5173`, API `http://localhost:3001`.  
3. Connect Kite via UI if token missing.  
4. Run **Deepak Day Scan** for a date → signals appear; with a Samco-compatible variant they push to **Samco Trading**.  
5. Keep `SAMCO_DRY_RUN=true` until you intentionally enable live trading.

---

## 10. Related docs

| Doc | Content |
|-----|---------|
| [`README.md`](./README.md) | Deepak / Deeppro / RulePNB signal and exit rules |
| [`.env.example`](./.env.example) | Template for API keys and Samco defaults |
| `src/config.ts` | Full config surface and rule thresholds |
| `src/api/server.ts` | Authoritative route list |
