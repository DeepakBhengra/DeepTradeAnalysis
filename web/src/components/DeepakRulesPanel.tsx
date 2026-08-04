import { useState } from "react";

const TRADE_SCENARIOS = [
  { label: "strong direction switch - up", side: "BUY" as const, number: 1 },
  { label: "continue upward direction - 3", side: "BUY" as const, number: 2 },
  { label: "continue upward direction - 4", side: "BUY" as const, number: 3 },
  { label: "continue upward direction - 2", side: "BUY" as const, number: 4 },
  { label: "strong direction switch - down", side: "SELL" as const, number: 1 },
  { label: "continue downward direction - 3", side: "SELL" as const, number: 2 },
  { label: "continue downward direction - 4", side: "SELL" as const, number: 3 },
  { label: "continue downward direction - 2", side: "SELL" as const, number: 4 },
];

const DEEPAK3_SCENARIOS = TRADE_SCENARIOS.filter((scenario) => scenario.number === 4);

const DEEPAK3_GATES = [
  "G1: All 4 anchor candles must cross the dominant BB band",
  "G2: Only continue upward/downward direction - 2 (scenario 4)",
  "G3: Entry candle range must be ≥ profit target",
  "G4: ≥ 3 stocks in the same sector with the same side (batch scan)",
];

const DEEPAK_MORNING_RULES = [
  "Setup window 09:15–10:15 IST (5 candles)",
  "BUY (LBSR): 09:15 crosses BB lower, base holds, RSI recovers (≤40→<50), last 2 green",
  "BUY entry 10:30: green candle close above BB middle",
  "SELL (UBRR): 09:15 crosses BB upper, no new high, RSI peaks ≥65 then rolls over, 10:15 red",
  "SELL entry 10:30: red candle close below BB middle",
  "Morning BUY suppresses legacy SELL (and vice versa)",
];

const DEEPAK_DUAL_BAND_RULES = [
  "If ≥2 consecutive candles are both BB-upper and BB-lower active, defer early continue-2 BUY/SELL (~10:15)",
  "After 10:15 IST, wait for 3 consecutive exclusive upper-only → BUY (scenario 6) on the 3rd candle",
  "Or 3 consecutive exclusive lower-only → SELL (scenario 6) on the 3rd candle",
  "Both-band / neither-band candles reset the exclusive streak; first tip wins",
];

const DEEPAK_RSI_EXTREME_RULES = [
  "CONTINUE_DOWN_2 SELL at ~10:15 with RSI ≤ 40 → suppress SELL; wait for recovery BUY",
  "Recovery BUY: 3 consecutive higher closes with rising RSI (each ≥ 40), tip by 12:00 IST (scenario 7)",
  "CONTINUE_UP_2 BUY at ~10:15 with RSI ≥ 60 → suppress BUY; wait for recovery SELL",
  "Recovery SELL: 3 consecutive lower closes with falling RSI (each ≤ 60), tip by 12:00 IST (scenario 7)",
];

const DEEPPRO_RULES = [
  "Stch Mtm SMI↔signal cross/touch (BUY from oversold / SELL from overbought)",
  "Require peak SMI ≥ 70 (SELL) or trough SMI ≤ -70 (BUY) in lookback",
  "Tag matching Bollinger Band in the same lookback window",
  "MACD histogram must fade on the cross candle (price-normalized Δ)",
  "Event candle must be before 14:00 IST (late entries filtered)",
];

const DEEPPRO_SCENARIOS = [
  { label: "smi cross", side: "BUY" as const, number: 1 },
  { label: "stall at highs / lows", side: "SELL" as const, number: 2 },
  { label: "smi exit overbought / oversold", side: "BUY" as const, number: 3 },
  { label: "macd bear / bull cross", side: "SELL" as const, number: 4 },
];

const CASCADE_PATTERN_RULES = [
  "BUY guards: require SMI rising + MACD hist rising + next mid higher; skip if open drawdown < −0.8%",
  "SELL cascade: same oversold levels as BUY quality but SMI+MACD still falling and next mid lower → short on confirm bar",
  "SELL guards: require SMI falling + MACD hist falling + next mid lower; skip if open rally > 0.8%",
  "BUY cascade: same overbought levels as SELL quality but SMI+MACD still rising and next mid higher → long on confirm bar",
];

