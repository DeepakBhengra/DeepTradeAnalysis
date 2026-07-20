interface StockSymbolInputProps {
  value: string;
  onChange: (value: string) => void;
  onLoad: () => void;
  loading: boolean;
}

export function StockSymbolInput({
  value,
  onChange,
  onLoad,
  loading,
}: StockSymbolInputProps) {
  return (
    <section className="border-b border-kite-border bg-kite-surface px-3 py-2">
      <h2 className="m-0 mb-1.5 text-xs font-medium uppercase tracking-wide text-kite-muted">
        Stock Selection
      </h2>
      <p className="m-0 mb-2 text-xs text-kite-muted">
        Enter an NSE equity symbol (e.g. RELIANCE, TCS, SBIN). Common names like SBI map to SBIN automatically.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === "Enter" && value.trim().length > 0 && !loading) {
              onLoad();
            }
          }}
          placeholder="RELIANCE"
          className="w-40 border border-kite-border bg-kite-bg px-2 py-1.5 text-sm uppercase text-kite-text outline-none focus:border-kite-orange"
        />
        <button
          type="button"
          onClick={onLoad}
          disabled={loading || value.trim().length === 0}
          className="cursor-pointer rounded-sm border border-kite-orange bg-kite-orange px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Loading..." : "Load"}
        </button>
      </div>
    </section>
  );
}
