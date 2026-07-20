import { config } from "../config.js";

let runtimeLiveTradingEnabled = config.samco.liveTradingEnabled;

export function getSamcoLiveTradingEnabled(): boolean {
  return runtimeLiveTradingEnabled;
}

export function setSamcoLiveTradingEnabled(enabled: boolean): void {
  runtimeLiveTradingEnabled = enabled;
  process.env.SAMCO_LIVE_TRADING_ENABLED = enabled ? "true" : "false";
}

export function resetSamcoLiveTradingEnabled(): void {
  runtimeLiveTradingEnabled = config.samco.liveTradingEnabled;
}
