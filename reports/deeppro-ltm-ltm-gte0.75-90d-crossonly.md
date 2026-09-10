# LTM deeppro BUY + SELL square-off (profit ≥ 0.75% · last 90 trades)

- **Symbol:** LTM
- **Rule:** deeppro (Stch Mtm exhaustion) — SELL overbought + BUY oversold mirror
- **Entry price:** event candle mid `(high + low) / 2`
- **Square-off:** best later same-day candle mid before `15:15` IST
- **SELL profit %:** `(sell - sq) / sell * 100`
- **BUY profit %:** `(sq - buy) / buy * 100`
- **Window:** last 27 deeppro trades (2026-02-06 → 2026-07-28)
- **Filter:** profit ≥ 0.75%
- **Trades in report:** 9 (6 SELL · 3 BUY)
- **Data:** Kite Connect historical (NSE:LTM, 15minute)
- **Generated (UTC):** 2026-08-03T09:58:48.164Z

## SELL

| Date | Event | RSI | BB upper % | BB lower % | Sell price | Best SQ off | SQ price | Profit % |
|------|-------|-----|------------|------------|------------|-------------|----------|----------|
| 18 Mar | 11:45 | 78.20 | 1.297 | 5.057 | 4357.55 | 15:15 | 4295.45 | 1.43% |
| 1 Apr | 11:00 | 70.90 | 1.705 | 5.483 | 4202.50 | 14:45 | 4091.85 | 2.63% |
| 29 May | 11:45 | 91.55 | 1.409 | 5.310 | 4139.40 | 15:15 | 4042.10 | 2.35% |
| 1 Jun | 11:45 | 69.25 | 0.374 | 5.396 | 4260.25 | 15:15 | 4196.50 | 1.50% |
| 15 Jun | 11:30 | 87.99 | 0.553 | 4.204 | 3948.95 | 15:15 | 3894.95 | 1.37% |
| 28 Jul | 11:15 | 85.28 | 1.140 | 6.060 | 4372.65 | 13:15 | 4304.65 | 1.56% |

## BUY

| Date | Event | RSI | BB upper % | BB lower % | Buy price | Best SQ off | SQ price | Profit % |
|------|-------|-----|------------|------------|------------|-------------|----------|----------|
| 16 Mar | 11:45 | 46.38 | 1.037 | 0.115 (crossed) | 4182.30 | 14:45 | 4221.50 | 0.94% |
| 8 Jun | 10:15 | 41.65 | 1.609 | 0.289 (close) | 3987.60 | 12:15 | 4029.80 | 1.06% |
| 9 Jun | 10:15 | 18.49 | 1.772 | 0.348 | 3971.00 | 15:15 | 4004.70 | 0.85% |

## Notes

- Same-day square-off only; no overnight holds.
- Kite Connect historical 15m only — same deeppro engine as Post-Mortem / Day Scan.

