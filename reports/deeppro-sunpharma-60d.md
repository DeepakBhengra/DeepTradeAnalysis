# SUNPHARMA deeppro Scan Report

- **Symbol:** SUNPHARMA
- **Interval:** 15m
- **Rule:** deeppro
- **Generated (UTC):** 2026-08-02T12:02:39Z
- **Trade days scanned:** 41 (2026-06-04 → 2026-07-31)
- **Requested trade days:** 60
- **Data source:** Yahoo Finance (SUNPHARMA.NS)
- **Candle range:** 2026-06-04T09:15:00+05:30 → 2026-07-31T15:15:00+05:30
- **Matches:** 21

## Rule definition

- SMI: `Stch Mtm(10,3,3) William Blau SMI`
- Overbought level: `40`
- Min peak SMI: `70`
- Lookback bars: `8`

Requires:

- SMI bearish cross from overbought
- Peak SMI >= 70 in lookback
- Upper Bollinger Band tagged in lookback
- MACD histogram declining on cross candle

## Chart pink-circle reference

- **Date:** 2026-07-31
- **Annotated time:** 14:00 IST
- Pink-circle Stch Mtm exhaustion: SMI bearish cross from deep overbought at 13:30, stall/doji at highs at 14:00, then dump with SMI exiting overbought and MACD bearish cross at 14:15.

## Matches

| Date | Cross | Event | Kind | Event RSI | BB upper % | Upper match | BB lower % | Lower match | Peak SMI | Fwd drop % |
|------|-------|-------|------|-----------|------------|-------------|------------|-------------|----------|------------|
| 2026-06-10 | 13:00 | 13:45 | stall_at_highs | 57.42 | 0.522 | - | 0.738 | - | 82.6 | 0.12 |
| 2026-06-12 | 12:00 | 12:45 | stall_at_highs | 64.93 | 0.308 | - | 1.044 | - | 79.5 | 0.20 |
| 2026-06-16 | 14:45 | 15:15 | stall_at_highs | 54.55 | 0.094 | close | 0.338 | - | 72.5 | 0.05 |
| 2026-06-18 | 15:00 | 15:15 | stall_at_highs | 72.12 | 0.035 | crossed | 0.531 | - | 73.1 | 0.13 |
| 2026-06-22 | 11:00 | 11:45 | stall_at_highs | 74.33 | 0.267 | close | 1.661 | - | 84.4 | 0.24 |
| 2026-06-22 | 13:15 | 13:30 | stall_at_highs | 73.74 | 0.073 | close | 1.221 | - | 82.1 | 0.26 |
| 2026-06-23 | 10:00 | 10:30 | stall_at_highs | 75.47 | 0.296 | close | 2.503 | - | 81.5 | 0.35 |
| 2026-06-24 | 14:00 | 14:15 | smi_exit_overbought | 59.43 | 0.275 | close | 0.493 | - | 84.5 | 0.12 |
| 2026-06-25 | 11:15 | 11:30 | stall_at_highs | 54.11 | 0.337 | - | 0.327 | - | 70.4 | 0.42 |
| 2026-06-29 | 11:15 | 12:00 | stall_at_highs | 61.23 | 0.875 | - | 1.555 | - | 74.9 | 0.28 |
| 2026-06-29 | 11:45 | 12:00 | stall_at_highs | 61.23 | 0.875 | - | 1.555 | - | 76.4 | 0.28 |
| 2026-07-02 | 11:30 | 12:00 | stall_at_highs | 54.78 | 0.224 | close | 0.392 | - | 76.9 | 0.22 |
| 2026-07-03 | 11:30 | 12:15 | smi_exit_overbought | 76.85 | 1.158 | - | 2.822 | - | 88.9 | 0.29 |
| 2026-07-09 | 10:45 | 10:45 | smi_cross | 69.40 | 0.342 | - | 3.900 | - | 80.8 | 0.54 |
| 2026-07-15 | 11:45 | 12:00 | stall_at_highs | 70.68 | 0.315 | - | 0.917 | - | 74.2 | 0.33 |
| 2026-07-21 | 13:00 | 13:15 | stall_at_highs | 77.44 | 0.196 | close | 0.735 | - | 81.2 | 0.24 |
| 2026-07-24 | 10:00 | 10:45 | stall_at_highs | 60.38 | 0.632 | - | 0.875 | - | 70.2 | 0.29 |
| 2026-07-27 | 13:15 | 13:30 | stall_at_highs | 72.99 | 0.315 | - | 1.696 | - | 89.1 | 0.27 |
| 2026-07-30 | 12:45 | 13:15 | macd_bear_cross | 62.19 | 0.323 | - | 1.138 | - | 81.8 | 0.58 |
| 2026-07-30 | 14:00 | 14:00 | smi_cross | 45.73 | 0.220 | close | 0.191 | close | 81.8 | 0.09 |
| 2026-07-31 **(chart pink)** | 13:30 | 14:00 | stall_at_highs | 88.47 | 0.318 | - | 1.862 | - | 87.9 | 3.69 |

