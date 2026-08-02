# Deeppro BUY + SELL square-off — 1 Jun (profit ≥ 0.75%)

- **Date:** 2026-06-01
- **Rule:** deeppro (Stch Mtm exhaustion) — SELL overbought + BUY oversold mirror
- **Universe:** 50 sector-watchlist stocks
- **Entry price:** event candle mid `(high + low) / 2`
- **Square-off:** best later same-day candle mid before `15:15` IST
- **SELL profit %:** `(sell - sq) / sell * 100`
- **BUY profit %:** `(sq - buy) / buy * 100`
- **Filter:** profit ≥ 0.75%
- **Stocks scanned:** 50 · with signals: 14 · in report: 3
- **Trades scanned:** 17
- **Trades in report:** 3 (3 SELL · 0 BUY)
- **Fetch errors:** 0
- **Data:** Kite Connect historical (NSE sector watchlist, 15minute)
- **Generated (UTC):** 2026-08-02T18:50:03.644Z

## SELL

| Stock | Sector | Date | Event | RSI | BB upper % | BB lower % | Sell price | Best SQ off | SQ price | Profit % |
|-------|--------|------|-------|-----|------------|------------|------------|-------------|----------|----------|
| HCLTECH | IT | 1 Jun | 12:15 | 74.78 | 0.274 (close) | 2.431 | 1209.90 | 15:15 | 1194.35 | 1.29% |
| LTM | IT | 1 Jun | 12:30 | 79.63 | 1.559 | 4.680 | 4244.20 | 15:15 | 4196.50 | 1.12% |
| TECHM | IT | 1 Jun | 12:30 | 95.68 | 1.170 | 5.309 | 1516.90 | 15:15 | 1502.40 | 0.96% |

## BUY

| Stock | Sector | Date | Event | RSI | BB upper % | BB lower % | Buy price | Best SQ off | SQ price | Profit % |
|-------|--------|------|-------|-----|------------|------------|------------|-------------|----------|----------|
| — | — | — | — | — | — | — | — | — | — | *none* |

## Notes

- Same-day square-off only; no overnight holds.
- Kite Connect historical 15m only — same deeppro engine as Post-Mortem / Day Scan.
- Deeppro quality gates enabled (favor same-day SQ ≥ ~0.75%): SELL event 10:45–12:30 + RSI/BB rules; BUY stall/OS-exit + BB lower + event≤13:15.

