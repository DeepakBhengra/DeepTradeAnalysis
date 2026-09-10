# Deeppro BUY + SELL square-off — 1 Jun to 15 Jun (profit ≥ 0.75%)

- **Range:** 2026-06-01 → 2026-06-15 (15 calendar days · 11 with signals)
- **Rule:** deeppro enhanced (Stch Mtm exhaustion + quality gates)
- **Universe:** 50 sector-watchlist stocks
- **Entry price:** event candle mid `(high + low) / 2`
- **Square-off:** best later same-day candle mid before `15:15` IST
- **SELL profit %:** `(sell - sq) / sell * 100`
- **BUY profit %:** `(sq - buy) / buy * 100`
- **Hit definition:** best same-day SQ profit ≥ 0.75%
- **Stocks scanned:** 50 · with signals: 38 · in hit report: 21
- **Signals scanned:** 63 (21 BUY · 42 SELL)
- **Hits ≥ 0.75%:** 24 (16 SELL · 8 BUY)
- **Overall hit rate:** 38.1% (24/63 with exit window)
- **BUY hit rate:** 38.1% (8/21) · avg profit 0.731%
- **SELL hit rate:** 38.1% (16/42) · avg profit 0.642%
- **Fetch errors:** 0
- **Data:** Kite Connect historical (NSE sector watchlist, 15minute)
- **Generated (UTC):** 2026-08-02T19:21:13.990Z

## Daily accuracy

| Date | Signals | With exit | Hits ≥0.75% | Hit rate | BUY hits | SELL hits | Avg profit % |
|------|---------|-----------|--------------------------|----------|----------|-----------|--------------|
| 1 Jun | 4 | 4 | 3 | 75% | 0 | 3 | 0.863 |
| 2 Jun | 3 | 3 | 0 | 0% | 0 | 0 | 0.360 |
| 3 Jun | 1 | 1 | 0 | 0% | 0 | 0 | 0.120 |
| 4 Jun | 3 | 3 | 2 | 66.7% | 0 | 2 | 0.650 |
| 5 Jun | 4 | 4 | 2 | 50% | 0 | 2 | 0.828 |
| 6 Jun | 0 | 0 | 0 | — | 0 | 0 | — |
| 7 Jun | 0 | 0 | 0 | — | 0 | 0 | — |
| 8 Jun | 3 | 3 | 1 | 33.3% | 0 | 1 | 0.503 |
| 9 Jun | 10 | 10 | 3 | 30% | 3 | 0 | 0.753 |
| 10 Jun | 7 | 7 | 2 | 28.6% | 1 | 1 | 0.614 |
| 11 Jun | 8 | 8 | 4 | 50% | 2 | 2 | 0.810 |
| 12 Jun | 8 | 8 | 3 | 37.5% | 2 | 1 | 0.728 |
| 13 Jun | 0 | 0 | 0 | — | 0 | 0 | — |
| 14 Jun | 0 | 0 | 0 | — | 0 | 0 | — |
| 15 Jun | 12 | 12 | 4 | 33.3% | 0 | 4 | 0.563 |

## SELL hits (≥ 0.75%)

