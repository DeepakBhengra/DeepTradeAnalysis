# Five-stock favourable rules — Q4 2025 validation (Oct–Dec 2025)

Square-off study on Upstox 1m→15m for **LTM (LTIM) · ICICIGI · TECHM · TVSMOTOR · POLICYBZR**.

- **Window:** 2025-10-01 → 2025-12-31 (62 trading days)
- **Entry:** first rule BUY/SELL before 14:00 IST (event mid)
- **Square-off:** best later same-day mid before 15:15 IST
- **Source:** Upstox public historical 1m candles, resampled to NSE 15m (09:15-aligned)
- **Goal:** keep high positive-% accuracy and positive average best profit; correct gates only when Q4 underperforms

## Final results (after RulePOLICYBZR correction)

| Rule | Days | Signals (B/S) | Quality/Ext | Positive % | Avg best % | Avg +ve % | BUY +% / avg | SELL +% / avg |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **RuleLTM** | 62 | 100 (60/40) | 31/29 | **85.0%** | 0.58% | 0.72% | 90% / 0.69% | 77.5% / 0.41% |
| **RuleICICIGI** | 62 | 103 (55/48) | 37/18 | **80.6%** | 0.46% | 0.60% | 80% / 0.51% | 81.3% / 0.40% |
| **RuleTECHM** | 62 | 102 (60/42) | 34/26 | **79.4%** | 0.40% | 0.56% | 81.7% / 0.54% | 76.2% / 0.20% |
| **RuleTVSMOTOR** | 62 | 98 (61/37) | 36/25 | **79.6%** | 0.48% | 0.67% | 80.3% / 0.52% | 78.4% / 0.42% |
| **RulePOLICYBZR** | 62 | 91 (61/30) | 41/20 | **80.2%** | 0.79% | 1.09% | 80.3% / 0.94% | 80.0% / 0.47% |

## Baseline vs corrected (RulePOLICYBZR only)

Original image thresholds on Q4 2025:

| Variant | Signals | Positive % | Avg best % | BUY +% | SELL +% |
|---------|--------:|-----------:|-----------:|-------:|--------:|
| Original (BUY ext neg SMI / SELL SMI≥40, BB≤0.5%) | 87 | 70.1% | 0.60% | 75.4% | **60.0%** |
| BUY extended only (mid SMI, BB≤1.6%) | 91 | 73.6% | 0.75% | 80.3% | 60.0% |
| SELL only (SMI≥60, RSI≤85, BB≤0.7%) | 87 | 77.0% | 0.64% | 75.4% | **80.0%** |
| **Both (shipped)** | **91** | **80.2%** | **0.79%** | **80.3%** | **80.0%** |

### RulePOLICYBZR corrections shipped

- `buyExtended.requireNegativeSmi`: true → **false**
- `buyExtended.maxSmi`: 0 → **40** (mid-SMI OK)
- `buyExtended.maxBbLowerGapPct`: 1.3 → **1.6**
- `sellQuality.minSmi`: 40 → **60**
- `sellQuality.maxRsi`: 75 → **85**
- `sellQuality.maxBbUpperGapPct`: 0.5 → **0.7**

LTM / ICICIGI / TECHM / TVSMOTOR needed **no** threshold changes — already ≥79% positive with positive average best profit.

## Encoded rules after Q4 improvisation

| Rule | Symbol | BUY quality | SELL quality | BUY extended |
|------|--------|-------------|--------------|--------------|
| **RuleLTM** | LTM (NSE LTIM) | RSI 30–55, SMI ≤ −40, BB lower ≤ 0.8% | RSI 50–75, SMI ≥ 40, BB upper ≤ 0.8% | mid SMI ≤ 40, BB ≤ 1.5% |
| **RuleICICIGI** | ICICIGI | RSI 30–50, SMI ≤ −40, BB lower ≤ 0.7% | RSI 45–75, SMI ≥ 20, BB upper ≤ 1.0% | negative SMI, BB ≤ 1.0% |
| **RuleTECHM** | TECHM | RSI 20–45, SMI ≤ −40, BB lower ≤ 0.7% | RSI 50–80, SMI ≥ 40, BB upper ≤ 1.0% | mid SMI ≤ 40, BB ≤ 2.2% |
| **RuleTVSMOTOR** | TVSMOTOR | RSI 30–55, SMI ≤ −30, BB lower ≤ 0.6% | RSI 55–75, SMI ≥ 40, BB upper ≤ 0.7% | mid SMI ≤ 40, BB ≤ 1.4% |
| **RulePOLICYBZR** | POLICYBZR | RSI 25–55, SMI ≤ −25, BB lower ≤ 1.0% | RSI 55–85, SMI ≥ **60**, BB upper ≤ **0.7%** | mid SMI ≤ **40**, BB ≤ **1.6%** |

## Detail reports

- `ltm-favourable-q4-2025.md`
- `icicigi-favourable-q4-2025.md`
- `techm-favourable-q4-2025.md`
- `tvsmotor-favourable-q4-2025.md`
- `policybzr-favourable-q4-2025.md`

Script: `scripts/study-favourable-symbol-q4-2025.ts`
