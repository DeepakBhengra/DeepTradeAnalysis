# Deeppro Day Scan Post-Mortem — 3 Aug 2026 (qty 100, profit & loss · detailed)

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
- **Generated (UTC):** 2026-08-03T20:52:03.898Z

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

## Overview table (best vs worst)

| Stock | Sector | Signal | Time | Kind | Entry | SMI | Peak/Trough | Event RSI | BB upper % | BB lower % | Best ₹ | Best % | Worst ₹ | Worst % |
|-------|--------|--------|------|------|-------|-----|-------------|-----------|------------|------------|--------|--------|---------|---------|
| GRASIM | Infra | BUY | 09:15 | smi_cross | 3116.55 | -55.4 | -75.0 | 42.05 | 0.018 | 0.361 | **5085.00** | 1.63% | **-250.00** | -0.08% |
| SHREECEM | Infra | SELL | 11:45 | smi_cross | 26720.00 | 50.4 | 78.4 | 70.93 | 1.156 | 3.418 | **5000.00** | 0.19% | **-9750.00** | -0.36% |
| EICHERMOT | Automobile | SELL | 12:15 | smi_cross | 8007.50 | 54.8 | 82.6 | 71.30 | 1.118 | 2.739 | **2325.00** | 0.29% | **-2325.00** | -0.29% |
| ALKEM | Health | BUY | 10:15 | smi_cross | 5704.00 | -47.9 | -72.8 | 26.41 | 1.490 | 0.029 | **1825.00** | 0.32% | **-2675.00** | -0.47% |
| GODREJCP | FMCG | SELL | 11:30 | smi_cross | 1089.60 | 43.1 | 65.5 | 71.37 | 0.892 | 2.381 | **1545.00** | 1.42% | **-90.00** | -0.08% |
| VOLTAS | Consumer | BUY | 09:15 | smi_cross | 1326.55 | -50.6 | -74.9 | 32.56 | 1.548 | 0.510 | **1340.00** | 1.01% | **110.00** | 0.08% |
| POLICYBZR | Insurance | SELL | 11:45 | smi_cross | 1632.45 | 55.9 | 91.7 | 74.06 | 0.792 | 2.649 | **1195.00** | 0.73% | **350.00** | 0.21% |
| SHRIRAMFIN | Finance | SELL | 12:15 | smi_cross | 1089.10 | 73.9 | 93.1 | 86.15 | 1.605 | 5.171 | **1125.00** | 1.03% | **300.00** | 0.28% |
| SBIN | Bank | SELL | 12:15 | smi_cross | 1045.65 | 43.8 | 76.8 | 74.84 | 0.798 | 2.074 | **970.00** | 0.93% | **255.00** | 0.24% |
| ICICIGI | Insurance | SELL | 11:30 | smi_cross | 1651.35 | 37.8 | 71.2 | 69.40 | 0.889 | 2.051 | **500.00** | 0.30% | **-685.00** | -0.41% |
| SBICARD | Finance | SELL | 11:00 | smi_cross | 670.10 | 52.8 | 81.6 | 76.04 | 0.453 | 2.348 | **377.00** | 0.56% | **-30.00** | -0.04% |
| HDFCBANK | Bank | SELL | 11:45 | smi_cross | 753.73 | 44.0 | 74.5 | 76.64 | 0.354 | 0.880 | **251.00** | 0.33% | **-12.00** | -0.02% |
| PIDILITIND | Consumer | SELL | 11:45 | smi_cross | 1628.85 | 57.8 | 81.8 | 67.14 | 0.666 | 1.316 | **235.00** | 0.14% | **-245.00** | -0.15% |
| BANKBARODA | Bank | SELL | 12:15 | smi_cross | 247.33 | 54.9 | 88.3 | 78.51 | 0.811 | 2.092 | **88.00** | 0.36% | **25.00** | 0.10% |
| ICICIBANK | Bank | SELL | 11:45 | smi_cross | 1444.85 | 44.3 | 67.1 | 71.61 | 0.460 | 0.997 | **85.00** | 0.06% | **-340.00** | -0.24% |
| HINDZINC | Metal | SELL | 12:00 | smi_cross | 547.63 | 45.6 | 75.5 | 76.54 | 0.545 | 2.005 | **80.00** | 0.15% | **-204.00** | -0.37% |
| TMPV | Automobile | SELL | 11:30 | smi_cross | 347.42 | 39.6 | 69.7 | 75.82 | 0.813 | 3.180 | **52.00** | 0.15% | **-165.00** | -0.48% |
| CANBK | Bank | SELL | 12:30 | smi_cross | 127.26 | 74.3 | 88.3 | 74.67 | 0.663 | 2.046 | **26.00** | 0.20% | **-12.00** | -0.09% |
| ASHOKLEY | Automobile | SELL | 12:30 | smi_cross | 174.06 | 82.2 | 91.8 | 80.20 | 1.584 | 5.391 | **17.00** | 0.09% | **-75.00** | -0.43% |
| OFSS | IT | SELL | 12:00 | smi_cross | 11356.50 | 54.5 | 82.1 | 78.83 | 0.773 | 2.113 | **0.00** | 0.00% | **-9300.00** | -0.82% |
| KPITTECH | IT | SELL | 11:30 | smi_cross | 613.50 | 49.8 | 78.1 | 74.14 | 1.239 | 3.862 | **-20.00** | -0.03% | **-683.00** | -1.11% |