## Match detail

### 1. 2026-06-10 13:45 IST (stall_at_highs)

- Cross time: `13:00` IST
- Side: `SELL`
- Cross close: `1794.1` · Event close: `1788.5`
- Peak SMI: `82.56` · Cross SMI/signal: `77.79` / `79.04`
- Cross RSI: `79.14` · **Event RSI: `57.42`**
- **BB upper proximity:** high `1790.8` vs `1800.14` · gap `0.5222%` · signed `-0.5222%` · match `none`
- **BB lower proximity:** low `1787.9` vs `1774.71` · gap `0.7375%` · signed `-0.7375%` · match `none`
- MACD histogram at cross: `1.3795`
- Forward drop (next ~3 bars): `0.12%`

### 2. 2026-06-12 12:45 IST (stall_at_highs)

- Cross time: `12:00` IST
- Side: `SELL`
- Cross close: `1807.2` · Event close: `1809.7`
- Peak SMI: `79.54` · Cross SMI/signal: `59.16` / `64.74`
- Cross RSI: `70.39` · **Event RSI: `64.93`**
- **BB upper proximity:** high `1810.3` vs `1815.87` · gap `0.3076%` · signed `-0.3076%` · match `none`
- **BB lower proximity:** low `1807.1` vs `1788.2` · gap `1.0442%` · signed `-1.0442%` · match `none`
- MACD histogram at cross: `0.9098`
- Forward drop (next ~3 bars): `0.2%`

### 3. 2026-06-16 15:15 IST (stall_at_highs)

- Cross time: `14:45` IST
- Side: `SELL`
- Cross close: `1802.7` · Event close: `1800.7`
- Peak SMI: `72.55` · Cross SMI/signal: `49.5` / `56.59`
- Cross RSI: `66.53` · **Event RSI: `54.55`**
- **BB upper proximity:** high `1805.0` vs `1806.7` · gap `0.0942%` · signed `-0.0942%` · match `close`
- **BB lower proximity:** low `1799.8` vs `1793.71` · gap `0.338%` · signed `-0.338%` · match `none`
- MACD histogram at cross: `0.8851`
- Forward drop (next ~3 bars): `0.05%`

### 4. 2026-06-18 15:15 IST (stall_at_highs)

- Cross time: `15:00` IST
- Side: `SELL`
- Cross close: `1823.9` · Event close: `1824.8`
- Peak SMI: `73.1` · Cross SMI/signal: `53.76` / `61.1`
- Cross RSI: `72.77` · **Event RSI: `72.12`**
- **BB upper proximity:** high `1828.0` vs `1827.36` · gap `0.0353%` · signed `0.0353%` · match `crossed`
- **BB lower proximity:** low `1822.5` vs `1812.8` · gap `0.5313%` · signed `-0.5313%` · match `none`
- MACD histogram at cross: `0.3476`
- Forward drop (next ~3 bars): `0.13%`

### 5. 2026-06-22 11:45 IST (stall_at_highs)