const RULEPNB_RULES = [
  "PNB stock only — never evaluates other symbols; separate from Deepak / Deeppro",
  "BUY quality (1.7%–0.9%): RSI 25–50, SMI ≤ −40, near BB lower (gap ≤ 0.7% or crossed/close)",
  ...CASCADE_PATTERN_RULES,
  "SELL quality (1.7%–0.9% / 0.8%–0.4%): RSI 50–70, SMI ≥ 40, near BB upper (gap ≤ 0.8% or crossed/close)",
  "BUY extended (3%–1.8% movers): prefer negative SMI; RSI mixed; BB lower gaps can be wider (≤ 1.4%)",
  "Entry price = candle mid (high+low)/2; setup candle before 14:00 IST",
  "One earliest BUY and one earliest SELL per day (BUY prefers quality > extended > cascade; SELL prefers quality over cascade)",
];

const RULEPNB_SCENARIOS = [
  { label: "buy quality", side: "BUY" as const, number: 1 },
  { label: "sell quality", side: "SELL" as const, number: 1 },
  { label: "buy extended", side: "BUY" as const, number: 2 },
  { label: "sell cascade", side: "SELL" as const, number: 2 },
  { label: "buy cascade", side: "BUY" as const, number: 3 },
];

const RULESUNPHARMA_RULES = [
  "SUNPHARMA stock only — never evaluates other symbols; separate from Deepak / Deeppro / RulePNB",
  "BUY quality (1.7%–0.9%): RSI 33–56, SMI ≤ −40, near BB lower (gap ≤ 0.5% or crossed/close)",
  ...CASCADE_PATTERN_RULES,
  "SELL quality (0.8%–0.4% / mid): RSI 56–72, SMI ≥ 40, tight BB upper (gap ≤ 0.3% or crossed/close)",
  "BUY extended (3%–1.8% movers): less oversold than mid bucket; mid-zone SMI OK (≤ 40); still near BB lower (gap ≤ 0.5%)",
  "Entry price = candle mid (high+low)/2; setup candle before 14:00 IST",
  "One earliest BUY and one earliest SELL per day (BUY prefers quality > extended > cascade; SELL prefers quality over cascade)",
];

const RULESUNPHARMA_SCENARIOS = [
  { label: "buy quality", side: "BUY" as const, number: 1 },
  { label: "sell quality", side: "SELL" as const, number: 1 },
  { label: "buy extended", side: "BUY" as const, number: 2 },
  { label: "sell cascade", side: "SELL" as const, number: 2 },
  { label: "buy cascade", side: "BUY" as const, number: 3 },
];

const FAVOURABLE_SYMBOL_SCENARIOS = [
  { label: "buy quality", side: "BUY" as const, number: 1 },
  { label: "sell quality", side: "SELL" as const, number: 1 },
  { label: "buy extended", side: "BUY" as const, number: 2 },
  { label: "sell cascade", side: "SELL" as const, number: 2 },
  { label: "buy cascade", side: "BUY" as const, number: 3 },
];

type RulesPanelVariant =
  | "deepak"
  | "deepak2"
  | "deepak3"
  | "deeppro"
  | "rulePnb"
  | "ruleSunpharma"
  | "ruleLtm"
  | "ruleIcicigi"
  | "ruleTechm"
  | "ruleTvsmotor"
  | "rulePolicybzr";

const FAVOURABLE_SYMBOL_PANEL: Record<
  "ruleLtm" | "ruleIcicigi" | "ruleTechm" | "ruleTvsmotor" | "rulePolicybzr",
  { title: string; blurb: string; rules: string[] }
