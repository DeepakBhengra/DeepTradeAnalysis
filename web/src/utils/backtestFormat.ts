export function formatScenarioLabel(scenarioKey: string): string {
  return scenarioKey
    .replace(/^deepak-watch-party /, "")
    .replace(/^deepak-3 /, "")
    .replace(/^deepak-2 /, "")
    .replace(/^deepak /, "")
    .replace(/^deeppro1 /, "")
    .replace(/^deeppro /, "")
    .replace(/^rulePnb /, "")
    .replace(/^ruleSunpharma /, "")
    .replace(/^ruleLtm /, "")
    .replace(/^ruleIcicigi /, "")
    .replace(/^ruleTechm /, "")
    .replace(/^ruleTvsmotor /, "")
    .replace(/^rulePolicybzr /, "");
}

export function formatMetric(value: number | null, digits = 2): string {
  return value != null && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

export function formatDayScanStrategy(
  strategy:
    | "deepak"
    | "deepak-2"
    | "deepak-3"
    | "deepak-watch-party"
    | "deeppro"
    | "deeppro1"
    | "rulePnb"
    | "ruleSunpharma"
    | "ruleLtm"
    | "ruleIcicigi"
    | "ruleTechm"
    | "ruleTvsmotor"
    | "rulePolicybzr",
): string {
  switch (strategy) {
    case "deepak":
      return "Deepak";
    case "deepak-2":
      return "Deepak-2";
    case "deepak-3":
      return "Deepak-3";
    case "deepak-watch-party":
      return "Watch Party";
    case "deeppro":
      return "Deeppro";
    case "deeppro1":
      return "Deeppro1";
    case "rulePnb":
      return "RulePNB";
    case "ruleSunpharma":
      return "RuleSUNPHARMA";
    case "ruleLtm":
      return "RuleLTM";
    case "ruleIcicigi":
      return "RuleICICIGI";
    case "ruleTechm":
      return "RuleTECHM";
    case "ruleTvsmotor":
      return "RuleTVSMOTOR";
    case "rulePolicybzr":
      return "RulePOLICYBZR";
    default:
      return strategy;
  }
}

export function formatExitType(input: {
  exitTimeIst?: string | null;
  targetHit?: boolean;
  exitReason?:
    | "target"
    | "deepak2_stop"
    | "breakeven"
    | "flip"
    | "eod"
    | "stop_loss"
    | null;
  stopLossHit?: boolean;
}): string {
  if (input.exitReason === "stop_loss") {
    return "Stop-loss %";
  }
  if (input.exitReason === "deepak2_stop" || input.stopLossHit) {
    return "Stop Loss";
  }
  if (input.exitReason === "breakeven") {
    return "Breakeven";
  }
  if (input.exitReason === "flip") {
    return "Flip";
  }
  if (input.exitReason === "eod") {
    return "15:00 Exit";
  }
  if (input.exitReason === "target" || input.targetHit) {
    return "Target";
  }
  if (input.exitTimeIst) {
    return input.targetHit ? "Target" : "Stop Loss";
  }
  return "—";
}
