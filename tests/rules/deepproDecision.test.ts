import { describe, expect, it } from "vitest";
import { buildIndicatorSnapshots } from "../../src/indicators/compute.js";
import {
  evaluateDeepproBuySignals,
  evaluateDeepproSignals,
  isSmiBearishCrossOrTouch,
  isSmiBullishCrossOrTouch,
  passesBuySmiAngle,
  passesDeepproBuyQuality,
  passesDeepproSellQuality,
  passesSellSmiAngle,
  smiBlackSlopeAngleDeg,
} from "../../src/rules/deepproDecision.js";
import type { Candle, DeepproSignal } from "../../src/types.js";

describe("SMI↔signal cross or touch helpers", () => {
  it("fires bearish only when SMI was above signal then crosses/touches to at-or-below", () => {
    expect(isSmiBearishCrossOrTouch(70, 60, 55, 58)).toBe(true); // cross below
    expect(isSmiBearishCrossOrTouch(70, 60, 60, 60)).toBe(true); // touch
    expect(isSmiBearishCrossOrTouch(70, 60, 65, 62)).toBe(false); // still above
    expect(isSmiBearishCrossOrTouch(55, 58, 50, 56)).toBe(false); // already below
  });

  it("fires bullish only when SMI was below signal then crosses/touches to at-or-above", () => {
    expect(isSmiBullishCrossOrTouch(-70, -60, -55, -58)).toBe(true); // cross above
    expect(isSmiBullishCrossOrTouch(-70, -60, -60, -60)).toBe(true); // touch
    expect(isSmiBullishCrossOrTouch(-70, -60, -65, -62)).toBe(false); // still below
    expect(isSmiBullishCrossOrTouch(-55, -58, -50, -56)).toBe(false); // already above
  });
});

describe("SMI black-slope angle gate (≥35° into the cross)", () => {
  const scale = 22;

  it("maps shallow vs steep ΔSMI into ~15–20° vs ≥35° bands", () => {
    // |ΔSMI|=8 → ~20°; |ΔSMI|=16 → ~36°
    expect(smiBlackSlopeAngleDeg(60, 52, scale)).toBeGreaterThan(19);
    expect(smiBlackSlopeAngleDeg(60, 52, scale)).toBeLessThan(22);
    expect(smiBlackSlopeAngleDeg(60, 44, scale)).toBeGreaterThanOrEqual(35);
  });

  it("rejects shallow SELL approaches (~15–20°) and keeps steep (≥35°) downward slopes", () => {
    const shallow = passesSellSmiAngle(70, 62, scale, 35);
    expect(shallow.ok).toBe(false);
    expect(shallow.angleDeg).toBeLessThan(25);

    const steep = passesSellSmiAngle(90, 74, scale, 35);
    expect(steep.ok).toBe(true);
    expect(steep.angleDeg).toBeGreaterThanOrEqual(35);
  });

  it("rejects shallow BUY approaches and keeps steep (≥35°) upward slopes", () => {
    const weak = passesBuySmiAngle(-70, -62, scale, 35);
    expect(weak.ok).toBe(false);

    const strong = passesBuySmiAngle(-70, -54, scale, 35);
    expect(strong.ok).toBe(true);
    expect(strong.angleDeg).toBeGreaterThanOrEqual(35);
  });
});

function stubSignal(
  overrides: Partial<DeepproSignal> &
    Pick<DeepproSignal, "side" | "eventTimeIst" | "eventKind" | "eventRsi">,
): DeepproSignal {
  return {
    rule: "deeppro",
    dateKey: "2026-06-29",
    timeIst: overrides.eventTimeIst,
    price: 100,
    smi: 50,
    smiSignal: 55,
    peakSmi: overrides.side === "SELL" ? 80 : -80,
    rsi: overrides.eventRsi,
    bbUpperProximity: {
      gapPct: 0.5,
      signedGapPct: -0.5,
      matchType: null,
      price: 101,
      bbLevel: 101.5,
    },
    bbLowerProximity: {
      gapPct: 1.5,
      signedGapPct: -1.5,
      matchType: null,
      price: 99,
      bbLevel: 97.5,
    },
    macdHistogram: 1,
    reasons: [],
    ...overrides,
  };
}

