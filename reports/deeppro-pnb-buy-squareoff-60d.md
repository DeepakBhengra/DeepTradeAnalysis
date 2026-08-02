# PNB deeppro BUY square-off study

- **Symbol:** PNB
- **Side:** BUY (long) at deeppro **mirror** event (oversold exhaustion)
- **Pattern:** SMI bullish cross from oversold + BB lower tag + rising MACD hist
- **Quality filters:** event before `14:00` IST · MACD hist Δ ≥ `0.01%` of price
- **Entry price:** event candle mid `(high + low) / 2`
- **Square-off:** best later same-day candle mid before `15:15` IST
- **Profit %:** `(squareOffPrice - buyPrice) / buyPrice * 100`
- **Window:** 41 trade days (2026-06-04 → 2026-07-31)
- **Signals:** 10 · **Positive best SQ:** 8 (80.0%) · **Avg best profit:** 0.32%

## Trades

| Date | Event | RSI | BB upper % | BB lower % | Buy price | Best SQ off | SQ price | Profit % |
|------|-------|-----|------------|------------|-----------|-------------|----------|----------|
| **11 Jun** | **12:15** | **33.40** | 2.862 | 0.829 | 105.50 | 15:15 | 106.30 | **0.75%** |
| 16 Jun | 13:15 | 38.22 | 0.682 | 0.297 (close) | 107.57 | 15:00 | 108.02 | 0.42% |
| 19 Jun | 12:45 | 29.20 | 1.041 | 0.264 (close) | 108.51 | 14:00 | 108.81 | 0.28% |
| 23 Jun | 12:00 | 19.75 | 2.278 | 0.204 (close) | 107.56 | 14:45 | 107.69 | 0.13% |
| 23 Jun | 12:30 | 8.71 | 2.337 | 0.431 | 107.49 | 14:45 | 107.69 | 0.19% |
| 29 Jun | 13:30 | 25.11 | 1.581 | 0.150 (close) | 106.49 | 14:45 | 107.14 | 0.61% |
| 07 Jul | 11:30 | 11.11 | 1.313 | 0.193 (close) | 103.50 | 14:45 | 104.28 | 0.75% |
| 08 Jul | 11:15 | 36.68 | 1.628 | 0.891 | 102.97 | 11:30 | 102.96 | -0.01% |
| 22 Jul | 11:15 | 19.92 | 1.455 | 0.351 | 111.04 | 12:45 | 110.87 | -0.15% |
| 22 Jul | 12:30 | 22.67 | 1.613 | 0.375 | 110.60 | 12:45 | 110.87 | 0.24% |

## Detail (incl. optimistic high fill & EOD)

| Date | Event | RSI | BB upper % | BB lower % | Buy | Best mid SQ | Mid profit | Best high SQ | High profit | EOD SQ | EOD profit |
|------|-------|-----|------------|------------|-----|-------------|------------|--------------|-------------|--------|------------|
| 11 Jun | 12:15 | 33.40 | 2.862 | 0.829 | 105.50 | 15:15 @ 106.30 | 0.75% | 15:15 @ 106.44 | 0.89% | 15:15 @ 106.30 | 0.75% |
| 16 Jun | 13:15 | 38.22 | 0.682 | 0.297 (close) | 107.57 | 15:00 @ 108.02 | 0.42% | 14:30 @ 108.10 | 0.49% | 15:15 @ 107.94 | 0.34% |
| 19 Jun | 12:45 | 29.20 | 1.041 | 0.264 (close) | 108.51 | 14:00 @ 108.81 | 0.28% | 14:00 @ 109.02 | 0.47% | 15:15 @ 108.80 | 0.27% |
| 23 Jun | 12:00 | 19.75 | 2.278 | 0.204 (close) | 107.56 | 14:45 @ 107.69 | 0.13% | 14:30 @ 107.85 | 0.27% | 15:15 @ 107.37 | -0.18% |
| 23 Jun | 12:30 | 8.71 | 2.337 | 0.431 | 107.49 | 14:45 @ 107.69 | 0.19% | 14:30 @ 107.85 | 0.33% | 15:15 @ 107.37 | -0.12% |
| 29 Jun | 13:30 | 25.11 | 1.581 | 0.150 (close) | 106.49 | 14:45 @ 107.14 | 0.61% | 14:45 @ 107.30 | 0.76% | 15:15 @ 107.03 | 0.51% |
| 07 Jul | 11:30 | 11.11 | 1.313 | 0.193 (close) | 103.50 | 14:45 @ 104.28 | 0.75% | 14:30 @ 104.40 | 0.87% | 15:15 @ 103.72 | 0.21% |
| 08 Jul | 11:15 | 36.68 | 1.628 | 0.891 | 102.97 | 11:30 @ 102.96 | -0.01% | 11:30 @ 103.07 | 0.10% | 15:15 @ 101.03 | -1.88% |
| 22 Jul | 11:15 | 19.92 | 1.455 | 0.351 | 111.04 | 12:45 @ 110.87 | -0.15% | 12:45 @ 111.19 | 0.14% | 15:15 @ 110.72 | -0.28% |
| 22 Jul | 12:30 | 22.67 | 1.613 | 0.375 | 110.60 | 12:45 @ 110.87 | 0.24% | 12:45 @ 111.19 | 0.53% | 15:15 @ 110.72 | 0.11% |

## Notes

- This is the **opposite** of the deeppro short pattern (oversold bounce vs overbought dump).
- Long profit is positive when price rises after the BUY entry.
- **Best SQ off** = highest profit using candle mid prices.
- **Best high SQ** = theoretical best if exit filled at that candle's high.
- Same-day only; no overnight holds.
