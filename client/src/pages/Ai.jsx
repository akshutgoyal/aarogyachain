import React, { useCallback, useEffect, useState } from 'react';
import { useChain } from '../chain';
import { listRecords } from '../services/api';
import { AI_VIEWER_LABEL } from '../contract';
import AiPanel from '../components/AiPanel';
import { Callout, Card, EmptyState, PageHeader, Pill } from '../components/ui';

// The AI page explains what the model is allowed to do, and then lets you watch
// the chain refuse it. The refusals are the interesting part — anyone can call a
// model; very few can show one being told no by a blockchain.

export default function Ai() {
  const { account } = useChain();
  const [records, setRecords] = useState([]);
  const [tokenId, setTokenId] = useState(null);

  const load = useCallback(async () => {
    try {
      const { records: all } = await listRecords();
      setRecords(all);
      if (all.length > 0) setTokenId((current) => current ?? all[0].tokenId);
    } catch {
      setRecords([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        eyebrow="Explanation layer"
        title="Gemini explains. It never decides."
        lead="A patient who owns a record still cannot read an MRI. Ownership without comprehension is not sovereignty — so Gemini turns data into plain language. It runs off-chain, holds no key, writes no state, and cannot mint, grant, or revoke anything."
      />

      <Callout tone="ai" className="mb-5" title="The model is used in two ways, with deliberately different privacy implications">
        <p className="mt-1">
          Sending a medical record to a third-party model is a <em>new purpose</em>, and a new
          purpose needs its own consent. So the two uses are separated, and neither one lets the
          model near anything the contract has not already released.
        </p>
      </Callout>

      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <Card title="Tier A · Explains the access history" tone="info">
          <p className="mb-2 text-xs leading-relaxed text-slate-700">
            Who accessed this record, when, and who can read it now. Built from{' '}
            <strong>public chain metadata only</strong> — event names, addresses and timestamps.
          </p>
          <ul className="space-y-1.5 text-[11px] leading-relaxed text-slate-600">
            <li>Nothing is decrypted. No record content reaches the model.</li>
            <li>Needs one consent: that you may read the record.</li>
            <li>Honestly, this data is already public on the ledger — we are only explaining it.</li>
          </ul>
        </Card>

        <Card title="Tier B · Explains the record contents" tone="ai">
          <p className="mb-2 text-xs leading-relaxed text-slate-700">
            It turns the record into plain language, with the values it mentions and questions to ask a
            clinician.
          </p>
          <ul className="space-y-1.5 text-[11px] leading-relaxed text-slate-600">
            <li>The file is decrypted and transmitted to the model.</li>
            <li>
              Needs <strong>two</strong> consents: you may read it, <em>and</em> the patient has
              authorised the AI as a viewer in its own right.
            </li>
            <li>Free tier uses synthetic data; the paid tier keeps content out of training.</li>
          </ul>
        </Card>
      </div>

      <Card
        className="mb-5"
        title="How the AI is authorised"
        subtitle="Not invented for the model — the same primitive a doctor's consent uses."
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Pill tone="violet">{AI_VIEWER_LABEL}</Pill>
          <span className="mono text-[10px] text-slate-500">
            0x000000000000000000000000000000000000a1a1
          </span>
        </div>
        <p className="text-xs leading-relaxed text-slate-700">
          The AI is registered as an ordinary <strong>viewer</strong>. It holds no key and never
          signs, so it can never act — it can only ever be the <em>subject</em> of a grant. The
          patient authorises it with the same <span className="mono">grantAccess()</span> call a
          doctor&rsquo;s consent uses, and the server checks it with the same{' '}
          <span className="mono">viewRecord()</span> call.
        </p>
        <Callout tone="ok" className="mt-3">
          That means there is no second permission system to trust. The same contract, the same
          enforcement, the same revocation — and revoking AI consent leaves the doctor&rsquo;s access
          completely untouched, because they are separate windows.
        </Callout>
      </Card>

      {records.length === 0 ? (
        <EmptyState
          title="No records on the contract yet"
          hint="Mint one from the Admin console first, then come back to watch the gate work."
        />
      ) : (
        <>
          <Card className="mb-5" title="Pick a record" subtitle="Both tiers run on it.">
            <div className="flex flex-wrap gap-1.5">
              {records.map((record) => (
                <button
                  key={record.tokenId}
                  type="button"
                  onClick={() => setTokenId(record.tokenId)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                    tokenId === record.tokenId
                      ? 'border-violet-300 bg-violet-50 text-violet-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  #{record.tokenId} · {record.recordType}
                </button>
              ))}
            </div>
            {records[0] && (
              <p className="mono mt-2.5 break-all text-[10px] text-slate-400">
                Owner {records.find((r) => r.tokenId === tokenId)?.patient}
              </p>
            )}
          </Card>

          {tokenId && (
            <AiPanel
              tokenId={tokenId}
              isOwner={
                Boolean(account) &&
                account.toLowerCase() ===
                  String(records.find((r) => r.tokenId === tokenId)?.patient).toLowerCase()
              }
            />
          )}
        </>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card title="Where the AI sits in the flow" subtitle="Arrows that change state are transactions. This one is not.">
          <ol className="space-y-2.5 text-xs leading-relaxed text-slate-600">
            <li>
              <strong className="text-slate-800">1.</strong> The record is encrypted in the browser
              and only its digest is anchored on-chain.
            </li>
            <li>
              <strong className="text-slate-800">2.</strong> A viewer asks for an explanation. The
              server does not trust the request — it asks the contract.
            </li>
            <li>
              <strong className="text-slate-800">3.</strong> The contract runs{' '}
              <span className="mono">viewRecord</span> as that address. It either releases the file
              location or reverts.
            </li>
            <li>
              <strong className="text-slate-800">4.</strong> For Tier B only, the contract is asked
              a <em>second</em> time, as the AI&rsquo;s own address.
            </li>
            <li>
              <strong className="text-slate-800">5.</strong> Only then is the record decrypted and
              sent to the model, which returns structured JSON.
            </li>
          </ol>
        </Card>

        <div className="space-y-4">
          <Card title="What we do not claim" tone="warn">
            <ul className="space-y-2 text-xs leading-relaxed text-slate-700">
              <li>
                <strong>A summary is not medical advice</strong>, and a hallucination is possible.
                The record is authoritative; the summary is not.
              </li>
              <li>
                The model does not verify anything. The <em>chain</em> verifies a record by digest;
                the model only explains it in words.
              </li>
              <li>
                In this demo the key wrapping is handled by the backend. Delegating wrapped-key
                release to a decentralised key-management network is the production path, not
                something we have built.
              </li>
              <li>
                Tier B sends record content to a third party under the patient&rsquo;s consent. That
                is a real data flow, and calling it anything else would be dishonest.
              </li>
            </ul>
          </Card>

          <Card title="Model and reliability">
            <ul className="space-y-2 text-xs leading-relaxed text-slate-600">
              <li>
                Primary model <span className="mono">gemini-3.6-flash</span>, with automatic fallback
                across Flash models if the primary is busy.
              </li>
              <li>
                The <strong>Pro models are unavailable on a free-tier key</strong> — a 429 with a
                limit of 0 tokens per minute — so the fallbacks are Flash. Verified, not assumed.
              </li>
              <li>A model call takes roughly 15–25 seconds. The button shows elapsed seconds so a
                legitimate wait does not read as a hang.</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