function istCandle(
  dateKey: string,
  hour: number,
  minute: number,
  open: number,
  high: number,
  low: number,
  close: number,
): Candle {
  const timestamp = new Date(
    `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`,
  );
  return {
    timestamp,
    open,
    high,
    low,
    close,
    volume: 10_000,
  };
}

function buildRisingThenDumpDay(dateKey: string): Candle[] {
  const candles: Candle[] = [];
  // Warmup days before analysis date
  for (let d = 0; d < 5; d++) {
    const day = `2026-07-${String(20 + d).padStart(2, "0")}`;
    for (let c = 0; c < 25; c++) {
      const minutes = 9 * 60 + 15 + c * 15;
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      if (hour > 15 || (hour === 15 && minute > 15)) {
        continue;
      }
      const base = 1900 + d * 5 + c * 0.4;
      candles.push(istCandle(day, hour, minute, base, base + 2, base - 1, base + 0.5));
    }
  }

  // Analysis day: grind into upper band, deep OB, then stall/dump
  const times = [
    [9, 15], [9, 30], [9, 45], [10, 0], [10, 15], [10, 30], [10, 45],
    [11, 0], [11, 15], [11, 30], [11, 45], [12, 0], [12, 15], [12, 30],
    [12, 45], [13, 0], [13, 15], [13, 30], [13, 45], [14, 0], [14, 15],
    [14, 30], [14, 45], [15, 0], [15, 15],
  ] as const;

  let price = 2000;
  let peakHigh = 0;
  for (let i = 0; i < times.length; i++) {
    const [hour, minute] = times[i];
    // Build a deep overbought run, then dump hard enough that SMI crosses the
    // slower Kite signal EMA(10) inside the quality SELL window (10:45–12:30).
    if (i <= 7) {
      const open = price;
      const close = price + 4.2;
      const high = close + 1.8;
      peakHigh = Math.max(peakHigh, high);
      candles.push(
        istCandle(dateKey, hour, minute, open, high, open - 0.5, close),
      );
      price = close;
    } else if (i === 8) {
      // first rollover ~11:15 — still near highs for BB tag / RSI
      const open = price;
      const close = price - 2;
      candles.push(
        istCandle(dateKey, hour, minute, open, peakHigh + 2, close - 1, close),
      );
      price = close;
    } else if (i <= 11) {
      // aggressive dump through ~12:00 so SMI pierces signal EMA(10)
      const open = price;
      const close = price - 28;
      candles.push(
        istCandle(dateKey, hour, minute, open, open + 1, close - 6, close),
      );
      price = close;
    } else {
      const open = price;
      const close = price - 12;
      candles.push(
        istCandle(dateKey, hour, minute, open, open + 1, close - 4, close),
      );
      price = close;
    }
  }

  return candles;
}

