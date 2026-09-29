import React from 'react';

// Visual primitives shared by every dashboard. Kept dumb and presentational so a
// dashboard file reads as layout, not as styling.

export const CHART_COLORS = ['#0d9488', '#6366f1', '#f59e0b', '#e11d48', '#8b5cf6', '#0ea5e9'];

export function StatCard({ label, value, hint, tone = 'default', delta }) {
  const tones = {
    default: 'border-slate-200',
    teal: 'border-teal-200',
    amber: 'border-amber-200',
    rose: 'border-rose-200',
    violet: 'border-violet-200',
  };
  const valueTone = {
    default: 'text-slate-900',
    teal: 'text-teal-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
    violet: 'text-violet-700',
  };
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className={`text-2xl font-semibold tabular-nums ${valueTone[tone]}`}>{value}</span>
        {delta && <span className="text-[11px] text-slate-400">{delta}</span>}
      </div>
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{hint}</p>}
    </div>
  );
}

export function ChartCard({ title, subtitle, right, children, className = '', height = 240 }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </header>
      <div className="px-2 py-3" style={{ height }}>
        {children}
      </div>
    </section>
  );
}

export function ProgressBar({ value, max = 100, tone = 'teal', label, sublabel }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const tones = {
    teal: 'bg-teal-500',
    violet: 'bg-violet-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-400',
  };
  return (
    <div>
      {(label || sublabel) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="truncate text-xs text-slate-600">{label}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
            {sublabel || `${pct}%`}
          </span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${tones[tone]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function DataTable({ columns, rows, empty = 'Nothing to show', rowKey, onRowClick }) {
  if (!rows || rows.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-xs text-slate-500">{empty}</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`whitespace-nowrap px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ${
                  column.align === 'right' ? 'text-right' : ''
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey ? rowKey(row) : index}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-slate-100 last:border-0 ${
                onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''
              }`}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-3 py-2.5 align-middle text-xs text-slate-700 ${
                    column.align === 'right' ? 'text-right' : ''
                  } ${column.mono ? 'font-mono text-[11px]' : ''}`}
                >
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DonutLegend({ data, colors = CHART_COLORS }) {
  return (
    <ul className="space-y-1.5">
      {data.map((entry, index) => (
        <li key={entry.name} className="flex items-center gap-2 text-xs">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: colors[index % colors.length] }}
          />
          <span className="truncate text-slate-600">{entry.name}</span>
          <span className="ml-auto font-medium tabular-nums text-slate-800">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function EmptyPanel({ title, hint }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">{hint}</p>}
    </div>
  );
}

/** The badge that keeps the honesty visible wherever a name is shown. */
export function OffChainBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-500 ring-1 ring-inset ring-slate-200 ${className}`}
      title="Display name supplied by the patient off-chain. The chain knows this wallet only by its address and label."
    >
      off-chain
    </span>
  );
}