| Stock | Sector | Date | Event | Kind | RSI | BB upper % | BB lower % | Sell price | Best SQ off | SQ price | Profit % |
|-------|--------|------|-------|------|-----|------------|------------|------------|-------------|----------|----------|
| HDFCLIFE | Insurance | 5 Jun | 11:00 | stall_at_highs | 69.24 | 0.462 | 3.069 | 586.78 | 15:15 | 574.70 | 2.06% |
| NATIONALUM | Metal | 11 Jun | 11:15 | smi_exit_overbought | 44.42 | 0.818 | 0.115 (close) | 376.42 | 15:00 | 370.13 | 1.67% |
| LTM | IT | 15 Jun | 11:30 | smi_cross | 87.99 | 0.553 | 4.204 | 3948.95 | 15:15 | 3894.95 | 1.37% |
| ICICIPRULI | Insurance | 5 Jun | 11:15 | stall_at_highs | 75.10 | 0.696 | 3.858 | 488.65 | 13:45 | 482.30 | 1.30% |
| HCLTECH | IT | 1 Jun | 12:15 | stall_at_highs | 74.78 | 0.274 (close) | 2.431 | 1209.90 | 15:15 | 1194.35 | 1.29% |
| JSWSTEEL | Metal | 10 Jun | 12:30 | stall_at_highs | 81.30 | 0.415 | 2.909 | 1287.35 | 15:00 | 1270.70 | 1.29% |
| KPITTECH | IT | 15 Jun | 12:15 | smi_exit_overbought | 68.38 | 1.721 | 3.015 | 765.15 | 15:15 | 755.98 | 1.20% |
| VEDL | Metal | 11 Jun | 12:00 | stall_at_highs | 83.03 | 0.954 | 3.993 | 308.23 | 14:45 | 304.60 | 1.18% |
| LTM | IT | 1 Jun | 12:30 | stall_at_highs | 79.63 | 1.559 | 4.680 | 4244.20 | 15:15 | 4196.50 | 1.12% |
| INDUSINDBK | Bank | 15 Jun | 12:00 | smi_exit_overbought | 76.66 | 1.044 | 3.918 | 941.95 | 14:15 | 931.53 | 1.11% |
| APOLLOHOSP | Health | 8 Jun | 12:00 | stall_at_highs | 77.50 | 0.606 | 2.362 | 8440.75 | 15:15 | 8353.50 | 1.03% |
| NATIONALUM | Metal | 12 Jun | 11:45 | smi_exit_overbought | 71.82 | 1.558 | 3.241 | 380.17 | 14:15 | 376.33 | 1.01% |
| TECHM | IT | 1 Jun | 12:30 | stall_at_highs | 95.68 | 1.170 | 5.309 | 1516.90 | 15:15 | 1502.40 | 0.96% |
| SBIN | Bank | 4 Jun | 11:00 | smi_cross | 84.85 | 0.555 | 3.835 | 983.80 | 13:15 | 974.58 | 0.94% |
| DIVISLAB | Health | 4 Jun | 12:15 | smi_exit_overbought | 68.16 | 0.839 | 1.426 | 6647.00 | 15:15 | 6594.75 | 0.79% |
| LICI | Insurance | 15 Jun | 11:15 | stall_at_highs | 82.54 | 1.352 | 4.451 | 399.08 | 12:45 | 396.05 | 0.76% |

## BUY hits (≥ 0.75%)

| Stock | Sector | Date | Event | Kind | RSI | BB upper % | BB lower % | Buy price | Best SQ off | SQ price | Profit % |
|-------|--------|------|-------|------|-----|------------|------------|------------|-------------|----------|----------|
| CANBK | Bank | 9 Jun | 09:30 | smi_exit_oversold | 45.72 | 0.424 | 0.369 | 128.67 | 15:15 | 133.22 | 3.54% |
| GICRE | Insurance | 12 Jun | 09:30 | smi_exit_oversold | 37.34 | 1.245 | 0.556 | 372.53 | 15:00 | 379.55 | 1.88% |
| M&M | Automobile | 12 Jun | 13:00 | stall_at_lows | 41.85 | 0.600 | 0.199 (close) | 2995.45 | 15:15 | 3041.25 | 1.53% |
| HINDALCO | Metal | 9 Jun | 09:45 | smi_exit_oversold | 32.66 | 1.264 | 0.357 | 1063.10 | 14:15 | 1078.65 | 1.46% |
| LUPIN | Health | 11 Jun | 10:00 | stall_at_lows | 35.05 | 1.029 | 0.305 | 2255.50 | 14:00 | 2282.80 | 1.21% |
| KPITTECH | IT | 9 Jun | 10:00 | stall_at_lows | 25.49 | 2.193 | 0.473 (crossed) | 748.73 | 15:15 | 756.85 | 1.08% |
| MARUTI | Automobile | 11 Jun | 10:30 | smi_exit_oversold | 39.06 | 1.084 | 0.599 | 13076.00 | 12:15 | 13194.50 | 0.91% |
| AUROPHARMA | Health | 10 Jun | 10:15 | smi_exit_oversold | 54.74 | 0.417 | 0.288 (close) | 1454.45 | 11:45 | 1466.55 | 0.83% |

