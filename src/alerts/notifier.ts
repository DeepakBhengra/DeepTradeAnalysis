import type { DecisionResult } from "../types.js";

export interface Notifier {
  notify(result: DecisionResult, meta: { candleCount: number }): Promise<void> | void;
}

export class ConsoleNotifier implements Notifier {
  private lastEmittedAt?: string;

  async notify(result: DecisionResult, meta: { candleCount: number }): Promise<void> {
    const timestamp = result.snapshot.timestamp.toISOString();
    const isNewCandle = this.lastEmittedAt !== timestamp;
    const latestSignal = result.deepak?.signals[result.deepak.signals.length - 1];

    const payload = {
      decision: result.decision,
      timestamp,
      close: result.snapshot.close,
      rsi: Number(result.snapshot.rsi.toFixed(2)),
      bollinger: {
        upper: Number(result.snapshot.bollinger.upper.toFixed(2)),
        middle: Number(result.snapshot.bollinger.middle.toFixed(2)),
        lower: Number(result.snapshot.bollinger.lower.toFixed(2)),
      },
      macd: {
        line: Number(result.snapshot.macd.macdLine.toFixed(4)),
        signal: Number(result.snapshot.macd.signalLine.toFixed(4)),
        histogram: Number(result.snapshot.macd.histogram.toFixed(4)),
      },
      deepak: result.deepak
        ? {
            activeScenario: result.deepak.activeScenario,
            scenarioTrail: result.deepak.scenarioTrail,
            signals: result.deepak.signals,
            latestSignal: latestSignal ?? null,
          }
        : null,
      reasons: result.reasons,
      candleCount: meta.candleCount,
      isNewCandle,
    };

    if (result.decision !== "HOLD") {
      console.log("\n=== PNB SIGNAL ===");
      console.log(JSON.stringify(payload, null, 2));
    } else if (isNewCandle) {
      console.log(
        `[${timestamp}] HOLD | close=${payload.close} rsi=${payload.rsi} candles=${meta.candleCount}`,
      );
    }

    this.lastEmittedAt = timestamp;
  }
}
