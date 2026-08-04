/**
 * Shared momentum-cascade guards used by favourable symbol rules /
 * RulePNB / RuleSUNPHARMA:
 *
 * Oversold (falling knife):
 * - buyGuards: require SMI+MACD turn-up + next mid higher (+ optional open DD)
 * - sellCascade: flip the same print into a short when momentum still falls
 *
 * Overbought (rising knife) — mirror:
 * - sellGuards: require SMI+MACD turn-down + next mid lower (+ optional open rally)
 * - buyCascade: flip the same print into a long when momentum still rises
 */

/** BUY-side guards to skip falling-knife / unconfirmed oversold prints. */
export type OversoldBuyGuards = {
  requireSmiRising: boolean;
  requireMacdHistRising: boolean;
  /**
   * Require the next same-day 15m mid > setup mid.
   * When true, the emitted entry is the confirmation bar.
   */
  requireNextBarConfirmation: boolean;
  /**
   * Reject setup if (setupMid − dayOpenMid) / dayOpenMid * 100 < −maxOpenDrawdownPct.
   * null = disabled.
   */
  maxOpenDrawdownPct: number | null;
};

/** SELL cascade: oversold levels + falling momentum → short on confirm. */
export type OversoldSellCascade = {
  enabled: boolean;
  requireSmiFalling: boolean;
  requireMacdHistFalling: boolean;
  requireNextBarLower: boolean;
  /** Optional minimum open drawdown (absolute). null = off. */
  minOpenDrawdownPct: number | null;
};

/** SELL-side guards to skip rising-knife / unconfirmed overbought prints. */
export type OverboughtSellGuards = {
  requireSmiFalling: boolean;
  requireMacdHistFalling: boolean;
  /**
   * Require the next same-day 15m mid < setup mid.
   * When true, the emitted entry is the confirmation bar.
   */
  requireNextBarConfirmation: boolean;
  /**
   * Reject setup if (setupMid − dayOpenMid) / dayOpenMid * 100 > maxOpenRallyPct.
   * null = disabled.
   */
  maxOpenRallyPct: number | null;
};

/** BUY cascade: overbought levels + rising momentum → long on confirm. */
export type OverboughtBuyCascade = {
  enabled: boolean;
  requireSmiRising: boolean;
  requireMacdHistRising: boolean;
  requireNextBarHigher: boolean;
  /** Optional minimum open rally. null = off. */
  minOpenRallyPct: number | null;
};

export type CascadeMomentumContext = {
  smi: number;
  prevSmi: number | null;
  macdHist: number;
  prevMacdHist: number | null;
  setupMid: number;
  dayOpenMid: number | null;
  nextMid: number | null;
};

export type CascadeGuardResult = {
  ok: boolean;
  reasons: string[];
  confirmedOnNextBar: boolean;
};

/** Default ICICIGI-proven settings applied across symbol-locked rules. */
export const DEFAULT_OVERSOLD_BUY_GUARDS: OversoldBuyGuards = {
  requireSmiRising: true,
  requireMacdHistRising: true,
  requireNextBarConfirmation: true,
  maxOpenDrawdownPct: 0.8,
};

export const DEFAULT_OVERSOLD_SELL_CASCADE: OversoldSellCascade = {
  enabled: true,
  requireSmiFalling: true,
  requireMacdHistFalling: true,
  requireNextBarLower: true,
  minOpenDrawdownPct: null,
};

/** Mirror defaults for rising-knife / melt-up prints. */
export const DEFAULT_OVERBOUGHT_SELL_GUARDS: OverboughtSellGuards = {
  requireSmiFalling: true,
  requireMacdHistFalling: true,
  requireNextBarConfirmation: true,
  maxOpenRallyPct: 0.8,
};

export const DEFAULT_OVERBOUGHT_BUY_CASCADE: OverboughtBuyCascade = {
  enabled: true,
  requireSmiRising: true,
  requireMacdHistRising: true,
  requireNextBarHigher: true,
  minOpenRallyPct: null,
};

