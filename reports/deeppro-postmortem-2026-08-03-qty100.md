# Deeppro Day Scan Post-Mortem — 3 Aug 2026 (qty 100)

- **Date:** 2026-08-03
- **Universe:** 100 Day Scan stocks (`SECTOR_WATCHLIST`)
- **Rule:** deeppro — SMI↔signal cross/touch · signal EMA(10) · no angle gate · quality gates on
- **Entry:** event candle mid `(high+low)/2` at signal time
- **Quantity:** **100** shares per signal
- **Square-off signal:** best later same-day mid before `15:15` IST
- **BUY profit ₹:** `(sq - entry) × qty`
- **SELL profit ₹:** `(entry - sq) × qty`
- **Signals:** 21 (18 SELL · 3 BUY)
- **Total P&L:** **₹22101.00**
- **Fetch errors:** 0
- **Generated (UTC):** 2026-08-03T20:41:59.434Z

## Trades

| Stock | Signal | Signal time | Buy/Sell price | Square-off time | Square-off price | Qty | Profit ₹ | Profit % |
|-------|--------|-------------|----------------|-----------------|------------------|-----|----------|----------|
| GRASIM | BUY | 09:15 | 3116.55 | 15:00 | 3167.40 | 100 | **5085.00** | 1.63% |
| SHREECEM | SELL | 11:45 | 26720.00 | 12:15 | 26670.00 | 100 | **5000.00** | 0.19% |
| EICHERMOT | SELL | 12:15 | 8007.50 | 15:00 | 7984.25 | 100 | **2325.00** | 0.29% |
| ALKEM | BUY | 10:15 | 5704.00 | 12:30 | 5722.25 | 100 | **1825.00** | 0.32% |
| GODREJCP | SELL | 11:30 | 1089.60 | 15:00 | 1074.15 | 100 | **1545.00** | 1.42% |
| VOLTAS | BUY | 09:15 | 1326.55 | 10:15 | 1339.95 | 100 | **1340.00** | 1.01% |
| POLICYBZR | SELL | 11:45 | 1632.45 | 13:30 | 1620.50 | 100 | **1195.00** | 0.73% |
| SHRIRAMFIN | SELL | 12:15 | 1089.10 | 14:45 | 1077.85 | 100 | **1125.00** | 1.03% |
| SBIN | SELL | 12:15 | 1045.65 | 15:00 | 1035.95 | 100 | **970.00** | 0.93% |
| ICICIGI | SELL | 11:30 | 1651.35 | 12:15 | 1646.35 | 100 | **500.00** | 0.30% |
| SBICARD | SELL | 11:00 | 670.10 | 13:15 | 666.33 | 100 | **377.00** | 0.56% |
| HDFCBANK | SELL | 11:45 | 753.73 | 13:15 | 751.22 | 100 | **251.00** | 0.33% |
| PIDILITIND | SELL | 11:45 | 1628.85 | 13:15 | 1626.50 | 100 | **235.00** | 0.14% |
| BANKBARODA | SELL | 12:15 | 247.33 | 14:00 | 246.45 | 100 | **88.00** | 0.36% |
| ICICIBANK | SELL | 11:45 | 1444.85 | 12:30 | 1444.00 | 100 | **85.00** | 0.06% |
| HINDZINC | SELL | 12:00 | 547.63 | 13:00 | 546.83 | 100 | **80.00** | 0.15% |
| TMPV | SELL | 11:30 | 347.42 | 15:00 | 346.90 | 100 | **52.00** | 0.15% |
| CANBK | SELL | 12:30 | 127.26 | 15:00 | 127.01 | 100 | **26.00** | 0.20% |
| ASHOKLEY | SELL | 12:30 | 174.06 | 13:15 | 173.90 | 100 | **17.00** | 0.09% |
| OFSS | SELL | 12:00 | 11356.50 | 12:15 | 11356.50 | 100 | **0.00** | 0.00% |
| KPITTECH | SELL | 11:30 | 613.50 | 11:45 | 613.70 | 100 | **-20.00** | -0.03% |

## Summary by side

| Side | Trades | Total profit ₹ |
|------|--------|----------------|
| SELL | 18 | 13851.00 |
| BUY | 3 | 8250.00 |
| **All** | **21** | **22101.00** |

## Notes

- Post-mortem uses the same Deeppro engine as Day Scan / Post-Mortem UI.
- No black-line slope / angle gate on BUY or SELL (cross/touch + quality gates only).
- Square-off is the best achievable same-day mid after entry (not a live fill guarantee).
- Kite Connect historical 15m only.