> = {
  ruleLtm: {
    title: "RuleLTM Buy / Sell Rules",
    blurb:
      "LTM-only rule · favourable profit-range RSI / Stch Mtm / BB proximity · BUY turn guards + SELL cascade · day scan evaluates LTM only.",
    rules: [
      "LTM stock only — never evaluates other symbols; separate from Deepak / Deeppro",
      "BUY quality: RSI 30–55, SMI ≤ −40, near BB lower (gap ≤ 0.8% or crossed/close)",
      ...CASCADE_PATTERN_RULES,
      "SELL quality: RSI 50–75, SMI ≥ 40, near BB upper (gap ≤ 0.8% or crossed/close)",
      "BUY extended: mid-zone SMI OK (≤ 40); still near BB lower (gap ≤ 1.5%)",
      "Entry price = candle mid (high+low)/2; setup candle before 14:00 IST",
      "One earliest BUY and one earliest SELL per day (BUY prefers quality over extended; SELL prefers quality over cascade)",
    ],
  },
  ruleIcicigi: {
    title: "RuleICICIGI Buy / Sell Rules",
    blurb:
      "ICICIGI-only rule · favourable profit-range RSI / Stch Mtm / BB proximity · BUY turn guards + SELL cascade · day scan evaluates ICICIGI only.",
    rules: [
      "ICICIGI stock only — never evaluates other symbols; separate from Deepak / Deeppro",
      "BUY quality: RSI 30–50, SMI ≤ −40, near BB lower (gap ≤ 0.7% or crossed/close)",
      ...CASCADE_PATTERN_RULES,
      "SELL quality: RSI 45–75, SMI ≥ 20, near BB upper (gap ≤ 1.0% or crossed/close)",
      "BUY extended: prefer negative SMI; BB lower gaps can be wider (≤ 1.0%)",
      "Entry price = candle mid (high+low)/2; setup candle before 14:00 IST",
      "One earliest BUY and one earliest SELL per day (BUY prefers quality over extended; SELL prefers quality over cascade)",
    ],
  },
  ruleTechm: {
    title: "RuleTECHM Buy / Sell Rules",
    blurb:
      "TECHM-only rule · favourable profit-range RSI / Stch Mtm / BB proximity · BUY turn guards + SELL cascade · day scan evaluates TECHM only.",
    rules: [
      "TECHM stock only — never evaluates other symbols; separate from Deepak / Deeppro",
      "BUY quality: RSI 20–45, SMI ≤ −40, near BB lower (gap ≤ 0.7% or crossed/close)",
      ...CASCADE_PATTERN_RULES,
      "SELL quality: RSI 50–80, SMI ≥ 40, near BB upper (gap ≤ 1.0% or crossed/close)",
      "BUY extended: mid-zone SMI OK (≤ 40); BB lower gaps can be wider (≤ 2.2%)",
      "Entry price = candle mid (high+low)/2; setup candle before 14:00 IST",
      "One earliest BUY and one earliest SELL per day (BUY prefers quality over extended; SELL prefers quality over cascade)",
    ],
  },
  ruleTvsmotor: {
    title: "RuleTVSMOTOR Buy / Sell Rules",
    blurb:
      "TVSMOTOR-only rule · favourable profit-range RSI / Stch Mtm / BB proximity · BUY turn guards + SELL cascade · day scan evaluates TVSMOTOR only.",
    rules: [
      "TVSMOTOR stock only — never evaluates other symbols; separate from Deepak / Deeppro",
      "BUY quality: RSI 30–55, SMI ≤ −30, near BB lower (gap ≤ 0.6% or crossed/close)",
      ...CASCADE_PATTERN_RULES,
      "SELL quality: RSI 55–75, SMI ≥ 40, near BB upper (gap ≤ 0.7% or crossed/close)",
      "BUY extended: mid-zone SMI OK (≤ 40); BB lower gaps can be wider (≤ 1.4%)",
      "Entry price = candle mid (high+low)/2; setup candle before 14:00 IST",
      "One earliest BUY and one earliest SELL per day (BUY prefers quality over extended; SELL prefers quality over cascade)",
    ],
  },
  rulePolicybzr: {
    title: "RulePOLICYBZR Buy / Sell Rules",
    blurb:
      "POLICYBZR-only rule · favourable profit-range RSI / Stch Mtm / BB proximity · BUY turn guards + SELL cascade · day scan evaluates POLICYBZR only.",
    rules: [
      "POLICYBZR stock only — never evaluates other symbols; separate from Deepak / Deeppro",
      "BUY quality: RSI 25–55, SMI ≤ −25, near BB lower (gap ≤ 1.0% or crossed/close)",
      ...CASCADE_PATTERN_RULES,
      "SELL quality: RSI 55–85, SMI ≥ 60, near BB upper (gap ≤ 0.7% or crossed/close)",
      "BUY extended: mid SMI ≤ 40; BB lower gaps can be wider (≤ 1.6%)",
      "Entry price = candle mid (high+low)/2; setup candle before 14:00 IST",
      "One earliest BUY and one earliest SELL per day (BUY prefers quality over extended; SELL prefers quality over cascade)",
    ],
  },
};

