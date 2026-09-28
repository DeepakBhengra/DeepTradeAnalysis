# PNB · 09:15 vs previous close · 15m · last 60 trading days

- **Stock:** PNB
- **Chart:** 15-minute NSE session bars (09:15–15:15 IST)
- **09:15 price:** open of the 09:15 candle
- **Previous day close:** close of the last 15m bar of the prior session
- **Day trend:** session close versus that day's 09:15 open (downtrend = closed below 09:15, uptrend = closed above 09:15)
- **Next day high / low:** highest high and lowest low of that same session's 15m bars; time is the first 15m candle that printed the extreme (IST)
- **Window:** 2026-07-03 → 2026-09-25 (60 comparable sessions; one extra prior day used for the first previous close)
- **Data:** Upstox public 1m resampled to 15m (NSE_EQ|INE160A01022)
- **Generated (UTC):** 2026-09-28T00:22:42.785Z

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

- Matches in window: **16/26** gap-up days (61.5%)

## All sessions

Rows marked **bold** match one of the two requested patterns (gap down + downtrend, or gap up + uptrend).

| Date | Stock | Previous day close ₹ | Next day 09:15 price ₹ | Opened vs previous close | That day trend | Next day low ₹ | Low time (IST) | Next day high ₹ | High time (IST) |
|------|-------|---------------------:|-----------------------:|--------------------------|----------------|---------------:|----------------|----------------:|-----------------|
| 2026-07-03 | PNB | 106.86 | 107.00 | upper | downtrend | 104.11 | 09:30 | 107.01 | 09:15 |
| 2026-07-06 | PNB | 105.29 | 105.30 | upper | downtrend | 104.15 | 15:15 | 105.64 | 09:15 |
| 2026-07-07 | PNB | 104.25 | 104.75 | upper | downtrend | 103.14 | 12:15 | 104.75 | 09:15 |
| 2026-07-08 | PNB | 103.69 | 103.25 | lower ** | downtrend ** | 100.45 | 14:45 | 103.25 | 09:15 |
| 2026-07-09 | PNB | 101.09 | 101.20 | upper ** | uptrend ** | 100.80 | 09:15 | 103.70 | 14:45 |
| 2026-07-10 | PNB | 103.70 | 104.10 | upper ** | uptrend ** | 103.71 | 09:30 | 107.55 | 13:00 |
| 2026-07-13 | PNB | 105.58 | 104.60 | lower | uptrend | 104.00 | 09:15 | 106.45 | 14:45 |
| 2026-07-14 | PNB | 106.31 | 106.00 | lower ** | downtrend ** | 104.60 | 13:30 | 106.30 | 09:15 |
| 2026-07-15 | PNB | 104.90 | 105.50 | upper ** | uptrend ** | 104.88 | 09:15 | 106.93 | 12:15 |
| 2026-07-16 | PNB | 105.72 | 106.09 | upper | downtrend | 104.90 | 13:45 | 106.09 | 09:15 |
| 2026-07-17 | PNB | 105.15 | 105.25 | upper ** | uptrend ** | 104.59 | 11:30 | 106.10 | 15:15 |
| 2026-07-20 | PNB | 106.01 | 108.26 | upper ** | uptrend ** | 107.40 | 09:15 | 111.95 | 14:15 |
| 2026-07-21 | PNB | 111.70 | 111.70 | unchanged | uptrend | 111.31 | 09:15 | 113.38 | 09:15 |
| 2026-07-22 | PNB | 112.10 | 112.08 | lower ** | downtrend ** | 110.35 | 14:30 | 112.82 | 09:15 |
| 2026-07-23 | PNB | 110.41 | 110.00 | lower | flat | 109.55 | 09:15 | 111.00 | 10:00 |
| 2026-07-24 | PNB | 110.00 | 109.00 | lower | uptrend | 108.71 | 09:15 | 110.64 | 14:00 |
| 2026-07-27 | PNB | 110.35 | 111.25 | upper ** | uptrend ** | 110.76 | 10:30 | 112.23 | 09:30 |
| 2026-07-28 | PNB | 111.53 | 111.62 | upper ** | uptrend ** | 111.18 | 09:15 | 112.33 | 11:30 |
| 2026-07-29 | PNB | 111.79 | 112.30 | upper | downtrend | 110.89 | 15:15 | 112.30 | 09:15 |
| 2026-07-30 | PNB | 111.07 | 111.05 | lower | uptrend | 110.32 | 09:15 | 111.90 | 15:15 |
| 2026-07-31 | PNB | 111.80 | 112.00 | upper ** | uptrend ** | 111.69 | 09:30 | 113.00 | 13:15 |
| 2026-08-03 | PNB | 112.65 | 113.01 | upper | downtrend | 112.66 | 09:15 | 114.47 | 10:00 |
| 2026-08-04 | PNB | 113.00 | 113.49 | upper ** | uptrend ** | 112.64 | 09:15 | 114.00 | 10:00 |
| 2026-08-05 | PNB | 113.99 | 114.16 | upper | downtrend | 113.30 | 15:00 | 115.20 | 09:30 |
| 2026-08-06 | PNB | 113.55 | 113.55 | unchanged | uptrend | 113.20 | 09:15 | 114.85 | 14:45 |
| 2026-08-07 | PNB | 114.30 | 114.01 | lower | uptrend | 113.60 | 09:15 | 115.37 | 14:15 |
| 2026-08-10 | PNB | 114.81 | 114.81 | unchanged | downtrend | 113.20 | 15:00 | 115.19 | 09:15 |
| 2026-08-11 | PNB | 113.50 | 113.50 | unchanged | uptrend | 112.30 | 09:45 | 114.30 | 13:30 |
| 2026-08-12 | PNB | 114.03 | 113.95 | lower | uptrend | 113.72 | 09:15 | 119.50 | 10:15 |
| 2026-08-13 | PNB | 118.98 | 118.62 | lower ** | downtrend ** | 117.31 | 09:15 | 119.35 | 09:45 |
| 2026-08-14 | PNB | 117.59 | 117.88 | upper ** | uptrend ** | 117.40 | 15:00 | 118.90 | 10:00 |
| 2026-08-17 | PNB | 118.00 | 117.11 | lower | uptrend | 115.32 | 10:15 | 118.06 | 14:45 |
| 2026-08-18 | PNB | 117.32 | 117.00 | lower ** | downtrend ** | 116.50 | 10:45 | 117.99 | 09:15 |
| 2026-08-19 | PNB | 116.50 | 116.45 | lower | uptrend | 116.03 | 09:15 | 117.59 | 11:45 |
| 2026-08-20 | PNB | 117.48 | 117.90 | upper ** | uptrend ** | 117.44 | 09:15 | 119.10 | 12:45 |
| 2026-08-21 | PNB | 118.00 | 117.45 | lower ** | downtrend ** | 115.41 | 09:30 | 117.52 | 09:15 |
| 2026-08-24 | PNB | 116.55 | 116.50 | lower ** | downtrend ** | 115.00 | 11:15 | 117.03 | 09:15 |
| 2026-08-25 | PNB | 115.86 | 115.61 | lower | uptrend | 115.01 | 09:15 | 116.90 | 11:15 |
| 2026-08-26 | PNB | 115.93 | 116.93 | upper | downtrend | 116.39 | 15:00 | 118.20 | 09:15 |
| 2026-08-27 | PNB | 116.70 | 116.70 | unchanged | downtrend | 115.07 | 13:45 | 117.20 | 09:15 |
| 2026-08-28 | PNB | 115.40 | 114.81 | lower | uptrend | 114.42 | 09:15 | 115.75 | 14:00 |
| 2026-08-31 | PNB | 115.40 | 115.00 | lower ** | downtrend ** | 113.16 | 10:45 | 115.35 | 14:45 |
| 2026-09-01 | PNB | 114.23 | 114.49 | upper ** | uptrend ** | 114.07 | 09:15 | 116.50 | 12:30 |
| 2026-09-02 | PNB | 115.22 | 114.65 | lower | uptrend | 113.92 | 09:15 | 117.25 | 13:00 |
| 2026-09-03 | PNB | 117.00 | 117.95 | upper | downtrend | 116.32 | 15:15 | 118.25 | 09:15 |
| 2026-09-04 | PNB | 116.32 | 116.90 | upper ** | uptrend ** | 116.45 | 09:15 | 118.05 | 11:30 |
| 2026-09-07 | PNB | 117.00 | 116.41 | lower ** | downtrend ** | 115.55 | 10:45 | 117.17 | 09:15 |
| 2026-09-08 | PNB | 115.60 | 115.75 | upper ** | uptrend ** | 114.95 | 09:15 | 116.68 | 10:15 |
| 2026-09-09 | PNB | 116.00 | 115.25 | lower | uptrend | 115.25 | 09:15 | 117.00 | 12:45 |
| 2026-09-10 | PNB | 115.61 | 115.50 | lower | uptrend | 115.47 | 09:15 | 118.20 | 10:15 |
| 2026-09-11 | PNB | 116.85 | 116.00 | lower | uptrend | 114.52 | 09:15 | 117.79 | 14:30 |
| 2026-09-15 | PNB | 116.75 | 116.75 | unchanged | downtrend | 114.70 | 15:15 | 117.23 | 09:15 |
| 2026-09-16 | PNB | 114.70 | 114.73 | upper ** | uptrend ** | 114.63 | 09:15 | 117.48 | 13:00 |
| 2026-09-17 | PNB | 116.80 | 116.80 | unchanged | downtrend | 116.36 | 14:00 | 119.40 | 09:30 |
| 2026-09-18 | PNB | 116.47 | 117.00 | upper ** | uptrend ** | 116.50 | 12:00 | 117.50 | 14:45 |
| 2026-09-21 | PNB | 117.27 | 117.23 | lower | uptrend | 116.64 | 09:15 | 118.58 | 14:45 |
| 2026-09-22 | PNB | 118.00 | 118.45 | upper | downtrend | 116.70 | 14:00 | 118.74 | 09:15 |
| 2026-09-23 | PNB | 117.00 | 116.61 | lower | uptrend | 116.61 | 09:15 | 118.90 | 14:15 |
| 2026-09-24 | PNB | 118.30 | 117.25 | lower ** | downtrend ** | 117.06 | 13:45 | 118.67 | 09:15 |
| 2026-09-25 | PNB | 117.12 | 117.12 | unchanged | downtrend | 116.23 | 13:15 | 118.01 | 09:15 |
