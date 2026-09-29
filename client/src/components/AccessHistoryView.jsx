import React from 'react';
import { Card, Callout, Pill } from './ui';

// Renders the TIER A result: an explanation of the access history, built from
// public chain metadata only. The coloured "data sent to the model" banner is
// deliberately part of the rendering, not fine print — the whole point of this
// tier is that no record content was involved.

export default function AccessHistoryView({ result, onClose }) {
  const summary = result.summary || {};

  return (
    <Card
      tone="info"
      title="Gemini's explanation of the access history"
      subtitle={`${result.model} · ${result.eventsConsidered} event(s) considered${
        result.cached ? ' · cached' : ''
      }`}
      right={
        onClose ? (
          <button type="button" onClick={onClose} className="btn-ghost">
            Close
          </button>
        ) : null
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Pill tone="emerald">no record content sent</Pill>
        <Pill tone="emerald">nothing decrypted</Pill>
        <Pill tone="slate">no AI consent required</Pill>
      </div>

      {summary.plain_summary && (
        <p className="mb-4 rounded-lg border border-sky-200 bg-white p-3.5 text-sm leading-relaxed text-slate-700">
          {summary.plain_summary}
        </p>
      )}

      {Array.isArray(summary.timeline) && summary.timeline.length > 0 && (
        <ol className="space-y-2.5">
          {summary.timeline.map((entry, index) => (
            <li key={index} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] font-semibold text-sky-700">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-500">{entry.when}</p>
                <p className="text-xs leading-relaxed text-slate-700">
                  <strong className="text-slate-900">{entry.who}</strong> — {entry.what}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Can read this record right now
          </p>
          {Array.isArray(summary.currently_has_access) && summary.currently_has_access.length > 0 ? (
            <ul className="mt-1 space-y-0.5">
              {summary.currently_has_access.map((who, index) => (
                <li key={index} className="text-xs text-slate-700">
                  {who}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs font-medium text-emerald-700">Nobody</p>
          )}
          <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
            Read from the contract, not inferred from the event list — a consent window closes
            silently, so history alone cannot say what is true now.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Worth noticing</p>
          {Array.isArray(summary.notable) && summary.notable.length > 0 ? (
            <ul className="mt-1 space-y-0.5">
              {summary.notable.map((item, index) => (
                <li key={index} className="text-xs text-amber-800">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-slate-600">Nothing unusual.</p>
          )}
        </div>
      </div>

      <Callout tone="info" className="mt-4" title="What the model was given">
        {result.dataSentToModel}. This explanation therefore needs no extra consent: the data it
        reasons over is already public on the ledger.
        {summary.disclaimer && <span className="mt-1.5 block">{summary.disclaimer}</span>}
      </Callout>
    </Card>
  );
}
