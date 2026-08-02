#!/usr/bin/env python3
"""Categorize deeppro square-off profits into ranges with avg RSI and best BB proximity."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPORTS_DIR = Path(__file__).resolve().parents[1] / "reports"

# Inclusive ranges requested by user. Gaps between bands are "outside".
PROFIT_RANGES = [
    {"id": "r1", "label": "0.08 – 0.25", "min": 0.08, "max": 0.25},
    {"id": "r2", "label": "0.30 – 0.70", "min": 0.30, "max": 0.70},
    {"id": "r3", "label": "0.75 – 2.0", "min": 0.75, "max": 2.0},
]


def resolve_symbol(raw: str) -> str:
    trading = raw.strip().upper().replace(".NS", "")
    if ":" in trading:
        trading = trading.split(":")[-1]
    return trading


def classify_profit(profit: float | None) -> str | None:
    if profit is None:
        return None
    for band in PROFIT_RANGES:
        if band["min"] <= profit <= band["max"]:
            return band["label"]
    return None


def format_bb(gap: float | None, match: str | None = None) -> str:
    if gap is None:
        return "—"
    text = f"{gap:.3f}"
    if match:
        text += f" ({match})"
    return text


def load_study(symbol: str, side: str) -> dict:
    tag = symbol.lower()
    name = f"deeppro-{tag}-{'short' if side == 'SELL' else 'buy'}-squareoff-60d.json"
    path = REPORTS_DIR / name
    if not path.exists():
        script = (
            "scripts/study-deeppro-short-squareoff.py"
            if side == "SELL"
            else "scripts/study-deeppro-buy-squareoff.py"
        )
        subprocess.run(
            [sys.executable, script, "--symbol", symbol],
            check=True,
            cwd=str(REPORTS_DIR.parent),
        )
    return json.loads(path.read_text())


def summarize_range(trades: list[dict], side: str) -> dict:
    if not trades:
        return {
            "trades": 0,
            "avgRsi": None,
            "bestBbUpperPct": None,
            "bestBbUpperMatch": None,
            "bestBbLowerPct": None,
            "bestBbLowerMatch": None,
            "avgBbUpperPct": None,
            "avgBbLowerPct": None,
            "avgProfitPct": None,
            "primaryBestBbPct": None,
            "primaryBestBbSide": "upper" if side == "SELL" else "lower",
        }

    rsi_vals = [t["eventRsi"] for t in trades]
    up_gaps = [t["bbUpperProximity"]["gapPct"] for t in trades]
    lo_gaps = [t["bbLowerProximity"]["gapPct"] for t in trades]
    profits = [t["bestProfitPct"] for t in trades]

    best_up = min(trades, key=lambda t: t["bbUpperProximity"]["gapPct"])
    best_lo = min(trades, key=lambda t: t["bbLowerProximity"]["gapPct"])

    primary_best = (
        best_up["bbUpperProximity"]["gapPct"]
        if side == "SELL"
        else best_lo["bbLowerProximity"]["gapPct"]
    )

    return {
        "trades": len(trades),
        "avgRsi": round(sum(rsi_vals) / len(rsi_vals), 2),
        "bestBbUpperPct": round(best_up["bbUpperProximity"]["gapPct"], 3),
        "bestBbUpperMatch": best_up["bbUpperProximity"]["matchType"],
        "bestBbLowerPct": round(best_lo["bbLowerProximity"]["gapPct"], 3),
        "bestBbLowerMatch": best_lo["bbLowerProximity"]["matchType"],
        "avgBbUpperPct": round(sum(up_gaps) / len(up_gaps), 3),
        "avgBbLowerPct": round(sum(lo_gaps) / len(lo_gaps), 3),
        "avgProfitPct": round(sum(profits) / len(profits), 2),
        "primaryBestBbPct": round(primary_best, 3),
        "primaryBestBbSide": "upper" if side == "SELL" else "lower",
    }


def build_side_report(symbol: str, side: str, study: dict) -> dict:
    trades = []
    for trade in study.get("trades", []):
        if not trade.get("hasExitWindow"):
            continue
        profit = trade.get("bestProfitPct")
        if profit is None:
            continue
        band = classify_profit(profit)
        enriched = {
            **trade,
            "profitRange": band,
        }
        trades.append(enriched)

    buckets = []
    for band in PROFIT_RANGES:
        in_band = [t for t in trades if t["profitRange"] == band["label"]]
        stats = summarize_range(in_band, side)
        buckets.append(
            {
                "profitRange": band["label"],
                "min": band["min"],
                "max": band["max"],
                **stats,
                "members": [
                    {
                        "date": t["date"],
                        "event": t["event"],
                        "eventRsi": t["eventRsi"],
                        "bbUpperPct": t["bbUpperProximity"]["gapPct"],
                        "bbUpperMatch": t["bbUpperProximity"]["matchType"],
                        "bbLowerPct": t["bbLowerProximity"]["gapPct"],
                        "bbLowerMatch": t["bbLowerProximity"]["matchType"],
                        "profitPct": t["bestProfitPct"],
                        "entryPrice": t.get("sellPrice", t.get("buyPrice")),
                        "sqTime": t.get("bestTimeIst"),
                        "sqPrice": t.get("bestExitPrice"),
                    }
                    for t in in_band
                ],
            }
        )

    outside = [t for t in trades if t["profitRange"] is None]
    return {
        "symbol": symbol,
        "side": side,
        "window": study.get("window"),
        "totalTradable": len(trades),
        "inRanges": sum(b["trades"] for b in buckets),
        "outsideRanges": len(outside),
        "buckets": buckets,
        "outsideMembers": [
            {
                "date": t["date"],
                "event": t["event"],
                "profitPct": t["bestProfitPct"],
                "eventRsi": t["eventRsi"],
            }
            for t in outside
        ],
    }


def write_markdown(symbol: str, sell_report: dict, buy_report: dict, path: Path) -> None:
    lines = [
        f"# {symbol} deeppro profit-range categorization (60d)",
        "",
        f"- **Generated (UTC):** {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
        f"- **Ranges:** 0.08–0.25 · 0.30–0.70 · 0.75–2.0 (inclusive)",
        "- **Avg RSI:** mean event RSI of trades in that profit range",
        "- **Best BB proximity:** tightest (smallest) gap % in that range",
        "- For SELL, primary BB focus is **upper**; for BUY, primary BB focus is **lower**",
        "",
        "## SELL (short)",
        "",
        f"- Tradable signals: {sell_report['totalTradable']} · In ranges: {sell_report['inRanges']} · Outside: {sell_report['outsideRanges']}",
        "",
        "| Profit range | Trades | Avg RSI | Best BB upper % | Best BB lower % | Avg profit % |",
        "|--------------|--------|---------|-----------------|-----------------|--------------|",
    ]

    for bucket in sell_report["buckets"]:
        lines.append(
            f"| {bucket['profitRange']} | {bucket['trades']} | "
            f"{bucket['avgRsi'] if bucket['avgRsi'] is not None else '—'} | "
            f"{format_bb(bucket['bestBbUpperPct'], bucket['bestBbUpperMatch'])} | "
            f"{format_bb(bucket['bestBbLowerPct'], bucket['bestBbLowerMatch'])} | "
            f"{bucket['avgProfitPct'] if bucket['avgProfitPct'] is not None else '—'} |"
        )

    lines.extend(
        [
            "",
            "### SELL members by range",
            "",
        ]
    )
    for bucket in sell_report["buckets"]:
        lines.append(f"#### {bucket['profitRange']} ({bucket['trades']} trades)")
        lines.append("")
        if bucket["trades"] == 0:
            lines.append("_No trades in this range._")
            lines.append("")
            continue
        lines.append(
            "| Date | Event | RSI | BB upper % | BB lower % | Sell | SQ off | SQ price | Profit % |"
        )
        lines.append(
            "|------|-------|-----|------------|------------|------|--------|----------|----------|"
        )
        for m in bucket["members"]:
            lines.append(
                f"| {m['date']} | {m['event']} | {m['eventRsi']:.2f} | "
                f"{format_bb(m['bbUpperPct'], m['bbUpperMatch'])} | "
                f"{format_bb(m['bbLowerPct'], m['bbLowerMatch'])} | "
                f"{m['entryPrice']:.2f} | {m['sqTime']} | {m['sqPrice']:.2f} | {m['profitPct']:.2f}% |"
            )
        lines.append("")

    lines.extend(
        [
            "## BUY (long mirror)",
            "",
            f"- Tradable signals: {buy_report['totalTradable']} · In ranges: {buy_report['inRanges']} · Outside: {buy_report['outsideRanges']}",
            "",
            "| Profit range | Trades | Avg RSI | Best BB upper % | Best BB lower % | Avg profit % |",
            "|--------------|--------|---------|-----------------|-----------------|--------------|",
        ]
    )

    for bucket in buy_report["buckets"]:
        lines.append(
            f"| {bucket['profitRange']} | {bucket['trades']} | "
            f"{bucket['avgRsi'] if bucket['avgRsi'] is not None else '—'} | "
            f"{format_bb(bucket['bestBbUpperPct'], bucket['bestBbUpperMatch'])} | "
            f"{format_bb(bucket['bestBbLowerPct'], bucket['bestBbLowerMatch'])} | "
            f"{bucket['avgProfitPct'] if bucket['avgProfitPct'] is not None else '—'} |"
        )

    lines.extend(
        [
            "",
            "### BUY members by range",
            "",
        ]
    )
    for bucket in buy_report["buckets"]:
        lines.append(f"#### {bucket['profitRange']} ({bucket['trades']} trades)")
        lines.append("")
        if bucket["trades"] == 0:
            lines.append("_No trades in this range._")
            lines.append("")
            continue
        lines.append(
            "| Date | Event | RSI | BB upper % | BB lower % | Buy | SQ off | SQ price | Profit % |"
        )
        lines.append(
            "|------|-------|-----|------------|------------|-----|--------|----------|----------|"
        )
        for m in bucket["members"]:
            lines.append(
                f"| {m['date']} | {m['event']} | {m['eventRsi']:.2f} | "
                f"{format_bb(m['bbUpperPct'], m['bbUpperMatch'])} | "
                f"{format_bb(m['bbLowerPct'], m['bbLowerMatch'])} | "
                f"{m['entryPrice']:.2f} | {m['sqTime']} | {m['sqPrice']:.2f} | {m['profitPct']:.2f}% |"
            )
        lines.append("")

    path.write_text("\n".join(lines))


def run_symbol(symbol: str) -> dict:
    sell_study = load_study(symbol, "SELL")
    buy_study = load_study(symbol, "BUY")
    sell_report = build_side_report(symbol, "SELL", sell_study)
    buy_report = build_side_report(symbol, "BUY", buy_study)

    payload = {
        "symbol": symbol,
        "generatedAtUtc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "ranges": [
            {"label": b["label"], "min": b["min"], "max": b["max"]} for b in PROFIT_RANGES
        ],
        "definitions": {
            "avgRsi": "Average event RSI of trades whose best same-day profit % falls in the range",
            "bestBbUpperPct": "Smallest BB upper gap % among trades in the range",
            "bestBbLowerPct": "Smallest BB lower gap % among trades in the range",
            "primaryFocus": "SELL uses BB upper; BUY uses BB lower",
        },
        "sell": sell_report,
        "buy": buy_report,
    }

    tag = symbol.lower()
    json_path = REPORTS_DIR / f"deeppro-{tag}-profit-ranges-60d.json"
    md_path = REPORTS_DIR / f"deeppro-{tag}-profit-ranges-60d.md"
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(payload, indent=2))
    write_markdown(symbol, sell_report, buy_report, md_path)

    def fmt_num(value, digits=2):
        return f"{value:.{digits}f}" if value is not None else "—"

    print(f"\n=== {symbol} profit-range summary ===")
    print("\nSELL")
    print(
        f"{'Range':<14} {'N':>3} {'AvgRSI':>8} {'BestBBup':>16} {'BestBBlo':>16} {'AvgProfit':>10}"
    )
    for bucket in sell_report["buckets"]:
        print(
            f"{bucket['profitRange']:<14} {bucket['trades']:3d} "
            f"{fmt_num(bucket['avgRsi']):>8} "
            f"{format_bb(bucket['bestBbUpperPct'], bucket['bestBbUpperMatch']):>16} "
            f"{format_bb(bucket['bestBbLowerPct'], bucket['bestBbLowerMatch']):>16} "
            f"{fmt_num(bucket['avgProfitPct']):>10}"
        )
    print("\nBUY")
    print(
        f"{'Range':<14} {'N':>3} {'AvgRSI':>8} {'BestBBup':>16} {'BestBBlo':>16} {'AvgProfit':>10}"
    )
    for bucket in buy_report["buckets"]:
        print(
            f"{bucket['profitRange']:<14} {bucket['trades']:3d} "
            f"{fmt_num(bucket['avgRsi']):>8} "
            f"{format_bb(bucket['bestBbUpperPct'], bucket['bestBbUpperMatch']):>16} "
            f"{format_bb(bucket['bestBbLowerPct'], bucket['bestBbLowerMatch']):>16} "
            f"{fmt_num(bucket['avgProfitPct']):>10}"
        )
    print(f"\nWrote {md_path}")
    print(f"Wrote {json_path}")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Categorize deeppro profits into ranges")
    parser.add_argument(
        "--symbols",
        default="TCS,SUNPHARMA",
        help="Comma-separated NSE symbols (default: TCS,SUNPHARMA)",
    )
    args = parser.parse_args()
    symbols = [resolve_symbol(part) for part in args.symbols.split(",") if part.strip()]

    for symbol in symbols:
        # Refresh underlying studies first
        for script in (
            "scripts/study-deeppro-short-squareoff.py",
            "scripts/study-deeppro-buy-squareoff.py",
        ):
            subprocess.run(
                [sys.executable, script, "--symbol", symbol],
                check=True,
                cwd=str(REPORTS_DIR.parent),
            )
        run_symbol(symbol)


if __name__ == "__main__":
    main()
