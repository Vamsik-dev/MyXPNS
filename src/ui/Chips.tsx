export function Chips({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">{label}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const selected = o === value;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(o)}
              className={`min-h-11 rounded-full px-4 text-[15px] transition ${selected ? 'bg-accent text-accent-ink' : 'bg-surface text-ink active:bg-surface-2'}`}
            >
              {o}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 px-1 text-[14px] text-negative">{error}</p>}
    </fieldset>
  );
}
