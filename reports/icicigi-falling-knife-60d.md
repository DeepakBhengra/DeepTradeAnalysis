# ICICIGI — falling-knife BUY quality scan (last 58 trade days)

- **Window:** 2026-05-13 → 2026-08-04
- **Source:** Yahoo Finance 15m (`ICICIGI.NS`, range=60d)
- **Level setup:** first RuleICICIGI BUY quality (RSI 30–50, SMI ≤ −40, BB lower ≤ 0.7%) before 14:00
- **Guards:** SMI rising + MACD hist rising + next-bar mid confirm + open DD ≤ 0.8%
- **“Like 29 Jul”:** level BUY where best same-day square-off ≤ 0% and EOD &lt; 0%

## Summary

| Metric | Count |
|---|---:|
| Trading days scanned | 58 |
| Days with level-only BUY quality | 27 |
| Level BUYs blocked by guards | 22 |
| **Losing knives (like 29 Jul)** | **6** |
| Losing knives blocked by guards | 6 |
| Level setups that pass guards | 5 |
| Days with guarded RuleICICIGI BUY (quality or extended) | 33 |

## Losing knives (29 Jul–style)

| Date | Setup | Mid | RSI | SMI | Open DD | Next bar | Best SQ | EOD | Guards |
|---|---|---:|---:|---:|---:|---|---:|---:|---|
| 15 May (Fri) | 13:30 | 1839.05 | 39.6 | -45.6 | -0.04% | ↓/none 13:45 | -0.07% | -0.16% | SMI not rising; MACD hist not rising; next bar not higher |
| 10 Jun (Wed) | 10:30 | 1761.75 | 38.4 | -53.1 | -0.96% | ↓/none 10:45 | -0.22% | -1.65% | SMI not rising; MACD hist not rising; next bar not higher; open DD -0.96% < −0.8% |
| 22 Jun (Mon) | 12:15 | 1872.75 | 38.2 | -52.2 | -0.67% | ↓/none 12:30 | -0.05% | -0.71% | SMI not rising; MACD hist not rising; next bar not higher |
| 23 Jun (Tue) | 11:00 | 1852.85 | 43.3 | -44.5 | -0.2% | ↓/none 11:15 | -0.02% | -1.04% | SMI not rising; next bar not higher |
| 29 Jul (Wed) | 10:15 | 1675.95 | 33.7 | -54.1 | -0.78% | ↓/none 10:30 | -0.16% | -1.66% | SMI not rising; MACD hist not rising; next bar not higher |
| 4 Aug (Tue) | 10:00 | 1646.05 | 41.6 | -46.1 | -0.66% | ↓/none 10:15 | 0% | -0.63% | SMI not rising; MACD hist not rising; next bar not higher |

## All level-only BUY quality days

