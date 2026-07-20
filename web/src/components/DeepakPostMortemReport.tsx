import type { DashboardSeriesPoint } from "../types/dashboard";
import type {
  DeepakPostMortemReport,
  EnhancementPriority,
  PostMortemGrade,
} from "../types/postMortem";
import { DeepakPostMortemMidChart } from "./DeepakPostMortemMidChart";

interface DeepakPostMortemReportProps {
  symbol: string;
  mode: string;
  report: DeepakPostMortemReport;
  series: DashboardSeriesPoint[];
}

const gradeClass: Record<PostMortemGrade, string> = {
  RIGHT: "text-kite-green",
  MIXED: "text-kite-amber",
  WRONG: "text-kite-red",
};

const gradeBadge: Record<PostMortemGrade, string> = {
  RIGHT: "bg-kite-green/10 text-kite-green",
  MIXED: "bg-kite-amber/10 text-kite-amber",
  WRONG: "bg-kite-red/10 text-kite-red",
};

const priorityBadge: Record<EnhancementPriority, string> = {
  P0: "bg-kite-red/10 text-kite-red",
  P1: "bg-kite-amber/10 text-kite-amber",
  P2: "bg-kite-orange/10 text-kite-orange",
  P3: "bg-kite-surface text-kite-muted",
};

const biasClass: Record<string, string> = {
  BUY: "text-kite-green",
  SELL: "text-kite-red",
  HOLD: "text-kite-amber",
};

