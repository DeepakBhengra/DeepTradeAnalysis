#!/usr/bin/env python3
"""Plot Stch Mtm + price snapshots for deeppro hits."""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

PLOT_DATA = Path("/opt/cursor/artifacts/deeppro-stchmtm-snapshots/plot-data.json")
OUT_DIR = Path("/opt/cursor/artifacts/deeppro-stchmtm-snapshots")
REPORTS_DIR = Path("/workspace/reports/deeppro-stchmtm-snapshots")


def plot_hit(hit: dict) -> Path:
    bars = hit["sessionBars"]
    times = [b["timeIst"] for b in bars]
    closes = [b["close"] for b in bars]
    smi = [b["smi"] if b["smi"] is not None else float("nan") for b in bars]
    sig = [b["signal"] if b["signal"] is not None else float("nan") for b in bars]
    xs = list(range(len(times)))

    cross = hit["crossTimeIst"]
    event = hit["eventTimeIst"]
    cross_x = times.index(cross) if cross in times else None
    event_x = times.index(event) if event in times else None

    fig, (ax_price, ax_smi) = plt.subplots(
        2,
        1,
        figsize=(11, 7),
        sharex=True,
        gridspec_kw={"height_ratios": [1.15, 1.35]},
    )
    fig.patch.set_facecolor("#0f1419")
    for ax in (ax_price, ax_smi):
        ax.set_facecolor("#151b23")
        ax.tick_params(colors="#c5d0dc", labelsize=8)
        for spine in ax.spines.values():
            spine.set_color("#2a3544")
        ax.grid(True, color="#243040", linewidth=0.6, alpha=0.8)

    ax_price.plot(xs, closes, color="#5b9bd5", linewidth=1.6, label="Close")
    ax_price.set_ylabel("Price", color="#c5d0dc")
    ax_price.set_title(
        f"{hit['symbol']}  ·  {hit['dateKey']}  ·  {hit['side']}  ·  "
        f"profit {hit['bestProfitPct']:.2f}%",
        color="#e8eef5",
        fontsize=12,
        pad=10,
    )

    ax_smi.axhspan(40, 100, color="#c0504d", alpha=0.12)
    ax_smi.axhspan(-100, -40, color="#4f81bd", alpha=0.12)
    ax_smi.axhline(40, color="#c0504d", linewidth=0.8, linestyle="--", alpha=0.7)
    ax_smi.axhline(-40, color="#4f81bd", linewidth=0.8, linestyle="--", alpha=0.7)
    ax_smi.axhline(0, color="#6b7785", linewidth=0.7, alpha=0.8)
    ax_smi.plot(xs, smi, color="#e8eef5", linewidth=1.7, label="SMI")
    ax_smi.plot(xs, sig, color="#e06767", linewidth=1.4, label="Signal")
    ax_smi.set_ylabel("Stch Mtm", color="#c5d0dc")
    ax_smi.set_ylim(-100, 100)

    def mark(ax, x, color, label):
        if x is None:
            return
        ax.axvline(x, color=color, linewidth=1.4, linestyle="-", alpha=0.95)
        ymin, ymax = ax.get_ylim()
        ax.text(
            x,
            ymax - (ymax - ymin) * 0.04,
            label,
            color=color,
            fontsize=8,
            rotation=90,
            va="top",
            ha="right",
        )

    mark(ax_price, cross_x, "#f0c14b", "SMI cross")
    mark(ax_smi, cross_x, "#f0c14b", "SMI cross")
    if event_x is not None and event_x != cross_x:
        mark(ax_price, event_x, "#3dcdc3", "Event")
        mark(ax_smi, event_x, "#3dcdc3", "Event")

    if cross_x is not None and hit["crossSmi"] is not None:
        ax_smi.scatter(
            [cross_x],
            [hit["crossSmi"]],
            s=70,
            color="#f0c14b",
            zorder=5,
            edgecolors="#1a1a1a",
            linewidths=0.6,
        )
        ax_smi.annotate(
            f"SMI {hit['crossSmi']}",
            xy=(cross_x, hit["crossSmi"]),
            xytext=(8, 12),
            textcoords="offset points",
            color="#f0c14b",
            fontsize=8,
        )

    ax_smi.legend(loc="lower right", fontsize=8, framealpha=0.25, labelcolor="#e8eef5")
    step = max(1, len(times) // 8)
    ax_smi.set_xticks(xs[::step])
    ax_smi.set_xticklabels(times[::step], rotation=45, ha="right")

    meta = (
        f"cross {hit['crossTimeIst']}  ·  event {hit['eventTimeIst']} ({hit['eventKind']})  ·  "
        f"peak/trough {hit['peakSmi']}  ·  entry {hit['entryPrice']}  ·  "
        f"best SQ {hit['bestTimeIst']} @ {hit['bestExitPrice']}"
    )
    fig.text(0.5, 0.01, meta, ha="center", color="#9aa8b6", fontsize=8)

    fname = f"{hit['symbol']}_{hit['dateKey']}_{hit['side']}_{hit['crossTimeIst'].replace(':', '')}.png"
    out = OUT_DIR / fname
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    fig.tight_layout(rect=[0, 0.04, 1, 1])
    fig.savefig(out, dpi=140, facecolor=fig.get_facecolor())
    fig.savefig(REPORTS_DIR / fname, dpi=140, facecolor=fig.get_facecolor())
    plt.close(fig)
    return out


def main() -> None:
    data = json.loads(PLOT_DATA.read_text())
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
