interface RuleVariantOption<T extends string> {
  value: T;
  label: string;
}

interface RuleVariantSelectProps<T extends string> {
  id: string;
  value: T;
  options: ReadonlyArray<RuleVariantOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function RuleVariantSelect<T extends string>({
  id,
  value,
  options,
  onChange,
  disabled = false,
}: RuleVariantSelectProps<T>) {
  return (
    <div>
      <label
        className="mb-0.5 block text-[10px] uppercase tracking-wide text-kite-muted"
        htmlFor={id}
      >
        Rule variant
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        className="rounded-sm border border-kite-border bg-kite-bg px-2 py-1.5 text-xs text-kite-text focus:border-kite-orange focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
