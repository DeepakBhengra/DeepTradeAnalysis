# Five-stock favourable rules — 60d study summary (2026-05-12 → 2026-08-03)

Rule-free Yahoo 15m studies for **LTM · ICICIGI · TECHM · TVSMOTOR · POLICYBZR**, then per-symbol RSI / Stch Mtm / BB IQR gates encoded as separate Day Scan / Post-Mortem rules.

## Step 1 — best BUY / SELL times

| Symbol | Best BUY | Best SELL | Recommended clock |
|--------|----------|-----------|-------------------|
| **LTM** | Mon 3 Aug 10:45 @ 4406.30 → SQ 13:15 @ 4712.00 = **+6.94%** | Wed 3 Jun 09:15 @ 4171.00 → SQ 12:00 @ 4001.30 = **+4.07%** | BUY/SELL **09:15** |
| **ICICIGI** | Thu 23 Jul 09:45 @ 1575.35 → SQ 15:15 @ 1622.65 = **+3.00%** | Thu 16 Jul 09:15 @ 1666.45 → SQ 09:30 @ 1589.35 = **+4.63%** | BUY/SELL **09:15** |
| **TECHM** | Mon 13 Jul 09:15 @ 1454.95 → SQ 13:00 @ 1522.55 = **+4.65%** | Wed 3 Jun 09:15 @ 1534.90 → SQ 15:15 @ 1471.30 = **+4.14%** | BUY/SELL **09:15** |
| **TVSMOTOR** | Tue 21 Jul 11:15 @ 3582.25 → SQ 14:45 @ 3798.60 = **+6.04%** | Wed 8 Jul 13:00 @ 3761.70 → SQ 15:00 @ 3634.40 = **+3.38%** | BUY/SELL **09:15** |
| **POLICYBZR** | Mon 18 May 10:00 @ 1679.65 → SQ 15:15 @ 1746.40 = **+3.97%** | Wed 3 Jun 09:15 @ 1632.70 → SQ 12:00 @ 1559.15 = **+4.50%** | BUY/SELL **09:15** |

Detail reports: `reports/{symbol}-best-entry-times-60d.md`, `reports/{symbol}-all-best-buy-sell-60d.md`.

## Step 2 — favourable RSI / SMI / BB by profit range (IQR)

| Symbol | Side | 1.7%–0.9% (quality) | 0.8%–0.4% | 3%–1.8% (extended) |
|--------|------|---------------------|-----------|--------------------|
| LTM | BUY | RSI 37–70 · SMI mid/neg · BB lower 0.4–2.2% | RSI 29–54 · SMI ≤−40 · BB ≤0.8% | RSI mixed · mid SMI · BB wider 0.7–1.5% |
| LTM | SELL | RSI 51–75 · SMI ≥40 · BB upper 0.3–0.7% | RSI 51–77 · SMI ≥40 · BB 0.4–1.1% | mixed |
| ICICIGI | BUY | RSI 33–68 · SMI neg · BB ≤0.9% | RSI 30–43 · SMI ≤−40 · BB ≤0.6% | RSI 26–54 · SMI neg · BB ≤0.9% |
| ICICIGI | SELL | RSI 41–75 · SMI mid→OB · BB ≤0.9% | RSI 45–73 · SMI ≥~20 · BB ≤1.0% | mixed / weaker |
| TECHM | BUY | mixed | RSI 21–40 · SMI ≤−40 · BB ≤0.6% *(clearest)* | mid SMI · BB wider ≤2.2% |
| TECHM | SELL | RSI 52–84 · SMI ≥40 · BB ≤1.1% | RSI 47–77 · SMI ≥40 · BB ≤0.8% | mixed |
| TVSMOTOR | BUY | RSI 31–58 · SMI neg · BB ≤0.5% | RSI 26–49 · SMI ≤−40 · BB ≤0.5% | mid SMI · BB ≤1.4% |
| TVSMOTOR | SELL | RSI 45–71 · SMI mid→OB · BB ≤1.0% | RSI 62–75 · SMI ≥40 · BB ≤0.7% | mixed |
| POLICYBZR | BUY | RSI 24–60 · SMI neg · BB ≤1.0% | RSI 28–51 · SMI ≤−40 · BB ≤0.7% | SMI often neg · BB ≤1.3% |
| POLICYBZR | SELL | RSI 41–69 · SMI mid→OB · BB ≤1.0% | RSI 64–71 · SMI ≥40 · BB ≤0.4% | mixed |

Detail reports: `reports/{symbol}-range-indicator-analysis-60d.md`.

## Step 3 — encoded rules

| Rule | Symbol | BUY quality | SELL quality | BUY extended |
|------|--------|-------------|--------------|--------------|
| **RuleLTM** | LTM | RSI 30–55, SMI ≤ −40, BB lower ≤ 0.8% | RSI 50–75, SMI ≥ 40, BB upper ≤ 0.8% | mid SMI ≤ 40, BB ≤ 1.5% |
| **RuleICICIGI** | ICICIGI | RSI 30–50, SMI ≤ −40, BB lower ≤ 0.7% | RSI 45–75, SMI ≥ 20, BB upper ≤ 1.0% | negative SMI, BB ≤ 1.0% |
| **RuleTECHM** | TECHM | RSI 20–45, SMI ≤ −40, BB lower ≤ 0.7% | RSI 50–80, SMI ≥ 40, BB upper ≤ 1.0% | mid SMI ≤ 40, BB ≤ 2.2% |
| **RuleTVSMOTOR** | TVSMOTOR | RSI 30–55, SMI ≤ −30, BB lower ≤ 0.6% | RSI 55–75, SMI ≥ 40, BB upper ≤ 0.7% | mid SMI ≤ 40, BB ≤ 1.4% |
| **RulePOLICYBZR** | POLICYBZR | RSI 25–55, SMI ≤ −25, BB lower ≤ 1.0% | RSI 55–85, SMI ≥ 60, BB upper ≤ 0.7% *(Q4 2025 tuned)* | mid SMI ≤ 40, BB ≤ 1.6% *(Q4 2025 tuned)* |

Each rule is **symbol-locked** (Day Scan / Post-Mortem / backtest), separate from Deepak / Deeppro / RulePNB / RuleSUNPHARMA.

- Config: `config.favourableSymbolRules` in `src/config.ts`
- Engine: `src/rules/favourableSymbolRule.ts`
- API: `GET /api/backtest/symbol-rule/{ltm|icicigi|techm|tvsmotor|policybzr}/day-scan` · backtest sibling
- Q4 2025 validation / improvisation: `reports/five-stock-favourable-rules-q4-2025-summary.md`
