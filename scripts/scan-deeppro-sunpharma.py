#!/usr/bin/env python3
"""Scan SUNPHARMA 15m candles for deeppro (Stch Mtm pink-circle) pattern over N trade days."""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

SYMBOL = "SUNPHARMA.NS"
OVERBOUGHT = 40
MIN_PEAK_SMI = 70
LOOKBACK = 8
STALL_BODY_RATIO = 0.35
BB_CLOSE_PCT = 0.3
REPORTS_DIR = Path(__file__).resolve().parents[1] / "reports"

# Yahoo Finance only serves 15m bars inside the last ~60 calendar days.
YAHOO_15M_MAX_CALENDAR_DAYS = 59


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def sma(series: pd.Series, period: int) -> pd.Series:
    return series.rolling(period).mean()


def bollinger(close: pd.Series, length: int = 20, nstd: float = 2.0):
    mid = sma(close, length)
    std = close.rolling(length).std(ddof=0)
    return mid + nstd * std, mid, mid - nstd * std


def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = (-delta).clip(lower=0)
    avg_gain = gain.rolling(period).mean()
    avg_loss = loss.rolling(period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    out = 100 - (100 / (1 + rs))
    return out.where(avg_loss != 0, 100)


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    macd_line = ema(close, fast) - ema(close, slow)
    signal_line = ema(macd_line, signal)
    return macd_line, signal_line, macd_line - signal_line


def smi_blau(high: pd.Series, low: pd.Series, close: pd.Series, k=10, d=3, e=3):
    ll = low.rolling(k).min()
    hh = high.rolling(k).max()
    diff = close - (hh + ll) / 2
    rdiff = hh - ll
    avgrel = ema(ema(diff, d), d)
    avgdiff = ema(ema(rdiff, d), d)
    smi = pd.Series(
        np.where(avgdiff != 0, 200 * avgrel / avgdiff, 0.0),
        index=close.index,
    )
    return smi, ema(smi, e)


def bb_upper_touch(row) -> bool:
    if not math.isfinite(row["bb_u"]):
        return False
    if row["High"] >= row["bb_u"]:
        return True
    return abs(row["High"] - row["bb_u"]) / abs(row["Close"]) * 100 <= BB_CLOSE_PCT


def body_ratio(row) -> float:
    rng = row["High"] - row["Low"]
    if rng <= 0:
        return 0.0
    return abs(row["Close"] - row["Open"]) / rng


def bb_upper_proximity(row) -> dict:
    gap_abs = abs(row["High"] - row["bb_u"]) / abs(row["Close"]) * 100
    signed = (row["High"] - row["bb_u"]) / abs(row["Close"]) * 100
    if row["High"] >= row["bb_u"]:
        match_type = "crossed"
        gap = signed
    elif gap_abs <= BB_CLOSE_PCT:
        match_type = "close"
        gap = gap_abs
    else:
        match_type = None
        gap = gap_abs
    return {
        "gapPct": round(float(gap), 4),
        "signedGapPct": round(float(signed), 4),
        "matchType": match_type,
        "price": round(float(row["High"]), 2),
        "bbLevel": round(float(row["bb_u"]), 2),
    }


def bb_lower_proximity(row) -> dict:
    gap_abs = abs(row["Low"] - row["bb_l"]) / abs(row["Close"]) * 100
    signed = (row["bb_l"] - row["Low"]) / abs(row["Close"]) * 100
    if row["Low"] <= row["bb_l"]:
        match_type = "crossed"
        gap = signed
    elif gap_abs <= BB_CLOSE_PCT:
        match_type = "close"
        gap = gap_abs
    else:
        match_type = None
        gap = gap_abs
    return {
        "gapPct": round(float(gap), 4),
        "signedGapPct": round(float(signed), 4),
        "matchType": match_type,
        "price": round(float(row["Low"]), 2),
        "bbLevel": round(float(row["bb_l"]), 2),
    }


def fetch_candles() -> pd.DataFrame:
    end = datetime.now()
    start = end - timedelta(days=YAHOO_15M_MAX_CALENDAR_DAYS)
    df = yf.Ticker(SYMBOL).history(
        start=start.strftime("%Y-%m-%d"),
        end=(end + timedelta(days=1)).strftime("%Y-%m-%d"),
        interval="15m",
        auto_adjust=True,
    )
    if df.empty:
        raise SystemExit("No Yahoo Finance candles returned for SUNPHARMA.NS")

    df = df.tz_convert("Asia/Kolkata").between_time("09:15", "15:15")
    df["bb_u"], df["bb_m"], df["bb_l"] = bollinger(df["Close"])
    df["rsi"] = rsi(df["Close"])
    df["macd"], df["macd_sig"], df["hist"] = macd(df["Close"])
    df["smi"], df["smi_sig"] = smi_blau(df["High"], df["Low"], df["Close"])
    return df


def scan_deeppro(df: pd.DataFrame, trade_days: list) -> list[dict]:
    day_set = set(trade_days)
    signals: list[dict] = []

    for i in range(LOOKBACK, len(df)):
        ts = df.index[i]
        if ts.normalize() not in day_set:
            continue

        prev = df.iloc[i - 1]
        cur = df.iloc[i]
        if not (prev["smi"] >= prev["smi_sig"] and cur["smi"] < cur["smi_sig"]):
            continue
        if not (cur["smi"] >= OVERBOUGHT or prev["smi"] >= OVERBOUGHT):
            continue

        window = df.iloc[i - LOOKBACK + 1 : i + 1]
        peak_smi = float(window["smi"].max())
        if peak_smi < MIN_PEAK_SMI:
            continue
        if not window.apply(bb_upper_touch, axis=1).any():
            continue
        if not (cur["hist"] < prev["hist"]):
            continue

        event_time = ts
        event_kind = "smi_cross"
        best_stall = None
        swing_high = float(window["High"].max())

        for j in range(1, 4):
            if i + j >= len(df):
                break
            later = df.iloc[i + j]
            earlier = df.iloc[i + j - 1]
            if later.name.normalize() != ts.normalize():
                break

            ratio = body_ratio(later)
            near_swing = abs(later["High"] - swing_high) / later["Close"] * 100 <= 0.5
            stall = ratio <= STALL_BODY_RATIO and (
                bb_upper_touch(later)
                or later["High"] >= later["bb_u"] * 0.998
                or near_swing
            )
            if stall and (best_stall is None or ratio <= best_stall[0]):
                best_stall = (ratio, later.name)

            if event_kind == "smi_cross":
                exit_ob = earlier["smi"] >= OVERBOUGHT and later["smi"] < OVERBOUGHT
                if exit_ob and later["smi"] < later["smi_sig"]:
                    event_time = later.name
                    event_kind = "smi_exit_overbought"
                    continue

                macd_cross = (
                    earlier["macd"] >= earlier["macd_sig"]
                    and later["macd"] < later["macd_sig"]
                )
                if macd_cross:
                    event_time = later.name
                    event_kind = "macd_bear_cross"

        if best_stall is not None:
            event_time = best_stall[1]
            event_kind = "stall_at_highs"

        t_idx = df.index.get_loc(event_time)
        event_row = df.iloc[t_idx]
        fwd = df.iloc[t_idx : t_idx + 4]
        drop_pct = (
            (fwd.iloc[0]["Close"] - fwd["Low"].min()) / fwd.iloc[0]["Close"] * 100
        )

        signals.append(
            {
                "date": ts.strftime("%Y-%m-%d"),
                "crossTimeIst": ts.strftime("%H:%M"),
                "eventTimeIst": event_time.strftime("%H:%M"),
                "eventKind": event_kind,
                "side": "SELL",
                "rule": "deeppro",
                "close": round(float(cur["Close"]), 2),
                "eventClose": round(float(event_row["Close"]), 2),
                "peakSmi": round(peak_smi, 2),
                "smi": round(float(cur["smi"]), 2),
                "smiSignal": round(float(cur["smi_sig"]), 2),
                "rsi": round(float(cur["rsi"]), 2),
                "eventRsi": round(float(event_row["rsi"]), 2),
                "bbUpperProximity": bb_upper_proximity(event_row),
                "bbLowerProximity": bb_lower_proximity(event_row),
                "macdHistogram": round(float(cur["hist"]), 4),
                "forwardDropPct": round(float(drop_pct), 2),
                "chartMatch": ts.strftime("%Y-%m-%d") == "2026-07-31",
            }
        )

    return signals


def write_markdown_report(payload: dict, path: Path) -> None:
    matches = payload["matches"]
    days = payload["tradeDaysScanned"]
    lines = [
        "# SUNPHARMA deeppro Scan Report",
        "",
        f"- **Symbol:** {payload['symbol']}",
        f"- **Interval:** {payload['interval']}",
        f"- **Rule:** {payload['rule']}",
        f"- **Generated (UTC):** {payload['generatedAtUtc']}",
        f"- **Trade days scanned:** {payload['tradeDayCount']} ({days[0]} → {days[-1]})",
        f"- **Requested trade days:** {payload['requestedTradeDays']}",
        f"- **Data source:** {payload['dataRange']['source']}",
        f"- **Candle range:** {payload['dataRange']['from']} → {payload['dataRange']['to']}",
        f"- **Matches:** {payload['matchCount']}",
        "",
        "## Rule definition",
        "",
        f"- SMI: `{payload['definition']['smi']}`",
        f"- Overbought level: `{payload['definition']['overboughtLevel']}`",
        f"- Min peak SMI: `{payload['definition']['minPeakSmi']}`",
        f"- Lookback bars: `{payload['definition']['lookbackBars']}`",
        "",
        "Requires:",
        "",
    ]
    for req in payload["definition"]["requires"]:
        lines.append(f"- {req}")

    chart = payload["chartPinkCircle"]
    lines.extend(
        [
            "",
            "## Chart pink-circle reference",
            "",
            f"- **Date:** {chart['date']}",
            f"- **Annotated time:** {chart['annotatedTimeIst']} IST",
            f"- {chart['description']}",
            "",
            "## Matches",
            "",
            "| Date | Cross | Event | Kind | Event RSI | BB upper % | Upper match | BB lower % | Lower match | Peak SMI | Fwd drop % |",
            "|------|-------|-------|------|-----------|------------|-------------|------------|-------------|----------|------------|",
        ]
    )

    if not matches:
        lines.append("| — | — | — | — | — | — | — | — | — | — | — |")
    else:
        for row in matches:
            up = row["bbUpperProximity"]
            lo = row["bbLowerProximity"]
            mark = " **(chart pink)**" if row.get("chartMatch") else ""
            lines.append(
                f"| {row['date']}{mark} | {row['crossTimeIst']} | {row['eventTimeIst']} | "
                f"{row['eventKind']} | {row['eventRsi']:.2f} | {up['gapPct']:.3f} | "
                f"{up['matchType'] or '-'} | {lo['gapPct']:.3f} | {lo['matchType'] or '-'} | "
                f"{row['peakSmi']:.1f} | {row['forwardDropPct']:.2f} |"
            )

    lines.extend(
        [
            "",
            "## Match detail",
            "",
        ]
    )
    for idx, row in enumerate(matches, start=1):
        up = row["bbUpperProximity"]
        lo = row["bbLowerProximity"]
        lines.extend(
            [
                f"### {idx}. {row['date']} {row['eventTimeIst']} IST ({row['eventKind']})",
                "",
                f"- Cross time: `{row['crossTimeIst']}` IST",
                f"- Side: `{row['side']}`",
                f"- Cross close: `{row['close']}` · Event close: `{row['eventClose']}`",
                f"- Peak SMI: `{row['peakSmi']}` · Cross SMI/signal: `{row['smi']}` / `{row['smiSignal']}`",
                f"- Cross RSI: `{row['rsi']}` · **Event RSI: `{row['eventRsi']}`**",
                (
                    f"- **BB upper proximity:** high `{up['price']}` vs `{up['bbLevel']}` · "
                    f"gap `{up['gapPct']}%` · signed `{up['signedGapPct']}%` · "
                    f"match `{up['matchType'] or 'none'}`"
                ),
                (
                    f"- **BB lower proximity:** low `{lo['price']}` vs `{lo['bbLevel']}` · "
                    f"gap `{lo['gapPct']}%` · signed `{lo['signedGapPct']}%` · "
                    f"match `{lo['matchType'] or 'none'}`"
                ),
                f"- MACD histogram at cross: `{row['macdHistogram']}`",
                f"- Forward drop (next ~3 bars): `{row['forwardDropPct']}%`",
                "",
            ]
        )

    if payload.get("notes"):
        lines.extend(["## Notes", ""])
        for note in payload["notes"]:
            lines.append(f"- {note}")
        lines.append("")

    path.write_text("\n".join(lines))


def main() -> None:
    parser = argparse.ArgumentParser(description="Scan SUNPHARMA for deeppro pattern")
    parser.add_argument(
        "--trade-days",
        type=int,
        default=60,
        help="Number of most recent trade days to scan (default: 60)",
    )
    parser.add_argument(
        "--tag",
        type=str,
        default=None,
        help="Optional filename tag (default: <trade-days>d)",
    )
    args = parser.parse_args()

    requested = max(1, args.trade_days)
    tag = args.tag or f"{requested}d"
    json_path = REPORTS_DIR / f"deeppro-sunpharma-{tag}.json"
    md_path = REPORTS_DIR / f"deeppro-sunpharma-{tag}.md"

    df = fetch_candles()
    all_days = sorted(df.index.normalize().unique())
    trade_days = all_days[-requested:]
    notes = []
    if len(all_days) < requested:
        notes.append(
            f"Requested {requested} trade days, but Yahoo 15m history only covers "
            f"{len(all_days)} trade days in the last ~60 calendar days "
            f"({all_days[0].date().isoformat()} → {all_days[-1].date().isoformat()})."
        )

    signals = scan_deeppro(df, trade_days)
    payload = {
        "symbol": "SUNPHARMA",
        "interval": "15m",
        "rule": "deeppro",
        "generatedAtUtc": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "requestedTradeDays": requested,
        "tradeDaysScanned": [d.date().isoformat() for d in trade_days],
        "tradeDayCount": len(trade_days),
        "dataRange": {
            "from": df.index.min().isoformat(),
            "to": df.index.max().isoformat(),
            "source": "Yahoo Finance (SUNPHARMA.NS)",
            "yahoo15mCalendarLimitDays": YAHOO_15M_MAX_CALENDAR_DAYS,
        },
        "definition": {
            "smi": "Stch Mtm(10,3,3) William Blau SMI",
            "overboughtLevel": OVERBOUGHT,
            "minPeakSmi": MIN_PEAK_SMI,
            "lookbackBars": LOOKBACK,
            "requires": [
                "SMI bearish cross from overbought",
                "Peak SMI >= 70 in lookback",
                "Upper Bollinger Band tagged in lookback",
                "MACD histogram declining on cross candle",
            ],
        },
        "chartPinkCircle": {
            "date": "2026-07-31",
            "annotatedTimeIst": "14:00",
            "description": (
                "Pink-circle Stch Mtm exhaustion: SMI bearish cross from deep "
                "overbought at 13:30, stall/doji at highs at 14:00, then dump with "
                "SMI exiting overbought and MACD bearish cross at 14:15."
            ),
        },
        "matches": signals,
        "matchCount": len(signals),
        "notes": notes,
        "artifacts": {
            "json": str(json_path.relative_to(REPORTS_DIR.parent)),
            "markdown": str(md_path.relative_to(REPORTS_DIR.parent)),
        },
    }

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(payload, indent=2))
    write_markdown_report(payload, md_path)

    print(f"SUNPHARMA deeppro scan — requested {requested} trade days\n")
    if notes:
        for note in notes:
            print(f"NOTE: {note}\n")
    print(f"Scanned {len(trade_days)} trade days: {trade_days[0].date()} → {trade_days[-1].date()}")
    print("Pink-circle reference: 2026-07-31 around 14:00 IST\n")
    print(
        f"{'Date':<12} {'Event':<7} {'RSI':>7} {'BBup%':>8} {'BBlo%':>8} "
        f"{'UpMatch':<8} {'LoMatch':<8} {'Drop%':>7}"
    )
    print("-" * 84)
    for row in signals:
        mark = "  <-- chart pink" if row["chartMatch"] else ""
        up = row["bbUpperProximity"]
        lo = row["bbLowerProximity"]
        print(
            f"{row['date']:<12} {row['eventTimeIst']:<7} {row['eventRsi']:7.2f} "
            f"{up['gapPct']:8.3f} {lo['gapPct']:8.3f} "
            f"{str(up['matchType'] or '-'):<8} {str(lo['matchType'] or '-'):<8} "
            f"{row['forwardDropPct']:7.2f}{mark}"
        )
    print(f"\nMatches: {len(signals)}")
    print(f"Wrote {json_path}")
    print(f"Wrote {md_path}")


if __name__ == "__main__":
    main()
