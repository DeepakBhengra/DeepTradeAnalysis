import type { SimulationStatus } from "../hooks/useDashboardSimulation";

interface SimulationControlsProps {
  status: SimulationStatus;
  sessionIndex: number;
  sessionCandleCount: number;
  simulatedTimeIst: string | null;
  loading: boolean;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
}

export function SimulationControls({
  status,
  sessionIndex,
  sessionCandleCount,
  simulatedTimeIst,
  loading,
  onStart,
  onPause,
  onStop,
}: SimulationControlsProps) {
  const isPlaying = status === "playing";
  const isIdle = status === "idle";
  const isComplete = status === "complete";
  const canPause = isPlaying;
  const canStop = !isIdle;
  const canStart = !isPlaying && !loading;

  const progressPct =
    sessionCandleCount > 0
      ? Math.round(((sessionIndex + 1) / sessionCandleCount) * 100)
      : 0;

  const progressLabel =
    simulatedTimeIst && sessionCandleCount > 0
      ? `Simulation · ${simulatedTimeIst} IST · Candle ${sessionIndex + 1} / ${sessionCandleCount}`
      : "Simulation · press Start to begin at 09:15 IST";

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="cursor-pointer rounded-sm border border-kite-orange bg-kite-orange px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onStart}
        disabled={!canStart}
      >
        {status === "paused" ? "Resume" : "Start"}
      </button>
      <button
        type="button"
        className="cursor-pointer rounded-sm border border-kite-border bg-kite-surface px-2.5 py-1 text-xs text-kite-text hover:bg-kite-surface disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onPause}
        disabled={!canPause}
      >
        Pause
      </button>
      <button
        type="button"
        className="cursor-pointer rounded-sm border border-kite-border bg-kite-surface px-2.5 py-1 text-xs text-kite-text hover:bg-kite-surface disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onStop}
        disabled={!canStop}
      >
        Stop
      </button>
      <span className="text-xs text-kite-muted">{progressLabel}</span>
      {sessionCandleCount > 0 && (
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-kite-surface">
          <div
            className="h-full bg-kite-orange transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
      {isComplete && (
        <span className="text-xs text-kite-green">Session complete</span>
      )}
      {loading && isPlaying && (
        <span className="text-xs text-kite-muted">Updating…</span>
      )}
    </div>
  );
}
