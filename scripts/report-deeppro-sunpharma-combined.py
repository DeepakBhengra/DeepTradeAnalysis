#!/usr/bin/env python3
"""SUNPHARMA deeppro BUY+SELL square-off report in study table format."""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPORTS_DIR = Path(__file__).resolve().parents[1] / "reports"
MIN_PROFIT_PCT = 0.8  # inclusive — "0.8%+" band used in deeppro studies
MAX_TRADES = 60
SYMBOL = "SUNPHARMA"


def run_study(script: str) -> dict:
    cmd = [sys.executable, str(Path(__file__).resolve().parents[0] / script), "--symbol", SYMBOL]
    print("Running:", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, cwd=str(Path(__file__).resolve().parents[1]))
    if "short" in script:
        path = REPORTS_DIR / f"deeppro-{SYMBOL.lower()}-short-squareoff-60d.json"
    else:
        path = REPORTS_DIR / f"deeppro-{SYMBOL.lower()}-buy-squareoff-60d.json"
    return json.loads(path.read_text())


def format_bb(proximity: dict) -> str:
    text = f"{proximity['gapPct']:.3f}"
    if proximity.get("matchType"):
        text += f" ({proximity['matchType']})"
    return text


def normalize(row: dict, side: str) -> dict:
    entry = row["sellPrice"] if side == "SELL" else row["buyPrice"]
    return {
        **row,
        "side": side,
        "entryPrice": entry,
    }


def trade_row(row: dict, include_side: bool = False) -> str:
    bb_u = format_bb(row["bbUpperProximity"])
    bb_l = format_bb(row["bbLowerProximity"])
    side_cell = f"| {row['side']} " if include_side else ""
    if not row.get("hasExitWindow"):
        return (
            f"| {row['date']} {side_cell}| {row['event']} | {row['eventRsi']:.2f} | "
            f"{bb_u} | {bb_l} | {row['entryPrice']:.2f} | --- | --- | no exit window |"
        )
    return (
        f"| {row['date']} {side_cell}| {row['event']} | {row['eventRsi']:.2f} | "
        f"{bb_u} | {bb_l} | {row['entryPrice']:.2f} | {row['bestTimeIst']} | "
        f"{row['bestExitPrice']:.2f} | {row['bestProfitPct']:.2f}% |"
    )


def main() -> None:
    short_payload = run_study("study-deeppro-short-squareoff.py")
    buy_payload = run_study("study-deeppro-buy-squareoff.py")

    all_trades = sorted(
        [normalize(r, "SELL") for r in short_payload.get("trades", [])]
        + [normalize(r, "BUY") for r in buy_payload.get("trades", [])],
        key=lambda r: (r["dateKey"], r["event"]),
    )
    # Last 60 trades in the study window (Yahoo 15m ≈ 60 calendar / ~41 trade days).
    recent = all_trades[-MAX_TRADES:]
    filtered = [
        r
        for r in recent
        if r.get("hasExitWindow") and (r.get("bestProfitPct") or float("-inf")) >= MIN_PROFIT_PCT
    ]

    window = short_payload["window"]
    out_md = REPORTS_DIR / f"deeppro-{SYMBOL.lower()}-buy-sell-60d.md"
    out_json = REPORTS_DIR / f"deeppro-{SYMBOL.lower()}-buy-sell-60d.json"
    out_filter_md = REPORTS_DIR / f"deeppro-{SYMBOL.lower()}-buy-sell-gte{MIN_PROFIT_PCT:g}-60d.md"
    out_filter_json = REPORTS_DIR / f"deeppro-{SYMBOL.lower()}-buy-sell-gte{MIN_PROFIT_PCT:g}-60d.json"
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    def write_report(path_md: Path, path_json: Path, trades: list[dict], title_suffix: str) -> None:
        sell_n = sum(1 for r in trades if r["side"] == "SELL")
        buy_n = sum(1 for r in trades if r["side"] == "BUY")
        profits = [r["bestProfitPct"] for r in trades if r.get("hasExitWindow")]
        payload = {
            "symbol": SYMBOL,
            "rule": "deeppro",
            "titleSuffix": title_suffix,
            "generatedAtUtc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "window": window,
            "summary": {
                "trades": len(trades),
                "sellCount": sell_n,
                "buyCount": buy_n,
                "avgBestProfitPct": round(sum(profits) / len(profits), 2) if profits else None,
                "maxBestProfitPct": max(profits) if profits else None,
            },
            "trades": trades,
        }
        path_json.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

        md = [
            f"# {SYMBOL} deeppro BUY + SELL {title_suffix}",
            "",
            f"- **Symbol:** {SYMBOL}",
            f"- **Rule:** deeppro (Stch Mtm exhaustion) — SELL overbought + BUY oversold mirror",
            f"- **Entry price:** event candle mid `(high + low) / 2`",
            f"- **Square-off:** best later same-day candle mid before `15:15` IST",
            f"- **SELL profit %:** `(sell - sq) / sell * 100`",
            f"- **BUY profit %:** `(sq - buy) / buy * 100`",
            f"- **Window:** {window['tradeDays']} trade days ({window['from']} → {window['to']})",
            f"- **Trades in report:** {len(trades)} ({sell_n} SELL · {buy_n} BUY)",
            f"- **Data:** Yahoo Finance 15m interim",
            "",
            "## Trades",
            "",
            "| Date | Side | Event | RSI | BB upper % | BB lower % | Entry | Best SQ off | SQ price | Profit % |",
            "|------|------|-------|-----|------------|------------|-------|-------------|----------|----------|",
        ]
        if trades:
            md.extend(trade_row(r, include_side=True) for r in trades)
        else:
            md.append("| — | — | — | — | — | — | — | — | — | *no trades* |")

        md.extend(
            [
                "",
                "## SELL only",
                "",
                "| Date | Event | RSI | BB upper % | BB lower % | Sell price | Best SQ off | SQ price | Profit % |",
                "|------|-------|-----|------------|------------|------------|-------------|----------|----------|",
            ]
        )
        sells = [r for r in trades if r["side"] == "SELL"]
        if sells:
            md.extend(trade_row(r, include_side=False) for r in sells)
        else:
            md.append("| — | — | — | — | — | — | — | — | *none* |")

        md.extend(
            [
                "",
                "## BUY only",
                "",
                "| Date | Event | RSI | BB upper % | BB lower % | Buy price | Best SQ off | SQ price | Profit % |",
                "|------|-------|-----|------------|------------|-----------|-------------|----------|----------|",
            ]
        )
        buys = [r for r in trades if r["side"] == "BUY"]
        if buys:
            md.extend(trade_row(r, include_side=False) for r in buys)
        else:
            md.append("| — | — | — | — | — | — | — | — | *none* |")

        md.extend(["", "## Notes", "", "- Same-day square-off only; no overnight holds.", ""])
        path_md.write_text("\n".join(md), encoding="utf-8")
        print(f"Wrote {path_md} ({len(trades)} trades)")

    write_report(out_md, out_json, recent, "square-off study (last 60 trades / ~60d window)")
    write_report(
        out_filter_md,
        out_filter_json,
        filtered,
        f"square-off study (profit ≥ {MIN_PROFIT_PCT}%)",
    )


if __name__ == "__main__":
    main()
