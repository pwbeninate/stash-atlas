import type { ReactNode } from "react";

/** Shared tooltip chrome for Recharts `content` renderers. */
export function ChartTooltip({
  title,
  subtitle,
  rows,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  rows: { key: string; color: string; label: string; value: string; detail?: string }[];
}) {
  return (
    <div className="min-w-48 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink shadow-lg">
      <p className="font-semibold">{title}</p>
      {subtitle && <p className="text-ink-2">{subtitle}</p>}
      {rows.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="flex-1 text-ink-2">{row.label}</span>
              <span className="tabular-nums">{row.value}</span>
              {row.detail && <span className="w-12 text-right tabular-nums text-muted">{row.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
