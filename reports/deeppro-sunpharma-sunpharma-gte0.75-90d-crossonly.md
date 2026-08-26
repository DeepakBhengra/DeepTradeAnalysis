# SUNPHARMA deeppro BUY + SELL square-off (profit ≥ 0.75% · last 90 trades)

- **Symbol:** SUNPHARMA
- **Rule:** deeppro (Stch Mtm exhaustion) — SELL overbought + BUY oversold mirror
- **Entry price:** event candle mid `(high + low) / 2`
- **Square-off:** best later same-day candle mid before `15:15` IST
- **SELL profit %:** `(sell - sq) / sell * 100`
- **BUY profit %:** `(sq - buy) / buy * 100`
- **Window:** last 29 deeppro trades (2026-02-09 → 2026-07-15)
- **Filter:** profit ≥ 0.75%
- **Trades in report:** 6 (2 SELL · 4 BUY)
- **Data:** Kite Connect historical (NSE:SUNPHARMA, 15minute)
- **Generated (UTC):** 2026-08-03T09:57:29.464Z

## SELL

| Date | Event | RSI | BB upper % | BB lower % | Sell price | Best SQ off | SQ price | Profit % |
|------|-------|-----|------------|------------|------------|-------------|----------|----------|
| 27 Apr | 10:45 | 81.41 | 1.286 | 10.576 | 1740.70 | 11:15 | 1726.55 | 0.81% |
| 29 Jun | 11:15 | 70.05 | 0.497 | 1.868 | 1889.45 | 14:30 | 1871.40 | 0.96% |

## BUY

| Date | Event | RSI | BB upper % | BB lower % | Buy price | Best SQ off | SQ price | Profit % |
|------|-------|-----|------------|------------|------------|-------------|----------|----------|
| 22 Apr | 11:00 | 33.72 | 1.080 | 0.099 (close) | 1657.25 | 15:15 | 1670.70 | 0.81% |
| 1 Jun | 09:45 | 25.11 | 3.938 | 0.042 (crossed) | 1791.30 | 14:15 | 1806.05 | 0.82% |
| 2 Jun | 10:45 | 26.36 | 1.989 | 0.140 (close) | 1773.55 | 15:15 | 1793.50 | 1.12% |
| 13 Jul | 11:00 | 32.73 | 1.160 | 0.088 (close) | 1915.20 | 13:45 | 1930.20 | 0.78% |

## Notes

- Same-day square-off only; no overnight holds.
- Kite Connect historical 15m only — same deeppro engine as Post-Mortem / Day Scan.