function isFavourablePanelVariant(
  variant: RulesPanelVariant,
): variant is keyof typeof FAVOURABLE_SYMBOL_PANEL {
  return variant in FAVOURABLE_SYMBOL_PANEL;
}

export function DeepakRulesPanel({
  variant = "deepak",
}: {
  variant?: RulesPanelVariant;
}) {
  const [expanded, setExpanded] = useState(false);
  const sessionLabel =
    variant === "deepak2"
      ? "Session 10:15–15:30 IST"
      : "Session 09:15–15:30 IST";
  const favourablePanel = isFavourablePanelVariant(variant)
    ? FAVOURABLE_SYMBOL_PANEL[variant]
    : null;
  const titleLabel =
    variant === "deepak3"
      ? "Deepak-3 Buy / Sell Rules"
      : variant === "deepak2"
        ? "Deepak-2 Buy / Sell Rules"
        : variant === "deeppro"
          ? "Deeppro Buy / Sell Rules"
          : variant === "rulePnb"
            ? "RulePNB Buy / Sell Rules"
            : variant === "ruleSunpharma"
              ? "RuleSUNPHARMA Buy / Sell Rules"
              : favourablePanel
                ? favourablePanel.title
                : "Deepak Buy / Sell Rules";
  const scenarios =
    variant === "deepak3"
      ? DEEPAK3_SCENARIOS
      : variant === "deeppro"
        ? DEEPPRO_SCENARIOS
        : variant === "rulePnb"
          ? RULEPNB_SCENARIOS
          : variant === "ruleSunpharma"
            ? RULESUNPHARMA_SCENARIOS
            : favourablePanel
              ? FAVOURABLE_SYMBOL_SCENARIOS
              : TRADE_SCENARIOS;

  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent p-0 text-left"
      >
        <h2 className="m-0 text-xs font-medium uppercase tracking-wide text-kite-muted">
          {titleLabel}
        </h2>
        <span className="text-xs text-kite-muted">{expanded ? "Hide" : "Show"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 text-xs text-kite-text">
          <p className="m-0 text-kite-muted">
            {variant === "deeppro"
              ? `${sessionLabel} · Stch Mtm exhaustion reversal (pink-circle) · separate from Deepak scenario trails · day scan lists entry signals in the standard results table.`
              : variant === "rulePnb"
                ? `${sessionLabel} · PNB-only rule · favourable profit-range RSI / Stch Mtm / BB proximity gates · not mixed with Deepak or Deeppro · day scan evaluates PNB only.`
                : variant === "ruleSunpharma"
                  ? `${sessionLabel} · SUNPHARMA-only rule · favourable profit-range RSI / Stch Mtm / BB proximity gates · not mixed with Deepak, Deeppro, or RulePNB · day scan evaluates SUNPHARMA only.`
                  : favourablePanel
                    ? `${sessionLabel} · ${favourablePanel.blurb}`
                    : `${sessionLabel} · 4-candle initial BB run from session open · adaptive exit target from average of last 20 trading-day ranges · exit when candle mid reaches entry ± target.`}
          </p>
          {variant === "deeppro" && (
            <ul className="m-0 list-inside list-disc space-y-1 text-kite-muted">
              {DEEPPRO_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          )}
          {variant === "rulePnb" && (
            <ul className="m-0 list-inside list-disc space-y-1 text-kite-muted">
              {RULEPNB_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          )}
          {variant === "ruleSunpharma" && (
            <ul className="m-0 list-inside list-disc space-y-1 text-kite-muted">
              {RULESUNPHARMA_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          )}
          {favourablePanel && (
            <ul className="m-0 list-inside list-disc space-y-1 text-kite-muted">
              {favourablePanel.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          )}
          {variant === "deepak3" && (
            <ul className="m-0 list-inside list-disc space-y-1 text-kite-muted">
              {DEEPAK3_GATES.map((gate) => (
                <li key={gate}>{gate}</li>
              ))}
            </ul>
          )}
          {variant === "deepak" && (
            <div className="space-y-2">
              <p className="m-0 font-medium text-kite-text">Morning rules add-on (09:15–10:30)</p>
              <ul className="m-0 list-inside list-disc space-y-1 text-kite-muted">
                {DEEPAK_MORNING_RULES.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
              <table className="w-full min-w-[420px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-kite-border text-left text-kite-muted">
                    <th className="px-2 py-1.5 font-medium">Scenario</th>
                    <th className="px-2 py-1.5 font-medium">Side</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-kite-border/50">
                    <td className="px-2 py-1.5">morning buy</td>
                    <td className="px-2 py-1.5 font-medium text-kite-green">BUY 5</td>
                  </tr>
                  <tr className="border-b border-kite-border/50">
                    <td className="px-2 py-1.5">morning sell</td>
                    <td className="px-2 py-1.5 font-medium text-kite-red">SELL 5</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {variant === "deepak" && (
            <div className="space-y-2">
              <p className="m-0 font-medium text-kite-text">Dual-band deferral (scenario 6)</p>
              <ul className="m-0 list-inside list-disc space-y-1 text-kite-muted">
                {DEEPAK_DUAL_BAND_RULES.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
              <table className="w-full min-w-[420px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-kite-border text-left text-kite-muted">
                    <th className="px-2 py-1.5 font-medium">Scenario</th>
                    <th className="px-2 py-1.5 font-medium">Side</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-kite-border/50">
                    <td className="px-2 py-1.5">deferred upper resolve - 3</td>
                    <td className="px-2 py-1.5 font-medium text-kite-green">BUY 6</td>
                  </tr>
                  <tr className="border-b border-kite-border/50">
                    <td className="px-2 py-1.5">deferred lower resolve - 3</td>
                    <td className="px-2 py-1.5 font-medium text-kite-red">SELL 6</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {variant === "deepak" && (
            <div className="space-y-2">
              <p className="m-0 font-medium text-kite-text">RSI extreme continue-2 deferral (scenario 7)</p>
              <ul className="m-0 list-inside list-disc space-y-1 text-kite-muted">
                {DEEPAK_RSI_EXTREME_RULES.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
              <table className="w-full min-w-[420px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-kite-border text-left text-kite-muted">
                    <th className="px-2 py-1.5 font-medium">Scenario</th>
                    <th className="px-2 py-1.5 font-medium">Side</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-kite-border/50">
                    <td className="px-2 py-1.5">oversold recovery buy</td>
                    <td className="px-2 py-1.5 font-medium text-kite-green">BUY 7</td>
                  </tr>
                  <tr className="border-b border-kite-border/50">
                    <td className="px-2 py-1.5">overbought recovery sell</td>
                    <td className="px-2 py-1.5 font-medium text-kite-red">SELL 7</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-kite-border text-left text-kite-muted">
                  <th className="px-2 py-1.5 font-medium">Scenario</th>
                  <th className="px-2 py-1.5 font-medium">Side</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((scenario) => (
                  <tr key={scenario.label} className="border-b border-kite-border/50">
                    <td className="px-2 py-1.5">{scenario.label}</td>
                    <td
                      className={`px-2 py-1.5 font-medium ${
                        scenario.side === "BUY" ? "text-kite-green" : "text-kite-red"
                      }`}
                    >
                      {scenario.side} {scenario.number}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
