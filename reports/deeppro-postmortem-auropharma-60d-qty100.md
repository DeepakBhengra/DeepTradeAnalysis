# Deeppro Post-Mortem — AUROPHARMA · last 60d (qty 100)

- **Symbol:** AUROPHARMA
- **Window:** 60 trade days (2026-05-08 → 2026-08-03)
- **Rule:** deeppro — SMI↔signal cross/touch · signal EMA(10) · black slope ≥20° · quality gates on
- **Entry:** event candle mid `(high+low)/2` at signal time
- **Quantity:** **100** shares per signal
- **Square-off signal:** best later same-day mid before `15:15` IST
- **BUY profit ₹:** `(sq - entry) × qty`
- **SELL profit ₹:** `(entry - sq) × qty`
- **Signals:** 8 (3 SELL · 5 BUY)
- **Wins / losses:** 7 / 1
- **Total P&L:** **₹11680.00**
- **Data:** Kite Connect historical (NSE:AUROPHARMA, 15minute)
- **Generated (UTC):** 2026-08-03T19:57:40.095Z

## Trades

| Date | Stock | Signal | Signal time | Buy/Sell price | Square-off time | Square-off price | Qty | Profit ₹ | Profit % |
|------|-------|--------|-------------|----------------|-----------------|------------------|-----|----------|----------|
| 8 May 2026 | AUROPHARMA | SELL | 11:45 | 1499.65 | 15:15 | 1486.80 | 100 | **1285.00** | 0.86% |
| 21 May 2026 | AUROPHARMA | SELL | 12:00 | 1536.40 | 12:15 | 1537.85 | 100 | **-145.00** | -0.09% |
| 10 Jun 2026 | AUROPHARMA | BUY | 10:15 | 1454.45 | 11:45 | 1466.55 | 100 | **1210.00** | 0.83% |
| 30 Jun 2026 | AUROPHARMA | BUY | 09:15 | 1558.25 | 14:45 | 1585.80 | 100 | **2755.00** | 1.77% |
| 9 Jul 2026 | AUROPHARMA | BUY | 09:15 | 1559.05 | 12:00 | 1597.65 | 100 | **3860.00** | 2.48% |
| 10 Jul 2026 | AUROPHARMA | BUY | 10:00 | 1563.85 | 11:15 | 1572.95 | 100 | **910.00** | 0.58% |
| 27 Jul 2026 | AUROPHARMA | SELL | 12:00 | 1560.05 | 15:15 | 1548.35 | 100 | **1170.00** | 0.75% |
| 31 Jul 2026 | AUROPHARMA | BUY | 09:15 | 1578.00 | 12:15 | 1584.35 | 100 | **635.00** | 0.40% |

## Summary by side

| Side | Trades | Total profit ₹ |
|------|--------|----------------|
| SELL | 3 | 2310.00 |
| BUY | 5 | 9370.00 |
| **All** | **8** | **11680.00** |

## Notes

- Same Deeppro engine as Day Scan / Post-Mortem UI.
- Square-off is the best achievable same-day mid after entry (not a live fill guarantee).
- Kite Connect historical 15m only.