## Profit trades (best square-off > 0)

| Stock | Sector | Signal | Time | Entry | Best SQ time | Best SQ | Best ₹ | Best % | Event RSI | Peak/Trough |
|-------|--------|--------|------|-------|--------------|---------|--------|--------|-----------|-------------|
| GRASIM | Infra | BUY | 09:15 | 3116.55 | 15:00 | 3167.40 | **5085.00** | 1.63% | 42.05 | -75.0 |
| SHREECEM | Infra | SELL | 11:45 | 26720.00 | 12:15 | 26670.00 | **5000.00** | 0.19% | 70.93 | 78.4 |
| EICHERMOT | Automobile | SELL | 12:15 | 8007.50 | 15:00 | 7984.25 | **2325.00** | 0.29% | 71.30 | 82.6 |
| ALKEM | Health | BUY | 10:15 | 5704.00 | 12:30 | 5722.25 | **1825.00** | 0.32% | 26.41 | -72.8 |
| GODREJCP | FMCG | SELL | 11:30 | 1089.60 | 15:00 | 1074.15 | **1545.00** | 1.42% | 71.37 | 65.5 |
| VOLTAS | Consumer | BUY | 09:15 | 1326.55 | 10:15 | 1339.95 | **1340.00** | 1.01% | 32.56 | -74.9 |
| POLICYBZR | Insurance | SELL | 11:45 | 1632.45 | 13:30 | 1620.50 | **1195.00** | 0.73% | 74.06 | 91.7 |
| SHRIRAMFIN | Finance | SELL | 12:15 | 1089.10 | 14:45 | 1077.85 | **1125.00** | 1.03% | 86.15 | 93.1 |
| SBIN | Bank | SELL | 12:15 | 1045.65 | 15:00 | 1035.95 | **970.00** | 0.93% | 74.84 | 76.8 |
| ICICIGI | Insurance | SELL | 11:30 | 1651.35 | 12:15 | 1646.35 | **500.00** | 0.30% | 69.40 | 71.2 |
| SBICARD | Finance | SELL | 11:00 | 670.10 | 13:15 | 666.33 | **377.00** | 0.56% | 76.04 | 81.6 |
| HDFCBANK | Bank | SELL | 11:45 | 753.73 | 13:15 | 751.22 | **251.00** | 0.33% | 76.64 | 74.5 |
| PIDILITIND | Consumer | SELL | 11:45 | 1628.85 | 13:15 | 1626.50 | **235.00** | 0.14% | 67.14 | 81.8 |
| BANKBARODA | Bank | SELL | 12:15 | 247.33 | 14:00 | 246.45 | **88.00** | 0.36% | 78.51 | 88.3 |
| ICICIBANK | Bank | SELL | 11:45 | 1444.85 | 12:30 | 1444.00 | **85.00** | 0.06% | 71.61 | 67.1 |
| HINDZINC | Metal | SELL | 12:00 | 547.63 | 13:00 | 546.83 | **80.00** | 0.15% | 76.54 | 75.5 |
| TMPV | Automobile | SELL | 11:30 | 347.42 | 15:00 | 346.90 | **52.00** | 0.15% | 75.82 | 69.7 |
| CANBK | Bank | SELL | 12:30 | 127.26 | 15:00 | 127.01 | **26.00** | 0.20% | 74.67 | 88.3 |
| ASHOKLEY | Automobile | SELL | 12:30 | 174.06 | 13:15 | 173.90 | **17.00** | 0.09% | 80.20 | 91.8 |

