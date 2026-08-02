#!/usr/bin/env python3
"""Study long BUY entries at deeppro mirror events and best same-day square-off."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

OVERSOLD = -40
MAX_TROUGH_SMI = -70
LOOKBACK = 8
STALL_BODY_RATIO = 0.35
BB_CLOSE_PCT = 0.3
SESSION_END = "15:15"
# Drop late / weak-momentum setups that land in the 0.08–0.25% band.
ENTRY_DEADLINE = "14:00"  # exclusive — event must be before this IST time
MIN_MACD_HIST_DELTA_PCT = 0.01  # |Δhist| / close * 100
REPORTS_DIR = Path(__file__).resolve().parents[1] / "reports"


def resolve_symbol(raw: str) -> tuple[str, str]:
    trading = raw.strip().upper().replace(".NS", "")
    if ":" in trading:
        trading = trading.split(":")[-1]
    return f"{trading}.NS", trading


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


def smi_blau(high, low, close, k=10, d=3, e=3):
    ll = low.rolling(k).min()
    hh = high.rolling(k).max()
    diff = close - (hh + ll) / 2
    rdiff = hh - ll
    avgrel = ema(ema(diff, d), d)
    avgdiff = ema(ema(rdiff, d), d)
    smi = pd.Series(np.where(avgdiff != 0, 200 * avgrel / avgdiff, 0.0), index=close.index)
    return smi, ema(smi, e)


def body_ratio(row) -> float:
    rng = row["High"] - row["Low"]
    if rng <= 0:
        return 0.0
    return abs(row["Close"] - row["Open"]) / rng


def bb_lower_touch(row) -> bool:
    if not np.isfinite(row["bb_l"]):
        return False
    if row["Low"] <= row["bb_l"]:
        return True
    return abs(row["Low"] - row["bb_l"]) / abs(row["Close"]) * 100 <= BB_CLOSE_PCT


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


def format_bb_pct(proximity: dict) -> str:
    text = f"{proximity['gapPct']:.3f}"
    if proximity["matchType"]:
        text += f" ({proximity['matchType']})"
    return text


def mid_price(row) -> float:
    return (row["High"] + row["Low"]) / 2.0


def long_profit_pct(entry: float, exit_price: float) -> float:
    return (exit_price - entry) / entry * 100.0


def fetch_df(yahoo_symbol: str) -> pd.DataFrame:
    end = datetime.now()
    start = end - timedelta(days=59)
    df = yf.Ticker(yahoo_symbol).history(
        start=start.strftime("%Y-%m-%d"),
        end=(end + timedelta(days=1)).strftime("%Y-%m-%d"),
        interval="15m",
        auto_adjust=True,
    )
    if df.empty:
        raise SystemExit(f"No candles returned for {yahoo_symbol}")
    df = df.tz_convert("Asia/Kolkata").between_time("09:15", SESSION_END)
    df["bb_u"], df["bb_m"], df["bb_l"] = bollinger(df["Close"])
    df["rsi"] = rsi(df["Close"])
    df["macd"], df["macd_sig"], df["macd_hist"] = macd(df["Close"])
    df["smi"], df["smi_sig"] = smi_blau(df["High"], df["Low"], df["Close"])
    return df


def find_deeppro_buy_events(df: pd.DataFrame):
    days = sorted(df.index.normalize().unique())
    day_set = set(days)
    events = []

    for i in range(LOOKBACK, len(df)):
        ts = df.index[i]
        if ts.normalize() not in day_set:
            continue
        prev = df.iloc[i - 1]
        cur = df.iloc[i]
        # Bullish SMI cross from oversold
        if not (prev["smi"] <= prev["smi_sig"] and cur["smi"] > cur["smi_sig"]):
            continue
        if not (cur["smi"] <= OVERSOLD or prev["smi"] <= OVERSOLD):
            continue
        window = df.iloc[i - LOOKBACK + 1 : i + 1]
        trough_smi = float(window["smi"].min())
        if trough_smi > MAX_TROUGH_SMI:
            continue
        if not window.apply(bb_lower_touch, axis=1).any():
            continue
        if not (cur["macd_hist"] > prev["macd_hist"]):
            continue
        hist_delta_pct = abs(cur["macd_hist"] - prev["macd_hist"]) / abs(cur["Close"]) * 100
        if hist_delta_pct < MIN_MACD_HIST_DELTA_PCT:
            continue

        event_time = ts
        event_kind = "smi_cross"
        best_stall = None
        swing_low = float(window["Low"].min())

        for j in range(1, 4):
            if i + j >= len(df):
                break
            later = df.iloc[i + j]
            earlier = df.iloc[i + j - 1]
            if later.name.normalize() != ts.normalize():
                break
            ratio = body_ratio(later)
            near_swing = abs(later["Low"] - swing_low) / later["Close"] * 100 <= 0.5
            stall = ratio <= STALL_BODY_RATIO and (
                bb_lower_touch(later)
                or later["Low"] <= later["bb_l"] * 1.002
                or near_swing
            )
            if stall and (best_stall is None or ratio <= best_stall[0]):
                best_stall = (ratio, later.name)
            if event_kind == "smi_cross":
                exit_os = earlier["smi"] <= OVERSOLD and later["smi"] > OVERSOLD
                if exit_os and later["smi"] > later["smi_sig"]:
                    event_time = later.name
                    event_kind = "smi_exit_oversold"
                    continue
                macd_cross = (
                    earlier["macd"] <= earlier["macd_sig"]
                    and later["macd"] > later["macd_sig"]
                )
                if macd_cross:
                    event_time = later.name
                    event_kind = "macd_bull_cross"

        if best_stall is not None:
            event_time = best_stall[1]
            event_kind = "stall_at_lows"

        event_hm = event_time.strftime("%H:%M")
        if event_hm >= ENTRY_DEADLINE:
            continue

        events.append(
            {
                "cross_ts": ts,
                "event_ts": event_time,
                "event_kind": event_kind,
                "trough_smi": trough_smi,
                "hist_delta_pct": round(float(hist_delta_pct), 5),
            }
        )

    seen = set()
    unique = []
    for event in events:
        key = event["event_ts"]
        if key in seen:
            continue
        seen.add(key)
        unique.append(event)
    return unique, days


def best_square_off(df: pd.DataFrame, event_ts: pd.Timestamp, buy_price: float) -> dict:
    """Find best same-day cover (sell) after the BUY event candle."""
    day = event_ts.normalize()
    after = df[(df.index > event_ts) & (df.index.normalize() == day)]
    if after.empty:
        return {
            "hasExitWindow": False,
            "bestTimeIst": None,
            "bestExitPrice": None,
            "bestProfitPct": None,
            "bestExitHigh": None,
            "bestHighTimeIst": None,
            "bestHighProfitPct": None,
            "eodTimeIst": None,
            "eodExitPrice": None,
            "eodProfitPct": None,
            "positive": False,
        }

    best_mid = None
    best_high = None
    for ts, row in after.iterrows():
        exit_mid = mid_price(row)
        exit_high = float(row["High"])
        mid_pct = long_profit_pct(buy_price, exit_mid)
        high_pct = long_profit_pct(buy_price, exit_high)
        cand_mid = {"time": ts, "price": exit_mid, "profitPct": mid_pct}
        cand_high = {"time": ts, "price": exit_high, "profitPct": high_pct}
        if best_mid is None or mid_pct > best_mid["profitPct"]:
            best_mid = cand_mid
        if best_high is None or high_pct > best_high["profitPct"]:
            best_high = cand_high

    eod_ts = after.index[-1]
    eod_row = after.iloc[-1]
    eod_price = mid_price(eod_row)
    eod_pct = long_profit_pct(buy_price, eod_price)

    return {
        "hasExitWindow": True,
        "bestTimeIst": best_mid["time"].strftime("%H:%M"),
        "bestExitPrice": round(float(best_mid["price"]), 2),
        "bestProfitPct": round(float(best_mid["profitPct"]), 2),
        "bestExitHigh": round(float(best_high["price"]), 2),
        "bestHighTimeIst": best_high["time"].strftime("%H:%M"),
        "bestHighProfitPct": round(float(best_high["profitPct"]), 2),
        "eodTimeIst": eod_ts.strftime("%H:%M"),
        "eodExitPrice": round(float(eod_price), 2),
        "eodProfitPct": round(float(eod_pct), 2),
        "positive": best_mid["profitPct"] > 0,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="deeppro BUY square-off study")
    parser.add_argument("--symbol", default="SUNPHARMA", help="NSE trading symbol")
    args = parser.parse_args()
    yahoo_symbol, report_symbol = resolve_symbol(args.symbol)

    df = fetch_df(yahoo_symbol)
    events, days = find_deeppro_buy_events(df)

    rows = []
    for event in events:
        event_ts = event["event_ts"]
        event_row = df.loc[event_ts]
        buy_price = round(mid_price(event_row), 2)
        buy_close = round(float(event_row["Close"]), 2)
        bb_upper = bb_upper_proximity(event_row)
        bb_lower = bb_lower_proximity(event_row)
        sq = best_square_off(df, event_ts, buy_price)
        rows.append(
            {
                "date": event_ts.strftime("%d %b"),
                "dateKey": event_ts.strftime("%Y-%m-%d"),
                "event": event_ts.strftime("%H:%M"),
                "eventKind": event["event_kind"],
                "eventRsi": round(float(event_row["rsi"]), 2),
                "bbUpperProximity": bb_upper,
                "bbLowerProximity": bb_lower,
                "buyPrice": buy_price,
                "buyClose": buy_close,
                "troughSmi": round(float(event["trough_smi"]), 2),
                "highlight": False,
                **{
                    k: (bool(v) if isinstance(v, (np.bool_, bool)) else v)
                    for k, v in sq.items()
                },
            }
        )

    tradable = [r for r in rows if r["hasExitWindow"]]
    positives = [r for r in tradable if r["positive"]]
    profits = [r["bestProfitPct"] for r in tradable if r["bestProfitPct"] is not None]
    avg_best = round(sum(profits) / len(profits), 2) if profits else None
    win_rate = round(100 * len(positives) / len(tradable), 1) if tradable else 0.0
    if tradable:
        best_row = max(tradable, key=lambda row: row["bestProfitPct"] or float("-inf"))
        best_row["highlight"] = True

    payload = {
        "symbol": report_symbol,
        "interval": "15m",
        "rule": "deeppro",
        "study": "buy_square_off",
        "generatedAtUtc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "assumptions": {
            "side": "BUY (long) — mirror of deeppro short pattern",
            "pattern": [
                "SMI(10,3,3) bullish cross from oversold (<= -40)",
                "Deep oversold trough SMI <= -70 in lookback",
                "Lower Bollinger Band tagged in lookback",
                "MACD histogram rising on cross candle",
                f"MACD hist Δ >= {MIN_MACD_HIST_DELTA_PCT}% of price",
                f"Event before {ENTRY_DEADLINE} IST",
            ],
            "entryPrice": "event candle mid = (high + low) / 2",
            "squareOffPrice": "later same-day candle mid = (high + low) / 2",
            "bestSquareOff": "candle after entry with maximum long profit % before session end",
            "optimisticNote": "bestHigh* fields use candle high (more optimistic fill)",
            "sessionEnd": SESSION_END,
            "entryDeadlineIst": ENTRY_DEADLINE,
            "minMacdHistDeltaPct": MIN_MACD_HIST_DELTA_PCT,
            "qualityFilters": (
                "Event before 14:00 IST and MACD hist Δ >= 0.01% of price — "
                "removes weak 0.08–0.25% same-day setups; keeps 0.30–0.70 / 0.75–2.0 rules."
            ),
            "dataSourceNote": (
                "Interim 15m history used because KITE_ACCESS_TOKEN is invalid in this "
                "environment. Re-run via Kite when token is available."
            ),
        },
        "window": {
            "tradeDays": len(days),
            "from": days[0].date().isoformat(),
            "to": days[-1].date().isoformat(),
        },
        "summary": {
            "signals": len(rows),
            "positiveBestSquareOff": len(positives),
            "winRatePct": win_rate,
            "avgBestProfitPct": avg_best,
            "maxBestProfitPct": max(profits) if profits else None,
            "minBestProfitPct": min(profits) if profits else None,
        },
        "trades": rows,
    }

    md_lines = [
        f"# {report_symbol} deeppro BUY square-off study",
        "",
        f"- **Symbol:** {report_symbol}",
        "- **Side:** BUY (long) at deeppro **mirror** event (oversold exhaustion)",
        "- **Pattern:** SMI bullish cross from oversold + BB lower tag + rising MACD hist",
        f"- **Quality filters:** event before `{ENTRY_DEADLINE}` IST · MACD hist Δ ≥ `{MIN_MACD_HIST_DELTA_PCT}%` of price",
        "- **Entry price:** event candle mid `(high + low) / 2`",
        f"- **Square-off:** best later same-day candle mid before `{SESSION_END}` IST",
        "- **Profit %:** `(squareOffPrice - buyPrice) / buyPrice * 100`",
        f"- **Window:** {len(days)} trade days ({days[0].date()} → {days[-1].date()})",
        f"- **Signals:** {len(rows)} · **Positive best SQ:** {len(positives)} ({win_rate}%) · **Avg best profit:** {avg_best}%",
        "",
        "## Trades",
        "",
        "| Date | Event | RSI | BB upper % | BB lower % | Buy price | Best SQ off | SQ price | Profit % |",
        "|------|-------|-----|------------|------------|-----------|-------------|----------|----------|",
    ]

    for row in rows:
        up = format_bb_pct(row["bbUpperProximity"])
        lo = format_bb_pct(row["bbLowerProximity"])
        if not row["hasExitWindow"]:
            md_lines.append(
                f"| {row['date']} | {row['event']} | {row['eventRsi']:.2f} | {up} | {lo} | "
                f"{row['buyPrice']:.2f} | — | — | no exit window |"
            )
            continue
        date_cell = f"**{row['date']}**" if row["highlight"] else row["date"]
        event_cell = f"**{row['event']}**" if row["highlight"] else row["event"]
        profit_cell = (
            f"**{row['bestProfitPct']:.2f}%**"
            if row["highlight"]
            else f"{row['bestProfitPct']:.2f}%"
        )
        rsi_cell = f"**{row['eventRsi']:.2f}**" if row["highlight"] else f"{row['eventRsi']:.2f}"
        md_lines.append(
            f"| {date_cell} | {event_cell} | {rsi_cell} | {up} | {lo} | "
            f"{row['buyPrice']:.2f} | {row['bestTimeIst']} | {row['bestExitPrice']:.2f} | "
            f"{profit_cell} |"
        )

    md_lines.extend(
        [
            "",
            "## Detail (incl. optimistic high fill & EOD)",
            "",
            "| Date | Event | RSI | BB upper % | BB lower % | Buy | Best mid SQ | Mid profit | Best high SQ | High profit | EOD SQ | EOD profit |",
            "|------|-------|-----|------------|------------|-----|-------------|------------|--------------|-------------|--------|------------|",
        ]
    )
    for row in rows:
        if not row["hasExitWindow"]:
            continue
        up = format_bb_pct(row["bbUpperProximity"])
        lo = format_bb_pct(row["bbLowerProximity"])
        md_lines.append(
            f"| {row['date']} | {row['event']} | {row['eventRsi']:.2f} | {up} | {lo} | "
            f"{row['buyPrice']:.2f} | "
            f"{row['bestTimeIst']} @ {row['bestExitPrice']:.2f} | {row['bestProfitPct']:.2f}% | "
            f"{row['bestHighTimeIst']} @ {row['bestExitHigh']:.2f} | {row['bestHighProfitPct']:.2f}% | "
            f"{row['eodTimeIst']} @ {row['eodExitPrice']:.2f} | {row['eodProfitPct']:.2f}% |"
        )

    md_lines.extend(
        [
            "",
            "## Notes",
            "",
            "- This is the **opposite** of the deeppro short pattern (oversold bounce vs overbought dump).",
            "- Long profit is positive when price rises after the BUY entry.",
            "- **Best SQ off** = highest profit using candle mid prices.",
            "- **Best high SQ** = theoretical best if exit filled at that candle's high.",
            "- Same-day only; no overnight holds.",
            "",
        ]
    )

    def json_default(value):
        if isinstance(value, (np.bool_,)):
            return bool(value)
        if isinstance(value, (np.integer,)):
            return int(value)
        if isinstance(value, (np.floating,)):
            return float(value)
        if isinstance(value, pd.Timestamp):
            return value.isoformat()
        raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    tag = report_symbol.lower()
    json_path = REPORTS_DIR / f"deeppro-{tag}-buy-squareoff-60d.json"
    md_path = REPORTS_DIR / f"deeppro-{tag}-buy-squareoff-60d.md"
    json_path.write_text(json.dumps(payload, indent=2, default=json_default))
    md_path.write_text("\n".join(md_lines))

    print(f"{report_symbol} deeppro BUY square-off study")
    print(
        f"Window: {len(days)} trade days · Signals: {len(rows)} · "
        f"Win rate: {win_rate}% · Avg best: {avg_best}%\n"
    )
    print(
        f"{'Date':<8} {'Event':<6} {'RSI':>7} {'BBup%':<16} {'BBlo%':<16} "
        f"{'Buy':>9} {'Best SQ':<8} {'SQ px':>9} {'Profit%':>8}"
    )
    print("-" * 100)
    for row in rows:
        up = format_bb_pct(row["bbUpperProximity"])
        lo = format_bb_pct(row["bbLowerProximity"])
        if not row["hasExitWindow"]:
            print(
                f"{row['date']:<8} {row['event']:<6} {row['eventRsi']:7.2f} {up:<16} {lo:<16} "
                f"{row['buyPrice']:9.2f} {'—':<8} {'—':>9} {'n/a':>8}"
            )
            continue
        mark = " <-- best" if row["highlight"] else ""
        print(
            f"{row['date']:<8} {row['event']:<6} {row['eventRsi']:7.2f} {up:<16} {lo:<16} "
            f"{row['buyPrice']:9.2f} {row['bestTimeIst']:<8} {row['bestExitPrice']:9.2f} "
            f"{row['bestProfitPct']:7.2f}%{mark}"
        )
    print(f"\nWrote {md_path}")
    print(f"Wrote {json_path}")


if __name__ == "__main__":
    main()