## Misses (best SQ < 0.75%)

| Stock | Sector | Date | Event | Kind | RSI | BB upper % | BB lower % | Entry price | Best SQ off | SQ price | Profit % |
|-------|--------|------|-------|------|-----|------------|------------|------------|-------------|----------|----------|
| GICRE | Insurance | 1 Jun | 09:45 | stall_at_lows | 31.19 | 1.472 | 0.043 (close) | 381.88 | 10:45 | 382.20 | 0.08% |
| LTM | IT | 2 Jun | 12:15 | stall_at_highs | 77.15 | 1.247 | 3.057 | 4324.35 | 12:30 | 4323.75 | 0.01% |
| HCLTECH | IT | 2 Jun | 11:00 | smi_cross | 69.80 | 0.319 | 4.701 | 1244.35 | 13:30 | 1237.90 | 0.52% |
| ICICIBANK | Bank | 2 Jun | 10:30 | stall_at_lows | 29.97 | 1.724 | 0.237 (close) | 1228.90 | 13:30 | 1235.65 | 0.55% |
| APOLLOHOSP | Health | 3 Jun | 12:15 | stall_at_highs | 76.95 | 0.676 | 2.881 | 8274.50 | 13:30 | 8264.50 | 0.12% |
| COFORGE | IT | 4 Jun | 12:30 | stall_at_highs | 72.79 | 0.378 | 1.203 | 1434.20 | 14:45 | 1431.05 | 0.22% |
| HINDALCO | Metal | 5 Jun | 11:00 | stall_at_lows | 21.12 | 2.638 | 0.195 (close) | 1104.85 | 12:15 | 1100.85 | -0.36% |
| ICICIGI | Insurance | 5 Jun | 12:00 | smi_exit_overbought | 69.96 | 0.718 | 1.897 | 1758.10 | 13:00 | 1752.60 | 0.31% |
| TCS | IT | 8 Jun | 10:30 | smi_exit_oversold | 33.14 | 2.603 | 0.579 | 2169.70 | 10:45 | 2168.35 | -0.06% |
| ALKEM | Health | 8 Jun | 12:00 | smi_cross | 72.45 | 0.411 | 3.460 | 5373.50 | 15:15 | 5344.50 | 0.54% |
| LICI | Insurance | 9 Jun | 11:45 | stall_at_highs | 80.49 | 0.225 (close) | 1.399 | 390.65 | 12:45 | 390.95 | -0.08% |
| PNB | Bank | 9 Jun | 11:15 | smi_cross | 68.85 | 0.099 (crossed) | 2.147 | 104.95 | 11:30 | 104.98 | -0.02% |
| LICI | Insurance | 9 Jun | 12:30 | smi_cross | 76.43 | 0.305 | 1.368 | 391.20 | 12:45 | 390.95 | 0.06% |
| JINDALSTEL | Metal | 9 Jun | 10:00 | smi_exit_oversold | 29.85 | 1.663 | 0.586 | 1159.35 | 11:15 | 1160.95 | 0.14% |
| CIPLA | Health | 9 Jun | 11:00 | stall_at_lows | 53.11 | 0.517 | 0.261 (close) | 1388.40 | 11:45 | 1391.40 | 0.22% |
| CANBK | Bank | 9 Jun | 12:30 | smi_cross | 96.71 | 0.007 (crossed) | 4.368 | 132.70 | 13:00 | 132.14 | 0.42% |
| M&M | Automobile | 9 Jun | 12:00 | smi_cross | 76.46 | 0.443 | 1.776 | 3010.10 | 13:15 | 2988.80 | 0.71% |
| TMPV | Automobile | 10 Jun | 11:00 | smi_exit_oversold | 43.26 | 0.782 | 0.069 (close) | 385.60 | 11:30 | 386.65 | 0.27% |
| M&M | Automobile | 10 Jun | 11:00 | stall_at_lows | 41.62 | 0.857 | 0.284 (close) | 2981.20 | 13:00 | 2991.30 | 0.34% |
| KOTAKBANK | Bank | 10 Jun | 12:00 | stall_at_highs | 73.28 | 0.857 | 2.986 | 389.25 | 14:45 | 387.65 | 0.41% |
| SUNPHARMA | Health | 10 Jun | 12:30 | stall_at_highs | 83.39 | 0.111 (close) | 1.266 | 1794.10 | 15:15 | 1784.00 | 0.56% |
| CIPLA | Health | 10 Jun | 09:30 | smi_exit_oversold | 45.13 | 0.705 | 0.269 (close) | 1380.60 | 11:30 | 1388.95 | 0.60% |
| LTM | IT | 11 Jun | 10:30 | stall_at_lows | 15.40 | 4.309 | 0.550 | 3853.70 | 13:30 | 3845.80 | -0.20% |
| ALKEM | Health | 11 Jun | 09:30 | stall_at_lows | 29.55 | 2.093 | 0.409 | 5303.50 | 14:15 | 5326.25 | 0.43% |
| CIPLA | Health | 11 Jun | 09:30 | stall_at_lows | 47.30 | 0.589 | 0.175 (close) | 1379.60 | 12:30 | 1387.95 | 0.61% |
| ICICIBANK | Bank | 11 Jun | 12:15 | stall_at_highs | 94.52 | 0.736 | 2.913 | 1324.95 | 15:15 | 1316.10 | 0.67% |
| HDFCBANK | Bank | 12 Jun | 12:15 | smi_exit_overbought | 78.87 | 0.956 | 2.000 | 758.48 | 12:30 | 758.18 | 0.04% |
| ASHOKLEY | Automobile | 12 Jun | 11:15 | smi_cross | 76.34 | 1.603 | 6.023 | 144.74 | 11:30 | 144.67 | 0.05% |
| DIVISLAB | Health | 12 Jun | 11:00 | stall_at_lows | 48.45 | 0.609 | 0.242 (close) | 6659.50 | 11:30 | 6679.00 | 0.29% |
| CANBK | Bank | 12 Jun | 12:00 | smi_exit_overbought | 71.75 | 1.381 | 2.423 | 129.59 | 13:00 | 128.98 | 0.47% |
| WIPRO | IT | 12 Jun | 11:45 | smi_exit_overbought | 72.24 | 0.294 (close) | 1.340 | 178.88 | 13:15 | 177.90 | 0.55% |
| ICICIGI | Insurance | 15 Jun | 11:30 | stall_at_highs | 81.57 | 1.051 | 4.028 | 1732.35 | 12:30 | 1731.90 | 0.03% |
| SBILIFE | Insurance | 15 Jun | 11:30 | smi_cross | 79.57 | 0.380 | 3.114 | 1745.60 | 13:45 | 1744.75 | 0.05% |
| EICHERMOT | Automobile | 15 Jun | 11:45 | stall_at_highs | 86.72 | 1.085 | 4.569 | 7548.00 | 12:30 | 7527.00 | 0.28% |
| M&M | Automobile | 15 Jun | 12:30 | smi_exit_overbought | 74.32 | 1.591 | 3.991 | 3143.15 | 15:15 | 3134.25 | 0.28% |
| WIPRO | IT | 15 Jun | 11:45 | smi_exit_overbought | 70.98 | 0.854 | 2.155 | 181.89 | 15:15 | 181.32 | 0.32% |
| HDFCLIFE | Insurance | 15 Jun | 11:15 | smi_cross | 83.56 | 1.190 | 5.565 | 573.65 | 12:45 | 571.75 | 0.33% |
| INFY | IT | 15 Jun | 12:00 | smi_exit_overbought | 72.83 | 0.772 | 2.951 | 1140.45 | 15:00 | 1134.80 | 0.50% |
| ICICIPRULI | Insurance | 15 Jun | 12:00 | smi_cross | 96.01 | 1.023 | 5.072 | 487.42 | 15:15 | 484.85 | 0.53% |

## Notes

- Same-day square-off only; no overnight holds.
- Kite Connect historical 15m only — same enhanced deeppro engine as Post-Mortem / Day Scan.
- Quality gates: SELL event 10:45–12:30 + RSI/BB rules; BUY BB-match recovery / morning unmatched proximity / extreme-stall paths.
- Hit rate uses best later same-day mid before 15:15 (study metric; not a live fill guarantee).