## Loss trades (worst square-off < 0)

| Stock | Sector | Signal | Time | Entry | Worst SQ time | Worst SQ | Worst ₹ | Worst % | Event RSI | Peak/Trough |
|-------|--------|--------|------|-------|---------------|----------|---------|---------|-----------|-------------|
| SHREECEM | Infra | SELL | 11:45 | 26720.00 | 13:45 | 26817.50 | **-9750.00** | -0.36% | 70.93 | 78.4 |
| OFSS | IT | SELL | 12:00 | 11356.50 | 15:00 | 11449.50 | **-9300.00** | -0.82% | 78.83 | 82.1 |
| ALKEM | Health | BUY | 10:15 | 5704.00 | 15:00 | 5677.25 | **-2675.00** | -0.47% | 26.41 | -72.8 |
| EICHERMOT | Automobile | SELL | 12:15 | 8007.50 | 13:00 | 8030.75 | **-2325.00** | -0.29% | 71.30 | 82.6 |
| ICICIGI | Insurance | SELL | 11:30 | 1651.35 | 13:30 | 1658.20 | **-685.00** | -0.41% | 69.40 | 71.2 |
| KPITTECH | IT | SELL | 11:30 | 613.50 | 15:00 | 620.33 | **-683.00** | -1.11% | 74.14 | 78.1 |
| ICICIBANK | Bank | SELL | 11:45 | 1444.85 | 14:00 | 1448.25 | **-340.00** | -0.24% | 71.61 | 67.1 |
| GRASIM | Infra | BUY | 09:15 | 3116.55 | 09:30 | 3114.05 | **-250.00** | -0.08% | 42.05 | -75.0 |
| PIDILITIND | Consumer | SELL | 11:45 | 1628.85 | 14:00 | 1631.30 | **-245.00** | -0.15% | 67.14 | 81.8 |
| HINDZINC | Metal | SELL | 12:00 | 547.63 | 14:00 | 549.67 | **-204.00** | -0.37% | 76.54 | 75.5 |
| TMPV | Automobile | SELL | 11:30 | 347.42 | 12:00 | 349.08 | **-165.00** | -0.48% | 75.82 | 69.7 |
| GODREJCP | FMCG | SELL | 11:30 | 1089.60 | 11:45 | 1090.50 | **-90.00** | -0.08% | 71.37 | 65.5 |
| ASHOKLEY | Automobile | SELL | 12:30 | 174.06 | 14:45 | 174.81 | **-75.00** | -0.43% | 80.20 | 91.8 |
| SBICARD | Finance | SELL | 11:00 | 670.10 | 11:45 | 670.40 | **-30.00** | -0.04% | 76.04 | 81.6 |
| HDFCBANK | Bank | SELL | 11:45 | 753.73 | 12:00 | 753.85 | **-12.00** | -0.02% | 76.64 | 74.5 |
| CANBK | Bank | SELL | 12:30 | 127.26 | 14:30 | 127.38 | **-12.00** | -0.09% | 74.67 | 88.3 |

## Trade-by-trade details

### 1. GRASIM · BUY @ 09:15

| Field | Value |
|-------|-------|
| Sector | Infra |
| Event kind | `smi_cross` |
| Cross time (IST) | 09:15 |
| Event / entry time (IST) | 09:15 |
| Entry mid | 3116.55 |
| Signal close | 3109.00 |
| Qty | 100 |
| SMI / signal | -55.4 / -57.7 |
| Trough SMI | -75.0 |
| Cross RSI | 42.05 |
| Event RSI | 42.05 |
| BB upper gap | 0.018% (crossed) |
| BB lower gap | 0.361% |
| MACD histogram | -1.6664 |
| Best SQ | 15:00 @ 3167.40 → **5085.00** (1.63%) |
| Worst SQ | 09:30 @ 3114.05 → **-250.00** (-0.08%) |

**Reasons**

- Stch Mtm(10,3,10) bullish cross from oversold
- Trough SMI -75.0 <= -65
- Lower Bollinger Band tagged in lookback
- MACD histogram rising
- MACD hist Δ 0.037% >= 0.01% of price
- Event smi_cross at 09:15 IST (before 14:00)
- Event RSI 42.05
- BB upper gap 0.018% (crossed)
- BB lower gap 0.361% (none)
- Quality BUY: SMI cross only; BB-lower match (no dual-band squeeze; after 11:00 RSI≥40) or unmatched≤10:30 gap≤0.65% or extreme RSI≤12

