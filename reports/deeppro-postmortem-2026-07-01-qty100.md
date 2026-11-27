# Deeppro Day Scan Post-Mortem — 1 Jul 2026 (qty 100)

- **Date:** 2026-07-01
- **Universe:** 100 Day Scan stocks (`SECTOR_WATCHLIST`)
- **Rule:** deeppro — SMI↔signal cross/touch · signal EMA(10) · no angle gate · quality gates on
- **Entry:** event candle mid `(high+low)/2` at signal time
- **Quantity:** **100** shares per signal
- **Square-off signal:** best later same-day mid before `15:15` IST
- **BUY profit ₹:** `(sq - entry) × qty`
- **SELL profit ₹:** `(entry - sq) × qty`
- **Signals:** 12 (10 SELL · 2 BUY)
- **Total P&L:** **₹592.00**
- **Fetch errors:** 0
- **Generated (UTC):** 2026-08-03T20:20:36.737Z

## Trades

| Stock | Signal | Signal time | Buy/Sell price | Square-off time | Square-off price | Qty | Profit ₹ | Profit % |
|-------|--------|-------------|----------------|-----------------|------------------|-----|----------|----------|
| ADANIPORTS | SELL | 11:15 | 1862.60 | 15:15 | 1847.45 | 100 | **1515.00** | 0.81% |
| ICICIGI | BUY | 09:45 | 1745.30 | 15:15 | 1758.10 | 100 | **1280.00** | 0.73% |
| SHRIRAMFIN | SELL | 11:45 | 1052.65 | 15:15 | 1045.30 | 100 | **735.00** | 0.70% |
| CIPLA | BUY | 12:45 | 1453.00 | 13:30 | 1458.40 | 100 | **540.00** | 0.37% |
| CANBK | SELL | 11:45 | 126.91 | 15:15 | 126.07 | 100 | **84.00** | 0.66% |
| GODREJCP | SELL | 11:45 | 1036.10 | 12:45 | 1035.70 | 100 | **40.00** | 0.04% |
| BEL | SELL | 12:15 | 415.40 | 13:15 | 415.03 | 100 | **38.00** | 0.09% |
| HDFCAMC | SELL | 12:15 | 2703.15 | 12:30 | 2704.30 | 100 | **-115.00** | -0.04% |
| NESTLEIND | SELL | 11:45 | 1440.65 | 12:00 | 1443.10 | 100 | **-245.00** | -0.17% |
| HINDUNILVR | SELL | 11:45 | 2160.05 | 12:00 | 2163.40 | 100 | **-335.00** | -0.16% |
| SHREECEM | SELL | 11:30 | 25827.50 | 11:45 | 25840.00 | 100 | **-1250.00** | -0.05% |
| ADANIENT | SELL | 11:45 | 3083.70 | 12:00 | 3100.65 | 100 | **-1695.00** | -0.55% |

## Summary by side

| Side | Trades | Total profit ₹ |
|------|--------|----------------|
| SELL | 10 | -1228.00 |
| BUY | 2 | 1820.00 |
| **All** | **12** | **592.00** |

## Notes

- Post-mortem uses the same Deeppro engine as Day Scan / Post-Mortem UI.
- No black-line slope / angle gate on BUY or SELL (cross/touch + quality gates only).
- Square-off is the best achievable same-day mid after entry (not a live fill guarantee).
- Kite Connect historical 15m only.

