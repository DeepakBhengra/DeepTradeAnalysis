import type { ConfidenceResult, Decision } from "../types/dashboard";
import { formatIstDateTime } from "../utils/istTime";

interface SignalCardProps {
  decision: Decision;
  close: number | null;
  latestClosedAt: string | null;
  confidence: ConfidenceResult | null;
}

const decisionClass: Record<Decision, string> = {
  BUY: "text-kite-green",
  SELL: "text-kite-red",
  HOLD: "text-kite-amber",
};

const bandLabel: Record<ConfidenceResult["band"], string> = {
  strong: "Strong",
  moderate: "Moderate",
  weak: "Weak",
  avoid: "Avoid",
};

export function SignalCard({
  decision,
  close,
  latestClosedAt,
  confidence,
}: SignalCardProps) {
  return (
    <section className="grid grid-cols-1 gap-3 border border-kite-border bg-kite-surface p-3 sm:grid-cols-3">
      <div>
        <p className="m-0 text-[10px] uppercase tracking-wide text-kite-muted">Signal</p>
        <p className={`mt-0.5 mb-0 text-xl font-bold tabular-nums ${decisionClass[decision]}`}>
          {decision}
        </p>
        {confidence && (
          <p className="m-0 mt-0.5 text-xs text-kite-muted">
            {bandLabel[confidence.band]} · {confidence.score}%
          </p>
        )}
      </div>
      <div>
        <p className="m-0 text-[10px] uppercase tracking-wide text-kite-muted">Close</p>
        <p className="mt-0.5 mb-0 text-sm font-medium tabular-nums text-kite-text">
          {close != null ? close.toFixed(2) : "—"}
        </p>
      </div>
      <div>
        <p className="m-0 text-[10px] uppercase tracking-wide text-kite-muted">Last Candle</p>
        <p className="mt-0.5 mb-0 text-sm tabular-nums text-kite-text">
          {latestClosedAt ? formatIstDateTime(latestClosedAt) : "—"}
        </p>
      </div>
    </section>
  );
}
