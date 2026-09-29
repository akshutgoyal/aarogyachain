import React, { useCallback, useEffect, useState } from 'react';
import { useChain } from '../chain';
import { AI_VIEWER_ADDRESS, AI_VIEWER_LABEL } from '../contract';
import { aiAccessHistory, aiSummary, aiStatus } from '../services/api';
import { DEMO_ACCOUNTS } from '../config/demoAccounts';
import { useTx } from '../hooks/useTx';
import ConsentTimer from './ConsentTimer';
import AccessHistoryView from './AccessHistoryView';
import SummaryView from './SummaryView';
import { Busy, Callout, Card, Pill } from './ui';

// The AI is used in two distinct ways, and the UI keeps them visibly separate
// because they have different privacy properties:
//
//   TIER A · explain the ACCESS HISTORY — public metadata only, nothing decrypted.
//            One consent: you may read the record.
//   TIER B · explain the CONTENTS — the record is decrypted and transmitted to a
//            model. Two consents: you may read it, AND the patient has authorised
//            the AI as a viewer in its own right.
//
// A model call takes roughly 20 seconds. Showing elapsed seconds matters: without
// it, a legitimate wait reads as a hang and someone reloads mid-demo.

const DURATIONS = [
  { label: '60 seconds', value: 60 },
  { label: '1 hour', value: 3600 },
  { label: '24 hours', value: 86400 },
];

function useElapsed(running) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) {
      setSeconds(0);
      return undefined;
    }
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return seconds;
}