- Cross time: `11:00` IST
- Side: `SELL`
- Cross close: `1846.7` · Event close: `1850.6`
- Peak SMI: `84.39` · Cross SMI/signal: `74.72` / `76.48`
- Cross RSI: `70.33` · **Event RSI: `74.33`**
- **BB upper proximity:** high `1853.0` vs `1857.94` · gap `0.2669%` · signed `-0.2669%` · match `close`
- **BB lower proximity:** low `1849.7` vs `1818.96` · gap `1.6611%` · signed `-1.6611%` · match `none`
- MACD histogram at cross: `1.3427`
- Forward drop (next ~3 bars): `0.24%`

### 6. 2026-06-22 13:30 IST (stall_at_highs)

- Cross time: `13:15` IST
- Side: `SELL`
- Cross close: `1858.7` · Event close: `1859.0`
- Peak SMI: `82.08` · Cross SMI/signal: `76.6` / `76.65`
- Cross RSI: `75.71` · **Event RSI: `73.74`**
- **BB upper proximity:** high `1861.6` vs `1862.95` · gap `0.0726%` · signed `-0.0726%` · match `close`
- **BB lower proximity:** low `1857.7` vs `1835.0` · gap `1.2211%` · signed `-1.2211%` · match `none`
- MACD histogram at cross: `0.9409`
- Forward drop (next ~3 bars): `0.26%`

### 7. 2026-06-23 10:30 IST (stall_at_highs)

- Cross time: `10:00` IST
- Side: `SELL`
- Cross close: `1890.0` · Event close: `1890.9`
- Peak SMI: `81.54` · Cross SMI/signal: `67.42` / `70.11`
- Cross RSI: `75.12` · **Event RSI: `75.47`**
- **BB upper proximity:** high `1893.9` vs `1899.5` · gap `0.2959%` · signed `-0.2959%` · match `close`
- **BB lower proximity:** low `1884.3` vs `1836.96` · gap `2.5034%` · signed `-2.5034%` · match `none`
- MACD histogram at cross: `3.09`
- Forward drop (next ~3 bars): `0.35%`

### 8. 2026-06-24 14:15 IST (smi_exit_overbought)

- Cross time: `14:00` IST
- Side: `SELL`
- Cross close: `1876.8` · Event close: `1875.0`
- Peak SMI: `84.48` · Cross SMI/signal: `63.08` / `71.04`
- Cross RSI: `57.27` · **Event RSI: `59.43`**
- **BB upper proximity:** high `1877.5` vs `1882.66` · gap `0.2754%` · signed `-0.2754%` · match `close`
- **BB lower proximity:** low `1874.4` vs `1865.15` · gap `0.4935%` · signed `-0.4935%` · match `none`
- MACD histogram at cross: `0.7523`
- Forward drop (next ~3 bars): `0.12%`

### 9. 2026-06-25 11:30 IST (stall_at_highs)

- Cross time: `11:15` IST
- Side: `SELL`
- Cross close: `1878.3` · Event close: `1878.1`
- Peak SMI: `70.38` · Cross SMI/signal: `36.15` / `44.52`
- Cross RSI: `51.91` · **Event RSI: `54.11`**
- **BB upper proximity:** high `1879.3` vs `1885.63` · gap `0.337%` · signed `-0.337%` · match `none`
- **BB lower proximity:** low `1877.0` vs `1870.85` · gap `0.3274%` · signed `-0.3274%` · match `none`
- MACD histogram at cross: `0.3597`
- Forward drop (next ~3 bars): `0.42%`

### 10. 2026-06-29 12:00 IST (stall_at_highs)

- Cross time: `11:15` IST
- Side: `SELL`
- Cross close: `1888.6` · Event close: `1885.3`
- Peak SMI: `74.92` · Cross SMI/signal: `72.76` / `72.97`
- Cross RSI: `65.59` · **Event RSI: `61.23`**
- **BB upper proximity:** high `1888.5` vs `1905.0` · gap `0.8754%` · signed `-0.8754%` · match `none`
- **BB lower proximity:** low `1884.5` vs `1855.18` · gap `1.5554%` · signed `-1.5554%` · match `none`
- MACD histogram at cross: `1.8636`
- Forward drop (next ~3 bars): `0.28%`

