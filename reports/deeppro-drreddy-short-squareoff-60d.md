# DRREDDY deeppro short-SELL square-off study

- **Symbol:** DRREDDY
- **Side:** short SELL at deeppro event time
- **Entry price:** event candle mid `(high + low) / 2`
- **Square-off:** best later same-day candle mid before `15:15` IST
- **Quality filters:** event before `14:00` IST · MACD hist Δ ≥ `0.01%` of price
- **Profit %:** `(sellPrice - squareOffPrice) / sellPrice * 100`
- **Window:** 41 trade days (2026-06-04 → 2026-07-31)
- **Signals:** 8 · **Positive best SQ:** 8 (100.0%) · **Avg best profit:** 0.8%

## Trades

| Date | Event | RSI | BB upper % | BB lower % | Sell price | Best SQ off | SQ price | Profit % |
|------|-------|-----|------------|------------|------------|-------------|----------|----------|
| 08 Jun | 11:45 | 48.60 | 0.523 | 0.718 | 1286.75 | 15:15 | 1275.35 | 0.89% |
| 09 Jun | 11:15 | 44.54 | 0.518 | 0.127 (close) | 1280.15 | 14:30 | 1264.30 | 1.24% |
| 11 Jun | 13:15 | 67.30 | 0.489 | 0.697 | 1278.75 | 14:45 | 1273.55 | 0.41% |
| 25 Jun | 11:45 | 75.39 | 1.180 | 2.443 | 1354.00 | 13:30 | 1347.20 | 0.50% |
| **29 Jun** | **11:15** | **85.75** | 1.685 | 6.185 | 1406.95 | 15:00 | 1376.35 | **2.17%** |
| 03 Jul | 12:00 | 69.15 | 0.635 | 2.463 | 1376.30 | 15:15 | 1371.75 | 0.33% |
| 03 Jul | 13:30 | 55.09 | 1.152 | 1.903 | 1377.15 | 15:15 | 1371.75 | 0.39% |
| 14 Jul | 10:45 | 84.85 | 0.128 (close) | 1.761 | 1246.40 | 14:00 | 1240.40 | 0.48% |

## Detail (incl. optimistic low fill & EOD)

| Date | Event | RSI | BB upper % | BB lower % | Sell | Best mid SQ | Mid profit | Best low SQ | Low profit | EOD SQ | EOD profit |
|------|-------|-----|------------|------------|------|-------------|------------|-------------|------------|--------|------------|
| 08 Jun | 11:45 | 48.60 | 0.523 | 0.718 | 1286.75 | 15:15 @ 1275.35 | 0.89% | 15:15 @ 1272.30 | 1.12% | 15:15 @ 1275.35 | 0.89% |
| 09 Jun | 11:15 | 44.54 | 0.518 | 0.127 (close) | 1280.15 | 14:30 @ 1264.30 | 1.24% | 14:30 @ 1261.90 | 1.43% | 15:15 @ 1269.00 | 0.87% |
| 11 Jun | 13:15 | 67.30 | 0.489 | 0.697 | 1278.75 | 14:45 @ 1273.55 | 0.41% | 14:45 @ 1271.90 | 0.54% | 15:15 @ 1276.60 | 0.17% |
| 25 Jun | 11:45 | 75.39 | 1.180 | 2.443 | 1354.00 | 13:30 @ 1347.20 | 0.50% | 12:15 @ 1343.40 | 0.78% | 15:15 @ 1349.35 | 0.34% |
| 29 Jun | 11:15 | 85.75 | 1.685 | 6.185 | 1406.95 | 15:00 @ 1376.35 | 2.17% | 13:00 @ 1372.10 | 2.48% | 15:15 @ 1377.25 | 2.11% |
| 03 Jul | 12:00 | 69.15 | 0.635 | 2.463 | 1376.30 | 15:15 @ 1371.75 | 0.33% | 15:15 @ 1368.00 | 0.60% | 15:15 @ 1371.75 | 0.33% |
| 03 Jul | 13:30 | 55.09 | 1.152 | 1.903 | 1377.15 | 15:15 @ 1371.75 | 0.39% | 15:15 @ 1368.00 | 0.66% | 15:15 @ 1371.75 | 0.39% |
| 14 Jul | 10:45 | 84.85 | 0.128 (close) | 1.761 | 1246.40 | 14:00 @ 1240.40 | 0.48% | 13:45 @ 1237.00 | 0.75% | 15:15 @ 1245.20 | 0.10% |

## Notes

- Short profit is positive when price falls after the SELL entry.
- **Best SQ off** = highest profit using candle mid prices (aligned with engine mid-price convention).
- **Best low SQ** = theoretical best if cover filled at that candle's low.
- Same-day only; no overnight holds.
- Highlighted row = best profit % in the window.
