# Deeppro Day Scan Post-Mortem — 3 Aug 2026 (qty 100, profit & loss)

- **Date:** 2026-08-03
- **Universe:** 100 Day Scan stocks (`SECTOR_WATCHLIST`)
- **Rule:** deeppro — SMI↔signal cross/touch · signal EMA(10) · no angle gate · quality gates on
- **Entry:** event candle mid `(high+low)/2` at signal time
- **Quantity:** **100** shares per signal
- **Best square-off:** highest later same-day mid P&L before `15:15` IST
- **Worst square-off:** lowest later same-day mid P&L before `15:15` IST
- **BUY P&L ₹:** `(sq - entry) × qty`
- **SELL P&L ₹:** `(entry - sq) × qty`
- **Signals:** 21 (18 SELL · 3 BUY)
- **Best-case total P&L:** **₹22101.00**
- **Worst-case total P&L:** **₹-25801.00**
- **Profit trades (best > 0):** 19 · ₹22121.00
- **Loss trades (worst < 0):** 16 · ₹-26841.00
- **Fetch errors:** 0
- **Generated (UTC):** 2026-08-03T20:48:34.051Z

## All trades (best vs worst)

| Stock | Signal | Signal time | Entry | Best SQ time | Best SQ | Best ₹ | Worst SQ time | Worst SQ | Worst ₹ |
|-------|--------|-------------|-------|--------------|---------|--------|---------------|----------|---------|
| GRASIM | BUY | 09:15 | 3116.55 | 15:00 | 3167.40 | **5085.00** | 09:30 | 3114.05 | **-250.00** |
| SHREECEM | SELL | 11:45 | 26720.00 | 12:15 | 26670.00 | **5000.00** | 13:45 | 26817.50 | **-9750.00** |
| EICHERMOT | SELL | 12:15 | 8007.50 | 15:00 | 7984.25 | **2325.00** | 13:00 | 8030.75 | **-2325.00** |
| ALKEM | BUY | 10:15 | 5704.00 | 12:30 | 5722.25 | **1825.00** | 15:00 | 5677.25 | **-2675.00** |
| GODREJCP | SELL | 11:30 | 1089.60 | 15:00 | 1074.15 | **1545.00** | 11:45 | 1090.50 | **-90.00** |
| VOLTAS | BUY | 09:15 | 1326.55 | 10:15 | 1339.95 | **1340.00** | 13:15 | 1327.65 | **110.00** |
| POLICYBZR | SELL | 11:45 | 1632.45 | 13:30 | 1620.50 | **1195.00** | 12:00 | 1628.95 | **350.00** |
| SHRIRAMFIN | SELL | 12:15 | 1089.10 | 14:45 | 1077.85 | **1125.00** | 12:30 | 1086.10 | **300.00** |
| SBIN | SELL | 12:15 | 1045.65 | 15:00 | 1035.95 | **970.00** | 12:30 | 1043.10 | **255.00** |
| ICICIGI | SELL | 11:30 | 1651.35 | 12:15 | 1646.35 | **500.00** | 13:30 | 1658.20 | **-685.00** |
| SBICARD | SELL | 11:00 | 670.10 | 13:15 | 666.33 | **377.00** | 11:45 | 670.40 | **-30.00** |
| HDFCBANK | SELL | 11:45 | 753.73 | 13:15 | 751.22 | **251.00** | 12:00 | 753.85 | **-12.00** |
| PIDILITIND | SELL | 11:45 | 1628.85 | 13:15 | 1626.50 | **235.00** | 14:00 | 1631.30 | **-245.00** |
| BANKBARODA | SELL | 12:15 | 247.33 | 14:00 | 246.45 | **88.00** | 12:30 | 247.08 | **25.00** |
| ICICIBANK | SELL | 11:45 | 1444.85 | 12:30 | 1444.00 | **85.00** | 14:00 | 1448.25 | **-340.00** |
| HINDZINC | SELL | 12:00 | 547.63 | 13:00 | 546.83 | **80.00** | 14:00 | 549.67 | **-204.00** |
| TMPV | SELL | 11:30 | 347.42 | 15:00 | 346.90 | **52.00** | 12:00 | 349.08 | **-165.00** |
| CANBK | SELL | 12:30 | 127.26 | 15:00 | 127.01 | **26.00** | 14:30 | 127.38 | **-12.00** |
| ASHOKLEY | SELL | 12:30 | 174.06 | 13:15 | 173.90 | **17.00** | 14:45 | 174.81 | **-75.00** |
| OFSS | SELL | 12:00 | 11356.50 | 12:15 | 11356.50 | **0.00** | 15:00 | 11449.50 | **-9300.00** |
| KPITTECH | SELL | 11:30 | 613.50 | 11:45 | 613.70 | **-20.00** | 15:00 | 620.33 | **-683.00** |

## Profit trades (best square-off > 0)

