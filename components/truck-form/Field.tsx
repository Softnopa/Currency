/** Labelled input used throughout the truck form. */
export function Field({
  label,
  id,
  className = "",
  ...props
}: { label: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input id={id} className="field" {...props} />
    </div>
  );
}

/** Small read-only figure shown under a product or in the summary. */
export function Stat({
  label,
  value,
  sub,
  strong,
}: {
  label: string;
  value: string;
  sub?: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-xl bg-background px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className={`tabular-nums ${strong ? "text-lg font-bold text-primary" : "font-semibold"}`}>{value}</div>
      {sub && <div className="text-xs text-muted tabular-nums">{sub}</div>}
    </div>
  );
}
