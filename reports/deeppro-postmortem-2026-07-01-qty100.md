# Deeppro Day Scan Post-Mortem — 1 Jul 2026 (qty 100)

- **Date:** 2026-07-01
- **Universe:** 100 Day Scan stocks (`SECTOR_WATCHLIST`)
- **Rule:** deeppro — SMI↔signal cross/touch · signal EMA(10) · black slope ≥20° · quality gates on
- **Entry:** event candle mid `(high+low)/2` at signal time
- **Quantity:** **100** shares per signal
- **Square-off signal:** best later same-day mid before `15:15` IST
- **BUY profit ₹:** `(sq - entry) × qty`
- **SELL profit ₹:** `(entry - sq) × qty`
- **Signals:** 7 (5 SELL · 2 BUY)
- **Total P&L:** **₹198.00**
- **Fetch errors:** 0
- **Generated (UTC):** 2026-08-03T20:00:59.737Z

## Trades

| Stock | Signal | Signal time | Buy/Sell price | Square-off time | Square-off price | Qty | Profit ₹ | Profit % |
|-------|--------|-------------|----------------|-----------------|------------------|-----|----------|----------|
| ICICIGI | BUY | 09:45 | 1745.30 | 15:15 | 1758.10 | 100 | **1280.00** | 0.73% |
| CIPLA | BUY | 12:45 | 1453.00 | 13:30 | 1458.40 | 100 | **540.00** | 0.37% |
| GODREJCP | SELL | 11:45 | 1036.10 | 12:45 | 1035.70 | 100 | **40.00** | 0.04% |
| BEL | SELL | 12:15 | 415.40 | 13:15 | 415.03 | 100 | **38.00** | 0.09% |
| HDFCAMC | SELL | 12:15 | 2703.15 | 12:30 | 2704.30 | 100 | **-115.00** | -0.04% |
| HINDUNILVR | SELL | 11:45 | 2160.05 | 12:00 | 2163.40 | 100 | **-335.00** | -0.16% |
| SHREECEM | SELL | 11:30 | 25827.50 | 11:45 | 25840.00 | 100 | **-1250.00** | -0.05% |

## Summary by side

| Side | Trades | Total profit ₹ |
|------|--------|----------------|
| SELL | 5 | -1622.00 |
| BUY | 2 | 1820.00 |
| **All** | **7** | **198.00** |

## Notes

- Post-mortem uses the same Deeppro engine as Day Scan / Post-Mortem UI.
- Square-off is the best achievable same-day mid after entry (not a live fill guarantee).
- Kite Connect historical 15m only.