export function evaluateOversoldBuyGuards(
  guards: OversoldBuyGuards | undefined | null,
  ctx: CascadeMomentumContext,
): CascadeGuardResult {
  if (!guards) {
    return { ok: true, reasons: [], confirmedOnNextBar: false };
  }

  const reasons: string[] = [];

  if (guards.requireSmiRising) {
    if (ctx.prevSmi == null || !(ctx.smi > ctx.prevSmi)) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(`SMI rising ${ctx.prevSmi.toFixed(1)}→${ctx.smi.toFixed(1)}`);
  }

  if (guards.requireMacdHistRising) {
    if (
      ctx.prevMacdHist == null ||
      !Number.isFinite(ctx.macdHist) ||
      !Number.isFinite(ctx.prevMacdHist) ||
      !(ctx.macdHist > ctx.prevMacdHist)
    ) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `MACD hist rising ${ctx.prevMacdHist.toFixed(2)}→${ctx.macdHist.toFixed(2)}`,
    );
  }

  if (
    guards.maxOpenDrawdownPct != null &&
    Number.isFinite(guards.maxOpenDrawdownPct) &&
    ctx.dayOpenMid != null &&
    ctx.dayOpenMid > 0
  ) {
    const dropPct = ((ctx.setupMid - ctx.dayOpenMid) / ctx.dayOpenMid) * 100;
    if (dropPct < -guards.maxOpenDrawdownPct) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `open drawdown ${dropPct.toFixed(2)}% ≥ −${guards.maxOpenDrawdownPct}%`,
    );
  }

  if (guards.requireNextBarConfirmation) {
    if (ctx.nextMid == null || !(ctx.nextMid > ctx.setupMid)) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `next-bar confirm mid ${ctx.setupMid.toFixed(2)}→${ctx.nextMid.toFixed(2)}`,
    );
    return { ok: true, reasons, confirmedOnNextBar: true };
  }

  return { ok: true, reasons, confirmedOnNextBar: false };
}

export function evaluateOversoldSellCascade(
  cascade: OversoldSellCascade | undefined | null,
  ctx: CascadeMomentumContext,
): CascadeGuardResult {
  if (!cascade?.enabled) {
    return { ok: false, reasons: [], confirmedOnNextBar: false };
  }

  const reasons: string[] = [];

  if (cascade.requireSmiFalling) {
    if (ctx.prevSmi == null || !(ctx.smi < ctx.prevSmi)) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(`SMI falling ${ctx.prevSmi.toFixed(1)}→${ctx.smi.toFixed(1)}`);
  }

  if (cascade.requireMacdHistFalling) {
    if (
      ctx.prevMacdHist == null ||
      !Number.isFinite(ctx.macdHist) ||
      !Number.isFinite(ctx.prevMacdHist) ||
      !(ctx.macdHist < ctx.prevMacdHist)
    ) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `MACD hist falling ${ctx.prevMacdHist.toFixed(2)}→${ctx.macdHist.toFixed(2)}`,
    );
  }

  if (
    cascade.minOpenDrawdownPct != null &&
    Number.isFinite(cascade.minOpenDrawdownPct) &&
    ctx.dayOpenMid != null &&
    ctx.dayOpenMid > 0
  ) {
    const dropPct = ((ctx.setupMid - ctx.dayOpenMid) / ctx.dayOpenMid) * 100;
    if (dropPct > -cascade.minOpenDrawdownPct) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `open drawdown ${dropPct.toFixed(2)}% ≤ −${cascade.minOpenDrawdownPct}%`,
    );
  }

  if (cascade.requireNextBarLower) {
    if (ctx.nextMid == null || !(ctx.nextMid < ctx.setupMid)) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `next-bar cascade mid ${ctx.setupMid.toFixed(2)}→${ctx.nextMid.toFixed(2)}`,
    );
    return { ok: true, reasons, confirmedOnNextBar: true };
  }

  return { ok: true, reasons, confirmedOnNextBar: false };
}

