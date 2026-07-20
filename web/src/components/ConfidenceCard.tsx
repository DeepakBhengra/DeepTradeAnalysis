import type { ConfidenceResult } from "../types/dashboard";

interface ConfidenceCardProps {
  confidence: ConfidenceResult | null;
}

const bandClass: Record<ConfidenceResult["band"], string> = {
  strong: "text-kite-green",
  moderate: "text-kite-amber",
  weak: "text-orange-600",
  avoid: "text-kite-red",
};

const bandLabel: Record<ConfidenceResult["band"], string> = {
  strong: "Strong",
  moderate: "Moderate",
  weak: "Weak",
  avoid: "Avoid",
};

function ScoreBar({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[10px] text-kite-muted">
        <span>{label}</span>
        <span className="tabular-nums">{score}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-kite-surface">
        <div
          className={`h-full rounded-sm ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}

export function ConfidenceCard({ confidence }: ConfidenceCardProps) {
  if (!confidence) {
    return (
      <section className="border border-kite-border bg-kite-surface p-3">
        <h2 className="m-0 mb-2 text-xs font-medium uppercase tracking-wide text-kite-muted">
          Confidence Score
        </h2>
        <p className="m-0 text-xs text-kite-muted">Insufficient volume data.</p>
      </section>
    );
  }

  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h2 className="m-0 text-xs font-medium uppercase tracking-wide text-kite-muted">
            Confidence Score
          </h2>
          <p className={`m-0 mt-1 text-2xl font-bold tabular-nums ${bandClass[confidence.band]}`}>
            {confidence.score}%
          </p>
        </div>
        <span
          className={`rounded-sm border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${bandClass[confidence.band]} border-current/20`}
        >
          {bandLabel[confidence.band]}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <ScoreBar
          label="Technical (BB/RSI/MACD)"
          score={confidence.technicalScore}
          color="bg-[#7E57C2]"
        />
        <ScoreBar
          label="Candle Volume"
          score={confidence.volumeScore}
          color="bg-[#42A5F5]"
        />
        <ScoreBar
          label="Order Book Depth"
          score={confidence.depthScore}
          color="bg-[#FF9800]"
        />
      </div>
    </section>
  );
}