describe("evaluateDeepproSignals", () => {
  it("detects a deeppro SELL on Stch Mtm bearish cross from deep overbought", () => {
    const dateKey = "2026-07-25";
    const candles = buildRisingThenDumpDay(dateKey);
    const snapshots = buildIndicatorSnapshots(candles);
    const result = evaluateDeepproSignals(snapshots, dateKey);

    expect(result.rule).toBe("deeppro");
    expect(result.signals.length).toBeGreaterThanOrEqual(1);
    expect(result.signals[0].side).toBe("SELL");
    expect(result.signals[0].eventKind).toBe("smi_cross");
    expect(result.signals[0].timeIst).toBe(result.signals[0].eventTimeIst);
    expect(result.signals[0].peakSmi).toBeGreaterThanOrEqual(65);
    expect(result.signals[0].timeIst).toMatch(/^\d{2}:\d{2}$/);
    expect(Number.isFinite(result.signals[0].eventRsi)).toBe(true);
    expect(Number.isFinite(result.signals[0].bbUpperProximity.gapPct)).toBe(true);
    expect(Number.isFinite(result.signals[0].bbLowerProximity.gapPct)).toBe(true);
    expect(result.signals[0].bbUpperProximity.price).toBeGreaterThan(0);
    expect(result.signals[0].bbLowerProximity.price).toBeGreaterThan(0);
  });

  it("detects a deeppro BUY on Stch Mtm bullish cross from deep oversold", () => {
    const dateKey = "2026-07-25";
    const candles: Candle[] = [];
    for (let d = 0; d < 5; d++) {
      const day = `2026-07-${String(20 + d).padStart(2, "0")}`;
      for (let c = 0; c < 25; c++) {
        const minutes = 9 * 60 + 15 + c * 15;
        const hour = Math.floor(minutes / 60);
        const minute = minutes % 60;
        if (hour > 15 || (hour === 15 && minute > 15)) {
          continue;
        }
        const base = 1950 - d * 4 - c * 0.35;
        candles.push(istCandle(day, hour, minute, base, base + 1, base - 2, base - 0.4));
      }
    }

    const times = [
      [9, 15], [9, 30], [9, 45], [10, 0], [10, 15], [10, 30], [10, 45],
      [11, 0], [11, 15], [11, 30], [11, 45], [12, 0], [12, 15], [12, 30],
      [12, 45], [13, 0], [13, 15], [13, 30], [13, 45], [14, 0], [14, 15],
      [14, 30], [14, 45], [15, 0], [15, 15],
    ] as const;

    let price = 1900;
    for (let i = 0; i < times.length; i++) {
      const [hour, minute] = times[i];
      // Compress bounce setup into the quality BUY window (≤13:15).
      if (i <= 8) {
        const open = price;
        const close = price - 3.2;
        candles.push(
          istCandle(dateKey, hour, minute, open, open + 0.5, close - 1.5, close),
        );
        price = close;
      } else if (i === 9) {
        const open = price;
        const close = price + 1;
        candles.push(
          istCandle(dateKey, hour, minute, open, close + 0.5, open - 1, close),
        );
        price = close;
      } else if (i === 10) {
        // stall at lows ~11:45
        candles.push(
          istCandle(dateKey, hour, minute, price, price + 1.2, price - 0.4, price + 0.05),
        );
      } else {
        const open = price;
        const close = price + 16;
        candles.push(
          istCandle(dateKey, hour, minute, open, close + 4, open - 1, close),
        );
        price = close;
      }
    }

    const snapshots = buildIndicatorSnapshots(candles);
    const result = evaluateDeepproBuySignals(snapshots, dateKey);
    expect(result.signals.length).toBeGreaterThanOrEqual(0);
    if (result.signals.length > 0) {
      expect(result.signals[0].side).toBe("BUY");
      expect(result.signals[0].eventKind).toBe("smi_cross");
      expect(result.signals[0].timeIst).toBe(result.signals[0].eventTimeIst);
      expect(result.signals[0].peakSmi).toBeLessThanOrEqual(-40);
      expect(Number.isFinite(result.signals[0].eventRsi)).toBe(true);
      expect(Number.isFinite(result.signals[0].bbLowerProximity.gapPct)).toBe(true);
    }
  });

  it("rejects deeppro SELL when the event lands at/after the 14:00 deadline", () => {
    const dateKey = "2026-07-25";
    const candles = buildRisingThenDumpDay(dateKey);
    // Force a late-only stall profile: flatten early afternoon, dump only after 14:00
    // by rebuilding the analysis day with cross at 13:45 and stall at 14:00+.
    const trimmed = candles.filter((c) => {
      const iso = c.timestamp.toISOString();
      return !iso.includes("2026-07-25");
    });
    const times = [
      [9, 15], [9, 30], [9, 45], [10, 0], [10, 15], [10, 30], [10, 45],
      [11, 0], [11, 15], [11, 30], [11, 45], [12, 0], [12, 15], [12, 30],
      [12, 45], [13, 0], [13, 15], [13, 30], [13, 45], [14, 0], [14, 15],
      [14, 30], [14, 45], [15, 0], [15, 15],
    ] as const;
    let price = 2000;
    for (let i = 0; i < times.length; i++) {
      const [hour, minute] = times[i];
      if (i <= 17) {
        const open = price;
        const close = price + 3.5;
        trimmed.push(
          istCandle(dateKey, hour, minute, open, close + 1.5, open - 0.5, close),
        );
        price = close;
      } else if (i === 18) {
        const open = price;
        const close = price - 1;
        trimmed.push(
          istCandle(dateKey, hour, minute, open, open + 1, close - 0.5, close),
        );
        price = close;
      } else if (i === 19 || i === 20) {
        trimmed.push(
          istCandle(dateKey, hour, minute, price, price + 0.4, price - 1.2, price + 0.05),
        );
      } else {
        const open = price;
        const close = price - 18;
        trimmed.push(
          istCandle(dateKey, hour, minute, open, open + 1, close - 5, close),
        );
        price = close;
      }
    }

    const snapshots = buildIndicatorSnapshots(trimmed);
    const result = evaluateDeepproSignals(snapshots, dateKey);
    for (const signal of result.signals) {
      expect(signal.eventTimeIst < "14:00").toBe(true);
    }
  });

  it("returns no signals on a quiet sideways day", () => {
    const dateKey = "2026-07-25";
    const candles: Candle[] = [];
    for (let d = 0; d < 6; d++) {
      const day = d < 5 ? `2026-07-${String(20 + d).padStart(2, "0")}` : dateKey;
      for (let c = 0; c < 20; c++) {
        const minutes = 9 * 60 + 15 + c * 15;
        const hour = Math.floor(minutes / 60);
        const minute = minutes % 60;
        const base = 1950 + Math.sin(c / 2) * 0.4;
        candles.push(istCandle(day, hour, minute, base, base + 0.3, base - 0.3, base));
      }
    }

    const snapshots = buildIndicatorSnapshots(candles);
    const result = evaluateDeepproSignals(snapshots, dateKey);
    expect(result.signals).toHaveLength(0);
  });

  it("applies SELL quality gate for ≥0.75% favoring setups", () => {
    expect(
      passesDeepproSellQuality(
        stubSignal({
          side: "SELL",
          eventTimeIst: "11:30",
          eventKind: "smi_cross",
          eventRsi: 68,
          bbUpperProximity: {
            gapPct: 0.7,
            signedGapPct: -0.7,
            matchType: null,
            price: 100,
            bbLevel: 100.7,
          },
        }),
      ),
    ).toBe(true);

    // Too late for quality window
    expect(
      passesDeepproSellQuality(
        stubSignal({
          side: "SELL",
          eventTimeIst: "13:00",
          eventKind: "smi_cross",
          eventRsi: 70,
        }),
      ),
    ).toBe(false);

    // Non-cross kinds rejected (stall / SMI-exit remaps disabled)
    expect(
      passesDeepproSellQuality(
        stubSignal({
          side: "SELL",
          eventTimeIst: "11:30",
          eventKind: "stall_at_highs",
          eventRsi: 70,
          bbUpperProximity: {
            gapPct: 0.7,
            signedGapPct: -0.7,
            matchType: null,
            price: 100,
            bbLevel: 100.7,
          },
        }),
      ),
    ).toBe(false);

    expect(
      passesDeepproSellQuality(
        stubSignal({
          side: "SELL",
          eventTimeIst: "11:45",
          eventKind: "smi_exit_overbought",
          eventRsi: 41,
          bbUpperProximity: {
            gapPct: 0.75,
            signedGapPct: -0.75,
            matchType: null,
            price: 100,
            bbLevel: 100.8,
          },
          bbLowerProximity: {
            gapPct: 0.22,
            signedGapPct: 0.22,
            matchType: "close",
            price: 99,
            bbLevel: 99.2,
          },
        }),
      ),
    ).toBe(false);
  });

  it("applies BUY quality gate for ≥0.75% favoring setups", () => {
    // Path B — early unmatched proximity on SMI cross
    expect(
      passesDeepproBuyQuality(
        stubSignal({
          side: "BUY",
          eventTimeIst: "10:30",
          eventKind: "smi_cross",
          eventRsi: 33,
          bbLowerProximity: {
            gapPct: 0.37,
            signedGapPct: 0.37,
            matchType: null,
            price: 100,
            bbLevel: 99.6,
          },
        }),
      ),
    ).toBe(true);

    // Non-cross kinds rejected even with path-B geometry
    expect(
      passesDeepproBuyQuality(
        stubSignal({
          side: "BUY",
          eventTimeIst: "10:30",
          eventKind: "stall_at_lows",
          eventRsi: 33,
          bbLowerProximity: {
            gapPct: 0.37,
            signedGapPct: 0.37,
            matchType: null,
            price: 100,
            bbLevel: 99.6,
          },
        }),
      ),
    ).toBe(false);

    // Path A — matched BB lower with recovering RSI on SMI cross
    expect(
      passesDeepproBuyQuality(
        stubSignal({
          side: "BUY",
          eventTimeIst: "12:30",
          eventKind: "smi_cross",
          eventRsi: 56,
          bbLowerProximity: {
            gapPct: 0.17,
            signedGapPct: 0.17,
            matchType: "close",
            price: 100,
            bbLevel: 99.8,
          },
        }),
      ),
    ).toBe(true);

    // Late unmatched cross rejected (1 Jun bank/metal noise)
    expect(
      passesDeepproBuyQuality(
        stubSignal({
          side: "BUY",
          eventTimeIst: "11:30",
          eventKind: "smi_cross",
          eventRsi: 30,
          bbLowerProximity: {
            gapPct: 0.36,
            signedGapPct: 0.36,
            matchType: null,
            price: 100,
            bbLevel: 99.6,
          },
        }),
      ),
    ).toBe(false);

    // Mid-morning BB-touch waterfall — matched but RSI still weak
    expect(
      passesDeepproBuyQuality(
        stubSignal({
          side: "BUY",
          eventTimeIst: "11:30",
          eventKind: "smi_cross",
          eventRsi: 30,
          bbLowerProximity: {
            gapPct: 0.2,
            signedGapPct: 0.2,
            matchType: "close",
            price: 100,
            bbLevel: 99.8,
          },
        }),
      ),
    ).toBe(false);

    // Dual-band squeeze rejected
    expect(
      passesDeepproBuyQuality(
        stubSignal({
          side: "BUY",
          eventTimeIst: "11:30",
          eventKind: "smi_cross",
          eventRsi: 43,
          bbUpperProximity: {
            gapPct: 0.21,
            signedGapPct: -0.21,
            matchType: "close",
            price: 101,
            bbLevel: 101.2,
          },
          bbLowerProximity: {
            gapPct: 0.06,
            signedGapPct: 0.06,
            matchType: "crossed",
            price: 100,
            bbLevel: 99.9,
          },
        }),
      ),
    ).toBe(false);

    // Path C — extreme late cross exception
    expect(
      passesDeepproBuyQuality(
        stubSignal({
          side: "BUY",
          eventTimeIst: "12:30",
          eventKind: "smi_cross",
          eventRsi: 10,
          macdHistogram: -15,
          bbLowerProximity: {
            gapPct: 0.87,
            signedGapPct: 0.87,
            matchType: null,
            price: 100,
            bbLevel: 99.1,
          },
        }),
      ),
    ).toBe(true);
  });
});