### 11. 2026-06-29 12:00 IST (stall_at_highs)

- Cross time: `11:45` IST
- Side: `SELL`
- Cross close: `1886.4` · Event close: `1885.3`
- Peak SMI: `76.39` · Cross SMI/signal: `66.66` / `70.67`
- Cross RSI: `63.84` · **Event RSI: `61.23`**
- **BB upper proximity:** high `1888.5` vs `1905.0` · gap `0.8754%` · signed `-0.8754%` · match `none`
- **BB lower proximity:** low `1884.5` vs `1855.18` · gap `1.5554%` · signed `-1.5554%` · match `none`
- MACD histogram at cross: `1.0742`
- Forward drop (next ~3 bars): `0.28%`

### 12. 2026-07-02 12:00 IST (stall_at_highs)

- Cross time: `11:30` IST
- Side: `SELL`
- Cross close: `1876.1` · Event close: `1876.2`
- Peak SMI: `76.92` · Cross SMI/signal: `64.82` / `66.72`
- Cross RSI: `55.83` · **Event RSI: `54.78`**
- **BB upper proximity:** high `1878.0` vs `1882.21` · gap `0.2243%` · signed `-0.2243%` · match `close`
- **BB lower proximity:** low `1873.9` vs `1866.54` · gap `0.3922%` · signed `-0.3922%` · match `none`
- MACD histogram at cross: `0.6982`
- Forward drop (next ~3 bars): `0.22%`

### 13. 2026-07-03 12:15 IST (smi_exit_overbought)

- Cross time: `11:30` IST
- Side: `SELL`
- Cross close: `1909.7` · Event close: `1913.0`
- Peak SMI: `88.92` · Cross SMI/signal: `77.31` / `81.62`
- Cross RSI: `74.16` · **Event RSI: `76.85`**
- **BB upper proximity:** high `1913.8` vs `1935.95` · gap `1.1578%` · signed `-1.1578%` · match `none`
- **BB lower proximity:** low `1910.5` vs `1856.51` · gap `2.8222%` · signed `-2.8222%` · match `none`
- MACD histogram at cross: `3.127`
- Forward drop (next ~3 bars): `0.29%`

### 14. 2026-07-09 10:45 IST (smi_cross)

- Cross time: `10:45` IST
- Side: `SELL`
- Cross close: `1931.7` · Event close: `1931.7`
- Peak SMI: `80.78` · Cross SMI/signal: `71.82` / `74.27`
- Cross RSI: `69.4` · **Event RSI: `69.4`**
- **BB upper proximity:** high `1947.0` vs `1953.61` · gap `0.3421%` · signed `-0.3421%` · match `none`
- **BB lower proximity:** low `1930.5` vs `1855.16` · gap `3.9001%` · signed `-3.9001%` · match `none`
- MACD histogram at cross: `5.9539`
- Forward drop (next ~3 bars): `0.54%`

### 15. 2026-07-15 12:00 IST (stall_at_highs)

- Cross time: `11:45` IST
- Side: `SELL`
- Cross close: `1957.1` · Event close: `1956.4`
- Peak SMI: `74.19` · Cross SMI/signal: `66.88` / `68.75`
- Cross RSI: `61.17` · **Event RSI: `70.68`**
- **BB upper proximity:** high `1958.4` vs `1964.55` · gap `0.3145%` · signed `-0.3145%` · match `none`
- **BB lower proximity:** low `1955.5` vs `1937.56` · gap `0.9172%` · signed `-0.9172%` · match `none`
- MACD histogram at cross: `0.2856`
- Forward drop (next ~3 bars): `0.33%`

### 16. 2026-07-21 13:15 IST (stall_at_highs)

- Cross time: `13:00` IST
- Side: `SELL`
- Cross close: `1961.9` · Event close: `1961.9`
- Peak SMI: `81.18` · Cross SMI/signal: `72.37` / `75.68`
- Cross RSI: `79.25` · **Event RSI: `77.44`**
- **BB upper proximity:** high `1962.4` vs `1966.25` · gap `0.1963%` · signed `-0.1963%` · match `close`
- **BB lower proximity:** low `1960.1` vs `1945.68` · gap `0.735%` · signed `-0.735%` · match `none`
- MACD histogram at cross: `0.7092`
- Forward drop (next ~3 bars): `0.24%`

