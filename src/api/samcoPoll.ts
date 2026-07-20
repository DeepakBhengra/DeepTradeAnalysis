import { config } from "../config.js";
import { processLiveTradingCycle } from "../engine/liveTradingLoop.js";
import { getSamcoLiveTradingEnabled } from "../samco/samcoLiveTrading.js";
import { getSamcoDryRun } from "../samco/samcoRuntimeSettings.js";

export async function runSamcoTradingPoll(): Promise<void> {
  const dryRun = getSamcoDryRun();
  const liveEnabled = getSamcoLiveTradingEnabled();
  if (!dryRun && !liveEnabled) {
    return;
  }

  await processLiveTradingCycle();
}

let pollTimer: ReturnType<typeof setInterval> | undefined;

export function startSamcoTradingPoll(): void {
  if (pollTimer) {
    return;
  }

  void runSamcoTradingPoll().catch((error) => {
    console.error("Samco trading poll failed:", error);
  });

  pollTimer = setInterval(() => {
    void runSamcoTradingPoll().catch((error) => {
      console.error("Samco trading poll failed:", error);
    });
  }, config.pollIntervalMs);
}

export function stopSamcoTradingPoll(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
}
