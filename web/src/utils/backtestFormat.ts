export function formatScenarioLabel(scenarioKey: string): string {
  return scenarioKey
    .replace(/^deepak-watch-party /, "")
    .replace(/^deepak-3 /, "")
    .replace(/^deepak-2 /, "")
    .replace(/^deepak /, "")
    .replace(/^deeppro /, "");
}

export function formatMetric(value: number | null, digits = 2): string {
  return value != null && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

export function formatDayScanStrategy(
  strategy: "deepak" | "deepak-2" | "deepak-watch-party",
): string {
  if (strategy === "deepak") {
    return "Deepak";
  }
  if (strategy === "deepak-2") {
    return "Deepak-2";
  }
  return "Watch Party";
}

export function formatExitType(input: {
  exitTimeIst?: string | null;
  targetHit?: boolean;
  exitReason?: "target" | "deepak2_stop" | null;
  stopLossHit?: boolean;
}): string {
  if (input.exitReason === "deepak2_stop" || input.stopLossHit) {
    return "Stop Loss";
  }
  if (input.exitReason === "target" || input.targetHit) {
    return "Target";
  }
  if (input.exitTimeIst) {
    return input.targetHit ? "Target" : "Stop Loss";
  }
  return "—";
}
