import { ConsoleNotifier } from "./alerts/notifier.js";
import { config } from "./config.js";
import { processLiveTradingCycle } from "./engine/liveTradingLoop.js";
import { runCycle } from "./engine/runCycle.js";
import { initializeSamcoSession } from "./samco/samcoSession.js";

const notifier = new ConsoleNotifier();

async function executeCycle(): Promise<void> {
  try {
    const cycle = await runCycle();
    await processLiveTradingCycle();

    if (!cycle.result) {
      console.log(
        `Waiting for enough history: ${cycle.candleCount}/${config.minCandlesRequired} candles`,
      );
      return;
    }

    await notifier.notify(cycle.result, { candleCount: cycle.candleCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Cycle failed: ${message}`);
  }
}

async function main(): Promise<void> {
  console.log(`Starting PNB 15m signal engine for ${config.symbol}`);
  await initializeSamcoSession();
  await executeCycle();

  setInterval(() => {
    void executeCycle();
  }, config.pollIntervalMs);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
