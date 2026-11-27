# SUNPHARMA · SMI black ↓ red · Drop % ≥ 2.3% · Jan–Mar 2026

- **Symbol:** SUNPHARMA
- **Indicator:** Kite Stch Mtm — black = SMI, red = signal EMA
- **Params:** Kite Stch Mtm `(10, 3, 3)`
- **Downward cross:** previous bar `SMI ≥ signal` and current bar `SMI < signal`
- **Filter:** same-day Drop % **≥ 2.3%** (includes Drop % **> 3%**)
- **Drop %:** `(cross mid − lowest later same-day mid) / cross mid × 100`
- **Pre-3:** three session 15m candles immediately before the cross (G=green, R=red, D=doji)
- **RSI:** Wilder RSI(14) @ cross; **Pre-3 RSI** on the three prior bars
- **Window:** 2026-01-01 → 2026-03-31 (60 trade days)
- **Session:** 09:15–15:30 IST
- **Data:** Upstox 1m resampled to 15m (`NSE_EQ|INE044A01036`) · warmup from 2025-12-01
- **All black↓red in window:** **137** · went lower **116**
- **Pass filter (≥ 2.3%):** **0** · of which **> 3%:** **0**
- **Largest same-day drop in window:** **2.21%**
- **Sort:** Drop % descending
- **Generated (UTC):** 2026-08-04T20:40:53.554Z

## Drop % > 3% (n=0)

Requested band. No SMI black↓red crosses in Jan–Mar 2026 produced a same-day drop above 3%.

_No rows._

## Drop % ≥ 2.3% (n=0)

Requested band (matches the highlighted big drops in the 60d report). Largest Q1 drop was **2.21%**, so this table is empty.

_No rows._

## Nearest big drops — Drop % ≥ 2% (n=4)

Included because the ≥ 2.3% filter returned **0** rows. These are the closest Q1 analogues.

| # | Day | Date | Time (IST) | Mid ₹ | Lowest ₹ | Drop % | Pre-3 (t−3··t−1) | Pre-3 RSI | RSI @ cross |
|--:|-----|------|------------|------:|---------:|-------:|------------------|----------:|------------:|
| 1 | Fri 27 Feb | 2026-02-27 | 09:15 | 1779.30 | 1739.95 | 2.21% | 14:45R · 15:00G · 15:15G (`RGG`) | 50.8 · 53.6 · 69.3 | 63.0 |
| 2 | Wed 14 Jan | 2026-01-14 | 09:15 | 1728.00 | 1691.10 | 2.14% | 14:45G · 15:00R · 15:15R (`GRR`) | 61.5 · 69.1 · 67.5 | 56.3 |
| 3 | Wed 7 Jan | 2026-01-07 | 10:15 | 1798.50 | 1760.80 | 2.10% | 09:30G · 09:45G · 10:00G (`GGG`) | 69.2 · 77.2 · 84.1 | 81.8 |
| 4 | Mon 16 Mar | 2026-03-16 | 09:15 | 1808.15 | 1771.10 | 2.05% | 14:45R · 15:00R · 15:15D (`RRD`) | 26.0 · 24.4 · 26.9 | 28.1 |

## Detail (nearest ≥ 2.0%)

| # | Day | Date | Time (IST) | Mid ₹ | Close ₹ | Lower time | Lower ₹ | Lowest time | Lowest ₹ | Drop % | Pre-3 | Pre-3 RSI | SMI (black) | Signal (red) | RSI |
|--:|-----|------|------------|------:|--------:|------------|--------:|-------------|---------:|-------:|-------|----------:|------------:|-------------:|----:|
| 1 | Fri 27 Feb | 2026-02-27 | 09:15 | 1779.30 | 1783.20 | 09:45 | 1774.60 | 15:15 | 1739.95 | 2.21% | 14:45R · 15:00G · 15:15G (`RGG`) | 50.8 · 53.6 · 69.3 | 42.25 | 45.72 | 63.0 |
| 2 | Wed 14 Jan | 2026-01-14 | 09:15 | 1728.00 | 1723.40 | 09:30 | 1718.30 | 14:00 | 1691.10 | 2.14% | 14:45G · 15:00R · 15:15R (`GRR`) | 61.5 · 69.1 · 67.5 | 17.53 | 22.40 | 56.3 |
| 3 | Wed 7 Jan | 2026-01-07 | 10:15 | 1798.50 | 1794.10 | 10:30 | 1786.30 | 12:30 | 1760.80 | 2.10% | 09:30G · 09:45G · 10:00G (`GGG`) | 69.2 · 77.2 · 84.1 | 67.51 | 67.79 | 81.8 |
| 4 | Mon 16 Mar | 2026-03-16 | 09:15 | 1808.15 | 1798.30 | 09:30 | 1802.45 | 14:00 | 1771.10 | 2.05% | 14:45R · 15:00R · 15:15D (`RRD`) | 26.0 · 24.4 · 26.9 | -49.28 | -41.38 | 28.1 |
