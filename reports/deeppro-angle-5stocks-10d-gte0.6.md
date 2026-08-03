# Deeppro angle-gate study — 5 stocks × 10 trade days (profit ≥ 0.6%)

- **Stocks:** SBIN, LTM, TATASTEEL, MARUTI, SUNPHARMA
- **Trade days (last 10 sessions per symbol):** 2026-07-21 → 2026-08-03 (10 dates)
- **Rules:** SMI↔signal cross/touch · signal EMA(10) · SELL cut ≥30° · BUY slope ≥35° · quality gates on
- **Hit:** best same-day SQ mid before 15:15 IST ≥ **0.6%**
- **Raw deeppro signals (all 5 stocks):** 6
- **Hits ≥ 0.6%:** 2 (2 SELL · 0 BUY)
- **Avg best profit (hits):** 0.91%
- **Generated (UTC):** 2026-08-03T17:38:56.756Z

## Per-symbol summary

| Stock | Sessions | Raw signals | Hits ≥ min |
|-------|----------|-------------|------------|
| SBIN | 10 | 3 | 1 |
| LTM | 10 | 2 | 1 |
| TATASTEEL | 10 | 1 | 0 |
| MARUTI | 10 | 0 | 0 |
| SUNPHARMA | 10 | 0 | 0 |

## Hits (profit ≥ 0.6%)

| Stock | Date | Side | Cross IST | Kind | SMI / Signal | Peak/Trough | Entry | Best SQ | Profit % |
|-------|------|------|-----------|------|--------------|-------------|-------|---------|----------|
| LTM | 28 Jul | SELL | 11:30 | smi_cross | 72.7 / 72.74 | 91.03 | 4342.90 | 13:15 | **0.88%** |
| SBIN | 3 Aug | SELL | 12:15 | smi_cross | 43.78 / 56.57 | 76.78 | 1045.65 | 15:00 | **0.93%** |

## All deeppro signals in window (with best SQ %)

| Stock | Date | Side | Cross IST | Entry | Best SQ | Profit % | ≥ min? |
|-------|------|------|-----------|-------|---------|----------|--------|
| LTM | 21 Jul | BUY | 11:45 | 4047.65 | 14:00 | 0.31% | no |
| LTM | 28 Jul | SELL | 11:30 | 4342.90 | 13:15 | 0.88% | YES |
| SBIN | 28 Jul | BUY | 10:30 | 1017.00 | 10:45 | 0.22% | no |
| SBIN | 29 Jul | BUY | 09:15 | 1018.10 | 10:00 | 0.09% | no |
| TATASTEEL | 29 Jul | SELL | 12:30 | 187.48 | 13:45 | 0.24% | no |
| SBIN | 3 Aug | SELL | 12:15 | 1045.65 | 15:00 | 0.93% | YES |

## Notes

- Same-day square-off only; profit = best later mid before 15:15 IST.
- Uses current Deeppro engine (cross/touch + angle gate + quality).
- Kite Connect historical 15m only.

