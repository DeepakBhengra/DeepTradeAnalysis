# PNB · 09:15 vs previous close · 15m · last 60 trading days

- **Stock:** PNB
- **Chart:** 15-minute NSE session bars (09:15–15:15 IST)
- **09:15 price:** open of the 09:15 candle
- **Previous day close:** close of the last 15m bar of the prior session
- **Day trend:** session close versus that day's 09:15 open (downtrend = closed below 09:15, uptrend = closed above 09:15)
- **Window:** 2026-07-03 → 2026-09-25 (60 comparable sessions; one extra prior day used for the first previous close)
- **Data:** Upstox public 1m resampled to 15m (NSE_EQ|INE160A01022)
- **Generated (UTC):** 2026-09-28T00:18:18.181Z

## Requested examples

### Gap down at 09:15 and the day was a downtrend

Opened **lower** than the previous close, and closed **below** 09:15.

- **Date:** Thu, 24 Sept 2026 (`2026-09-24`)
- **Previous day close:** ₹118.30
- **09:15 price:** ₹117.25 (-0.89% vs previous close)
- **Opened:** lower
- **Session close:** ₹117.12 (-0.11% from 09:15)
- **Day trend:** downtrend

- Matches in window: **10/26** gap-down days (38.5%)

### Gap up at 09:15 and the day was an uptrend

Opened **upper** than the previous close, and closed **above** 09:15.

- **Date:** Fri, 18 Sept 2026 (`2026-09-18`)
- **Previous day close:** ₹116.47
- **09:15 price:** ₹117.00 (+0.46% vs previous close)
- **Opened:** upper
- **Session close:** ₹117.27 (+0.23% from 09:15)
- **Day trend:** uptrend

- Matches in window: **16/26** gap-up days (61.5%)

## All sessions

Rows marked **bold** match one of the two requested patterns (gap down + downtrend, or gap up + uptrend).

| Date | Stock | Previous day close ₹ | Next day 09:15 price ₹ | Opened vs previous close | That day trend |
|------|-------|---------------------:|-----------------------:|--------------------------|----------------|
| 2026-07-03 | PNB | 106.86 | 107.00 | upper | downtrend |
| 2026-07-06 | PNB | 105.29 | 105.30 | upper | downtrend |
| 2026-07-07 | PNB | 104.25 | 104.75 | upper | downtrend |
| 2026-07-08 | PNB | 103.69 | 103.25 | lower ** | downtrend ** |
| 2026-07-09 | PNB | 101.09 | 101.20 | upper ** | uptrend ** |
| 2026-07-10 | PNB | 103.70 | 104.10 | upper ** | uptrend ** |
| 2026-07-13 | PNB | 105.58 | 104.60 | lower | uptrend |
| 2026-07-14 | PNB | 106.31 | 106.00 | lower ** | downtrend ** |
| 2026-07-15 | PNB | 104.90 | 105.50 | upper ** | uptrend ** |
| 2026-07-16 | PNB | 105.72 | 106.09 | upper | downtrend |
| 2026-07-17 | PNB | 105.15 | 105.25 | upper ** | uptrend ** |
| 2026-07-20 | PNB | 106.01 | 108.26 | upper ** | uptrend ** |
| 2026-07-21 | PNB | 111.70 | 111.70 | unchanged | uptrend |
| 2026-07-22 | PNB | 112.10 | 112.08 | lower ** | downtrend ** |
| 2026-07-23 | PNB | 110.41 | 110.00 | lower | flat |
| 2026-07-24 | PNB | 110.00 | 109.00 | lower | uptrend |
| 2026-07-27 | PNB | 110.35 | 111.25 | upper ** | uptrend ** |
| 2026-07-28 | PNB | 111.53 | 111.62 | upper ** | uptrend ** |
| 2026-07-29 | PNB | 111.79 | 112.30 | upper | downtrend |
| 2026-07-30 | PNB | 111.07 | 111.05 | lower | uptrend |
| 2026-07-31 | PNB | 111.80 | 112.00 | upper ** | uptrend ** |
| 2026-08-03 | PNB | 112.65 | 113.01 | upper | downtrend |
| 2026-08-04 | PNB | 113.00 | 113.49 | upper ** | uptrend ** |
| 2026-08-05 | PNB | 113.99 | 114.16 | upper | downtrend |
| 2026-08-06 | PNB | 113.55 | 113.55 | unchanged | uptrend |
| 2026-08-07 | PNB | 114.30 | 114.01 | lower | uptrend |
| 2026-08-10 | PNB | 114.81 | 114.81 | unchanged | downtrend |
| 2026-08-11 | PNB | 113.50 | 113.50 | unchanged | uptrend |
| 2026-08-12 | PNB | 114.03 | 113.95 | lower | uptrend |
| 2026-08-13 | PNB | 118.98 | 118.62 | lower ** | downtrend ** |
| 2026-08-14 | PNB | 117.59 | 117.88 | upper ** | uptrend ** |
| 2026-08-17 | PNB | 118.00 | 117.11 | lower | uptrend |
| 2026-08-18 | PNB | 117.32 | 117.00 | lower ** | downtrend ** |
| 2026-08-19 | PNB | 116.50 | 116.45 | lower | uptrend |
| 2026-08-20 | PNB | 117.48 | 117.90 | upper ** | uptrend ** |
| 2026-08-21 | PNB | 118.00 | 117.45 | lower ** | downtrend ** |
| 2026-08-24 | PNB | 116.55 | 116.50 | lower ** | downtrend ** |
| 2026-08-25 | PNB | 115.86 | 115.61 | lower | uptrend |
| 2026-08-26 | PNB | 115.93 | 116.93 | upper | downtrend |
| 2026-08-27 | PNB | 116.70 | 116.70 | unchanged | downtrend |
| 2026-08-28 | PNB | 115.40 | 114.81 | lower | uptrend |
| 2026-08-31 | PNB | 115.40 | 115.00 | lower ** | downtrend ** |
| 2026-09-01 | PNB | 114.23 | 114.49 | upper ** | uptrend ** |
| 2026-09-02 | PNB | 115.22 | 114.65 | lower | uptrend |
| 2026-09-03 | PNB | 117.00 | 117.95 | upper | downtrend |
| 2026-09-04 | PNB | 116.32 | 116.90 | upper ** | uptrend ** |
| 2026-09-07 | PNB | 117.00 | 116.41 | lower ** | downtrend ** |
| 2026-09-08 | PNB | 115.60 | 115.75 | upper ** | uptrend ** |
| 2026-09-09 | PNB | 116.00 | 115.25 | lower | uptrend |
| 2026-09-10 | PNB | 115.61 | 115.50 | lower | uptrend |
| 2026-09-11 | PNB | 116.85 | 116.00 | lower | uptrend |
| 2026-09-15 | PNB | 116.75 | 116.75 | unchanged | downtrend |
| 2026-09-16 | PNB | 114.70 | 114.73 | upper ** | uptrend ** |
| 2026-09-17 | PNB | 116.80 | 116.80 | unchanged | downtrend |
| 2026-09-18 | PNB | 116.47 | 117.00 | upper ** | uptrend ** |
| 2026-09-21 | PNB | 117.27 | 117.23 | lower | uptrend |
| 2026-09-22 | PNB | 118.00 | 118.45 | upper | downtrend |
| 2026-09-23 | PNB | 117.00 | 116.61 | lower | uptrend |
| 2026-09-24 | PNB | 118.30 | 117.25 | lower ** | downtrend ** |
| 2026-09-25 | PNB | 117.12 | 117.12 | unchanged | downtrend |
