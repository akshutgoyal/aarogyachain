import React, { useState } from 'react';

export function Card({ title, subtitle, right, children, className = '', tone = 'default' }) {
  const tones = {
    default: 'border-slate-200 bg-white',
    warn: 'border-amber-200 bg-amber-50/60',
    danger: 'border-rose-200 bg-rose-50/60',
    ok: 'border-emerald-200 bg-emerald-50/60',
    info: 'border-teal-200 bg-teal-50/60',
    ai: 'border-violet-200 bg-violet-50/60',
  };
  return (
    <section className={`rounded-xl border shadow-sm ${tones[tone]} ${className}`}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-200/70 px-5 py-3.5">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, error }) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

export function Copyable({ value, label, className = '' }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy ${value}`}
      className={`group inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600 hover:border-teal-300 hover:text-teal-700 ${className}`}
    >
      <span className="truncate">{label || value}</span>
      <span className="text-slate-400 group-hover:text-teal-600">{copied ? '✓' : '⧉'}</span>
    </button>
  );
}

export function Pill({ children, tone = 'slate', className = '' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
    teal: 'bg-teal-50 text-teal-700 ring-teal-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ className = '' }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden="true"
    />
  );
}

export function Busy({ label = 'Working…' }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-500">
      <Spinner /> {label}
    </span>
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-5 py-8 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Callout({ tone = 'info', title, children, className = '' }) {
  const tones = {
    info: 'border-teal-200 bg-teal-50 text-teal-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-rose-200 bg-rose-50 text-rose-900',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    ai: 'border-violet-200 bg-violet-50 text-violet-900',
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-xs leading-relaxed ${tones[tone]} ${className}`}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {children}
    </div>
  );
}

export function KeyValue({ items }) {
  return (
    <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
      {items.map(({ k, v, mono }) => (
        <div key={k} className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">{k}</dt>
          <dd className={`truncate text-sm text-slate-800 ${mono ? 'font-mono text-xs' : ''}`}>
            {v || '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function PageHeader({ eyebrow, title, lead, actions }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-teal-700">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {lead && <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{lead}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