export function evaluateOverboughtSellGuards(
  guards: OverboughtSellGuards | undefined | null,
  ctx: CascadeMomentumContext,
): CascadeGuardResult {
  if (!guards) {
    return { ok: true, reasons: [], confirmedOnNextBar: false };
  }

  const reasons: string[] = [];

  if (guards.requireSmiFalling) {
    if (ctx.prevSmi == null || !(ctx.smi < ctx.prevSmi)) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(`SMI falling ${ctx.prevSmi.toFixed(1)}→${ctx.smi.toFixed(1)}`);
  }

  if (guards.requireMacdHistFalling) {
    if (
      ctx.prevMacdHist == null ||
      !Number.isFinite(ctx.macdHist) ||
      !Number.isFinite(ctx.prevMacdHist) ||
      !(ctx.macdHist < ctx.prevMacdHist)
    ) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `MACD hist falling ${ctx.prevMacdHist.toFixed(2)}→${ctx.macdHist.toFixed(2)}`,
    );
  }

  if (
    guards.maxOpenRallyPct != null &&
    Number.isFinite(guards.maxOpenRallyPct) &&
    ctx.dayOpenMid != null &&
    ctx.dayOpenMid > 0
  ) {
    const rallyPct = ((ctx.setupMid - ctx.dayOpenMid) / ctx.dayOpenMid) * 100;
    if (rallyPct > guards.maxOpenRallyPct) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `open rally ${rallyPct.toFixed(2)}% ≤ ${guards.maxOpenRallyPct}%`,
    );
  }

  if (guards.requireNextBarConfirmation) {
    if (ctx.nextMid == null || !(ctx.nextMid < ctx.setupMid)) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `next-bar confirm mid ${ctx.setupMid.toFixed(2)}→${ctx.nextMid.toFixed(2)}`,
    );
    return { ok: true, reasons, confirmedOnNextBar: true };
  }

  return { ok: true, reasons, confirmedOnNextBar: false };
}

export function evaluateOverboughtBuyCascade(
  cascade: OverboughtBuyCascade | undefined | null,
  ctx: CascadeMomentumContext,
): CascadeGuardResult {
  if (!cascade?.enabled) {
    return { ok: false, reasons: [], confirmedOnNextBar: false };
  }

  const reasons: string[] = [];

  if (cascade.requireSmiRising) {
    if (ctx.prevSmi == null || !(ctx.smi > ctx.prevSmi)) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(`SMI rising ${ctx.prevSmi.toFixed(1)}→${ctx.smi.toFixed(1)}`);
  }

  if (cascade.requireMacdHistRising) {
    if (
      ctx.prevMacdHist == null ||
      !Number.isFinite(ctx.macdHist) ||
      !Number.isFinite(ctx.prevMacdHist) ||
      !(ctx.macdHist > ctx.prevMacdHist)
    ) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `MACD hist rising ${ctx.prevMacdHist.toFixed(2)}→${ctx.macdHist.toFixed(2)}`,
    );
  }

  if (
    cascade.minOpenRallyPct != null &&
    Number.isFinite(cascade.minOpenRallyPct) &&
    ctx.dayOpenMid != null &&
    ctx.dayOpenMid > 0
  ) {
    const rallyPct = ((ctx.setupMid - ctx.dayOpenMid) / ctx.dayOpenMid) * 100;
    if (rallyPct < cascade.minOpenRallyPct) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `open rally ${rallyPct.toFixed(2)}% ≥ ${cascade.minOpenRallyPct}%`,
    );
  }

  if (cascade.requireNextBarHigher) {
    if (ctx.nextMid == null || !(ctx.nextMid > ctx.setupMid)) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `next-bar cascade mid ${ctx.setupMid.toFixed(2)}→${ctx.nextMid.toFixed(2)}`,
    );
    return { ok: true, reasons, confirmedOnNextBar: true };
  }

  return { ok: true, reasons, confirmedOnNextBar: false };
}

export function findNextSameDayIndex(
  dayIndexes: number[],
  setupIndex: number,
): number | null {
  const position = dayIndexes.indexOf(setupIndex);
  if (position < 0 || position + 1 >= dayIndexes.length) {
    return null;
  }
  return dayIndexes[position + 1];
}
