interface ReasonsListProps {
  reasons: string[];
}

export function ReasonsList({ reasons }: ReasonsListProps) {
  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <h2 className="m-0 mb-2 text-xs font-medium uppercase tracking-wide text-kite-muted">
        Active Reasons
      </h2>
      {reasons.length === 0 ? (
        <p className="m-0 text-xs text-kite-muted">
          No active rule triggers on the latest candle.
        </p>
      ) : (
        <ul className="m-0 list-none divide-y divide-kite-border p-0">
          {reasons.map((reason) => (
            <li
              key={reason}
              className="py-1.5 pl-3 text-xs text-kite-text before:-ml-3 before:mr-1.5 before:text-kite-muted before:content-['—']"
            >
              {reason}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
