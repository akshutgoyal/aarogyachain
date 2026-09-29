import React, { useCallback, useEffect, useState } from 'react';
import { digestOf, formatBytes } from '../crypto';
import { listRecords, verifyDigest } from '../services/api';
import { Callout, Card, EmptyState, Field, PageHeader, Pill } from '../components/ui';

// The free, permissionless primitive. No wallet, no account, no consent — a
// verifier that does not trust the issuing hospital can still check a file.
//
// The digest is keccak256 of the ENCRYPTED file, because that is the artifact the
// chain anchors. So the file to drop here is the encrypted record you were given,
// not the plaintext scan. That is the design: the chain never learns anything
// about the contents.

export default function Verify() {
  const [records, setRecords] = useState([]);
  const [tokenId, setTokenId] = useState('1');
  const [file, setFile] = useState(null);
  const [localDigest, setLocalDigest] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const loadRecords = useCallback(async () => {
    try {
      const { records: all } = await listRecords();
      setRecords(all);
      if (all.length > 0 && !all.some((r) => String(r.tokenId) === String(tokenId))) {
        setTokenId(String(all[0].tokenId));
      }
    } catch {
      setRecords([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const pickFile = async (chosen) => {
    setFile(chosen || null);
    setResult(null);
    setError(null);
    if (!chosen) {
      setLocalDigest('');
      return;
    }
    const buffer = await chosen.arrayBuffer();
    const digest = digestOf(buffer);
    setLocalDigest(digest);
    await check(digest, `you dropped ${chosen.name} (${formatBytes(chosen.size)})`);
  };

  const check = async (digest, note) => {
    setBusy(true);
    setError(null);
    try {
      const verdict = await verifyDigest(Number(tokenId), digest);
      setResult({ ...verdict, note });
    } catch (requestError) {
      setError(requestError.message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const useOnChainDigest = () => {
    const record = records.find((r) => String(r.tokenId) === String(tokenId));
    if (!record) return;
    setFile(null);
    setLocalDigest(record.recordHash);
    check(record.recordHash, 'the digest read from the chain');
  };

  const tamper = () => {
    // Flip the last hex character. One bit, and the record is no longer authentic.
    const record = records.find((r) => String(r.tokenId) === String(tokenId));
    if (!record) return;
    const last = record.recordHash.slice(-1);
    const flipped = (parseInt(last, 16) ^ 0x1).toString(16);
    const tampered = record.recordHash.slice(0, -1) + flipped;
    setFile(null);
    setLocalDigest(tampered);
    check(tampered, 'the same digest with one bit changed');
  };

  return (
    <>
      <PageHeader
        eyebrow="Public utility"
        title="Verify a record without an account"
        lead="Re-hash the file and compare it with the 32 bytes on-chain. A match means the file is exactly what was registered; a mismatch means it was altered, even by us. No wallet, no login, and nothing to trust but arithmetic."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Check a file" subtitle="Free, permissionless, and identical for everyone.">
          <div className="space-y-3">
            <Field label="Which record">
              <div className="flex flex-wrap gap-1.5">
                {records.length === 0 && (
                  <span className="text-xs text-slate-500">No records found on the contract.</span>
                )}
                {records.map((record) => (
                  <button
                    key={record.tokenId}
                    type="button"
                    onClick={() => {
                      setTokenId(String(record.tokenId));
                      setResult(null);
                    }}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      String(record.tokenId) === String(tokenId)
                        ? 'border-teal-300 bg-teal-50 text-teal-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    #{record.tokenId} · {record.recordType}
                  </button>
                ))}
              </div>
            </Field>

            <Field
              label="Drop the encrypted record file"
              hint="The chain anchors keccak256 of the encrypted file, so this is the file to check — not the plaintext scan."
            >
              <input
                type="file"
                onChange={(event) => pickFile(event.target.files?.[0] || null)}
                className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white text-xs text-slate-600 file:mr-3 file:cursor-pointer file:rounded-l-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
            </Field>

            {localDigest && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">
                  Digest computed in your browser
                </p>
                <p className="mono mt-1 break-all text-slate-700">{localDigest}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => localDigest && check(localDigest, 'the digest shown above')}
                disabled={!localDigest || busy}
                className="btn-primary"
              >
                {busy ? 'Asking the contract…' : 'Verify this digest'}
              </button>
              <button
                type="button"
                onClick={useOnChainDigest}
                disabled={busy || records.length === 0}
                className="btn-secondary"
              >
                Use the on-chain digest
              </button>
              <button
                type="button"
                onClick={tamper}
                disabled={busy || records.length === 0}
                className="btn-secondary border-rose-300 text-rose-700 hover:bg-rose-50"
              >
                Tamper with one bit
              </button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          {error && (
            <Callout tone="danger" title="Could not verify">
              {error}
            </Callout>
          )}

          {!result && !error && (
            <Card>
              <EmptyState
                title="No verdict yet"
                hint="Drop a file, or use the buttons to compare the on-chain digest against itself and against a single altered bit."
              />
            </Card>
          )}

          {result && (
            <>
              <Card tone={result.authentic ? 'ok' : 'danger'}>
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg ${
                      result.authentic
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {result.authentic ? '✓' : '✕'}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold ${
                        result.authentic ? 'text-emerald-800' : 'text-rose-800'
                      }`}
                    >
                      {result.authentic
                        ? 'Authentic — this file is exactly what was registered'
                        : 'Tampered — this file is not the registered one'}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Checked against token #{result.tokenId}. The verdict came from the contract's
                      own <span className="mono">verifyRecord</span> call — we did not compute the
                      comparison ourselves.
                    </p>
                    {result.note && (
                      <p className="mt-1.5 text-[11px] text-slate-500">Input: {result.note}</p>
                    )}
                  </div>
                </div>

                <dl className="mt-4 space-y-2">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                      digest provided
                    </dt>
                    <dd className="mono break-all text-slate-700">{result.provided}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                      digest on-chain
                    </dt>
                    <dd className="mono break-all text-slate-700">{result.onChain}</dd>
                  </div>
                </dl>
              </Card>

              <Callout tone="info" title="What this proves, and what it does not">
                A match proves the bytes are unchanged since the record was registered — not that
                the diagnosis is correct, and not that the clinician was qualified. It answers
                exactly one question: has this file been altered? That is the question paper
                records cannot answer at all.
              </Callout>
            </>
          )}

          <Card title="Why the digest matters" subtitle="The 32-byte truth anchor.">
            <ul className="space-y-2 text-xs leading-relaxed text-slate-600">
              <li>
                When a record is registered, <span className="mono">keccak256</span> of the
                encrypted file is computed off-chain and only that 32-byte value is stored.
              </li>
              <li>
                Anyone can recompute it later and compare. A mismatch is detected even if the
                alteration happened inside our own database.
              </li>
              <li>
                The check is a free <span className="mono">view</span> call, so it costs nothing and
                needs no permission — which is why it works on this page with no wallet connected.
              </li>
              <li>
                <Pill tone="teal">current state</Pill> {records.length} record(s) on this contract
                are verifiable by anyone reading this page.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
