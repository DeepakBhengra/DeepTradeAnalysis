# Deeppro BUY + SELL square-off — 29 Jun (profit ≥ 0.75%)

- **Date:** 2026-06-29
- **Rule:** deeppro (Stch Mtm exhaustion) — SELL overbought + BUY oversold mirror
- **Universe:** 50 sector-watchlist stocks
- **Entry price:** event candle mid `(high + low) / 2`
- **Square-off:** best later same-day candle mid before `15:15` IST
- **SELL profit %:** `(sell - sq) / sell * 100`
- **BUY profit %:** `(sq - buy) / buy * 100`
- **Filter:** profit ≥ 0.75%
- **Stocks scanned:** 50 · with signals: 25 · in report: 14
- **Trades scanned:** 31
- **Trades in report:** 16 (9 SELL · 7 BUY)
- **Fetch errors:** 0
- **Data:** Kite Connect historical (NSE sector watchlist, 15minute)
- **Generated (UTC):** 2026-08-02T18:14:35.612Z

## SELL

| Stock | Sector | Date | Event | RSI | BB upper % | BB lower % | Sell price | Best SQ off | SQ price | Profit % |
|-------|--------|------|-------|-----|------------|------------|------------|-------------|----------|----------|
| DRREDDY | Health | 29 Jun | 11:15 | 84.96 | 1.675 | 6.178 | 1406.95 | 15:00 | 1376.35 | 2.17% |
| AUROPHARMA | Health | 29 Jun | 11:15 | 67.57 | 0.691 | 1.651 | 1573.60 | 15:15 | 1543.60 | 1.91% |
| DIVISLAB | Health | 29 Jun | 11:45 | 40.97 | 0.745 | 0.222 (close) | 6681.00 | 15:15 | 6553.25 | 1.91% |
| CIPLA | Health | 29 Jun | 10:45 | 69.03 | 0.381 | 3.458 | 1478.00 | 15:15 | 1452.50 | 1.73% |
| CIPLA | Health | 29 Jun | 12:30 | 67.97 | 1.591 | 2.788 | 1476.75 | 15:15 | 1452.50 | 1.64% |
| POLICYBZR | Insurance | 29 Jun | 10:45 | 69.61 | 0.415 | 2.868 | 1642.15 | 13:15 | 1621.85 | 1.24% |
| JSWSTEEL | Metal | 29 Jun | 11:30 | 67.66 | 0.574 | 1.361 | 1243.75 | 14:30 | 1230.60 | 1.06% |
| SUNPHARMA | Health | 29 Jun | 12:00 | 68.13 | 0.857 | 1.553 | 1886.60 | 14:30 | 1871.40 | 0.81% |
| JINDALSTEL | Metal | 29 Jun | 12:00 | 78.86 | 0.499 | 1.431 | 1076.10 | 15:00 | 1068.05 | 0.75% |

## BUY

| Stock | Sector | Date | Event | RSI | BB upper % | BB lower % | Buy price | Best SQ off | SQ price | Profit % |
|-------|--------|------|-------|-----|------------|------------|------------|-------------|----------|----------|
| HINDALCO | Metal | 29 Jun | 09:30 | 49.33 | 0.902 | 0.392 | 957.35 | 11:30 | 971.90 | 1.52% |
| GICRE | Insurance | 29 Jun | 12:30 | 56.39 | 0.761 | 0.167 (close) | 358.53 | 15:15 | 363.78 | 1.46% |
| GICRE | Insurance | 29 Jun | 09:45 | 36.55 | 2.143 | 0.641 | 359.75 | 15:15 | 363.78 | 1.12% |
| HDFCBANK | Bank | 29 Jun | 10:00 | 33.04 | 0.867 | 0.024 (crossed) | 795.80 | 11:15 | 804.18 | 1.05% |
| INDUSINDBK | Bank | 29 Jun | 10:30 | 9.67 | 2.642 | 0.371 | 910.95 | 14:45 | 919.35 | 0.92% |
| EICHERMOT | Automobile | 29 Jun | 12:30 | 10.26 | 3.968 | 0.874 | 7394.75 | 15:15 | 7454.50 | 0.81% |
| INFY | IT | 29 Jun | 13:15 | 49.49 | 0.955 | 0.140 (close) | 1030.65 | 15:00 | 1038.60 | 0.77% |

## Notes

- Same-day square-off only; no overnight holds.
- Kite Connect historical 15m only — same deeppro engine as Post-Mortem / Day Scan.