### 2. SHREECEM · SELL @ 11:45

| Field | Value |
|-------|-------|
| Sector | Infra |
| Event kind | `smi_cross` |
| Cross time (IST) | 11:45 |
| Event / entry time (IST) | 11:45 |
| Entry mid | 26720.00 |
| Signal close | 26725.00 |
| Qty | 100 |
| SMI / signal | 50.4 / 53.0 |
| Peak SMI | 78.4 |
| Cross RSI | 70.93 |
| Event RSI | 70.93 |
| BB upper gap | 1.156% |
| BB lower gap | 3.418% |
| MACD histogram | 37.267 |
| Best SQ | 12:15 @ 26670.00 → **5000.00** (0.19%) |
| Worst SQ | 13:45 @ 26817.50 → **-9750.00** (-0.36%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 78.4 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.025% >= 0.01% of price
- Event smi_cross at 11:45 IST (before 14:00)
- Event RSI 70.93
- BB upper gap 1.156% (none)
- BB lower gap 3.418% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

### 3. EICHERMOT · SELL @ 12:15

| Field | Value |
|-------|-------|
| Sector | Automobile |
| Event kind | `smi_cross` |
| Cross time (IST) | 12:15 |
| Event / entry time (IST) | 12:15 |
| Entry mid | 8007.50 |
| Signal close | 8002.50 |
| Qty | 100 |
| SMI / signal | 54.8 / 63.7 |
| Peak SMI | 82.6 |
| Cross RSI | 71.30 |
| Event RSI | 71.30 |
| BB upper gap | 1.118% |
| BB lower gap | 2.739% |
| MACD histogram | 4.9398 |
| Best SQ | 15:00 @ 7984.25 → **2325.00** (0.29%) |
| Worst SQ | 13:00 @ 8030.75 → **-2325.00** (-0.29%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 82.6 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.048% >= 0.01% of price
- Event smi_cross at 12:15 IST (before 14:00)
- Event RSI 71.30
- BB upper gap 1.118% (none)
- BB lower gap 2.739% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

### 4. ALKEM · BUY @ 10:15

| Field | Value |
|-------|-------|
| Sector | Health |
| Event kind | `smi_cross` |
| Cross time (IST) | 10:15 |
| Event / entry time (IST) | 10:15 |
| Entry mid | 5704.00 |
| Signal close | 5715.00 |
| Qty | 100 |
| SMI / signal | -47.9 / -53.5 |
| Trough SMI | -72.8 |
| Cross RSI | 26.41 |
| Event RSI | 26.41 |
| BB upper gap | 1.490% |
| BB lower gap | 0.029% (crossed) |
| MACD histogram | -5.4942 |
| Best SQ | 12:30 @ 5722.25 → **1825.00** (0.32%) |
| Worst SQ | 15:00 @ 5677.25 → **-2675.00** (-0.47%) |

**Reasons**

- Stch Mtm(10,3,10) bullish cross from oversold
- Trough SMI -72.8 <= -65
- Lower Bollinger Band tagged in lookback
- MACD histogram rising
- MACD hist Δ 0.036% >= 0.01% of price
- Event smi_cross at 10:15 IST (before 14:00)
- Event RSI 26.41
- BB upper gap 1.490% (none)
- BB lower gap 0.029% (crossed)
- Quality BUY: SMI cross only; BB-lower match (no dual-band squeeze; after 11:00 RSI≥40) or unmatched≤10:30 gap≤0.65% or extreme RSI≤12

### 5. GODREJCP · SELL @ 11:30

| Field | Value |
|-------|-------|
| Sector | FMCG |
| Event kind | `smi_cross` |
| Cross time (IST) | 11:30 |
| Event / entry time (IST) | 11:30 |
| Entry mid | 1089.60 |
| Signal close | 1091.60 |
| Qty | 100 |
| SMI / signal | 43.1 / 44.7 |
| Peak SMI | 65.5 |
| Cross RSI | 71.37 |
| Event RSI | 71.37 |
| BB upper gap | 0.892% |
| BB lower gap | 2.381% |
| MACD histogram | 0.7762 |
| Best SQ | 15:00 @ 1074.15 → **1545.00** (1.42%) |
| Worst SQ | 11:45 @ 1090.50 → **-90.00** (-0.08%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 65.5 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.022% >= 0.01% of price
- Event smi_cross at 11:30 IST (before 14:00)
- Event RSI 71.37
- BB upper gap 0.892% (none)
- BB lower gap 2.381% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

### 6. VOLTAS · BUY @ 09:15

| Field | Value |
|-------|-------|
| Sector | Consumer |
| Event kind | `smi_cross` |
| Cross time (IST) | 09:15 |
| Event / entry time (IST) | 09:15 |
| Entry mid | 1326.55 |
| Signal close | 1331.40 |
| Qty | 100 |
| SMI / signal | -50.6 / -50.8 |
| Trough SMI | -74.9 |
| Cross RSI | 32.56 |
| Event RSI | 32.56 |
| BB upper gap | 1.548% |
| BB lower gap | 0.510% (crossed) |
| MACD histogram | -2.2834 |
| Best SQ | 10:15 @ 1339.95 → **1340.00** (1.01%) |
| Worst SQ | 13:15 @ 1327.65 → **110.00** (0.08%) |

**Reasons**

- Stch Mtm(10,3,10) bullish cross from oversold
- Trough SMI -74.9 <= -65
- Lower Bollinger Band tagged in lookback
- MACD histogram rising
- MACD hist Δ 0.042% >= 0.01% of price
- Event smi_cross at 09:15 IST (before 14:00)
- Event RSI 32.56
- BB upper gap 1.548% (none)
- BB lower gap 0.510% (crossed)
- Quality BUY: SMI cross only; BB-lower match (no dual-band squeeze; after 11:00 RSI≥40) or unmatched≤10:30 gap≤0.65% or extreme RSI≤12

### 7. POLICYBZR · SELL @ 11:45

| Field | Value |
|-------|-------|
| Sector | Insurance |
| Event kind | `smi_cross` |
| Cross time (IST) | 11:45 |
| Event / entry time (IST) | 11:45 |
| Entry mid | 1632.45 |
| Signal close | 1630.00 |
| Qty | 100 |
| SMI / signal | 55.9 / 60.9 |
| Peak SMI | 91.7 |
| Cross RSI | 74.06 |
| Event RSI | 74.06 |
| BB upper gap | 0.792% |
| BB lower gap | 2.649% |
| MACD histogram | 0.9158 |
| Best SQ | 13:30 @ 1620.50 → **1195.00** (0.73%) |
| Worst SQ | 12:00 @ 1628.95 → **350.00** (0.21%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 91.7 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.033% >= 0.01% of price
- Event smi_cross at 11:45 IST (before 14:00)
- Event RSI 74.06
- BB upper gap 0.792% (none)
- BB lower gap 2.649% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

### 8. SHRIRAMFIN · SELL @ 12:15

| Field | Value |
|-------|-------|
| Sector | Finance |
| Event kind | `smi_cross` |
| Cross time (IST) | 12:15 |
| Event / entry time (IST) | 12:15 |
| Entry mid | 1089.10 |
| Signal close | 1089.20 |
| Qty | 100 |
| SMI / signal | 73.9 / 78.5 |
| Peak SMI | 93.1 |
| Cross RSI | 86.15 |
| Event RSI | 86.15 |
| BB upper gap | 1.605% |
| BB lower gap | 5.171% |
| MACD histogram | 1.2579 |
| Best SQ | 14:45 @ 1077.85 → **1125.00** (1.03%) |
| Worst SQ | 12:30 @ 1086.10 → **300.00** (0.28%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 93.1 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.052% >= 0.01% of price
- Event smi_cross at 12:15 IST (before 14:00)
- Event RSI 86.15
- BB upper gap 1.605% (none)
- BB lower gap 5.171% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

### 9. SBIN · SELL @ 12:15

| Field | Value |
|-------|-------|
| Sector | Bank |
| Event kind | `smi_cross` |
| Cross time (IST) | 12:15 |
| Event / entry time (IST) | 12:15 |
| Entry mid | 1045.65 |
| Signal close | 1043.60 |
| Qty | 100 |
| SMI / signal | 43.8 / 56.6 |
| Peak SMI | 76.8 |
| Cross RSI | 74.84 |
| Event RSI | 74.84 |
| BB upper gap | 0.798% |
| BB lower gap | 2.074% |
| MACD histogram | 0.2215 |
| Best SQ | 15:00 @ 1035.95 → **970.00** (0.93%) |
| Worst SQ | 12:30 @ 1043.10 → **255.00** (0.24%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 76.8 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.050% >= 0.01% of price
- Event smi_cross at 12:15 IST (before 14:00)
- Event RSI 74.84
- BB upper gap 0.798% (none)
- BB lower gap 2.074% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

### 10. ICICIGI · SELL @ 11:30

| Field | Value |
|-------|-------|
| Sector | Insurance |
| Event kind | `smi_cross` |
| Cross time (IST) | 11:30 |
| Event / entry time (IST) | 11:30 |
| Entry mid | 1651.35 |
| Signal close | 1649.00 |
| Qty | 100 |
| SMI / signal | 37.8 / 39.7 |
| Peak SMI | 71.2 |
| Cross RSI | 69.40 |
| Event RSI | 69.40 |
| BB upper gap | 0.889% |
| BB lower gap | 2.051% |
| MACD histogram | 1.3327 |
| Best SQ | 12:15 @ 1646.35 → **500.00** (0.30%) |
| Worst SQ | 13:30 @ 1658.20 → **-685.00** (-0.41%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 71.2 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.056% >= 0.01% of price
- Event smi_cross at 11:30 IST (before 14:00)
- Event RSI 69.40
- BB upper gap 0.889% (none)
- BB lower gap 2.051% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

### 11. SBICARD · SELL @ 11:00

| Field | Value |
|-------|-------|
| Sector | Finance |
| Event kind | `smi_cross` |
| Cross time (IST) | 11:00 |
| Event / entry time (IST) | 11:00 |
| Entry mid | 670.10 |
| Signal close | 670.20 |
| Qty | 100 |
| SMI / signal | 52.8 / 53.2 |
| Peak SMI | 81.6 |
| Cross RSI | 76.04 |
| Event RSI | 76.04 |
| BB upper gap | 0.453% |
| BB lower gap | 2.348% |
| MACD histogram | 0.8025 |
| Best SQ | 13:15 @ 666.33 → **377.00** (0.56%) |
| Worst SQ | 11:45 @ 670.40 → **-30.00** (-0.04%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 81.6 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.020% >= 0.01% of price
- Event smi_cross at 11:00 IST (before 14:00)
- Event RSI 76.04
- BB upper gap 0.453% (none)
- BB lower gap 2.348% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

### 12. HDFCBANK · SELL @ 11:45

| Field | Value |
|-------|-------|
| Sector | Bank |
| Event kind | `smi_cross` |
| Cross time (IST) | 11:45 |
| Event / entry time (IST) | 11:45 |
| Entry mid | 753.73 |
| Signal close | 753.75 |
| Qty | 100 |
| SMI / signal | 44.0 / 46.3 |
| Peak SMI | 74.5 |
| Cross RSI | 76.64 |
| Event RSI | 76.64 |
| BB upper gap | 0.354% |
| BB lower gap | 0.880% |
| MACD histogram | 0.3021 |
| Best SQ | 13:15 @ 751.22 → **251.00** (0.33%) |
| Worst SQ | 12:00 @ 753.85 → **-12.00** (-0.02%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 74.5 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.019% >= 0.01% of price
- Event smi_cross at 11:45 IST (before 14:00)
- Event RSI 76.64
- BB upper gap 0.354% (none)
- BB lower gap 0.880% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

### 13. PIDILITIND · SELL @ 11:45

| Field | Value |
|-------|-------|
| Sector | Consumer |
| Event kind | `smi_cross` |
| Cross time (IST) | 11:45 |
| Event / entry time (IST) | 11:45 |
| Entry mid | 1628.85 |
| Signal close | 1627.70 |
| Qty | 100 |
| SMI / signal | 57.8 / 59.0 |
| Peak SMI | 81.8 |
| Cross RSI | 67.14 |
| Event RSI | 67.14 |
| BB upper gap | 0.666% |
| BB lower gap | 1.316% |
| MACD histogram | 0.708 |
| Best SQ | 13:15 @ 1626.50 → **235.00** (0.14%) |
| Worst SQ | 14:00 @ 1631.30 → **-245.00** (-0.15%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 81.8 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.026% >= 0.01% of price
- Event smi_cross at 11:45 IST (before 14:00)
- Event RSI 67.14
- BB upper gap 0.666% (none)
- BB lower gap 1.316% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

### 14. BANKBARODA · SELL @ 12:15

| Field | Value |
|-------|-------|
| Sector | Bank |
| Event kind | `smi_cross` |
| Cross time (IST) | 12:15 |
| Event / entry time (IST) | 12:15 |
| Entry mid | 247.33 |
| Signal close | 247.22 |
| Qty | 100 |
| SMI / signal | 54.9 / 66.9 |
| Peak SMI | 88.3 |
| Cross RSI | 78.51 |
| Event RSI | 78.51 |
| BB upper gap | 0.811% |
| BB lower gap | 2.092% |
| MACD histogram | 0.0895 |
| Best SQ | 14:00 @ 246.45 → **88.00** (0.36%) |
| Worst SQ | 12:30 @ 247.08 → **25.00** (0.10%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 88.3 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.034% >= 0.01% of price
- Event smi_cross at 12:15 IST (before 14:00)
- Event RSI 78.51
- BB upper gap 0.811% (none)
- BB lower gap 2.092% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

### 15. ICICIBANK · SELL @ 11:45

| Field | Value |
|-------|-------|
| Sector | Bank |
| Event kind | `smi_cross` |
| Cross time (IST) | 11:45 |
| Event / entry time (IST) | 11:45 |
| Entry mid | 1444.85 |
| Signal close | 1445.80 |
| Qty | 100 |
| SMI / signal | 44.3 / 49.2 |
| Peak SMI | 67.1 |
| Cross RSI | 71.61 |
| Event RSI | 71.61 |
| BB upper gap | 0.460% |
| BB lower gap | 0.997% |
| MACD histogram | 0.2296 |
| Best SQ | 12:30 @ 1444.00 → **85.00** (0.06%) |
| Worst SQ | 14:00 @ 1448.25 → **-340.00** (-0.24%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 67.1 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.011% >= 0.01% of price
- Event smi_cross at 11:45 IST (before 14:00)
- Event RSI 71.61
- BB upper gap 0.460% (none)
- BB lower gap 0.997% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

### 16. HINDZINC · SELL @ 12:00

| Field | Value |
|-------|-------|
| Sector | Metal |
| Event kind | `smi_cross` |
| Cross time (IST) | 12:00 |
| Event / entry time (IST) | 12:00 |
| Entry mid | 547.63 |
| Signal close | 547.70 |
| Qty | 100 |
| SMI / signal | 45.6 / 46.7 |
| Peak SMI | 75.5 |
| Cross RSI | 76.54 |
| Event RSI | 76.54 |
| BB upper gap | 0.545% |
| BB lower gap | 2.005% |
| MACD histogram | 0.2115 |
| Best SQ | 13:00 @ 546.83 → **80.00** (0.15%) |
| Worst SQ | 14:00 @ 549.67 → **-204.00** (-0.37%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 75.5 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.011% >= 0.01% of price
- Event smi_cross at 12:00 IST (before 14:00)
- Event RSI 76.54
- BB upper gap 0.545% (none)
- BB lower gap 2.005% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

### 17. TMPV · SELL @ 11:30

| Field | Value |
|-------|-------|
| Sector | Automobile |
| Event kind | `smi_cross` |
| Cross time (IST) | 11:30 |
| Event / entry time (IST) | 11:30 |
| Entry mid | 347.42 |
| Signal close | 347.60 |
| Qty | 100 |
| SMI / signal | 39.6 / 40.0 |
| Peak SMI | 69.7 |
| Cross RSI | 75.82 |
| Event RSI | 75.82 |
| BB upper gap | 0.813% |
| BB lower gap | 3.180% |
| MACD histogram | 0.1594 |
| Best SQ | 15:00 @ 346.90 → **52.00** (0.15%) |
| Worst SQ | 12:00 @ 349.08 → **-165.00** (-0.48%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 69.7 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.016% >= 0.01% of price
- Event smi_cross at 11:30 IST (before 14:00)
- Event RSI 75.82
- BB upper gap 0.813% (none)
- BB lower gap 3.180% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

### 18. CANBK · SELL @ 12:30

| Field | Value |
|-------|-------|
| Sector | Bank |
| Event kind | `smi_cross` |
| Cross time (IST) | 12:30 |
| Event / entry time (IST) | 12:30 |
| Entry mid | 127.26 |
| Signal close | 127.19 |
| Qty | 100 |
| SMI / signal | 74.3 / 77.3 |
| Peak SMI | 88.3 |
| Cross RSI | 74.67 |
| Event RSI | 74.67 |
| BB upper gap | 0.663% |
| BB lower gap | 2.046% |
| MACD histogram | 0.0405 |
| Best SQ | 15:00 @ 127.01 → **26.00** (0.20%) |
| Worst SQ | 14:30 @ 127.38 → **-12.00** (-0.09%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 88.3 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.031% >= 0.01% of price
- Event smi_cross at 12:30 IST (before 14:00)
- Event RSI 74.67
- BB upper gap 0.663% (none)
- BB lower gap 2.046% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

### 19. ASHOKLEY · SELL @ 12:30

| Field | Value |
|-------|-------|
| Sector | Automobile |
| Event kind | `smi_cross` |
| Cross time (IST) | 12:30 |
| Event / entry time (IST) | 12:30 |
| Entry mid | 174.06 |
| Signal close | 174.13 |
| Qty | 100 |
| SMI / signal | 82.2 / 82.9 |
| Peak SMI | 91.8 |
| Cross RSI | 80.20 |
| Event RSI | 80.20 |
| BB upper gap | 1.584% |
| BB lower gap | 5.391% |
| MACD histogram | 0.1024 |
| Best SQ | 13:15 @ 173.90 → **17.00** (0.09%) |
| Worst SQ | 14:45 @ 174.81 → **-75.00** (-0.43%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 91.8 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.056% >= 0.01% of price
- Event smi_cross at 12:30 IST (before 14:00)
- Event RSI 80.20
- BB upper gap 1.584% (none)
- BB lower gap 5.391% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

### 20. OFSS · SELL @ 12:00

| Field | Value |
|-------|-------|
| Sector | IT |
| Event kind | `smi_cross` |
| Cross time (IST) | 12:00 |
| Event / entry time (IST) | 12:00 |
| Entry mid | 11356.50 |
| Signal close | 11373.00 |
| Qty | 100 |
| SMI / signal | 54.5 / 59.0 |
| Peak SMI | 82.1 |
| Cross RSI | 78.83 |
| Event RSI | 78.83 |
| BB upper gap | 0.773% |
| BB lower gap | 2.113% |
| MACD histogram | 6.114 |
| Best SQ | 12:15 @ 11356.50 → **0.00** (0.00%) |
| Worst SQ | 15:00 @ 11449.50 → **-9300.00** (-0.82%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 82.1 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.012% >= 0.01% of price
- Event smi_cross at 12:00 IST (before 14:00)
- Event RSI 78.83
- BB upper gap 0.773% (none)
- BB lower gap 2.113% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

### 21. KPITTECH · SELL @ 11:30

| Field | Value |
|-------|-------|
| Sector | IT |
| Event kind | `smi_cross` |
| Cross time (IST) | 11:30 |
| Event / entry time (IST) | 11:30 |
| Entry mid | 613.50 |
| Signal close | 614.75 |
| Qty | 100 |
| SMI / signal | 49.8 / 51.8 |
| Peak SMI | 78.1 |
| Cross RSI | 74.14 |
| Event RSI | 74.14 |
| BB upper gap | 1.239% |
| BB lower gap | 3.862% |
| MACD histogram | 0.8751 |
| Best SQ | 11:45 @ 613.70 → **-20.00** (-0.03%) |
| Worst SQ | 15:00 @ 620.33 → **-683.00** (-1.11%) |

**Reasons**

- Stch Mtm(10,3,10) bearish cross from overbought
- Peak SMI 78.1 >= 65
- Upper Bollinger Band tagged in lookback
- MACD histogram declining
- MACD hist Δ 0.051% >= 0.01% of price
- Event smi_cross at 11:30 IST (before 14:00)
- Event RSI 74.14
- BB upper gap 1.239% (none)
- BB lower gap 3.862% (none)
- Quality SELL: SMI cross only, event 10:45–12:30, RSI≥67, BB upper gap≤1.75%

## Notes

- Post-mortem uses the same Deeppro engine as Day Scan / Post-Mortem UI.
- No black-line slope / angle gate on BUY or SELL (cross/touch + quality gates only).
- **Best** = most favorable same-day mid after entry; **Worst** = least favorable same-day mid after entry (both before 15:15).
- Detail blocks include sector, event kind, SMI/signal, peak/trough, RSI, BB gaps, MACD hist, best/worst SQ, and engine reasons.
- Not a live fill guarantee — shows the P&L envelope if squared off on any later 15m mid.
- Kite Connect historical 15m only.

