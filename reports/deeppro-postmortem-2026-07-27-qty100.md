# Deeppro Day Scan Post-Mortem — 27 Jul 2026 (qty 100)

- **Date:** 2026-07-27
- **Universe:** 100 Day Scan stocks (`SECTOR_WATCHLIST`)
- **Rule:** deeppro — SMI↔signal cross/touch · signal EMA(10) · black slope ≥20° · quality gates on
- **Entry:** event candle mid `(high+low)/2` at signal time
- **Quantity:** **100** shares per signal
- **Square-off signal:** best later same-day mid before `15:15` IST
- **BUY profit ₹:** `(sq - entry) × qty`
- **SELL profit ₹:** `(entry - sq) × qty`
- **Signals:** 12 (9 SELL · 3 BUY)
- **Total P&L:** **₹14362.00**
- **Fetch errors:** 0
- **Generated (UTC):** 2026-08-03T19:48:32.759Z

## Trades

| Stock | Signal | Signal time | Buy/Sell price | Square-off time | Square-off price | Qty | Profit ₹ | Profit % |
|-------|--------|-------------|----------------|-----------------|------------------|-----|----------|----------|
| BAJAJ-AUTO | BUY | 09:45 | 11133.00 | 11:45 | 11230.50 | 100 | **9750.00** | 0.88% |
| TRENT | SELL | 12:00 | 2943.95 | 14:30 | 2931.35 | 100 | **1260.00** | 0.43% |
| AUROPHARMA | SELL | 12:00 | 1560.05 | 15:15 | 1548.35 | 100 | **1170.00** | 0.75% |
| TCS | SELL | 11:00 | 2300.65 | 14:15 | 2294.95 | 100 | **570.00** | 0.25% |
| MARUTI | SELL | 12:00 | 13628.50 | 12:15 | 13624.00 | 100 | **450.00** | 0.03% |
| ASIANPAINT | SELL | 12:00 | 2712.35 | 12:30 | 2709.65 | 100 | **270.00** | 0.10% |
| JINDALSTEL | SELL | 12:15 | 1063.75 | 14:30 | 1061.25 | 100 | **250.00** | 0.24% |
| VEDL | SELL | 11:00 | 266.68 | 15:15 | 264.48 | 100 | **220.00** | 0.83% |
| VOLTAS | BUY | 13:00 | 1321.70 | 14:45 | 1323.40 | 100 | **170.00** | 0.13% |
| POWERGRID | BUY | 11:00 | 288.10 | 11:45 | 289.13 | 100 | **102.00** | 0.36% |
| FEDERALBNK | SELL | 10:45 | 356.05 | 11:15 | 355.05 | 100 | **100.00** | 0.28% |
| IOC | SELL | 12:00 | 140.71 | 13:45 | 140.21 | 100 | **50.00** | 0.36% |

## Summary by side

| Side | Trades | Total profit ₹ |
|------|--------|----------------|
| SELL | 9 | 4340.00 |
| BUY | 3 | 10022.00 |
| **All** | **12** | **14362.00** |

## Notes

- Post-mortem uses the same Deeppro engine as Day Scan / Post-Mortem UI.
- Square-off is the best achievable same-day mid after entry (not a live fill guarantee).
- Kite Connect historical 15m only.

