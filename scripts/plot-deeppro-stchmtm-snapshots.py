#!/usr/bin/env python3
"""Plot Zerodha-style Stch Mtm snapshots zoomed on the SMI↔signal cross."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib.pyplot as plt

DEFAULT_PLOT_DATA = Path("/opt/cursor/artifacts/deeppro-stchmtm-snapshots/plot-data.json")
OUT_DIR = Path("/opt/cursor/artifacts/deeppro-stchmtm-snapshots")
REPORTS_DIR = Path("/workspace/reports/deeppro-stchmtm-snapshots")
ZOOM_HALF = 8  # bars either side of the cross


def _series(bars: list[dict], key: str) -> list[float]:
    return [b[key] if b[key] is not None else float("nan") for b in bars]


def _mark_cross(ax, x: int | None, y: float | None, label: str) -> None:
    if x is None:
        return
    ax.axvline(x, color="#f0c14b", linewidth=1.6, linestyle="-", alpha=0.95, zorder=4)
    ymin, ymax = ax.get_ylim()
    ax.text(
        x,
        ymax - (ymax - ymin) * 0.05,
        label,
        color="#f0c14b",
        fontsize=8,
        rotation=90,
        va="top",
        ha="right",
    )
    if y is not None and y == y:  # not NaN
        ax.scatter(
            [x],
            [y],
            s=90,
            color="#f0c14b",
            zorder=6,
            edgecolors="#111111",
            linewidths=0.7,
        )


def plot_hit(hit: dict) -> Path:
    bars = hit["sessionBars"]
    times = [b["timeIst"] for b in bars]
    closes = _series(bars, "close")
    smi = _series(bars, "smi")
    sig = _series(bars, "signal")
    xs = list(range(len(times)))

    cross = hit["crossTimeIst"]
    cross_x = times.index(cross) if cross in times else None

    if cross_x is None:
        z0, z1 = 0, max(0, len(times) - 1)
    else:
        z0 = max(0, cross_x - ZOOM_HALF)
        z1 = min(len(times) - 1, cross_x + ZOOM_HALF)
    z_slice = slice(z0, z1 + 1)
    z_xs = list(range(z0, z1 + 1))
    z_times = times[z_slice]
    z_smi = smi[z_slice]
    z_sig = sig[z_slice]
    local_cross = cross_x - z0 if cross_x is not None else None

    fig = plt.figure(figsize=(12, 8.2))
    fig.patch.set_facecolor("#0f1419")
    gs = fig.add_gridspec(3, 1, height_ratios=[1.05, 1.15, 1.45], hspace=0.18)
    ax_price = fig.add_subplot(gs[0])
    ax_smi = fig.add_subplot(gs[1], sharex=ax_price)
    ax_zoom = fig.add_subplot(gs[2])

    for ax in (ax_price, ax_smi, ax_zoom):
        ax.set_facecolor("#151b23")
        ax.tick_params(colors="#c5d0dc", labelsize=8)
        for spine in ax.spines.values():
            spine.set_color("#2a3544")
        ax.grid(True, color="#243040", linewidth=0.6, alpha=0.8)

    ax_price.plot(xs, closes, color="#5b9bd5", linewidth=1.6)
    ax_price.set_ylabel("Price", color="#c5d0dc")
    ax_price.set_title(
        f"{hit['symbol']}  ·  {hit['dateKey']}  ·  {hit['side']}  ·  "
        f"profit {hit['bestProfitPct']:.2f}%  ·  Stch Mtm (10,3,3)",
        color="#e8eef5",
        fontsize=12,
        pad=10,
    )
    _mark_cross(ax_price, cross_x, None, "SMI cross")

    for ax in (ax_smi, ax_zoom):
        ax.axhspan(40, 100, color="#c0504d", alpha=0.12)
        ax.axhspan(-100, -40, color="#4f81bd", alpha=0.12)
        ax.axhline(40, color="#c0504d", linewidth=0.8, linestyle="--", alpha=0.7)
        ax.axhline(-40, color="#4f81bd", linewidth=0.8, linestyle="--", alpha=0.7)
        ax.axhline(0, color="#6b7785", linewidth=0.7, alpha=0.8)
        ax.set_ylim(-100, 100)

    ax_smi.plot(xs, smi, color="#e8eef5", linewidth=1.7, label="SMI")
    ax_smi.plot(xs, sig, color="#e06767", linewidth=1.4, label="Signal")
    ax_smi.set_ylabel("Stch Mtm (session)", color="#c5d0dc")
    _mark_cross(ax_smi, cross_x, hit.get("crossSmi"), "SMI cross")
    ax_smi.legend(loc="lower right", fontsize=8, framealpha=0.25, labelcolor="#e8eef5")

    ax_zoom.plot(z_xs, z_smi, color="#e8eef5", linewidth=2.0, label="SMI", marker="o", markersize=3.5)
    ax_zoom.plot(z_xs, z_sig, color="#e06767", linewidth=1.8, label="Signal", marker="o", markersize=3.2)
    ax_zoom.set_ylabel("Stch Mtm (zoom)", color="#c5d0dc")
    ax_zoom.set_title(
        f"SMI↔signal cross zoom  ·  {cross} IST  ·  "
        f"SMI {hit.get('crossSmi')} / Signal {hit.get('crossSignal')}  ·  {hit.get('eventKind')}",
        color="#f0c14b",
        fontsize=10,
        pad=6,
    )
    if local_cross is not None:
        abs_x = z_xs[local_cross]
        ax_zoom.axvline(abs_x, color="#f0c14b", linewidth=1.8, alpha=0.95)
        cross_smi = hit.get("crossSmi")
        cross_sig = hit.get("crossSignal")
        if cross_smi is not None:
            ax_zoom.scatter(
                [abs_x],
                [cross_smi],
                s=110,
                color="#f0c14b",
                zorder=6,
                edgecolors="#111111",
                linewidths=0.8,
            )
            ax_zoom.annotate(
                f"CROSS\nSMI {cross_smi}\nSig {cross_sig}",
                xy=(abs_x, cross_smi),
                xytext=(10, 18 if hit["side"] == "SELL" else -28),
                textcoords="offset points",
                color="#f0c14b",
                fontsize=8,
                fontweight="bold",
                arrowprops={"arrowstyle": "->", "color": "#f0c14b", "lw": 0.9},
            )
        if local_cross > 0:
            ax_zoom.axvspan(
                z_xs[local_cross - 1] - 0.35,
                abs_x + 0.35,
                color="#f0c14b",
                alpha=0.08,
                zorder=1,
            )

    ax_zoom.legend(loc="best", fontsize=8, framealpha=0.25, labelcolor="#e8eef5")
    ax_zoom.set_xticks(z_xs)
    ax_zoom.set_xticklabels(z_times, rotation=45, ha="right")

    step = max(1, len(times) // 8) if times else 1
    ax_smi.set_xticks(xs[::step])
    ax_smi.set_xticklabels(times[::step], rotation=45, ha="right")
    plt.setp(ax_price.get_xticklabels(), visible=False)

    meta = (
        f"cross {hit['crossTimeIst']} IST ({hit['eventKind']})  ·  "
        f"peak/trough {hit['peakSmi']}  ·  entry {hit['entryPrice']}  ·  "
        f"best SQ {hit['bestTimeIst']} @ {hit['bestExitPrice']}  ·  "
        f"Zerodha Stch Mtm (10,3,3) recreation from Kite 15m"
    )
    fig.text(0.5, 0.01, meta, ha="center", color="#9aa8b6", fontsize=8)

    fname = f"{hit['symbol']}_{hit['dateKey']}_{hit['side']}_{hit['crossTimeIst'].replace(':', '')}.png"
    out = OUT_DIR / fname
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    fig.tight_layout(rect=[0, 0.035, 1, 1])
    fig.savefig(out, dpi=150, facecolor=fig.get_facecolor())
    fig.savefig(REPORTS_DIR / fname, dpi=150, facecolor=fig.get_facecolor())
    plt.close(fig)
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--plot-data",
        default=str(DEFAULT_PLOT_DATA),
        help="Path to plot-data JSON with hits[].sessionBars",
    )
    args = parser.parse_args()
    plot_path = Path(args.plot_data)
    data = json.loads(plot_path.read_text())
    hits = data["hits"]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    paths = []
    for hit in hits:
        path = plot_hit(hit)
        paths.append(str(path))
        print(f"wrote {path}")
    print(json.dumps({"ok": True, "charts": len(paths), "paths": paths}, indent=2))


if __name__ == "__main__":
    main()
