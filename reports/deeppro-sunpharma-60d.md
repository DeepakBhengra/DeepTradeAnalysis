# SUNPHARMA deeppro Scan Report

- **Symbol:** SUNPHARMA
- **Interval:** 15m
- **Rule:** deeppro
- **Data source required:** Kite Connect historical (`NSE:SUNPHARMA`, `15minute`)

## Status

This report could **not** be regenerated from Kite in this environment.

`KITE_API_KEY` / `KITE_API_SECRET` are available, but `KITE_ACCESS_TOKEN` is missing or invalid
(`Kite access_token expired or invalid`).

Previous Yahoo Finance output was incorrect for this project — historical candles must come from Kite.

## How to generate

1. Connect Kite (dashboard **Connect Kite**, or set a valid daily `KITE_ACCESS_TOKEN` in `.env`).
2. Run:

```bash
npm run scan:deeppro:sunpharma:60d
# or
npx tsx scripts/scan-deeppro.ts --symbol SUNPHARMA --trade-days 60
```

Artifacts written:

- `reports/deeppro-sunpharma-60d.json`
- `reports/deeppro-sunpharma-60d.md`
