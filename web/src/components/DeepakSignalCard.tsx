import type { DeepakDecisionResult, Decision } from "../types/dashboard";

interface DeepakSignalCardProps {
  deepakDecision: DeepakDecisionResult | null;
  decision: Decision;
  title?: string;
}

const decisionClass: Record<Decision, string> = {
  BUY: "text-kite-green",
  SELL: "text-kite-red",
  HOLD: "text-kite-amber",
};

export function DeepakSignalCard({
  deepakDecision,
  decision,
  title = "Deepak",
}: DeepakSignalCardProps) {
  if (!deepakDecision) {
    return (
      <section className="border border-kite-border bg-kite-surface p-3">
        <p className="m-0 text-[10px] uppercase tracking-wide text-kite-muted">
          {title} Scenarios
        </p>
        <p className="mt-1 mb-0 text-xs text-kite-muted">
          No session data for {title} scenario analysis.
        </p>
      </section>
    );
  }

  const { activeScenario, scenarioTrail, signals } = deepakDecision;

  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="m-0 text-[10px] uppercase tracking-wide text-kite-muted">
            {title} Signal
          </p>
          <p className={`mt-0.5 mb-0 text-xl font-bold tabular-nums ${decisionClass[decision]}`}>
            {decision}
          </p>
        </div>
        {activeScenario && (
          <p className="m-0 max-w-md text-right text-xs text-kite-muted">
            Active: <span className="text-kite-text">{activeScenario}</span>
          </p>
        )}
      </div>

      {scenarioTrail.length > 0 && (
        <div className="mb-3">
          <p className="m-0 text-[10px] uppercase tracking-wide text-kite-muted">
            Scenario trail
          </p>
          <ul className="m-0 mt-1 list-none space-y-1 p-0 text-xs text-kite-text">
            {scenarioTrail.map((event) => (
              <li key={`${event.scenarioKey}-${event.timeIst}`}>
                {event.timeIst} · {event.scenarioKey}
                {event.bbMatchType ? ` (${event.bbMatchType})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {signals.length > 0 ? (
        <div>
          <p className="m-0 text-[10px] uppercase tracking-wide text-kite-muted">
            Entry / exit signals
          </p>
          <ul className="m-0 mt-1 list-none space-y-2 p-0 text-xs">
            {signals.map((signal) => (
              <li
                key={`${signal.scenarioKey}-${signal.timeIst}-${signal.scenarioNumber}`}
                className="rounded-sm border border-kite-border px-2 py-1.5"
              >
                <p className={`m-0 font-medium ${decisionClass[signal.side]}`}>
                  {signal.side} scenario {signal.scenarioNumber}
                </p>
                <p className="m-0 mt-0.5 text-kite-text">
                  {signal.scenarioKey}
                </p>
                <p className="m-0 mt-0.5 tabular-nums text-kite-muted">
                  Entry {signal.timeIst} IST @ mid {signal.price.toFixed(2)} (
                  {signal.bbMatchType}) · target {signal.profitTarget.toFixed(2)}
                </p>
                {signal.exit?.targetHit ? (
                  <p className="m-0 mt-0.5 tabular-nums text-kite-green">
                    Exit {signal.exit.timeIst} IST @ mid {signal.exit.price.toFixed(2)}{" "}
                    (profit {signal.exit.profit?.toFixed(2)})
                  </p>
                ) : (
                  <p className="m-0 mt-0.5 text-kite-muted">Exit pending</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="m-0 text-xs text-kite-muted">No buy/sell entry signals today.</p>
      )}
    </section>
  );
}
