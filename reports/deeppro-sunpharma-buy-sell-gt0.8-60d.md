# SUNPHARMA deeppro BUY + SELL report (profit > 0.8%)

- **Symbol:** SUNPHARMA
- **Rule:** deeppro (Stch Mtm exhaustion) — BUY mirror + SELL short
- **Filter:** best same-day square-off profit **> 0.8%**
- **Entry price:** event candle mid `(high + low) / 2`
- **Square-off:** best later same-day candle mid before `15:15` IST
- **Window:** 41 trade days (2026-06-04 → 2026-07-31)
- **Source signals:** 12 SELL · 3 BUY
- **Passing filter:** 0 SELL · 0 BUY · 0 combined
- **Reported (last 60):** 0
- **Data:** Yahoo Finance 15m interim (re-run with Kite when available for exact fills)

## SELL trades (short)

| Date | Event | RSI | BB upper % | BB lower % | Sell price | Best SQ off | SQ price | Profit % |
|------|-------|-----|------------|------------|------------|-------------|----------|----------|
| — | — | — | — | — | — | — | — | *no SELL trades above filter* |

## BUY trades (long)

| Date | Event | RSI | BB upper % | BB lower % | Buy price | Best SQ off | SQ price | Profit % |
|------|-------|-----|------------|------------|-----------|-------------|----------|----------|
| — | — | — | — | — | — | — | — | *no BUY trades above filter* |

## Combined (chronological)

| Date | Side | Event | RSI | BB upper % | BB lower % | Entry | Best SQ off | SQ price | Profit % |
|------|------|-------|-----|------------|------------|-------|-------------|----------|----------|
| — | — | — | — | — | — | — | — | — | *No deeppro trades with profit > 0.8% in this window* |

## Notes

- SELL profit % = `(sellPrice - sqPrice) / sellPrice * 100`
- BUY profit % = `(sqPrice - buyPrice) / buyPrice * 100`
- Same-day square-off only; no overnight holds.
- Filter is strict **> 0.8%** on best mid square-off.