| Stock | Signal | Signal time | Entry | Best SQ time | Best SQ | Best ₹ | Best % |
|-------|--------|-------------|-------|--------------|---------|--------|--------|
| GRASIM | BUY | 09:15 | 3116.55 | 15:00 | 3167.40 | **5085.00** | 1.63% |
| SHREECEM | SELL | 11:45 | 26720.00 | 12:15 | 26670.00 | **5000.00** | 0.19% |
| EICHERMOT | SELL | 12:15 | 8007.50 | 15:00 | 7984.25 | **2325.00** | 0.29% |
| ALKEM | BUY | 10:15 | 5704.00 | 12:30 | 5722.25 | **1825.00** | 0.32% |
| GODREJCP | SELL | 11:30 | 1089.60 | 15:00 | 1074.15 | **1545.00** | 1.42% |
| VOLTAS | BUY | 09:15 | 1326.55 | 10:15 | 1339.95 | **1340.00** | 1.01% |
| POLICYBZR | SELL | 11:45 | 1632.45 | 13:30 | 1620.50 | **1195.00** | 0.73% |
| SHRIRAMFIN | SELL | 12:15 | 1089.10 | 14:45 | 1077.85 | **1125.00** | 1.03% |
| SBIN | SELL | 12:15 | 1045.65 | 15:00 | 1035.95 | **970.00** | 0.93% |
| ICICIGI | SELL | 11:30 | 1651.35 | 12:15 | 1646.35 | **500.00** | 0.30% |
| SBICARD | SELL | 11:00 | 670.10 | 13:15 | 666.33 | **377.00** | 0.56% |
| HDFCBANK | SELL | 11:45 | 753.73 | 13:15 | 751.22 | **251.00** | 0.33% |
| PIDILITIND | SELL | 11:45 | 1628.85 | 13:15 | 1626.50 | **235.00** | 0.14% |
| BANKBARODA | SELL | 12:15 | 247.33 | 14:00 | 246.45 | **88.00** | 0.36% |
| ICICIBANK | SELL | 11:45 | 1444.85 | 12:30 | 1444.00 | **85.00** | 0.06% |
| HINDZINC | SELL | 12:00 | 547.63 | 13:00 | 546.83 | **80.00** | 0.15% |
| TMPV | SELL | 11:30 | 347.42 | 15:00 | 346.90 | **52.00** | 0.15% |
| CANBK | SELL | 12:30 | 127.26 | 15:00 | 127.01 | **26.00** | 0.20% |
| ASHOKLEY | SELL | 12:30 | 174.06 | 13:15 | 173.90 | **17.00** | 0.09% |

## Loss trades (worst square-off < 0)

| Stock | Signal | Signal time | Entry | Worst SQ time | Worst SQ | Worst ₹ | Worst % |
|-------|--------|-------------|-------|---------------|----------|---------|---------|
| SHREECEM | SELL | 11:45 | 26720.00 | 13:45 | 26817.50 | **-9750.00** | -0.36% |
| OFSS | SELL | 12:00 | 11356.50 | 15:00 | 11449.50 | **-9300.00** | -0.82% |
| ALKEM | BUY | 10:15 | 5704.00 | 15:00 | 5677.25 | **-2675.00** | -0.47% |
| EICHERMOT | SELL | 12:15 | 8007.50 | 13:00 | 8030.75 | **-2325.00** | -0.29% |
| ICICIGI | SELL | 11:30 | 1651.35 | 13:30 | 1658.20 | **-685.00** | -0.41% |
| KPITTECH | SELL | 11:30 | 613.50 | 15:00 | 620.33 | **-683.00** | -1.11% |
| ICICIBANK | SELL | 11:45 | 1444.85 | 14:00 | 1448.25 | **-340.00** | -0.24% |
| GRASIM | BUY | 09:15 | 3116.55 | 09:30 | 3114.05 | **-250.00** | -0.08% |
| PIDILITIND | SELL | 11:45 | 1628.85 | 14:00 | 1631.30 | **-245.00** | -0.15% |
| HINDZINC | SELL | 12:00 | 547.63 | 14:00 | 549.67 | **-204.00** | -0.37% |
| TMPV | SELL | 11:30 | 347.42 | 12:00 | 349.08 | **-165.00** | -0.48% |
| GODREJCP | SELL | 11:30 | 1089.60 | 11:45 | 1090.50 | **-90.00** | -0.08% |
| ASHOKLEY | SELL | 12:30 | 174.06 | 14:45 | 174.81 | **-75.00** | -0.43% |
| SBICARD | SELL | 11:00 | 670.10 | 11:45 | 670.40 | **-30.00** | -0.04% |
| HDFCBANK | SELL | 11:45 | 753.73 | 12:00 | 753.85 | **-12.00** | -0.02% |
| CANBK | SELL | 12:30 | 127.26 | 14:30 | 127.38 | **-12.00** | -0.09% |

## Summary

| Metric | Value |
|--------|-------|
| Signals | 21 (18 SELL · 3 BUY) |
| Best-case total P&L | **₹22101.00** |
| Worst-case total P&L | **₹-25801.00** |
| Profit trades (best > 0) | 19 · ₹22121.00 |
| Loss trades (worst < 0) | 16 · ₹-26841.00 |
| SELL best-case | ₹13851.00 |
| BUY best-case | ₹8250.00 |
| SELL worst-case | ₹-22986.00 |
| BUY worst-case | ₹-2815.00 |

## Notes

- Post-mortem uses the same Deeppro engine as Day Scan / Post-Mortem UI.
- No black-line slope / angle gate on BUY or SELL (cross/touch + quality gates only).
- **Best** = most favorable same-day mid after entry; **Worst** = least favorable same-day mid after entry (both before 15:15).
- Not a live fill guarantee — shows the P&L envelope if squared off on any later 15m mid.
- Kite Connect historical 15m only.

