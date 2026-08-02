#!/usr/bin/env python3
"""Combined SUNPHARMA deeppro BUY+SELL report filtered to profit > 0.8%."""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPORTS_DIR = Path(__file__).resolve().parents[1] / "reports"
MIN_PROFIT_PCT = 0.8
MAX_TRADES = 60
SYMBOL = "SUNPHARMA"


def run_study(script: str) -> Path:
    cmd = [sys.executable, str(Path(__file__).resolve().parents[0] / script), "--symbol", SYMBOL]
    print("Running:", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, cwd=str(Path(__file__).resolve().parents[1]))
    # Scripts write reports/deeppro-{symbol}-{study}-60d.json with fixed naming.
    if "short" in script:
        return REPORTS_DIR / f"deeppro-{SYMBOL.lower()}-short-squareoff-60d.json"
    return REPORTS_DIR / f"deeppro-{SYMBOL.lower()}-buy-squareoff-60d.json"


def format_bb(proximity: dict) -> str:
    text = f"{proximity['gapPct']:.3f}"
    if proximity.get("matchType"):
        text += f" ({proximity['matchType']})"
    return text


def trade_row_md(row: dict, price_label: str) -> str:
    if not row.get("hasExitWindow"):
        return (
            f"| {row['date']} | {row['event']} | {row['eventRsi']:.2f} | "
            f"{format_bb(row['bbUpperProximity'])} | {format_bb(row['bbLowerProximity'])} | "
            f"{row[price_label]:.2f} | --- | --- | no exit window |"
        )
    return (
        f"| {row['date']} | {row['event']} | {row['eventRsi']:.2f} | "
        f"{format_bb(row['bbUpperProximity'])} | {format_bb(row['bbLowerProximity'])} | "
        f"{row[price_label]:.2f} | {row['bestTimeIst']} | {row['bestExitPrice']:.2f} | "
        f"{row['bestProfitPct']:.2f}% |"
    )


