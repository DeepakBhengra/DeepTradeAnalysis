# RulePNB — PNB July 2026 loss trades only

- **Rule:** RulePNB (PNB-only)
- **Symbol:** PNB
- **Window:** 2026-07-01 → 2026-07-31 (23 trade days)
- **Source signals:** 33 (20 BUY · 13 SELL)
- **Entry:** signal candle mid `(high+low)/2`
- **Best-SQ losses:** 5 (best later mid before 15:15 still negative)
- **EOD-SQ losses:** 19 (held to last mid ≤ 15:15)
- **Avg best-SQ loss %:** -0.06%
- **Avg EOD-SQ loss %:** -0.36%
- **Generated (UTC):** 2026-08-03T22:41:45.920Z

## A) Losses even on best same-day square-off

These are the only RulePNB July signals where **no later mid before 15:15** was better than entry.

| Day | Weekday | Side | Scenario | Entry time | Entry price | SQ time | SQ price | Loss % | RSI | SMI |
|-----|---------|------|----------|------------|-------------|---------|----------|--------|-----|-----|
| Wed, 22 Jul 2026 | Wednesday | BUY | buy quality | 09:30 | 111.23 | 09:45 | 111.06 | **-0.15%** | 37.2 | -55.9 |
| Mon, 13 Jul 2026 | Monday | SELL | sell quality | 13:45 | 105.98 | 14:00 | 106.07 | **-0.09%** | 61.1 | 54.6 |
| Wed, 15 Jul 2026 | Wednesday | BUY | buy quality | 13:30 | 105.82 | 14:30 | 105.79 | **-0.02%** | 45.6 | -58.5 |
| Thu, 16 Jul 2026 | Thursday | BUY | buy quality | 09:15 | 105.75 | 11:00 | 105.72 | **-0.02%** | 36.9 | -52.0 |
| Fri, 24 Jul 2026 | Friday | SELL | sell quality | 12:30 | 110.10 | 13:00 | 110.12 | **-0.01%** | 66.0 | 53.3 |

## B) Losses if square-off at session end (15:15 mid)

Uses the last same-day mid at/before 15:15 as square-off (more realistic hold-to-close loss view).

| Day | Weekday | Side | Scenario | Entry time | Entry price | SQ time | SQ price | Loss % | Best-SQ % |
|-----|---------|------|----------|------------|-------------|---------|----------|--------|-----------|
| Fri, 10 Jul 2026 | Friday | SELL | sell quality | 10:00 | 104.06 | 15:15 | 105.45 | **-1.33%** | 0.07% |
| Wed, 8 Jul 2026 | Wednesday | BUY | buy quality | 09:30 | 102.18 | 15:15 | 101.04 | **-1.12%** | 0.78% |
| Fri, 17 Jul 2026 | Friday | SELL | sell quality | 13:15 | 105.26 | 15:15 | 105.82 | **-0.54%** | 0.40% |
| Thu, 16 Jul 2026 | Thursday | BUY | buy quality | 09:15 | 105.75 | 15:15 | 105.22 | **-0.50%** | -0.02% |
| Wed, 22 Jul 2026 | Wednesday | BUY | buy quality | 09:30 | 111.23 | 15:15 | 110.73 | **-0.45%** | -0.15% |
| Wed, 29 Jul 2026 | Wednesday | BUY | buy quality | 11:15 | 111.45 | 15:15 | 111.00 | **-0.41%** | 0.21% |
| Fri, 31 Jul 2026 | Friday | SELL | sell quality | 09:45 | 112.23 | 15:15 | 112.67 | **-0.39%** | 0.11% |
| Mon, 13 Jul 2026 | Monday | SELL | sell quality | 13:45 | 105.98 | 15:15 | 106.34 | **-0.34%** | -0.09% |
| Mon, 6 Jul 2026 | Monday | BUY | buy quality | 11:45 | 104.57 | 15:15 | 104.23 | **-0.32%** | 0.36% |
| Thu, 30 Jul 2026 | Thursday | SELL | sell quality | 13:45 | 111.36 | 15:15 | 111.71 | **-0.31%** | 0.05% |
| Wed, 1 Jul 2026 | Wednesday | SELL | sell quality | 10:00 | 107.21 | 15:15 | 107.51 | **-0.28%** | 0.38% |
| Fri, 24 Jul 2026 | Friday | SELL | sell quality | 12:30 | 110.10 | 15:15 | 110.41 | **-0.27%** | -0.01% |
| Tue, 28 Jul 2026 | Tuesday | BUY | buy extended | 13:30 | 111.92 | 15:15 | 111.63 | **-0.26%** | 0.10% |
| Thu, 9 Jul 2026 | Thursday | SELL | sell quality | 13:15 | 103.40 | 15:15 | 103.55 | **-0.15%** | 0.11% |
| Tue, 14 Jul 2026 | Tuesday | BUY | buy quality | 09:45 | 105.02 | 15:15 | 104.91 | **-0.10%** | 0.25% |
| Tue, 28 Jul 2026 | Tuesday | SELL | sell quality | 09:15 | 111.56 | 15:15 | 111.63 | **-0.06%** | 0.00% |
| Tue, 21 Jul 2026 | Tuesday | BUY | buy quality | 12:30 | 112.19 | 15:15 | 112.13 | **-0.05%** | 0.22% |
| Wed, 15 Jul 2026 | Wednesday | BUY | buy quality | 13:30 | 105.82 | 15:15 | 105.79 | **-0.03%** | -0.02% |
| Mon, 27 Jul 2026 | Monday | SELL | sell quality | 09:45 | 111.57 | 15:15 | 111.58 | **-0.01%** | 0.62% |

