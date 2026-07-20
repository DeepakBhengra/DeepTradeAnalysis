import type { BbProximityReport } from "../types/dashboard";

interface BbProximityCardProps {
  bbProximity: BbProximityReport | null | undefined;
  analysisDate?: string | null;
}

function formatGap(match: BbProximityReport["topMatches"][number]): string {
  if (match.matchType === "crossed") {
    return `crossed by ${match.gapPct.toFixed(3)}%`;
  }
  return `gap ${match.gapPct.toFixed(3)}%`;
}

function MatchList({
  title,
  matches,
  priceLabel,
}: {
  title: string;
  matches: BbProximityReport["topMatches"];
  priceLabel: "High" | "Low";
}) {
  if (matches.length === 0) {
    return (
      <div>
        <p className="m-0 text-[10px] uppercase tracking-wide text-kite-muted">{title}</p>
        <p className="mt-1 mb-0 text-xs text-kite-muted">No matching 15m candles.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="m-0 text-[10px] uppercase tracking-wide text-kite-muted">{title}</p>
      <ul className="m-0 mt-1 list-none divide-y divide-kite-border p-0">
        {matches.map((match) => (
          <li key={`${title}-${match.timeIst}-${match.matchType}`} className="py-1.5">
            <p className="m-0 text-xs font-medium text-kite-text">
              {match.timeIst} IST
              <span
                className={`ml-1.5 rounded-sm px-1 py-0.5 text-[9px] font-semibold uppercase ${
                  match.candleColor === "green"
                    ? "bg-kite-green/10 text-kite-green"
                    : "bg-kite-red/10 text-kite-red"
                }`}
              >
                {match.candleColor}
              </span>
              <span
                className={`ml-1.5 rounded-sm px-1 py-0.5 text-[9px] font-semibold uppercase ${
                  match.matchType === "crossed"
                    ? "bg-kite-red/10 text-kite-red"
                    : "bg-kite-green/10 text-kite-green"
                }`}
              >
                {match.matchType}
              </span>
              {match.isSessionExtreme && (
                <span className="ml-1.5 rounded-sm bg-kite-surface px-1 py-0.5 text-[9px] font-semibold uppercase text-kite-muted">
                  Session {priceLabel.toLowerCase()}
                </span>
              )}
            </p>
            <p className="mt-0.5 mb-0 text-[10px] tabular-nums text-kite-muted">
              High {match.high.toFixed(2)} · BB Upper {match.bbUpper.toFixed(2)}
              {priceLabel === "High" && <> · {formatGap(match)}</>}
            </p>
            <p className="mt-0.5 mb-0 text-[10px] tabular-nums text-kite-muted">
              Low {match.low.toFixed(2)} · BB Lower {match.bbLower.toFixed(2)}
              {priceLabel === "Low" && <> · {formatGap(match)}</>}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BbProximityCard({ bbProximity, analysisDate }: BbProximityCardProps) {
  if (!bbProximity) {
    return (
      <section className="border border-kite-border bg-kite-surface p-3">
        <h2 className="m-0 mb-2 text-xs font-medium uppercase tracking-wide text-kite-muted">
          BB Proximity (15m IST)
        </h2>
        <p className="m-0 text-xs text-kite-muted">
          {analysisDate
            ? `No usable 15m candles for ${analysisDate} (09:15–15:30 IST).`
            : "BB proximity scan unavailable."}
        </p>
      </section>
    );
  }

  const crossedTop = bbProximity.topMatches.filter((m) => m.matchType === "crossed").length;
  const crossedBottom = bbProximity.bottomMatches.filter(
    (m) => m.matchType === "crossed",
  ).length;

  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <h2 className="m-0 mb-2 text-xs font-medium uppercase tracking-wide text-kite-muted">
        BB Proximity (15m IST)
      </h2>
      <p className="mb-3 text-[10px] leading-snug text-kite-muted">
        {bbProximity.dateKey} · BB(20,2) close (≤ {bbProximity.thresholdPct}%) or crossed by
        candle high/low · {crossedTop} upper cross(es), {crossedBottom} lower cross(es)
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MatchList
          title="BB upper close to or crossed by candle high"
          matches={bbProximity.topMatches}
          priceLabel="High"
        />
        <MatchList
          title="BB lower close to or crossed by candle low"
          matches={bbProximity.bottomMatches}
          priceLabel="Low"
        />
      </div>
    </section>
  );
}
