import type { ParameterCheckCandleRef, SidewaysDebug, SidewaysTrendState } from "../types/dashboard";

interface SidewaysTrendCardProps {
  sidewaysTrend: SidewaysTrendState | null | undefined;
  sidewaysDebug?: SidewaysDebug | null;
  candleCount: number;
  analysisDate?: string | null;
  mode?: "live" | "historical";
}

function ParameterCheckCandleLine({ candleRef }: { candleRef: ParameterCheckCandleRef }) {
  return (
    <p className="mt-0.5 mb-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] tabular-nums text-kite-text">
      <span className="font-medium">{candleRef.timeIst} IST</span>
      <span
        className={`rounded-sm px-1 py-0.5 text-[9px] font-semibold uppercase ${
          candleRef.candleColor === "green"
            ? "bg-kite-green/10 text-kite-green"
            : "bg-kite-red/10 text-kite-red"
        }`}
      >
        {candleRef.candleColor}
      </span>
      <span className="text-kite-muted">·</span>
      <span>
        High <span className="font-medium text-kite-green">{candleRef.high.toFixed(2)}</span>
      </span>
      <span className="text-kite-muted">·</span>
      <span>
        Low <span className="font-medium text-kite-red">{candleRef.low.toFixed(2)}</span>
      </span>
    </p>
  );
}

function unavailableMessage(
  candleCount: number,
  analysisDate?: string | null,
  mode?: "live" | "historical",
  sidewaysDebug?: SidewaysDebug | null,
): string {
  if (candleCount === 0) {
    return analysisDate
      ? `No candle data found for ${analysisDate}.`
      : "No candle data available yet.";
  }

  const isHistorical = mode === "historical" || analysisDate != null;

  if (isHistorical && analysisDate) {
    if (sidewaysDebug) {
      const { rawSessionCount, usableSessionCount } = sidewaysDebug;
      if (rawSessionCount === 0) {
        return `No session candles found for ${analysisDate} between 9:15 AM and 12:00 PM IST.`;
      }
      if (usableSessionCount < 3) {
        return `Only ${usableSessionCount} usable sideways session candle(s) for ${analysisDate} (raw: ${rawSessionCount}). Need at least 3 with valid BB/RSI/MACD between 9:15 AM and 12:00 PM IST.`;
      }
    }
    return `No usable sideways session candles for ${analysisDate} between 9:15 AM and 12:00 PM IST.`;
  }

  if (sidewaysDebug && sidewaysDebug.usableSessionCount > 0 && sidewaysDebug.usableSessionCount < 3) {
    return `Sideways session in progress — ${sidewaysDebug.usableSessionCount} of 3 required candles available (9:15 AM – 12:00 PM IST).`;
  }

  return "Sideways session data unavailable — need at least 3 candles between 9:15 AM and 12:00 PM IST.";
}

