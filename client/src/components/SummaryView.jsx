import React from 'react';
import { Card, Callout, Pill } from './ui';

// Renders the structured JSON the model returns. Kept deliberately plain: the
// record is authoritative, so this is presented as an explanation with the
// disclaimer attached, not as a result.

export default function SummaryView({ result, recordLabel, onClose }) {
  const summary = result.summary || {};

  return (
    <Card
      tone="ai"
      title="Gemini's explanation"
      subtitle={`${recordLabel || 'record'} · ${result.model} · ${
        result.cached ? 'served from cache' : 'freshly generated'
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
        <Pill tone="violet">off-chain</Pill>
        <Pill tone="violet">no key held</Pill>
        <Pill tone="violet">wrote no state</Pill>
        {result.consentGranted && <Pill tone="emerald">consent verified by the contract</Pill>}
      </div>

      {summary.record_type_in_words && (
        <p className="mb-3 text-xs text-slate-600">
          Gemini read this as <strong className="text-slate-800">{summary.record_type_in_words}</strong>.
        </p>
      )}

      {summary.plain_summary && (
        <div className="mb-4 rounded-lg border border-violet-200 bg-white p-4">
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
            In plain language
          </h3>
          <p className="text-sm leading-relaxed text-slate-700">{summary.plain_summary}</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {Array.isArray(summary.key_findings) && summary.key_findings.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Key findings
            </h3>
            <ul className="space-y-1.5">
              {summary.key_findings.map((finding, index) => (
                <li key={index} className="flex gap-2 text-xs leading-relaxed text-slate-700">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400" />
                  {finding}
                </li>
              ))}
            </ul>
          </section>
        )}

        {Array.isArray(summary.questions_for_your_doctor) &&
          summary.questions_for_your_doctor.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Worth asking your doctor
              </h3>
              <ul className="space-y-1.5">
                {summary.questions_for_your_doctor.map((question, index) => (
                  <li key={index} className="flex gap-2 text-xs leading-relaxed text-slate-700">
                    <span className="text-violet-400">?</span>
                    {question}
                  </li>
                ))}
              </ul>
            </section>
          )}
      </div>

      {Array.isArray(summary.values_to_note) && summary.values_to_note.length > 0 && (
        <section className="mt-4">
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Values mentioned in the record
          </h3>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                  <th className="px-3 py-2 font-medium">Why it matters</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {summary.values_to_note.map((entry, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2 font-medium text-slate-700">{entry.name}</td>
                    <td className="px-3 py-2 font-mono text-slate-700">{entry.value}</td>
                    <td className="px-3 py-2 text-slate-600">{entry.why_it_matters}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {summary.confidence_note && (
        <Callout tone="warn" className="mt-4" title="What was unclear">
          {summary.confidence_note}
        </Callout>
      )}

      <Callout tone="danger" className="mt-4" title="Not medical advice">
        {summary.disclaimer}
        {result.sourceTruncated && ' The record was long, so only the first part was read.'}
      </Callout>
    </Card>
  );
}