### 17. 2026-07-24 10:45 IST (stall_at_highs)

- Cross time: `10:00` IST
- Side: `SELL`
- Cross close: `1951.3` · Event close: `1948.5`
- Peak SMI: `70.23` · Cross SMI/signal: `53.56` / `60.52`
- Cross RSI: `68.3` · **Event RSI: `60.38`**
- **BB upper proximity:** high `1950.3` vs `1962.62` · gap `0.6323%` · signed `-0.6323%` · match `none`
- **BB lower proximity:** low `1947.2` vs `1930.14` · gap `0.8755%` · signed `-0.8755%` · match `none`
- MACD histogram at cross: `1.1162`
- Forward drop (next ~3 bars): `0.29%`

### 18. 2026-07-27 13:30 IST (stall_at_highs)

- Cross time: `13:15` IST
- Side: `SELL`
- Cross close: `1971.7` · Event close: `1971.1`
- Peak SMI: `89.1` · Cross SMI/signal: `84.02` / `84.88`
- Cross RSI: `68.6` · **Event RSI: `72.99`**
- **BB upper proximity:** high `1972.3` vs `1978.5` · gap `0.3145%` · signed `-0.3145%` · match `none`
- **BB lower proximity:** low `1968.3` vs `1934.88` · gap `1.6955%` · signed `-1.6955%` · match `none`
- MACD histogram at cross: `2.2708`
- Forward drop (next ~3 bars): `0.27%`

### 19. 2026-07-30 13:15 IST (macd_bear_cross)

- Cross time: `12:45` IST
- Side: `SELL`
- Cross close: `2012.1` · Event close: `2013.4`
- Peak SMI: `81.79` · Cross SMI/signal: `72.11` / `74.82`
- Cross RSI: `60.17` · **Event RSI: `62.19`**
- **BB upper proximity:** high `2016.0` vs `2022.51` · gap `0.3232%` · signed `-0.3232%` · match `none`
- **BB lower proximity:** low `2010.7` vs `1987.78` · gap `1.1383%` · signed `-1.1383%` · match `none`
- MACD histogram at cross: `0.6279`
- Forward drop (next ~3 bars): `0.58%`

### 20. 2026-07-30 14:00 IST (smi_cross)

- Cross time: `14:00` IST
- Side: `SELL`
- Cross close: `2001.8` · Event close: `2001.8`
- Peak SMI: `81.79` · Cross SMI/signal: `20.86` / `41.38`
- Cross RSI: `45.73` · **Event RSI: `45.73`**
- **BB upper proximity:** high `2014.9` vs `2019.3` · gap `0.2196%` · signed `-0.2196%` · match `close`
- **BB lower proximity:** low `2001.7` vs `1997.88` · gap `0.1906%` · signed `-0.1906%` · match `close`
- MACD histogram at cross: `-1.2257`
- Forward drop (next ~3 bars): `0.09%`

### 21. 2026-07-31 14:00 IST (stall_at_highs)

- Cross time: `13:30` IST
- Side: `SELL`
- Cross close: `2041.9` · Event close: `2042.3`
- Peak SMI: `87.87` · Cross SMI/signal: `84.24` / `84.58`
- Cross RSI: `79.58` · **Event RSI: `88.47`**
- **BB upper proximity:** high `2042.5` vs `2048.99` · gap `0.3176%` · signed `-0.3176%` · match `none`
- **BB lower proximity:** low `2037.1` vs `1999.07` · gap `1.862%` · signed `-1.862%` · match `none`
- MACD histogram at cross: `2.4458`
- Forward drop (next ~3 bars): `3.69%`

## Notes

- Requested 60 trade days, but Yahoo 15m history only covers 41 trade days in the last ~60 calendar days (2026-06-04 → 2026-07-31).
