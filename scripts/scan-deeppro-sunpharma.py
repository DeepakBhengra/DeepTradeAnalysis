#!/usr/bin/env python3
"""Scan SUNPHARMA 15m candles for deeppro (Stch Mtm pink-circle) pattern over N trade days."""

from __future__ import annotations

import json
import math
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

SYMBOL = "SUNPHARMA.NS"
TRADE_DAYS = 20
OVERBOUGHT = 40
MIN_PEAK_SMI = 70
LOOKBACK = 8
STALL_BODY_RATIO = 0.35
BB_CLOSE_PCT = 0.3
OUT_PATH = Path(__file__).resolve().parents[1] / "reports" / "deeppro-sunpharma-20d.json"


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


def main() -> None:
    end = datetime.now()
    start = end - timedelta(days=55)
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

    trade_days = sorted(df.index.normalize().unique())[-TRADE_DAYS:]
    day_set = set(trade_days)

    signals = []
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
        best_stall = None  # (body_ratio, timestamp)
        swing_high = float(window["High"].max())

        for j in range(1, 4):
            if i + j >= len(df):
                break
            later = df.iloc[i + j]
            earlier = df.iloc[i + j - 1]
            if later.name.normalize() != ts.normalize():
                break

            ratio = body_ratio(later)
            near_swing = (
                abs(later["High"] - swing_high) / later["Close"] * 100 <= 0.5
            )
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

        # Prefer the most doji-like stall near highs (matches chart pink annotation).
        if best_stall is not None:
            event_time = best_stall[1]
            event_kind = "stall_at_highs"

        t_idx = df.index.get_loc(event_time)
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
                "peakSmi": round(peak_smi, 2),
                "smi": round(float(cur["smi"]), 2),
                "smiSignal": round(float(cur["smi_sig"]), 2),
                "rsi": round(float(cur["rsi"]), 2),
                "macdHistogram": round(float(cur["hist"]), 4),
                "forwardDropPct": round(float(drop_pct), 2),
                "chartMatch": ts.strftime("%Y-%m-%d") == "2026-07-31",
            }
        )

    # Highlight chart-circled annotation timing (14:00 stall on 31 Jul)
    chart_pattern = {
        "date": "2026-07-31",
        "annotatedTimeIst": "14:00",
        "description": (
            "Pink-circle Stch Mtm exhaustion: SMI bearish cross from deep "
            "overbought at 13:30, stall/doji at highs at 14:00, then dump with "
            "SMI exiting overbought and MACD bearish cross at 14:15."
        ),
    }

    payload = {
        "symbol": "SUNPHARMA",
        "interval": "15m",
        "rule": "deeppro",
        "tradeDaysScanned": [d.date().isoformat() for d in trade_days],
        "tradeDayCount": len(trade_days),
        "dataRange": {
            "from": df.index.min().isoformat(),
            "to": df.index.max().isoformat(),
            "source": "Yahoo Finance (SUNPHARMA.NS)",
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
        "chartPinkCircle": chart_pattern,
        "matches": signals,
        "matchCount": len(signals),
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, indent=2))

    print(f"SUNPHARMA deeppro scan — last {len(trade_days)} trade days\n")
    print("Pink-circle reference (from chart): 2026-07-31 around 14:00 IST")
    print("  SMI cross 13:30 → stall 14:00 → dump/MACD×/SMI exit OB 14:15\n")
    print(f"{'Date':<12} {'Cross':<7} {'Event':<7} {'Kind':<22} {'PeakSMI':>8} {'Drop%':>7}")
    print("-" * 72)
    for row in signals:
        mark = "  <-- chart pink" if row["chartMatch"] else ""
        print(
            f"{row['date']:<12} {row['crossTimeIst']:<7} {row['eventTimeIst']:<7} "
            f"{row['eventKind']:<22} {row['peakSmi']:8.1f} {row['forwardDropPct']:7.2f}{mark}"
        )
    print(f"\nMatches: {len(signals)}")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