export function SidewaysTrendCard({
  sidewaysTrend,
  sidewaysDebug,
  candleCount,
  analysisDate,
  mode,
}: SidewaysTrendCardProps) {
  const effectiveMode = mode ?? (analysisDate != null ? "historical" : "live");

  if (!sidewaysTrend) {
    return (
      <section className="border border-kite-border bg-kite-surface p-3">
        <h2 className="m-0 mb-2 text-xs font-medium uppercase tracking-wide text-kite-muted">
          Sideways Trend (9:15 AM – 12:00 PM IST)
        </h2>
        <p className="m-0 text-xs text-kite-muted">
          {unavailableMessage(candleCount, analysisDate, effectiveMode, sidewaysDebug)}
        </p>
        {sidewaysDebug && (
          <p className="mt-2 mb-0 text-[10px] leading-snug text-kite-muted">
            Debug · target {sidewaysDebug.targetDateKey ?? "—"} · raw session{" "}
            {sidewaysDebug.rawSessionCount} · usable session {sidewaysDebug.usableSessionCount}
          </p>
        )}
      </section>
    );
  }

  const params = sidewaysTrend.parameters;

  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <h2 className="m-0 mb-2 text-xs font-medium uppercase tracking-wide text-kite-muted">
        Sideways Trend (9:15 AM – 12:00 PM IST)
      </h2>
      {params && (
        <p className="mb-2 text-[10px] leading-snug text-kite-muted">
          {effectiveMode === "historical" ? "Historical" : "Live"} · Session{" "}
          {sidewaysTrend.sessionDate ?? analysisDate} · {params.sessionWindow.start}–
          {params.sessionWindow.end} · {params.candleCountInWindow} candles · BB(
          {params.bollinger.length},{params.bollinger.stdDev}) · RSI({params.rsi.period}) · MACD(
          {params.macd.fastPeriod},{params.macd.slowPeriod},{params.macd.signalPeriod})
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <p className="m-0 text-[10px] uppercase tracking-wide text-kite-muted">Trend Status</p>
          <p
            className={`mt-0.5 mb-0 text-sm font-bold ${
              sidewaysTrend.isSidewaysTrend ? "text-kite-green" : "text-kite-muted"
            }`}
          >
            {sidewaysTrend.isSidewaysTrend ? "Sideways" : "Not sideways"}
          </p>
        </div>
        <div>
          <p className="m-0 text-[10px] uppercase tracking-wide text-kite-muted">BB Top Range</p>
          <p className="mt-0.5 mb-0 text-sm tabular-nums text-kite-text">
            {sidewaysTrend.bbTopRange != null ? sidewaysTrend.bbTopRange.toFixed(2) : "—"}
          </p>
        </div>
        <div>
          <p className="m-0 text-[10px] uppercase tracking-wide text-kite-muted">BB Bottom Range</p>
          <p className="mt-0.5 mb-0 text-sm tabular-nums text-kite-text">
            {sidewaysTrend.bbBottomRange != null
              ? sidewaysTrend.bbBottomRange.toFixed(2)
              : "—"}
          </p>
        </div>
      </div>

      {params && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] tabular-nums text-kite-muted">
          <span>Avg RSI: {params.avgRsi?.toFixed(2) ?? "—"}</span>
          <span>Avg MACD hist: {params.avgMacdHistogram?.toFixed(3) ?? "—"}</span>
          <span>Avg band width: {params.avgBandWidthPct?.toFixed(3) ?? "—"}%</span>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        <span
          className={`inline-block rounded-sm border px-1.5 py-0.5 text-[10px] ${
            sidewaysTrend.nearBbTopRange
              ? "border-kite-green/30 bg-kite-green/10 text-kite-green"
              : "border-kite-border bg-kite-surface text-kite-muted"
          }`}
        >
          Near Top Range
        </span>
        <span
          className={`inline-block rounded-sm border px-1.5 py-0.5 text-[10px] ${
            sidewaysTrend.nearBbBottomRange
              ? "border-kite-green/30 bg-kite-green/10 text-kite-green"
              : "border-kite-border bg-kite-surface text-kite-muted"
          }`}
        >
          Near Bottom Range
        </span>
      </div>

      {params && params.checks.length > 0 && (
        <div className="mt-3 border-t border-kite-border pt-2">
          <h3 className="m-0 mb-1.5 text-[10px] font-medium uppercase tracking-wide text-kite-muted">
            Sideways Parameters
          </h3>
          <ul className="m-0 list-none divide-y divide-kite-border p-0">
            {params.checks.map((check) => (
              <li key={check.id} className="flex items-start gap-2 py-1.5">
                <span
                  className={`mt-0.5 shrink-0 rounded-sm px-1 py-0.5 text-[9px] font-semibold uppercase ${
                    check.passed
                      ? "bg-kite-green/10 text-kite-green"
                      : "bg-kite-red/10 text-kite-red"
                  }`}
                >
                  {check.passed ? "PASS" : "FAIL"}
                </span>
                <div className="min-w-0">
                  <p className="m-0 flex flex-wrap items-center gap-x-1.5 text-xs text-kite-text">
                    <span>{check.label}</span>
                    {check.matchType && (
                      <span
                        className={`rounded-sm px-1 py-0.5 text-[9px] font-semibold uppercase ${
                          check.matchType === "crossed"
                            ? "bg-kite-red/10 text-kite-red"
                            : "bg-kite-green/10 text-kite-green"
                        }`}
                      >
                        {check.matchType}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 mb-0 text-[10px] tabular-nums text-kite-muted">
                    {check.value} · threshold: {check.threshold}
                  </p>
                  {check.candleRef && <ParameterCheckCandleLine candleRef={check.candleRef} />}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