export function DeepakPostMortemReportView({
  symbol,
  mode,
  report,
  series,
}: DeepakPostMortemReportProps) {
  return (
    <div className="flex flex-col gap-3">
      <section className="border border-kite-border bg-kite-surface p-3">
        <h2 className="m-0 text-sm font-semibold text-kite-text">
          {symbol} · {report.variantLabel} post-mortem
        </h2>
        <p className="mt-1 mb-0 text-xs text-kite-muted">
          NSE · 15m · {report.dateKey}
          {report.sessionClose != null && (
            <> · close {report.sessionClose.toFixed(2)}</>
          )}
          {report.sessionRsi != null && (
            <> · RSI {report.sessionRsi.toFixed(2)}</>
          )}
          {" · "}
          {mode} · live bias {report.decision}
          {report.activeScenario ? ` · ${report.activeScenario}` : ""}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Signals" value={String(report.signals.length)} />
        <StatCard
          label="Right"
          value={String(report.rightCount)}
          valueClass="text-kite-green"
        />
        <StatCard
          label="Mixed"
          value={String(report.mixedCount)}
          valueClass="text-kite-amber"
        />
        <StatCard
          label="Wrong"
          value={String(report.wrongCount)}
          valueClass="text-kite-red"
        />
      </section>

      {report.headline && (
        <section className="border border-kite-red/30 bg-kite-surface p-3">
          <p className="m-0 text-[10px] uppercase tracking-wide text-kite-red">
            Headline failure
          </p>
          <p className="mt-1 mb-0 text-xs text-kite-text">
            {report.headline.id} {report.headline.side}{" "}
            <span className="text-kite-muted">{report.headline.scenarioKey}</span> @{" "}
            {report.headline.timeIst} ({report.headline.entry.toFixed(2)}) —{" "}
            {report.headline.why}
          </p>
        </section>
      )}

      {report.signals.length === 0 && (
        <section className="border border-kite-border bg-kite-surface p-3 text-xs text-kite-muted">
          No {report.variantLabel} BUY/SELL signals fired for this symbol and date.
        </section>
      )}

      {report.signals.length > 0 && (
        <>
          <section className="border border-kite-border bg-kite-surface p-3">
            <h3 className="m-0 mb-2 text-xs font-medium uppercase tracking-wide text-kite-muted">
              Session path vs signals
            </h3>
            <DeepakPostMortemMidChart series={series} signals={report.signals} />
          </section>

          <section className="border border-kite-border bg-kite-surface p-3">
            <h3 className="m-0 mb-2 text-xs font-medium uppercase tracking-wide text-kite-muted">
              Decision scorecard
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-kite-border text-[10px] uppercase tracking-wide text-kite-muted">
                    <th className="px-1.5 py-1.5 font-medium">ID</th>
                    <th className="px-1.5 py-1.5 font-medium">Side</th>
                    <th className="px-1.5 py-1.5 font-medium">Scenario</th>
                    <th className="px-1.5 py-1.5 font-medium">Time</th>
                    <th className="px-1.5 py-1.5 font-medium text-right">Entry</th>
                    <th className="px-1.5 py-1.5 font-medium">BB</th>
                    <th className="px-1.5 py-1.5 font-medium">Grade</th>
                    <th className="px-1.5 py-1.5 font-medium">MFE / MAE</th>
                    <th className="px-1.5 py-1.5 font-medium">Next path</th>
                  </tr>
                </thead>
                <tbody>
                  {report.signals.map((signal) => (
                    <tr
                      key={`${signal.id}-${signal.timeIst}-${signal.scenarioKey}`}
                      className="border-b border-kite-border/60"
                    >
                      <td className="px-1.5 py-1.5 tabular-nums">{signal.id}</td>
                      <td
                        className={`px-1.5 py-1.5 font-medium ${biasClass[signal.side]}`}
                      >
                        {signal.side}
                      </td>
                      <td className="max-w-[200px] px-1.5 py-1.5 text-kite-muted">
                        {signal.scenarioKey}
                      </td>
                      <td className="px-1.5 py-1.5 tabular-nums">{signal.timeIst}</td>
                      <td className="px-1.5 py-1.5 text-right tabular-nums">
                        {signal.entry.toFixed(2)}
                      </td>
                      <td className="px-1.5 py-1.5">{signal.bbMatchType}</td>
                      <td className={`px-1.5 py-1.5 font-semibold ${gradeClass[signal.grade]}`}>
                        {signal.grade}
                      </td>
                      <td className="px-1.5 py-1.5 text-kite-muted">
                        {signal.mfeLabel} · {signal.maeLabel}
                      </td>
                      <td className="px-1.5 py-1.5 text-kite-muted">{signal.nextPath}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="m-0 mb-2 text-xs font-medium uppercase tracking-wide text-kite-muted">
              Signal-by-signal verdict
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {report.signals.map((signal) => (
                <article
                  key={`card-${signal.id}-${signal.timeIst}-${signal.scenarioKey}`}
                  className="border border-kite-border bg-kite-surface p-3"
                >
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <p className="m-0 text-xs font-medium text-kite-text">
                      {signal.id}{" "}
                      <span className={biasClass[signal.side]}>{signal.side}</span> ·{" "}
                      {signal.timeIst}
                    </p>
                    <span
                      className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${gradeBadge[signal.grade]}`}
                    >
                      {signal.grade}
                    </span>
                  </div>
                  <p className="m-0 text-[10px] text-kite-muted">
                    {signal.scenarioKey} · entry {signal.entry.toFixed(2)} · BB{" "}
                    {signal.bbMatchType}
                    {signal.targetHit ? " · target hit" : ""}
                  </p>
                  <p className="mt-1.5 mb-0 text-xs text-kite-text">{signal.why}</p>
                  <p className="mt-1 mb-0 text-[10px] text-kite-muted">
                    Favorable {signal.mfeLabel} · Adverse {signal.maeLabel}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="border border-kite-border bg-kite-surface p-3">
            <h3 className="m-0 mb-2 text-xs font-medium uppercase tracking-wide text-kite-muted">
              Live decision timeline
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-kite-border text-[10px] uppercase tracking-wide text-kite-muted">
                    <th className="px-1.5 py-1.5 font-medium">From</th>
                    <th className="px-1.5 py-1.5 font-medium">Dashboard bias</th>
                    <th className="px-1.5 py-1.5 font-medium">Why</th>
                    <th className="px-1.5 py-1.5 font-medium">Was market agreeing?</th>
                  </tr>
                </thead>
                <tbody>
                  {report.timeline.map((step) => (
                    <tr
                      key={`tl-${step.fromTimeIst}-${step.bias}-${step.why}`}
                      className="border-b border-kite-border/60"
                    >
                      <td className="px-1.5 py-1.5 tabular-nums">{step.fromTimeIst}</td>
                      <td className={`px-1.5 py-1.5 font-semibold ${biasClass[step.bias]}`}>
                        {step.bias}
                      </td>
                      <td className="px-1.5 py-1.5 text-kite-muted">{step.why}</td>
                      <td className="px-1.5 py-1.5 text-kite-muted">{step.marketAgree}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {report.tips.length > 0 && (
        <section>
          <h3 className="m-0 mb-2 text-xs font-medium uppercase tracking-wide text-kite-muted">
            How to enhance the Deepak rule
          </h3>
          <p className="m-0 mb-2 text-xs text-kite-muted">
            Tips derived from this session&apos;s graded failures — advisory only; rules are
            unchanged.
          </p>
          <div className="flex flex-col gap-2">
            {report.tips.map((tip) => (
              <article
                key={`${tip.priority}-${tip.title}`}
                className="border border-kite-border bg-kite-surface p-3"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${priorityBadge[tip.priority]}`}
                  >
                    {tip.priority}
                  </span>
                  <p className="m-0 text-xs font-medium text-kite-text">{tip.title}</p>
                </div>
                <p className="m-0 text-xs text-kite-text">{tip.body}</p>
                <p className="mt-1 mb-0 text-[10px] text-kite-muted">
                  Effect: {tip.effect}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="border border-sky-500/40 bg-kite-surface p-3">
        <p className="m-0 text-[10px] uppercase tracking-wide text-sky-400">
          Net read for this symbol-day
        </p>
        <p className="mt-1.5 mb-0 text-xs leading-relaxed text-kite-text">{report.netRead}</p>
      </section>

      <p className="m-0 text-[10px] text-kite-muted">
        Grades use subsequent 15m candle mids vs entry. RIGHT = engine target hit, or meaningful
        follow-through (MFE ≥ min(profit target, 0.3% of entry)) without a large prior MAE.
        Engine adaptive targets (often a full daily range) are exit math only — not the
        directional grade bar.
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClass = "text-kite-text",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="border border-kite-border bg-kite-surface px-3 py-2">
      <p className={`m-0 text-lg font-semibold tabular-nums ${valueClass}`}>{value}</p>
      <p className="m-0 text-[10px] uppercase tracking-wide text-kite-muted">{label}</p>
    </div>
  );
}