def main() -> None:
    short_json = run_study("study-deeppro-short-squareoff.py")
    buy_json = run_study("study-deeppro-buy-squareoff.py")

    short_payload = json.loads(short_json.read_text())
    buy_payload = json.loads(buy_json.read_text())

    short_trades = []
    for row in short_payload.get("trades", []):
        if row.get("hasExitWindow") and (row.get("bestProfitPct") or 0) > MIN_PROFIT_PCT:
            short_trades.append({**row, "side": "SELL", "entryPrice": row["sellPrice"]})

    buy_trades = []
    for row in buy_payload.get("trades", []):
        if row.get("hasExitWindow") and (row.get("bestProfitPct") or 0) > MIN_PROFIT_PCT:
            buy_trades.append({**row, "side": "BUY", "entryPrice": row["buyPrice"]})

    combined = sorted(
        short_trades + buy_trades,
        key=lambda r: (r["dateKey"], r["event"]),
    )
    # Last 60 qualifying trades (most recent first, then restore chrono for the table).
    selected = combined[-MAX_TRADES:]

    window_from = short_payload["window"]["from"]
    window_to = short_payload["window"]["to"]
    trade_days = short_payload["window"]["tradeDays"]

    out_json = REPORTS_DIR / f"deeppro-{SYMBOL.lower()}-buy-sell-gt{MIN_PROFIT_PCT:g}-60d.json"
    out_md = REPORTS_DIR / f"deeppro-{SYMBOL.lower()}-buy-sell-gt{MIN_PROFIT_PCT:g}-60d.md"
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    payload = {
        "symbol": SYMBOL,
        "rule": "deeppro",
        "filter": f"best same-day square-off profit % > {MIN_PROFIT_PCT}",
        "maxTrades": MAX_TRADES,
        "generatedAtUtc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "window": {
            "tradeDays": trade_days,
            "from": window_from,
            "to": window_to,
        },
        "summary": {
            "sellSignalsGtFilter": len(short_trades),
            "buySignalsGtFilter": len(buy_trades),
            "combinedSignalsGtFilter": len(combined),
            "reportedTrades": len(selected),
            "sourceSellSignals": short_payload["summary"]["signals"],
            "sourceBuySignals": buy_payload["summary"]["signals"],
        },
        "trades": selected,
    }
    out_json.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    sell_rows = [r for r in selected if r["side"] == "SELL"]
    buy_rows = [r for r in selected if r["side"] == "BUY"]

    md: list[str] = [
        f"# {SYMBOL} deeppro BUY + SELL report (profit > {MIN_PROFIT_PCT}%)",
        "",
        f"- **Symbol:** {SYMBOL}",
        f"- **Rule:** deeppro (Stch Mtm exhaustion) — BUY mirror + SELL short",
        f"- **Filter:** best same-day square-off profit **> {MIN_PROFIT_PCT}%**",
        f"- **Entry price:** event candle mid `(high + low) / 2`",
        f"- **Square-off:** best later same-day candle mid before `15:15` IST",
        f"- **Window:** {trade_days} trade days ({window_from} → {window_to})",
        f"- **Source signals:** {short_payload['summary']['signals']} SELL · {buy_payload['summary']['signals']} BUY",
        f"- **Passing filter:** {len(short_trades)} SELL · {len(buy_trades)} BUY · {len(combined)} combined",
        f"- **Reported (last {MAX_TRADES}):** {len(selected)}",
        f"- **Data:** Yahoo Finance 15m interim (re-run with Kite when available for exact fills)",
        "",
        "## SELL trades (short)",
        "",
        "| Date | Event | RSI | BB upper % | BB lower % | Sell price | Best SQ off | SQ price | Profit % |",
        "|------|-------|-----|------------|------------|------------|-------------|----------|----------|",
    ]
    if sell_rows:
        md.extend(trade_row_md(r, "sellPrice") for r in sell_rows)
    else:
        md.append("| — | — | — | — | — | — | — | — | *no SELL trades above filter* |")

    md.extend(
        [
            "",
            "## BUY trades (long)",
            "",
            "| Date | Event | RSI | BB upper % | BB lower % | Buy price | Best SQ off | SQ price | Profit % |",
            "|------|-------|-----|------------|------------|-----------|-------------|----------|----------|",
        ]
    )
    if buy_rows:
        md.extend(trade_row_md(r, "buyPrice") for r in buy_rows)
    else:
        md.append("| — | — | — | — | — | — | — | — | *no BUY trades above filter* |")

    md.extend(
        [
            "",
            "## Combined (chronological)",
            "",
            "| Date | Side | Event | RSI | BB upper % | BB lower % | Entry | Best SQ off | SQ price | Profit % |",
            "|------|------|-------|-----|------------|------------|-------|-------------|----------|----------|",
        ]
    )
    if selected:
        for row in selected:
            entry = row["sellPrice"] if row["side"] == "SELL" else row["buyPrice"]
            md.append(
                f"| {row['date']} | {row['side']} | {row['event']} | {row['eventRsi']:.2f} | "
                f"{format_bb(row['bbUpperProximity'])} | {format_bb(row['bbLowerProximity'])} | "
                f"{entry:.2f} | {row['bestTimeIst']} | {row['bestExitPrice']:.2f} | "
                f"{row['bestProfitPct']:.2f}% |"
            )
    else:
        md.append(
            "| — | — | — | — | — | — | — | — | — | "
            f"*No deeppro trades with profit > {MIN_PROFIT_PCT}% in this window* |"
        )

    md.extend(
        [
            "",
            "## Notes",
            "",
            "- SELL profit % = `(sellPrice - sqPrice) / sellPrice * 100`",
            "- BUY profit % = `(sqPrice - buyPrice) / buyPrice * 100`",
            "- Same-day square-off only; no overnight holds.",
            f"- Filter is strict **> {MIN_PROFIT_PCT}%** on best mid square-off.",
            "",
        ]
    )
    out_md.write_text("\n".join(md), encoding="utf-8")
    print(f"Wrote {out_md}")
    print(f"Wrote {out_json}")
    print(
        f"SELL>{MIN_PROFIT_PCT}: {len(short_trades)} · "
        f"BUY>{MIN_PROFIT_PCT}: {len(buy_trades)} · reported: {len(selected)}"
    )


if __name__ == "__main__":
    main()