| Date | Setup | Mid | RSI | SMI | ΔSMI | ΔMACD | Open DD | Confirm | Best SQ | EOD | Guard |
|---|---|---:|---:|---:|---|---|---:|:---:|---:|---:|---|
| 15 May (Fri) | 13:30 | 1839.05 | 39.6 | -45.6 | -18.9→-45.6 ↓ | -1.68→-2.14 ↓ | -0.04% | N | -0.07% | -0.16% | SMI not rising; MACD hist not rising; next bar not higher |
| 20 May (Wed) | 09:15 | 1799.90 | 30.7 | -57.8 | -22.8→-57.8 ↓ | -0.2→-2.04 ↓ | 0% | N | 0.44% | -1.07% | SMI not rising; MACD hist not rising; next bar not higher |
| 22 May (Fri) | 13:45 | 1823.25 | 38.4 | -79.7 | -70.5→-79.7 ↓ | -2.58→-3.16 ↓ | 0.18% | N | 0.23% | 0.23% | SMI not rising; MACD hist not rising; next bar not higher |
| 27 May (Wed) | 09:45 | 1857.55 | 30.3 | -42.9 | -23.6→-42.9 ↓ | -1.47→-1.99 ↓ | -0.08% | N | 0.52% | -0.36% | SMI not rising; MACD hist not rising; next bar not higher |
| 29 May (Fri) | 10:15 | 1839.15 | 33.9 | -52.7 | -72→-52.7 ↑ | -2.76→-2.03 ↑ | -0.44% | Y | 0.19% | -2.71% | **PASS** |
| 2 Jun (Tue) | 10:45 | 1732.45 | 37.4 | -54.1 | -32.5→-54.1 ↓ | 1.58→1.22 ↓ | -0.32% | N | 0.95% | 0.81% | SMI not rising; MACD hist not rising; next bar not higher |
| 3 Jun (Wed) | 09:45 | 1726.25 | 45.1 | -46.6 | -32.1→-46.6 ↓ | -0.26→-0.57 ↓ | -0.39% | Y | 0.91% | 0.91% | SMI not rising; MACD hist not rising |
| 4 Jun (Thu) | 13:15 | 1733.35 | 34 | -50.6 | -43.8→-50.6 ↓ | -0.35→-0.37 ↓ | -0.22% | Y | 0.25% | 0.12% | SMI not rising; MACD hist not rising |
| 8 Jun (Mon) | 09:30 | 1737.85 | 37 | -46.1 | -27.3→-46.1 ↓ | -1.67→-2.65 ↓ | 0.04% | Y | 0.81% | 0.03% | SMI not rising; MACD hist not rising |
| 9 Jun (Tue) | 13:45 | 1772.30 | 32.9 | -70.9 | -58.9→-70.9 ↓ | -1.95→-2.59 ↓ | 0.05% | Y | 0.48% | 0.17% | SMI not rising; MACD hist not rising |
| 10 Jun (Wed) | 10:30 | 1761.75 | 38.4 | -53.1 | -28.8→-53.1 ↓ | -2.35→-2.95 ↓ | -0.96% | N | -0.22% | -1.65% | SMI not rising; MACD hist not rising; next bar not higher; open DD -0.96% < −0.8% |
| 11 Jun (Thu) | 10:15 | 1725.75 | 34.1 | -59.7 | -68.9→-59.7 ↑ | -1.23→-0.66 ↑ | 0.01% | Y | 0.07% | -0.58% | **PASS** |
| 12 Jun (Fri) | 09:45 | 1684.65 | 30.1 | -74.4 | -75.8→-74.4 ↑ | -2.05→-2.32 ↓ | -0.76% | Y | 0.69% | 0.69% | MACD hist not rising |
| 22 Jun (Mon) | 12:15 | 1872.75 | 38.2 | -52.2 | -32.7→-52.2 ↓ | -2.46→-2.74 ↓ | -0.67% | N | -0.05% | -0.71% | SMI not rising; MACD hist not rising; next bar not higher |
| 23 Jun (Tue) | 11:00 | 1852.85 | 43.3 | -44.5 | -33→-44.5 ↓ | -1.23→-1.2 ↑ | -0.2% | N | -0.02% | -1.04% | SMI not rising; next bar not higher |
| 24 Jun (Wed) | 11:15 | 1825.55 | 45.3 | -45.3 | -34→-45.3 ↓ | 0.73→0.49 ↓ | -0.83% | N | 0.19% | -0.29% | SMI not rising; MACD hist not rising; next bar not higher; open DD -0.83% < −0.8% |
| 30 Jun (Tue) | 10:00 | 1758.55 | 37.3 | -49.9 | -36.2→-49.9 ↓ | 0.71→0.5 ↓ | -0.22% | N | 0.55% | -1.19% | SMI not rising; MACD hist not rising; next bar not higher |
| 1 Jul (Wed) | 09:30 | 1739.65 | 40.7 | -52.7 | -65.1→-52.7 ↑ | -0.32→-0.04 ↑ | 0.02% | Y | 1.03% | 1.02% | **PASS** |
| 7 Jul (Tue) | 11:45 | 1784.90 | 49.4 | -58.1 | -51.1→-58.1 ↓ | -1.09→-1.14 ↓ | -0.38% | N | 0.82% | 0.82% | SMI not rising; MACD hist not rising; next bar not higher |
| 9 Jul (Thu) | 10:30 | 1789.35 | 33.7 | -57.4 | -71.2→-57.4 ↑ | -2.84→-1.81 ↑ | -0.72% | Y | 0.43% | 0.43% | **PASS** |
| 13 Jul (Mon) | 09:30 | 1761.50 | 31.3 | -43.5 | -4.8→-43.5 ↓ | -2.77→-5.92 ↓ | -1.53% | N | 1.53% | 1.53% | SMI not rising; MACD hist not rising; next bar not higher; open DD -1.53% < −0.8% |
| 15 Jul (Wed) | 13:45 | 1809.50 | 45.5 | -48.5 | -62.5→-48.5 ↑ | -2.15→-1.81 ↑ | 0.36% | Y | 0.39% | 0.36% | **PASS** |
| 22 Jul (Wed) | 13:30 | 1589.50 | 34.8 | -65.7 | -82.2→-65.7 ↑ | -0.46→-0.04 ↑ | -1.33% | Y | 0.08% | -0.22% | open DD -1.33% < −0.8% |
| 28 Jul (Tue) | 10:00 | 1668.25 | 33.4 | -48.2 | -22.9→-48.2 ↓ | -1.56→-2.06 ↓ | -0.64% | Y | 1.32% | 1.27% | SMI not rising; MACD hist not rising |
| 29 Jul (Wed) | 10:15 | 1675.95 | 33.7 | -54.1 | -33.8→-54.1 ↓ | -0.75→-1.33 ↓ | -0.78% | N | -0.16% | -1.66% | SMI not rising; MACD hist not rising; next bar not higher |
| 31 Jul (Fri) | 10:15 | 1631.90 | 36.7 | -45.5 | -40.4→-45.5 ↓ | -0.04→-0.09 ↓ | -0.27% | N | 0.16% | -0.5% | SMI not rising; MACD hist not rising; next bar not higher |
| 4 Aug (Tue) | 10:00 | 1646.05 | 41.6 | -46.1 | -26.2→-46.1 ↓ | -1.14→-1.8 ↓ | -0.66% | N | 0% | -0.63% | SMI not rising; MACD hist not rising; next bar not higher |