### BUY EOD losses

| Day | Entry time | Entry price | SQ time | SQ price | Loss % |
|-----|------------|-------------|---------|----------|--------|
| Wed, 8 Jul 2026 | 09:30 | 102.18 | 15:15 | 101.04 | **-1.12%** |
| Thu, 16 Jul 2026 | 09:15 | 105.75 | 15:15 | 105.22 | **-0.50%** |
| Wed, 22 Jul 2026 | 09:30 | 111.23 | 15:15 | 110.73 | **-0.45%** |
| Wed, 29 Jul 2026 | 11:15 | 111.45 | 15:15 | 111.00 | **-0.41%** |
| Mon, 6 Jul 2026 | 11:45 | 104.57 | 15:15 | 104.23 | **-0.32%** |
| Tue, 28 Jul 2026 | 13:30 | 111.92 | 15:15 | 111.63 | **-0.26%** |
| Tue, 14 Jul 2026 | 09:45 | 105.02 | 15:15 | 104.91 | **-0.10%** |
| Tue, 21 Jul 2026 | 12:30 | 112.19 | 15:15 | 112.13 | **-0.05%** |
| Wed, 15 Jul 2026 | 13:30 | 105.82 | 15:15 | 105.79 | **-0.03%** |

### SELL EOD losses

| Day | Entry time | Entry price | SQ time | SQ price | Loss % |
|-----|------------|-------------|---------|----------|--------|
| Fri, 10 Jul 2026 | 10:00 | 104.06 | 15:15 | 105.45 | **-1.33%** |
| Fri, 17 Jul 2026 | 13:15 | 105.26 | 15:15 | 105.82 | **-0.54%** |
| Fri, 31 Jul 2026 | 09:45 | 112.23 | 15:15 | 112.67 | **-0.39%** |
| Mon, 13 Jul 2026 | 13:45 | 105.98 | 15:15 | 106.34 | **-0.34%** |
| Thu, 30 Jul 2026 | 13:45 | 111.36 | 15:15 | 111.71 | **-0.31%** |
| Wed, 1 Jul 2026 | 10:00 | 107.21 | 15:15 | 107.51 | **-0.28%** |
| Fri, 24 Jul 2026 | 12:30 | 110.10 | 15:15 | 110.41 | **-0.27%** |
| Thu, 9 Jul 2026 | 13:15 | 103.40 | 15:15 | 103.55 | **-0.15%** |
| Tue, 28 Jul 2026 | 09:15 | 111.56 | 15:15 | 111.63 | **-0.06%** |
| Mon, 27 Jul 2026 | 09:45 | 111.57 | 15:15 | 111.58 | **-0.01%** |

## Notes

- Section A uses best later mid before 15:15 (only 5 July signals never got a positive exit).
- Section B uses session-end mid ≤ 15:15; many trades that had a positive best-SQ still finished red if held to close.
- Worst EOD loss in July: look at the most negative Loss % in section B.

