# Deeppro Stch Mtm snapshots — 5 stocks × 5 trade days (≥ 0.75%)

- **Stocks:** JSWSTEEL, HINDALCO, KPITTECH, NATIONALUM, LTM
- **Trade days:** 2026-06-09, 2026-06-10, 2026-06-11, 2026-06-12, 2026-06-15
- **Rule:** enhanced deeppro (Kite 15m)
- **Hit:** best same-day SQ mid before 15:15 IST ≥ 0.75%
- **Hits:** 7
- **Generated (UTC):** 2026-08-03T09:43:23.796Z

## Hits

| Stock | Date | Side | Cross IST | Event IST | Kind | Cross SMI | Peak/Trough SMI | Entry | Best SQ | Profit % | Chart |
|-------|------|------|-----------|-----------|------|-----------|-----------------|-------|---------|----------|-------|
| HINDALCO | 2026-06-09 | BUY | 09:30 | 09:45 | smi_exit_oversold | -51.32 / -57.98 | -68.19 | 1063.10 | 14:15 | 1.46% | `HINDALCO_2026-06-09_BUY_0930.png` |
| KPITTECH | 2026-06-09 | BUY | 09:15 | 10:00 | stall_at_lows | -62.79 / -67.16 | -78.36 | 748.73 | 15:15 | 1.08% | `KPITTECH_2026-06-09_BUY_0915.png` |
| JSWSTEEL | 2026-06-10 | SELL | 12:00 | 12:30 | stall_at_highs | 81.89 / 82.03 | 88.1 | 1287.35 | 15:00 | 1.29% | `JSWSTEEL_2026-06-10_SELL_1200.png` |
| NATIONALUM | 2026-06-11 | SELL | 11:00 | 11:15 | smi_exit_overbought | 52.78 / 56.31 | 69.11 | 376.42 | 15:00 | 1.67% | `NATIONALUM_2026-06-11_SELL_1100.png` |
| NATIONALUM | 2026-06-12 | SELL | 11:15 | 11:45 | smi_exit_overbought | 61.62 / 63.24 | 67.92 | 380.17 | 14:15 | 1.01% | `NATIONALUM_2026-06-12_SELL_1115.png` |
| KPITTECH | 2026-06-15 | SELL | 11:30 | 12:15 | smi_exit_overbought | 84.64 / 86.96 | 91.32 | 765.15 | 15:15 | 1.20% | `KPITTECH_2026-06-15_SELL_1130.png` |
| LTM | 2026-06-15 | SELL | 11:30 | 11:30 | smi_cross | 79.79 / 80.01 | 83.2 | 3948.95 | 15:15 | 1.37% | `LTM_2026-06-15_SELL_1130.png` |

## How to read the Stch Mtm snapshot

- **Black line** = SMI · **Red line** = signal
- Vertical **gold** line = SMI cross (Day Scan Entry IST)
- Vertical **cyan** line = mapped event (stall / SMI-exit) when different
- Shaded zone ≈ overbought (≥40) / oversold (≤-40)