export default function AiPanel({ tokenId, isOwner = false }) {
  const { account, readContract, writeContract, refresh } = useChain();
  const { run, isBusy } = useTx({ onDone: useCallback(() => refresh(), [refresh]) });

  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState(null);
  const [summary, setSummary] = useState(null);
  const [refusal, setRefusal] = useState(null);
  const [duration, setDuration] = useState(3600);
  const [askAs, setAskAs] = useState('');

  // Who the request is made as. Defaults to the connected wallet, but can be
  // pointed at another party — being refused as the doctor is the demonstration,
  // and a judge with no wallet at all should still be able to try both tiers.
  const viewer = askAs || account || '';
  const viewingAs = DEMO_ACCOUNTS.find(
    (entry) => entry.address.toLowerCase() === String(viewer).toLowerCase()
  );

  const aiViewer = status?.aiViewer || AI_VIEWER_ADDRESS;
  const aiActive = Boolean(status?.aiConsent?.active);
  const aiGranted = Boolean(status?.aiConsent?.granted);

  const loadingHistory = isBusy(`history #${tokenId}`);
  const loadingSummary = isBusy(`contents #${tokenId}`);
  const elapsed = useElapsed(loadingHistory || loadingSummary);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await aiStatus(tokenId));
    } catch {
      setStatus(null);
    }
  }, [tokenId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const grantAiConsent = () =>
    run(`grant AI consent #${tokenId}`, async () => {
      const contract = await writeContract();
      // The SAME call a doctor's consent uses. The AI is just another viewer.
      const tx = await contract.grantAccess(tokenId, aiViewer, duration);
      await tx.wait();
      await loadStatus();
    }, {
      successTitle: 'AI processing authorised',
      successDetail:
        'The patient has now consented, separately, to this record being sent to the model. Revoking it will not stop a doctor from reading the record — the two are independent.',
    });

  const revokeAiConsent = () =>
    run(`revoke AI consent #${tokenId}`, async () => {
      const contract = await writeContract();
      const tx = await contract.revokeAccess(tokenId, aiViewer);
      await tx.wait();
      await loadStatus();
    }, {
      successTitle: 'AI processing revoked',
      successDetail: 'The record is still readable by its authorised viewers. Only the explanation is withdrawn.',
    });

  const explainHistory = async () => {
    setSummary(null);
    setRefusal(null);
    setHistory(null);
    const response = await run(`history #${tokenId}`, () => aiAccessHistory(tokenId, viewer), {
      silent: true,
    });
    if (response.ok) setHistory(response.result);
    else setRefusal({ code: response.error?.code, message: response.error?.detail });
  };

  const explainContents = async () => {
    setHistory(null);
    setSummary(null);
    setRefusal(null);
    const response = await run(`contents #${tokenId}`, () => aiSummary(tokenId, viewer), {
      silent: true,
    });
    if (response.ok) setSummary(response.result);
    else setRefusal({ code: response.error?.code, message: response.error?.detail });
  };

  return (
    <div className="space-y-4">
      <Card
        tone={aiActive ? 'ai' : 'default'}
        title="AI consent — a second, separate window"
        subtitle="Reading a record and sending it to a model are different acts, so they have different consents."
        right={
          <Pill tone={aiActive ? 'violet' : 'slate'}>
            {aiActive ? 'authorised' : aiGranted ? 'expired' : 'not granted'}
          </Pill>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-600">{AI_VIEWER_LABEL}</span>
          <span className="mono text-[10px] text-slate-400">{aiViewer}</span>
          <ConsentTimer expiresAt={aiActive ? status?.aiConsent?.expiresAt : undefined} label="AI" />
        </div>

        {isOwner ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDuration(option.value)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    duration === option.value
                      ? 'border-violet-300 bg-violet-50 text-violet-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={grantAiConsent}
                disabled={isBusy(`grant AI consent #${tokenId}`)}
                className="btn-primary bg-teal-600 hover:bg-teal-700 focus:ring-teal-500/40"
              >
                {isBusy(`grant AI consent #${tokenId}`) ? (
                  <Busy label="Confirming…" />
                ) : (
                  'Authorise AI for this record'
                )}
              </button>
              {aiGranted && (
                <button
                  type="button"
                  onClick={revokeAiConsent}
                  disabled={isBusy(`revoke AI consent #${tokenId}`)}
                  className="btn-secondary border-rose-300 text-rose-700 hover:bg-rose-50"
                >
                  {isBusy(`revoke AI consent #${tokenId}`) ? (
                    <Busy label="Confirming…" />
                  ) : (
                    'Withdraw AI consent'
                  )}
                </button>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Granted with the same <span className="mono">grantAccess</span> call a doctor&rsquo;s
              consent uses, against the AI&rsquo;s own address. The AI holds no key and never
              signs — it can only ever be the <em>subject</em> of a grant.
            </p>
          </div>
        ) : (
          <Callout tone="warn">
            Only the record owner can authorise AI processing. Ask the patient to grant it from
            their console.
          </Callout>
        )}
      </Card>

      <Card title="Two ways to use the model" subtitle="Different data, different consent, different cost.">
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Asking as</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {DEMO_ACCOUNTS.map((entry) => (
              <button
                key={entry.address}
                type="button"
                onClick={() => setAskAs(entry.address)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  String(viewer).toLowerCase() === entry.address.toLowerCase()
                    ? 'border-teal-300 bg-teal-50 text-teal-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-600">
            {viewingAs
              ? `${viewingAs.label} — ${viewingAs.role}.`
              : 'Pick a party. Each one gets a different answer from the same request.'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3.5">
            <p className="text-xs font-semibold text-slate-800">Explain the access history</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
              Who accessed this record, when, and who can read it now. Built from{' '}
              <strong>public chain metadata only</strong> — the file is never decrypted, so no extra
              consent is needed.
            </p>
            <button
              type="button"
              onClick={explainHistory}
              disabled={loadingHistory || loadingSummary || !viewer}
              className="btn-secondary mt-2.5 w-full border-teal-300 text-teal-800 hover:bg-teal-50"
            >
              {loadingHistory ? <Busy label={`Calling Gemini… ${elapsed}s`} /> : 'Explain the access history'}
            </button>
          </div>

          <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3.5">
            <p className="text-xs font-semibold text-slate-800">Explain the record contents</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
              It turns the record into plain language. The file is <strong>decrypted and sent to the
              model</strong>, so it needs the second consent above.
            </p>
            <button
              type="button"
              onClick={explainContents}
              disabled={loadingHistory || loadingSummary || !viewer}
              className="btn-secondary mt-2.5 w-full border-violet-300 text-violet-700 hover:bg-violet-50"
            >
              {loadingSummary ? (
                <Busy label={`Calling Gemini… ${elapsed}s`} />
              ) : (
                'Explain the record contents'
              )}
            </button>
          </div>
        </div>

        {elapsed >= 5 && (loadingHistory || loadingSummary) && (
          <p className="mt-3 text-[11px] text-slate-500">
            Still working — a model call usually takes 15–25 seconds. If the primary model is busy,
            the request has already moved on to a fallback rather than failing.
          </p>
        )}
      </Card>

      {refusal && (
        <Callout
          tone={refusal.code === 'AiConsentRequired' ? 'warn' : 'danger'}
          title={
            refusal.code === 'AiConsentRequired'
              ? 'You may read this record — but nobody agreed to the model seeing it'
              : refusal.code === 'AI_NOT_CONFIGURED'
                ? 'Both checks passed, but no API key is configured'
                : `Refused: ${refusal.code}`
          }
        >
          <p>{refusal.message}</p>
          {refusal.code === 'AiConsentRequired' && (
            <p className="mt-2 font-medium">
              This is the second gate doing its job. Consent to read and consent to transmit are
              separate, and only the first was granted. That distinction is what makes the AI
              defensible on real patient data.
            </p>
          )}
        </Callout>
      )}

      {history && <AccessHistoryView result={history} onClose={() => setHistory(null)} />}
      {summary && (
        <SummaryView
          result={summary}
          recordLabel={`token #${tokenId}`}
          onClose={() => setSummary(null)}
        />
      )}
    </div>
  );
}
