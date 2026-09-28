# PNB · 09:15 vs previous close · 15m · last 60 trading days

- **Stock:** PNB
- **Chart:** 15-minute NSE session bars (09:15–15:15 IST)
- **09:15 price:** open of the 09:15 candle
- **Previous day close:** close of the last 15m bar of the prior session
- **Day trend:** session close versus that day's 09:15 open (downtrend = closed below 09:15, uptrend = closed above 09:15)
- **Next day high / low:** highest high and lowest low of that same session's 15m bars; time is the first 15m candle that printed the extreme (IST)
- **09:15 candle color:** green if that bar's close > open, red if close < open, doji if equal
- **09:15 high / low / close:** high, low, and close of the 09:15 15m candle; crossed upward / downward if that wick goes through the previous close
- **Window:** 2026-07-03 → 2026-09-25 (60 comparable sessions; one extra prior day used for the first previous close)
- **Data:** Upstox public 1m resampled to 15m (NSE_EQ|INE160A01022)
- **Generated (UTC):** 2026-09-28T01:02:25.553Z

## Requested examples

### Gap down at 09:15 and the day was a downtrend

Opened **lower** than the previous close, and closed **below** 09:15.

- **Date:** Thu, 24 Sept 2026 (`2026-09-24`)
- **Previous day close:** ₹118.30
- **09:15 price:** ₹117.25 (-0.89% vs previous close)
- **Opened:** lower
- **Session close:** ₹117.12 (-0.11% from 09:15)
- **Day trend:** downtrend
- **Next day low:** ₹117.06 at 13:45 IST
- **Next day high:** ₹118.67 at 09:15 IST
- **09:15 candle color:** green
- **09:15 high:** ₹118.67 — highest of 09:15 am price crossed upward the prev close price
- **09:15 low:** ₹117.25 — lowest of 09:15 am price crossed downward the prev close price
- **09:15 close:** ₹117.85

- Matches in window: **10/26** gap-down days (38.5%)

### Gap up at 09:15 and the day was an uptrend

Opened **upper** than the previous close, and closed **above** 09:15.

- **Date:** Fri, 18 Sept 2026 (`2026-09-18`)
- **Previous day close:** ₹116.47
- **09:15 price:** ₹117.00 (+0.46% vs previous close)
- **Opened:** upper
- **Session close:** ₹117.27 (+0.23% from 09:15)
- **Day trend:** uptrend
- **Next day low:** ₹116.50 at 12:00 IST
- **Next day high:** ₹117.50 at 14:45 IST
- **09:15 candle color:** red
- **09:15 high:** ₹117.44 — highest of 09:15 am price crossed upward the prev close price
- **09:15 low:** ₹116.64
- **09:15 close:** ₹116.85

- Matches in window: **16/26** gap-up days (61.5%)

## All sessions

Rows marked **bold** match one of the two requested patterns (gap down + downtrend, or gap up + uptrend).

