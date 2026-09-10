# Deepak Day Scan Post-Mortem — 9 Jul 2026 (qty 100)

- **Date:** 2026-07-09
- **Universe:** 100 Day Scan stocks (`SECTOR_WATCHLIST`)
- **Rule:** deepak — BB direction switch / continue paths · morning rules on · dual-band deferral on
- **Entry:** event candle mid `(high+low)/2` at signal time
- **Quantity:** **100** shares per signal
- **Square-off signal:** best later same-day mid before `15:15` IST
- **BUY profit ₹:** `(sq - entry) × qty`
- **SELL profit ₹:** `(entry - sq) × qty`
- **Signals:** 11 (4 SELL · 7 BUY)
- **Total P&L:** **₹1993.00**
- **Fetch errors:** 0
- **Generated (UTC):** 2026-08-03T20:12:19.291Z

## Trades

| Stock | Signal | Signal time | Scenario | Buy/Sell price | Square-off time | Square-off price | Qty | Profit ₹ | Profit % |
|-------|--------|-------------|----------|----------------|-----------------|------------------|-----|----------|----------|
| ALKEM | BUY | 10:15 | deepak continue upward direction - 2 | 5669.75 | 10:45 | 5681.75 | 100 | **1200.00** | 0.21% |
| NESTLEIND | SELL | 15:00 | deepak deferred lower resolve - 3 | 1465.20 | 15:15 | 1461.75 | 100 | **345.00** | 0.24% |
| BPCL | BUY | 10:15 | deepak continue upward direction - 2 | 306.40 | 14:15 | 308.52 | 100 | **213.00** | 0.69% |
| ITC | BUY | 12:30 | deepak deferred upper resolve - 3 | 282.83 | 14:15 | 283.85 | 100 | **102.00** | 0.36% |
| TECHM | BUY | 13:15 | deepak deferred upper resolve - 3 | 1431.65 | 14:15 | 1432.50 | 100 | **85.00** | 0.06% |
| TMPV | BUY | 14:15 | deepak deferred upper resolve - 3 | 332.35 | 14:30 | 332.63 | 100 | **27.00** | 0.08% |
| WIPRO | BUY | 12:30 | deepak deferred upper resolve - 3 | 173.72 | 12:45 | 173.93 | 100 | **21.00** | 0.12% |
| POWERGRID | BUY | 12:15 | deepak deferred upper resolve - 3 | 283.27 | 14:15 | 283.33 | 100 | **6.00** | 0.02% |
| NMDC | SELL | 14:30 | deepak deferred lower resolve - 3 | 84.28 | 15:15 | 84.35 | 100 | **-6.00** | -0.08% |
| M&M | SELL | 15:15 | deepak deferred lower resolve - 3 | 3084.70 | — | — | 100 | no exit | — |
| LUPIN | SELL | 15:15 | deepak deferred lower resolve - 3 | 2503.25 | — | — | 100 | no exit | — |

## Summary by side

| Side | Trades | Total profit ₹ |
|------|--------|----------------|
| SELL | 4 | 339.00 |
| BUY | 7 | 1654.00 |
| **All** | **11** | **1993.00** |

## Notes

- Post-mortem uses the same Deepak engine as Day Scan / Post-Mortem UI (`evaluateDeepakDecision`).
- Adaptive target exits from the Deepak engine are ignored here; square-off is best same-day mid after entry.
- Square-off is the best achievable same-day mid after entry (not a live fill guarantee).
- Kite Connect historical 15m only.

