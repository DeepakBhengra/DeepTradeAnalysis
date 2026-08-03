import type {
  DashboardSeriesPoint,
  DeepakDecisionResult,
  DeepakTradeSignal,
  Decision,
} from "../types/dashboard";
import type {
  DeepakPostMortemReport,
  EnhancementTip,
  GradedPostMortemSignal,
  LiveBiasStep,
  PostMortemGrade,
  PostMortemMidPoint,
  PostMortemVariant,
} from "../types/postMortem";
import { formatIstDateTime } from "./istTime";

const VARIANT_LABEL: Record<PostMortemVariant, string> = {
  deepak: "Deepak",
  deepak2: "Deepak-2",
  deeppro: "Deeppro",
  rulePnb: "RulePNB",
};

export function seriesTimeIst(timeSeconds: number): string {
  return formatIstDateTime(timeSeconds * 1000, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function candleMid(point: Pick<DashboardSeriesPoint, "high" | "low">): number {
  return (point.high + point.low) / 2;
}

function signedMove(side: "BUY" | "SELL", entry: number, mid: number): number {
  return side === "BUY" ? mid - entry : entry - mid;
}

function findEntryIndex(
  path: PostMortemMidPoint[],
  timeIst: string,
): number {
  const exact = path.findIndex((p) => p.timeIst === timeIst);
  if (exact >= 0) {
    return exact;
  }
  // Fallback: first bar at or after signal time (HH:mm lexicographic works for session)
  return path.findIndex((p) => p.timeIst >= timeIst);
}

function formatPts(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
}

/**
 * Directional grade bar — not the engine's adaptive daily-range target.
 * Adaptive targets (~full day range) are exit math, not "was the call right?".
 * Cap at 0.3% of entry (min 0.7) so a +5pt follow-through on a ₹1580 name counts.
 */
export function directionalGradeThreshold(
  entry: number,
  profitTarget: number,
): number {
  const pctCap = Math.max(0.7, entry * 0.003);
  return Math.min(profitTarget, pctCap);
}

function gradeSignal(
  signal: DeepakTradeSignal,
  path: PostMortemMidPoint[],
): GradedPostMortemSignal {
  const entryIndex = findEntryIndex(path, signal.timeIst);
  const entryBar = entryIndex >= 0 ? path[entryIndex] : null;
  const later = entryIndex >= 0 ? path.slice(entryIndex + 1) : [];
  const last = path.length > 0 ? path[path.length - 1] : null;

  let mfe = 0;
  let mae = 0;
  let mfeTime = entryBar?.timeIst ?? signal.timeIst;
  let maeTime = entryBar?.timeIst ?? signal.timeIst;
  let firstAdverseTime: string | null = null;

  for (const bar of later) {
    const move = signedMove(signal.side, signal.price, bar.mid);
    if (move > mfe) {
      mfe = move;
      mfeTime = bar.timeIst;
    }
    if (move < mae) {
      mae = move;
      maeTime = bar.timeIst;
      if (firstAdverseTime == null && move < 0) {
        firstAdverseTime = bar.timeIst;
      }
    }
  }

  const eodPnl = last
    ? signedMove(signal.side, signal.price, last.mid)
    : 0;
  const targetHit = Boolean(signal.exit?.targetHit);
  const profitTarget = signal.profitTarget;
  const gradeBar = directionalGradeThreshold(signal.price, profitTarget);
  const largeAdverse = mae <= -gradeBar;
  const meaningfulFollowThrough = mfe >= gradeBar;
  // RIGHT: engine target hit cleanly, or meaningful follow-through without a prior washout.
  // MIXED: eventual follow-through / EOD win but large MAE first (costly timing).
  // WRONG: no meaningful follow-through and not finishing ahead.
  const directionallyOk =
    targetHit || meaningfulFollowThrough || (eodPnl > 0 && mfe >= gradeBar);

  let grade: PostMortemGrade;
  if (!directionallyOk && eodPnl <= 0 && mfe < gradeBar) {
    grade = "WRONG";
  } else if (directionallyOk && !largeAdverse) {
    grade = "RIGHT";
  } else {
    grade = "MIXED";
  }

  const mfeLabel = `${formatPts(mfe)} to ${mfeTime} mid`;
  const maeLabel = `${formatPts(mae)} @ ${maeTime} mid`;

  let why: string;
  if (grade === "RIGHT") {
    why = targetHit
      ? `Profit target hit${signal.exit ? ` at ${signal.exit.timeIst}` : ""}; direction confirmed.`
      : `Meaningful follow-through: MFE ${formatPts(mfe)} ≥ grade bar ${gradeBar.toFixed(2)}` +
        (eodPnl < 0 ? ` (then faded; EOD ${formatPts(eodPnl)})` : ` · EOD ${formatPts(eodPnl)}`) +
        `.`;
  } else if (grade === "WRONG") {
    why = `No follow-through: MFE ${formatPts(mfe)} stayed below grade bar ${gradeBar.toFixed(2)}; EOD ${formatPts(eodPnl)}.`;
  } else {
    why = `Direction mixed: MFE ${formatPts(mfe)} but MAE ${formatPts(mae)}${
      firstAdverseTime ? ` (first adverse ${firstAdverseTime})` : ""
    }; EOD ${formatPts(eodPnl)}.`;
  }

  let nextPath: string;
  if (later.length === 0) {
    nextPath = "No later session bars";
  } else if (grade === "WRONG") {
    nextPath = firstAdverseTime
      ? `Adverse from ${firstAdverseTime}; never recovered`
      : "No favorable follow-through";
  } else if (mae < 0 && mfe > 0) {
    nextPath = firstAdverseTime
      ? `Dip @ ${firstAdverseTime} → favorable to ${mfeTime}`
      : `Favorable to ${mfeTime}`;
  } else if (mfe > 0) {
    nextPath = `Favorable to ${mfeTime}`;
  } else {
    nextPath = `Drift to EOD ${last?.timeIst ?? ""}`;
  }

  return {
    id: `#${signal.scenarioNumber}`,
    side: signal.side,
    scenarioKey: signal.scenarioKey,
    scenarioNumber: signal.scenarioNumber,
    timeIst: signal.timeIst,
    entry: signal.price,
    bbMatchType: signal.bbMatchType,
    profitTarget,
    targetHit,
    grade,
    mfe,
    mae,
    eodPnl,
    mfeLabel,
    maeLabel,
    why,
    nextPath,
    entryCandleColor: entryBar
      ? entryBar.close >= entryBar.open
        ? "green"
        : "red"
      : "green",
  };
}

function buildTimeline(
  signals: DeepakTradeSignal[],
  graded: GradedPostMortemSignal[],
): LiveBiasStep[] {
  if (signals.length === 0) {
    return [];
  }

  const ordered = [...signals].sort((a, b) => a.timeIst.localeCompare(b.timeIst));
  const steps: LiveBiasStep[] = [];
  const openSignals: DeepakTradeSignal[] = [];

  for (const signal of ordered) {
    // Close prior signals that already hit target at or before this time
    for (let i = openSignals.length - 1; i >= 0; i--) {
      const open = openSignals[i];
      if (open.exit?.targetHit && open.exit.timeIst <= signal.timeIst) {
        openSignals.splice(i, 1);
      }
    }
    openSignals.push(signal);

    const stillOpen = openSignals.filter(
      (s) => !(s.exit?.targetHit && s.exit.timeIst <= signal.timeIst),
    );
    const bias: Decision =
      stillOpen.length === 0 ? "HOLD" : stillOpen[stillOpen.length - 1].side;

    const gradedMatch = graded.find(
      (g) =>
        g.scenarioKey === signal.scenarioKey &&
        g.timeIst === signal.timeIst &&
        g.scenarioNumber === signal.scenarioNumber,
    );

    let marketAgree: string;
    let tone: LiveBiasStep["tone"] = "neutral";
    if (!gradedMatch) {
      marketAgree = "—";
    } else if (gradedMatch.grade === "RIGHT") {
      marketAgree = "Yes — path supported this bias";
      tone = "success";
    } else if (gradedMatch.grade === "WRONG") {
      marketAgree = "No — subsequent path opposed this bias";
      tone = "danger";
    } else {
      marketAgree = "Mixed — costly timing or weak follow-through";
      tone = "warning";
    }

    steps.push({
      fromTimeIst: signal.timeIst,
      bias,
      why: `Last open = ${signal.scenarioKey}`,
      marketAgree,
      tone,
    });
  }

  return steps;
}

function isContinue4(key: string): boolean {
  return /continue (downward|upward) direction - 4/i.test(key);
}

function isStrongSwitch(key: string): boolean {
  return /strong direction switch/i.test(key);
}

function isDeferredResolve(key: string): boolean {
  return /deferred (upper|lower) resolve/i.test(key);
}

export function buildNetRead(
  graded: GradedPostMortemSignal[],
  variantLabel: string,
): string {
  if (graded.length === 0) {
    return `${variantLabel} fired no BUY/SELL signals this session — nothing to grade.`;
  }

  const strong = graded.filter((s) => isStrongSwitch(s.scenarioKey));
  const continue4 = graded.filter((s) => isContinue4(s.scenarioKey));
  const deferred = graded.filter((s) => isDeferredResolve(s.scenarioKey));
  const wrongContinue4 = continue4.filter((s) => s.grade === "WRONG");

  const goodStrong = strong.filter((s) => s.grade === "RIGHT" || s.grade === "MIXED");
  const goodDeferred = deferred.filter(
    (s) => s.grade === "RIGHT" || s.grade === "MIXED",
  );

  let summary: string;
  if (goodStrong.length > 0 && goodDeferred.length > 0) {
    const strongIds = goodStrong.map((s) => s.id).join("/");
    const deferredIds = goodDeferred.map((s) => s.id).join("/");
    summary =
      `${variantLabel} correctly detected the morning lower-band regime and the switch to ` +
      `${goodStrong[0].side === "BUY" ? "bullish" : "bearish"} (${goodStrong[0].side} ${strongIds}), ` +
      `and correctly confirmed the afternoon ${goodDeferred[0].side === "BUY" ? "upper" : "lower"}-band trend ` +
      `(${goodDeferred[0].side} ${deferredIds}).`;
  } else if (goodStrong.length > 0) {
    const strongIds = goodStrong.map((s) => s.id).join("/");
    summary =
      `${variantLabel} correctly detected the regime switch (${goodStrong[0].side} ${strongIds}).`;
  } else if (goodDeferred.length > 0) {
    const deferredIds = goodDeferred.map((s) => s.id).join("/");
    summary =
      `${variantLabel} correctly confirmed the deferred band resolve (${goodDeferred[0].side} ${deferredIds}).`;
  } else {
    const right = graded.filter((s) => s.grade === "RIGHT").length;
    const mixed = graded.filter((s) => s.grade === "MIXED").length;
    const wrong = graded.filter((s) => s.grade === "WRONG").length;
    summary =
      `${variantLabel} printed ${graded.length} signal(s): ${right} right, ${mixed} mixed, ${wrong} wrong.`;
  }

  if (wrongContinue4.length > 0 && strong.length > 0) {
    const cont = wrongContinue4[0];
    const opposing = strong.find(
      (s) => s.side !== cont.side && s.timeIst <= cont.timeIst,
    );
    if (opposing) {
      const continueLabel = cont.side === "SELL" ? "continue-down-4" : "continue-up-4";
      summary +=
        ` The enhancement focus is not “more signals” — it is stopping ${continueLabel} ` +
        `from contradicting an active strong-switch ${opposing.side} and flipping live bias at the worst moment.`;
    } else {
      summary +=
        ` The enhancement focus is not “more signals” — it is stopping false continue-4 prints from dominating live bias.`;
    }
  } else if (graded.some((s) => s.grade === "WRONG")) {
    summary +=
      ` Focus enhancements on the WRONG signal(s) rather than adding more entries.`;
  }

  return summary;
}

function buildTips(graded: GradedPostMortemSignal[]): EnhancementTip[] {
  const tips: EnhancementTip[] = [];
  const seen = new Set<string>();

  const push = (tip: EnhancementTip) => {
    const key = `${tip.priority}:${tip.title}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    tips.push(tip);
  };

  const strongBuys = graded.filter(
    (s) => s.side === "BUY" && isStrongSwitch(s.scenarioKey),
  );
  const strongSells = graded.filter(
    (s) => s.side === "SELL" && isStrongSwitch(s.scenarioKey),
  );
  const wrongContinue4 = graded.filter(
    (s) => s.grade === "WRONG" && isContinue4(s.scenarioKey),
  );

  for (const cont of wrongContinue4) {
    const opposingStrong =
      cont.side === "SELL"
        ? strongBuys.find((s) => s.timeIst <= cont.timeIst)
        : strongSells.find((s) => s.timeIst <= cont.timeIst);

    if (opposingStrong) {
      push({
        priority: "P0",
        title: "Race post-switch exclusive bands (first wins)",
        body: `${cont.id} ${cont.side} continue-4 @ ${cont.timeIst} fired after ${opposingStrong.id} strong-switch ${opposingStrong.side}. After switch-up/down, accept only the first exclusive band — do not also take the opposite continue-4.`,
        effect: `Would suppress ${cont.id} and keep live bias on the strong-switch side.`,
      });
      push({
        priority: "P0",
        title: "Cooldown / invalidate continue-4 after strong switch",
        body: `Once a strong-switch ${opposingStrong.side} is open, require N bars or an invalidate level before allowing opposite continue-4.`,
        effect: `Blocks shakeout shorts/longs that flip dashboard bias at the worst moment.`,
      });
      push({
        priority: "P3",
        title: "Priority-based resolveDecision",
        body: "Last-open-signal aggregation let continue-4 override an open strong-switch thesis. Prefer scenario priority (strong switch > continue-4) for live bias.",
        effect: "Dashboard bias would stay on the stronger thesis even if continue-4 still prints.",
      });
    }
  }

  for (const cont of wrongContinue4) {
    const recoveryMismatch =
      (cont.side === "SELL" && cont.entryCandleColor === "green") ||
      (cont.side === "BUY" && cont.entryCandleColor === "red");
    if (recoveryMismatch) {
      push({
        priority: "P1",
        title: "Candle-color / recovery filter on continue-4",
        body: `Reject continue-4 when the signal candle is a recovery bar (${cont.entryCandleColor} on ${cont.side} @ ${cont.timeIst}).`,
        effect: `Would have blocked ${cont.id} on this session.`,
      });
      push({
        priority: "P1",
        title: "Extend RSI-extreme deferral to continue-4",
        body: "RSI extreme deferral currently covers continue-2 only. Apply the same oversold/overbought recovery gate to continue-4.",
        effect: "Fewer shorts into washout bounces and longs into blow-offs.",
      });
    }
  }

  const deferred = graded.filter((s) => isDeferredResolve(s.scenarioKey));
  for (const d of deferred) {
    if (d.grade === "RIGHT" && d.mae <= -Math.max(d.profitTarget, 1)) {
      push({
        priority: "P2",
        title: "Soften deferred-band chase entries",
        body: `${d.id} deferred resolve was directionally right but saw MAE ${formatPts(d.mae)} after a late exclusive-band streak.`,
        effect: "Enter on streak arm / pullback to middle instead of the third chase bar.",
      });
    } else if (d.grade === "MIXED" || d.grade === "WRONG") {
      push({
        priority: "P2",
        title: "Soften deferred-band chase entries",
        body: `${d.id} deferred resolve @ ${d.timeIst} graded ${d.grade} — late exclusive-band entries often chase.`,
        effect: "Require pullback or earlier arm before deferred entry.",
      });
    }
  }

  if (wrongContinue4.length > 0 || graded.some((s) => s.grade === "WRONG" && s.mae < -5)) {
    push({
      priority: "P2",
      title: "Stop or opposite-invalidate open signals",
      body: "Simulator only exits on profit target. Wrong-side continues can dominate live bias with no stop.",
      effect: "Cap damage when a false continue-4 still prints.",
    });
  }

  tips.sort((a, b) => a.priority.localeCompare(b.priority));
  return tips;
}

export function buildMidPath(series: DashboardSeriesPoint[]): PostMortemMidPoint[] {
  return series.map((point) => ({
    timeIst: seriesTimeIst(point.time),
    mid: candleMid(point),
    high: point.high,
    low: point.low,
    close: point.close,
    open: point.open,
    rsi: point.rsi,
  }));
}

export function buildDeepakPostMortemReport(
  decision: DeepakDecisionResult | null,
  series: DashboardSeriesPoint[],
  variant: PostMortemVariant,
): DeepakPostMortemReport | null {
  if (!decision) {
    return null;
  }

  const midPath = buildMidPath(series);
  const orderedSignals = [...decision.signals].sort((a, b) =>
    a.timeIst.localeCompare(b.timeIst),
  );

  const signals = orderedSignals.map((signal) => gradeSignal(signal, midPath));

  const rightCount = signals.filter((s) => s.grade === "RIGHT").length;
  const mixedCount = signals.filter((s) => s.grade === "MIXED").length;
  const wrongCount = signals.filter((s) => s.grade === "WRONG").length;

  const wrongSignals = signals.filter((s) => s.grade === "WRONG");
  const headline =
    wrongSignals.length > 0
      ? [...wrongSignals].sort((a, b) => a.mae - b.mae)[0]
      : null;

  const last = midPath.length > 0 ? midPath[midPath.length - 1] : null;

  return {
    variant,
    variantLabel: VARIANT_LABEL[variant],
    dateKey: decision.dateKey,
    decision: decision.decision,
    activeScenario: decision.activeScenario,
    midPath,
    signals,
    rightCount,
    mixedCount,
    wrongCount,
    headline,
    timeline: buildTimeline(orderedSignals, signals),
    tips: buildTips(signals),
    netRead: buildNetRead(signals, VARIANT_LABEL[variant]),
    sessionClose: last?.close ?? null,
    sessionRsi: last?.rsi ?? null,
  };
}
