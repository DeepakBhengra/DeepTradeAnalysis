# AGENTS.md

## Cursor Cloud specific instructions

This repo is a two-package monorepo for the **PNB 15m Signal Engine**:

- **Root (`/`)** — TypeScript backend: an Express API server plus the signal engine (`src/rules`, `src/indicators`, `src/backtest`). Runs via `tsx` (ESM, `.js`-suffixed imports resolving to `.ts`).
- **`web/`** — React + Vite + Tailwind dashboard ("Trading Tools"). Dev server proxies `/api` → `http://localhost:3001` (see `web/vite.config.ts`).

Dependencies for both packages are installed by the startup update script; no extra setup is required.

### Run / test / build (commands live in `package.json` scripts)

- Dev (both services): `npm run dev:dashboard` — runs the API on port `3001` and Vite on port `5173` concurrently. Use `npm run dev:dashboard:clean` to free the ports first.
- Backend only: `npm run dev:api`. Web only: `npm run dev:web`.
- Tests: `npm test` (root, ~222 vitest cases) and `npm test --prefix web` (~77 cases).
- Typecheck/build (there is no separate lint step — `tsc` is the type gate): `npm run build` (backend `tsc`) and `npm run build --prefix web` (Vite). `npm run build:all` does both.

### Non-obvious caveats

- **Live market data needs Kite (Zerodha) credentials.** The API starts fine without them, but `/api/dashboard`, `/api/backtest/*`, and day-scan endpoints return `Kite not connected`, and the dashboard shows a "Connect Kite" gate. This is expected offline. To enable live data, copy `.env.example` → `.env` and set `KITE_API_KEY`/`KITE_API_SECRET` plus a daily `KITE_ACCESS_TOKEN`, or connect interactively via `/api/kite/login`. The daily access token is obtained through Kite's OAuth flow and cannot be scripted headlessly.
- **The core signal engine is fully exercisable offline** (no credentials): feed `Candle[]` through `buildIndicatorSnapshots()` (`src/indicators/compute.ts`) then `scanDeepakDecisions()` / `evaluateDeepakDecision()` (`src/rules/deepakDecision.ts`). The vitest suites cover this end to end.
- **Known pre-existing test failure (not an environment issue):** `tests/api/buildDeepak3DayScanPayload.test.ts` (3 cases) fail because the `src/data/pnbFeed.js` mock omits the `warmKiteExchangeInstruments` export that `runBatchedSectorScan.ts` calls. All other tests pass.
- **Samco execution is dry-run / disabled by default** (`SAMCO_DRY_RUN=true`, `SAMCO_LIVE_TRADING_ENABLED=false`); no live orders are placed in dev.
