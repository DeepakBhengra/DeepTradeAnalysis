# SUNPHARMA deeppro BUY + SELL square-off (profit ≥ 0.8% · last 60 trades)

- **Symbol:** SUNPHARMA
- **Rule:** deeppro (Stch Mtm exhaustion) — SELL overbought + BUY oversold mirror
- **Entry price:** event candle mid `(high + low) / 2`
- **Square-off:** best later same-day candle mid before `15:15` IST
- **SELL profit %:** `(sell - sq) / sell * 100`
- **BUY profit %:** `(sq - buy) / buy * 100`
- **Window:** last 60 deeppro trades (2026-03-06 → 2026-07-30)
- **Filter:** profit ≥ 0.8%
- **Trades in report:** 11 (5 SELL · 6 BUY)
- **Data:** Kite Connect historical (NSE:SUNPHARMA, 15minute)
- **Generated (UTC):** 2026-08-02T17:46:52.517Z

## SELL

| Date | Event | RSI | BB upper % | BB lower % | Sell price | Best SQ off | SQ price | Profit % |
|------|-------|-----|------------|------------|------------|-------------|----------|----------|
| 13 Apr | 09:15 | 72.78 | 0.425 (crossed) | 0.814 | 1656.75 | 09:45 | 1643.05 | 0.83% |
| 17 Apr | 10:15 | 69.14 | 0.129 (close) | 1.291 | 1693.85 | 13:15 | 1672.70 | 1.25% |
| 27 Apr | 10:45 | 81.41 | 1.286 | 10.576 | 1740.70 | 11:15 | 1726.55 | 0.81% |
| 25 Jun | 11:30 | 51.01 | 0.338 | 0.330 | 1878.15 | 13:45 | 1863.10 | 0.80% |
| 29 Jun | 12:00 | 68.13 | 0.857 | 1.553 | 1886.60 | 14:30 | 1871.40 | 0.81% |

## BUY

| Date | Event | RSI | BB upper % | BB lower % | Buy price | Best SQ off | SQ price | Profit % |
|------|-------|-----|------------|------------|------------|-------------|----------|----------|
| 16 Mar | 11:45 | 21.13 | 2.364 | 0.215 (close) | 1775.45 | 14:45 | 1790.35 | 0.84% |
| 16 Mar | 13:00 | 15.87 | 2.219 | 0.494 | 1771.50 | 14:45 | 1790.35 | 1.06% |
| 8 Apr | 11:15 | 43.72 | 1.556 | 0.363 | 1697.75 | 14:15 | 1716.00 | 1.07% |
| 14 May | 09:15 | 60.86 | 0.428 (crossed) | 0.379 | 1840.85 | 12:45 | 1865.00 | 1.31% |
| 26 May | 11:30 | 36.53 | 0.922 | 0.430 | 1826.85 | 15:15 | 1841.55 | 0.80% |
| 2 Jun | 11:15 | 24.39 | 1.865 | 0.592 | 1777.00 | 15:15 | 1793.50 | 0.93% |

## Notes

- Same-day square-off only; no overnight holds.
- Kite Connect historical 15m only — same deeppro engine as Post-Mortem / Day Scan.