## Guarded RuleICICIGI BUY signals (after filters)

| Date | Entry | Scenario | Price | Best SQ | EOD |
|---|---|---|---:|---:|---:|
| 14 May (Thu) | 10:30 | buy_extended | 1812.45 | 2.02% | 2.02% |
| 18 May (Mon) | 10:15 | buy_extended | 1799.00 | 0.98% | 0.6% |
| 20 May (Wed) | 10:15 | buy_quality | 1803.45 | 0.24% | -1.26% |
| 21 May (Thu) | 09:45 | buy_extended | 1785.15 | 0.97% | 0.97% |
| 26 May (Tue) | 10:15 | buy_extended | 1855.40 | 0.8% | 0.38% |
| 27 May (Wed) | 10:45 | buy_quality | 1861.50 | 0.31% | -0.57% |
| 29 May (Fri) | 10:30 | buy_quality | 1842.65 | -0.05% | -2.9% |
| 2 Jun (Tue) | 13:00 | buy_quality | 1739.00 | 0.57% | 0.43% |
| 3 Jun (Wed) | 10:45 | buy_quality | 1733.65 | 0.48% | 0.48% |
| 8 Jun (Mon) | 10:45 | buy_quality | 1745.40 | 0.38% | -0.4% |
| 10 Jun (Wed) | 09:30 | buy_extended | 1785.65 | 0.1% | -2.96% |
| 11 Jun (Thu) | 10:30 | buy_quality | 1726.95 | -0.06% | -0.65% |
| 12 Jun (Fri) | 10:15 | buy_extended | 1691.05 | 0.31% | 0.31% |
| 17 Jun (Wed) | 12:30 | buy_extended | 1787.65 | 0.22% | 0.17% |
| 23 Jun (Tue) | 09:30 | buy_extended | 1861.95 | 0.07% | -1.52% |
| 24 Jun (Wed) | 13:30 | buy_extended | 1829.00 | -0.08% | -0.48% |
| 25 Jun (Thu) | 09:30 | buy_extended | 1832.15 | 0.19% | -0.89% |
| 30 Jun (Tue) | 11:00 | buy_quality | 1768.25 | -0.3% | -1.73% |
| 1 Jul (Wed) | 09:45 | buy_quality | 1744.80 | 0.73% | 0.73% |
| 2 Jul (Thu) | 10:45 | buy_extended | 1758.15 | 0.42% | 0.22% |
| 3 Jul (Fri) | 12:00 | buy_extended | 1773.35 | 0.06% | 0.06% |
| 6 Jul (Mon) | 11:00 | buy_extended | 1777.00 | 0.53% | 0.53% |
| 7 Jul (Tue) | 13:00 | buy_extended | 1796.20 | 0.19% | 0.19% |
| 9 Jul (Thu) | 10:45 | buy_quality | 1794.65 | 0.13% | 0.13% |
| 10 Jul (Fri) | 13:15 | buy_extended | 1810.55 | 1.2% | 0.78% |
| 14 Jul (Tue) | 11:45 | buy_extended | 1753.45 | 2.04% | 2.04% |
| 15 Jul (Wed) | 14:00 | buy_quality | 1811.30 | 0.29% | 0.26% |
| 17 Jul (Fri) | 10:00 | buy_extended | 1601.95 | 0.75% | 0.6% |
| 21 Jul (Tue) | 10:15 | buy_extended | 1619.60 | 0.29% | 0.23% |
| 23 Jul (Thu) | 10:15 | buy_extended | 1580.25 | 2.68% | 2.68% |
| 28 Jul (Tue) | 09:30 | buy_extended | 1680.10 | 0.61% | 0.56% |
| 30 Jul (Thu) | 11:30 | buy_extended | 1638.00 | 0.5% | -0.09% |
| 31 Jul (Fri) | 11:30 | buy_quality | 1633.70 | 0.05% | -0.61% |

## Notes

- 29 Jul pattern = level BUY quality while momentum still falling / next bar lower / deep open drawdown, then no positive same-day square-off.
- Guards are designed to block that class; a blocked loser is a win for the filter.
- Yahoo 15m covers ~60 calendar days of sessions; bar count may be slightly under 60 trade days near holidays.