| Date | Stock | Previous day close ₹ | Next day 09:15 price ₹ | 09:15 candle color | 09:15 high ₹ | 09:15 low ₹ | 09:15 close ₹ | 09:15 high vs prev close | 09:15 low vs prev close | Opened vs previous close | That day trend | Next day low ₹ | Low time (IST) | Next day high ₹ | High time (IST) |
|------|-------|---------------------:|-----------------------:|--------------------|-------------:|------------:|--------------:|--------------------------|-------------------------|--------------------------|----------------|---------------:|----------------|----------------:|-----------------|
| 2026-07-03 | PNB | 106.86 | 107.00 | red | 107.01 | 104.25 | 104.50 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | upper | downtrend | 104.11 | 09:30 | 107.01 | 09:15 |
| 2026-07-06 | PNB | 105.29 | 105.30 | red | 105.64 | 104.30 | 104.60 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | upper | downtrend | 104.15 | 15:15 | 105.64 | 09:15 |
| 2026-07-07 | PNB | 104.25 | 104.75 | red | 104.75 | 103.88 | 104.13 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | upper | downtrend | 103.14 | 12:15 | 104.75 | 09:15 |
| 2026-07-08 | PNB | 103.69 | 103.25 | red | 103.25 | 102.35 | 102.40 | no | lowest of 09:15 am price crossed downward the prev close price | lower ** | downtrend ** | 100.45 | 14:45 | 103.25 | 09:15 |
| 2026-07-09 | PNB | 101.09 | 101.20 | green | 101.55 | 100.80 | 101.36 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | upper ** | uptrend ** | 100.80 | 09:15 | 103.70 | 14:45 |
| 2026-07-10 | PNB | 103.70 | 104.10 | red | 104.40 | 103.81 | 103.87 | highest of 09:15 am price crossed upward the prev close price | no | upper ** | uptrend ** | 103.71 | 09:30 | 107.55 | 13:00 |
| 2026-07-13 | PNB | 105.58 | 104.60 | green | 104.92 | 104.00 | 104.74 | no | lowest of 09:15 am price crossed downward the prev close price | lower | uptrend | 104.00 | 09:15 | 106.45 | 14:45 |
| 2026-07-14 | PNB | 106.31 | 106.00 | red | 106.30 | 105.55 | 105.69 | no | lowest of 09:15 am price crossed downward the prev close price | lower ** | downtrend ** | 104.60 | 13:30 | 106.30 | 09:15 |
| 2026-07-15 | PNB | 104.90 | 105.50 | green | 105.93 | 104.88 | 105.84 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | upper ** | uptrend ** | 104.88 | 09:15 | 106.93 | 12:15 |
| 2026-07-16 | PNB | 105.72 | 106.09 | red | 106.09 | 105.40 | 105.60 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | upper | downtrend | 104.90 | 13:45 | 106.09 | 09:15 |
| 2026-07-17 | PNB | 105.15 | 105.25 | green | 105.41 | 104.80 | 105.29 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | upper ** | uptrend ** | 104.59 | 11:30 | 106.10 | 15:15 |
| 2026-07-20 | PNB | 106.01 | 108.26 | green | 111.48 | 107.40 | 111.10 | highest of 09:15 am price crossed upward the prev close price | no | upper ** | uptrend ** | 107.40 | 09:15 | 111.95 | 14:15 |
| 2026-07-21 | PNB | 111.70 | 111.70 | green | 113.38 | 111.31 | 112.62 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | unchanged | uptrend | 111.31 | 09:15 | 113.38 | 09:15 |
| 2026-07-22 | PNB | 112.10 | 112.08 | red | 112.82 | 111.15 | 111.16 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | lower ** | downtrend ** | 110.35 | 14:30 | 112.82 | 09:15 |
| 2026-07-23 | PNB | 110.41 | 110.00 | green | 110.40 | 109.55 | 110.09 | no | lowest of 09:15 am price crossed downward the prev close price | lower | flat | 109.55 | 09:15 | 111.00 | 10:00 |
| 2026-07-24 | PNB | 110.00 | 109.00 | green | 109.60 | 108.71 | 109.25 | no | lowest of 09:15 am price crossed downward the prev close price | lower | uptrend | 108.71 | 09:15 | 110.64 | 14:00 |
| 2026-07-27 | PNB | 110.35 | 111.25 | green | 112.10 | 110.96 | 112.06 | highest of 09:15 am price crossed upward the prev close price | no | upper ** | uptrend ** | 110.76 | 10:30 | 112.23 | 09:30 |
| 2026-07-28 | PNB | 111.53 | 111.62 | green | 111.94 | 111.18 | 111.75 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | upper ** | uptrend ** | 111.18 | 09:15 | 112.33 | 11:30 |
| 2026-07-29 | PNB | 111.79 | 112.30 | red | 112.30 | 111.26 | 111.40 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | upper | downtrend | 110.89 | 15:15 | 112.30 | 09:15 |
| 2026-07-30 | PNB | 111.07 | 111.05 | red | 111.08 | 110.32 | 110.76 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | lower | uptrend | 110.32 | 09:15 | 111.90 | 15:15 |
| 2026-07-31 | PNB | 111.80 | 112.00 | green | 112.57 | 112.00 | 112.28 | highest of 09:15 am price crossed upward the prev close price | no | upper ** | uptrend ** | 111.69 | 09:30 | 113.00 | 13:15 |
| 2026-08-03 | PNB | 112.65 | 113.01 | red | 113.75 | 112.66 | 112.77 | highest of 09:15 am price crossed upward the prev close price | no | upper | downtrend | 112.66 | 09:15 | 114.47 | 10:00 |
| 2026-08-04 | PNB | 113.00 | 113.49 | red | 113.65 | 112.64 | 113.16 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | upper ** | uptrend ** | 112.64 | 09:15 | 114.00 | 10:00 |
| 2026-08-05 | PNB | 113.99 | 114.16 | green | 115.07 | 114.01 | 114.75 | highest of 09:15 am price crossed upward the prev close price | no | upper | downtrend | 113.30 | 15:00 | 115.20 | 09:30 |
| 2026-08-06 | PNB | 113.55 | 113.55 | green | 114.25 | 113.20 | 114.09 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | unchanged | uptrend | 113.20 | 09:15 | 114.85 | 14:45 |
| 2026-08-07 | PNB | 114.30 | 114.01 | green | 114.22 | 113.60 | 114.04 | no | lowest of 09:15 am price crossed downward the prev close price | lower | uptrend | 113.60 | 09:15 | 115.37 | 14:15 |
| 2026-08-10 | PNB | 114.81 | 114.81 | red | 115.19 | 114.25 | 114.47 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | unchanged | downtrend | 113.20 | 15:00 | 115.19 | 09:15 |
| 2026-08-11 | PNB | 113.50 | 113.50 | red | 113.50 | 112.58 | 112.92 | no | lowest of 09:15 am price crossed downward the prev close price | unchanged | uptrend | 112.30 | 09:45 | 114.30 | 13:30 |
| 2026-08-12 | PNB | 114.03 | 113.95 | green | 117.30 | 113.72 | 116.78 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | lower | uptrend | 113.72 | 09:15 | 119.50 | 10:15 |
| 2026-08-13 | PNB | 118.98 | 118.62 | red | 118.73 | 117.31 | 117.83 | no | lowest of 09:15 am price crossed downward the prev close price | lower ** | downtrend ** | 117.31 | 09:15 | 119.35 | 09:45 |
| 2026-08-14 | PNB | 117.59 | 117.88 | green | 118.46 | 117.65 | 118.20 | highest of 09:15 am price crossed upward the prev close price | no | upper ** | uptrend ** | 117.40 | 15:00 | 118.90 | 10:00 |
| 2026-08-17 | PNB | 118.00 | 117.11 | red | 117.39 | 116.11 | 116.18 | no | lowest of 09:15 am price crossed downward the prev close price | lower | uptrend | 115.32 | 10:15 | 118.06 | 14:45 |
| 2026-08-18 | PNB | 117.32 | 117.00 | red | 117.99 | 116.72 | 116.82 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | lower ** | downtrend ** | 116.50 | 10:45 | 117.99 | 09:15 |
| 2026-08-19 | PNB | 116.50 | 116.45 | green | 116.82 | 116.03 | 116.67 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | lower | uptrend | 116.03 | 09:15 | 117.59 | 11:45 |
| 2026-08-20 | PNB | 117.48 | 117.90 | red | 118.52 | 117.44 | 117.75 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | upper ** | uptrend ** | 117.44 | 09:15 | 119.10 | 12:45 |
| 2026-08-21 | PNB | 118.00 | 117.45 | red | 117.52 | 115.64 | 115.87 | no | lowest of 09:15 am price crossed downward the prev close price | lower ** | downtrend ** | 115.41 | 09:30 | 117.52 | 09:15 |
| 2026-08-24 | PNB | 116.55 | 116.50 | green | 117.03 | 116.13 | 116.65 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | lower ** | downtrend ** | 115.00 | 11:15 | 117.03 | 09:15 |
| 2026-08-25 | PNB | 115.86 | 115.61 | green | 116.43 | 115.01 | 116.06 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | lower | uptrend | 115.01 | 09:15 | 116.90 | 11:15 |
| 2026-08-26 | PNB | 115.93 | 116.93 | green | 118.20 | 116.61 | 117.86 | highest of 09:15 am price crossed upward the prev close price | no | upper | downtrend | 116.39 | 15:00 | 118.20 | 09:15 |
| 2026-08-27 | PNB | 116.70 | 116.70 | green | 117.20 | 116.46 | 116.94 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | unchanged | downtrend | 115.07 | 13:45 | 117.20 | 09:15 |
| 2026-08-28 | PNB | 115.40 | 114.81 | green | 115.55 | 114.42 | 115.37 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | lower | uptrend | 114.42 | 09:15 | 115.75 | 14:00 |
| 2026-08-31 | PNB | 115.40 | 115.00 | red | 115.03 | 113.72 | 114.11 | no | lowest of 09:15 am price crossed downward the prev close price | lower ** | downtrend ** | 113.16 | 10:45 | 115.35 | 14:45 |
| 2026-09-01 | PNB | 114.23 | 114.49 | green | 115.18 | 114.07 | 114.95 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | upper ** | uptrend ** | 114.07 | 09:15 | 116.50 | 12:30 |
| 2026-09-02 | PNB | 115.22 | 114.65 | green | 115.46 | 113.92 | 115.37 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | lower | uptrend | 113.92 | 09:15 | 117.25 | 13:00 |
| 2026-09-03 | PNB | 117.00 | 117.95 | red | 118.25 | 117.14 | 117.32 | highest of 09:15 am price crossed upward the prev close price | no | upper | downtrend | 116.32 | 15:15 | 118.25 | 09:15 |
| 2026-09-04 | PNB | 116.32 | 116.90 | red | 117.00 | 116.45 | 116.83 | highest of 09:15 am price crossed upward the prev close price | no | upper ** | uptrend ** | 116.45 | 09:15 | 118.05 | 11:30 |
| 2026-09-07 | PNB | 117.00 | 116.41 | red | 117.17 | 116.01 | 116.05 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | lower ** | downtrend ** | 115.55 | 10:45 | 117.17 | 09:15 |
| 2026-09-08 | PNB | 115.60 | 115.75 | green | 116.19 | 114.95 | 116.06 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | upper ** | uptrend ** | 114.95 | 09:15 | 116.68 | 10:15 |
| 2026-09-09 | PNB | 116.00 | 115.25 | green | 116.29 | 115.25 | 115.92 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | lower | uptrend | 115.25 | 09:15 | 117.00 | 12:45 |
| 2026-09-10 | PNB | 115.61 | 115.50 | green | 117.08 | 115.47 | 116.90 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | lower | uptrend | 115.47 | 09:15 | 118.20 | 10:15 |
| 2026-09-11 | PNB | 116.85 | 116.00 | red | 116.11 | 114.52 | 115.51 | no | lowest of 09:15 am price crossed downward the prev close price | lower | uptrend | 114.52 | 09:15 | 117.79 | 14:30 |
| 2026-09-15 | PNB | 116.75 | 116.75 | red | 117.23 | 116.23 | 116.66 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | unchanged | downtrend | 114.70 | 15:15 | 117.23 | 09:15 |
| 2026-09-16 | PNB | 114.70 | 114.73 | green | 116.40 | 114.63 | 115.33 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | upper ** | uptrend ** | 114.63 | 09:15 | 117.48 | 13:00 |
| 2026-09-17 | PNB | 116.80 | 116.80 | green | 118.80 | 116.49 | 118.60 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | unchanged | downtrend | 116.36 | 14:00 | 119.40 | 09:30 |
| 2026-09-18 | PNB | 116.47 | 117.00 | red | 117.44 | 116.64 | 116.85 | highest of 09:15 am price crossed upward the prev close price | no | upper ** | uptrend ** | 116.50 | 12:00 | 117.50 | 14:45 |
| 2026-09-21 | PNB | 117.27 | 117.23 | red | 117.80 | 116.64 | 117.22 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | lower | uptrend | 116.64 | 09:15 | 118.58 | 14:45 |
| 2026-09-22 | PNB | 118.00 | 118.45 | red | 118.74 | 118.03 | 118.09 | highest of 09:15 am price crossed upward the prev close price | no | upper | downtrend | 116.70 | 14:00 | 118.74 | 09:15 |
| 2026-09-23 | PNB | 117.00 | 116.61 | green | 117.47 | 116.61 | 117.44 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | lower | uptrend | 116.61 | 09:15 | 118.90 | 14:15 |
| 2026-09-24 | PNB | 118.30 | 117.25 | green | 118.67 | 117.25 | 117.85 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | lower ** | downtrend ** | 117.06 | 13:45 | 118.67 | 09:15 |
| 2026-09-25 | PNB | 117.12 | 117.12 | red | 118.01 | 117.02 | 117.10 | highest of 09:15 am price crossed upward the prev close price | lowest of 09:15 am price crossed downward the prev close price | unchanged | downtrend | 116.23 | 13:15 | 118.01 | 09:15 |
