# SUNPHARMA deeppro BUY + SELL square-off study (profit ≥ 0.8%)

- **Symbol:** SUNPHARMA
- **Rule:** deeppro (Stch Mtm exhaustion) — SELL overbought + BUY oversold mirror
- **Entry price:** event candle mid `(high + low) / 2`
- **Square-off:** best later same-day candle mid before `15:15` IST
- **SELL profit %:** `(sell - sq) / sell * 100`
- **BUY profit %:** `(sq - buy) / buy * 100`
- **Window:** 60 trade days (2026-05-07 → 2026-07-31)
- **Filter:** profit ≥ 0.8%
- **Trades in report:** 5 (2 SELL · 3 BUY)
- **Data:** Kite Connect historical (NSE:SUNPHARMA, 15minute)
- **Generated (UTC):** 2026-08-02T17:40:10.892Z

## Trades

| Date | Side | Event | Kind | RSI | Peak SMI | BB upper % | BB lower % | Entry | Best SQ off | SQ price | Profit % |
|------|------|-------|------|-----|----------|------------|------------|-------|-------------|----------|----------|
| 14 May | BUY | 09:15 | smi_cross | 60.86 | -76.9 | 0.428 | 0.379 | 1840.85 | 12:45 | 1865.00 | 1.31% |
| 26 May | BUY | 11:30 | stall_at_lows | 36.53 | -70.1 | 0.922 | 0.430 | 1826.85 | 15:15 | 1841.55 | 0.80% |
| 2 Jun | BUY | 11:15 | stall_at_lows | 24.39 | -72.8 | 1.865 | 0.592 | 1777.00 | 15:15 | 1793.50 | 0.93% |
| 25 Jun | SELL | 11:30 | stall_at_highs | 51.01 | 78.7 | 0.338 | 0.330 | 1878.15 | 13:45 | 1863.10 | 0.80% |
| 29 Jun | SELL | 12:00 | stall_at_highs | 68.13 | 69.0 | 0.857 | 1.553 | 1886.60 | 14:30 | 1871.40 | 0.81% |

## SELL only

| Date | Event | RSI | Entry | Best SQ off | SQ price | Profit % |
|------|-------|-----|-------|-------------|----------|----------|
| 25 Jun | 11:30 | 51.01 | 1878.15 | 13:45 | 1863.10 | 0.80% |
| 29 Jun | 12:00 | 68.13 | 1886.60 | 14:30 | 1871.40 | 0.81% |

## BUY only

| Date | Event | RSI | Entry | Best SQ off | SQ price | Profit % |
|------|-------|-----|-------|-------------|----------|----------|
| 14 May | 09:15 | 60.86 | 1840.85 | 12:45 | 1865.00 | 1.31% |
| 26 May | 11:30 | 36.53 | 1826.85 | 15:15 | 1841.55 | 0.80% |
| 2 Jun | 11:15 | 24.39 | 1777.00 | 15:15 | 1793.50 | 0.93% |

## Notes

- Same-day square-off only; no overnight holds.
- Uses the same deeppro engine + Kite historical feed as Post-Mortem / Day Scan.

