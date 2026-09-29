import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isAddress } from 'ethers';
import { useChain } from '../chain';
import { decryptRecord, fromBase64, formatBytes } from '../crypto';
import { listRecords, releaseFile } from '../services/api';
import { useTx } from '../hooks/useTx';
import AddressInput from '../components/AddressInput';
import ConsentTimer from '../components/ConsentTimer';
import AiPanel from '../components/AiPanel';
import {
  Busy,
  Callout,
  Card,
  EmptyState,
  Field,
  PageHeader,
  Pill,
  Spinner,
} from '../components/ui';

const RECORD_TYPES = ['MRI_SCAN', 'BLOOD_PANEL', 'XRAY', 'DISCHARGE_SUMMARY'];

export default function Doctor() {
  const { account, roles, readContract, writeContract, refresh } = useChain();
  const { busy, run, isBusy } = useTx({ onDone: useCallback(() => refresh(), [refresh]) });

  const [records, setRecords] = useState([]);
  const [accessMap, setAccessMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState({ patient: '', recordType: 'MRI_SCAN' });
  const [breakGlass, setBreakGlass] = useState({ tokenId: '', reason: '' });
  const [viewing, setViewing] = useState(null);
  const [aiToken, setAiToken] = useState(null);

  const isManager = roles.manager;

  /** Every record on the contract, annotated with whether THIS wallet may read it. */
  const load = useCallback(async () => {
    if (!account) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { records: all } = await listRecords();
      const contract = await readContract();
      const access = {};
      for (const record of all) {
        try {
          // The contract answers, not the UI.
          access[record.tokenId] = contract
            ? await contract.canAccess(record.tokenId, account)
            : false;
        } catch {
          access[record.tokenId] = false;
        }
      }
      setAccessMap(access);
      setRecords(all);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [account, readContract]);

  useEffect(() => {
    load();
  }, [load]);

  const readable = useMemo(
    () => records.filter((record) => accessMap[record.tokenId]),
    [records, accessMap]
  );

  const requestRecord = () =>
    run('requestRecord', async () => {
      if (!isAddress(request.patient)) throw new Error('A valid patient address is required.');
      const contract = await writeContract();
      const tx = await contract.requestRecord(request.patient, request.recordType);
      await tx.wait();
    }, {
      successDetail: 'RecordRequested recorded. The lab requests — the admin decides whether to mint.',
    });

  const emergencyAccess = () =>
    run('emergencyAccess', async () => {
      const tokenId = Number(breakGlass.tokenId);
      if (!Number.isInteger(tokenId) || tokenId <= 0) throw new Error('Enter a token ID.');
      if (!breakGlass.reason.trim()) throw new Error('Break-glass requires a stated reason.');
      const contract = await writeContract();
      const tx = await contract.emergencyAccess(tokenId, account, breakGlass.reason.trim());
      await tx.wait();
      setBreakGlass({ tokenId: '', reason: '' });
      await load();
    }, {
      successDetail: 'One hour, one record, and the reason is permanently on-chain. Consent was bypassed by design.',
    });

  const openRecord = (tokenId) =>
    run(`Open record #${tokenId}`, async () => {
      const released = await releaseFile(tokenId, account);
      let plaintext = null;
      try {
        const bytes = fromBase64(released.ciphertext);
        plaintext = new TextDecoder().decode(await decryptRecord(bytes, released.contentKey));
      } catch {
        plaintext = null;
      }
      setViewing({ ...released, plaintext, byteLength: fromBase64(released.ciphertext).length });
      // Read the expiry from the contract so the countdown reflects real state.
      const contract = await readContract();
      if (contract) {
        const expiry = await contract.consent(tokenId, account);
        setViewing((current) =>
          current ? { ...current, expiresAt: Number(expiry) || undefined } : current
        );
      }
      await load();
    });

  if (!account) {
    return (
      <>
        <PageHeader eyebrow="Manager · Doctor / lab" title="Doctor console" />
        <EmptyState
          title="Connect a wallet first"
          hint="This console reads your role from the contract. Switch MetaMask to the Cardiology account to act as the doctor."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Manager · Doctor / lab"
        title="Doctor console"
        lead="Request records, read the ones the patient has opened to you, and break glass when you must. Requesting is not minting — the admin decides whether a record comes into existence."
        actions={
          <button type="button" onClick={load} className="btn-secondary">
            Refresh
          </button>
        }
      />

      {!isManager && (
        <Callout tone="warn" className="mb-5" title="This wallet does not hold MANAGER_ROLE">
          Request and break-glass will revert. That is the contract refusing, and it is worth
          watching once — a modified frontend cannot talk its way past it.
        </Callout>
      )}

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card title="Request a record" subtitle="RecordRequested is an event the admin can act on.">
          <div className="space-y-3">
            <AddressInput
              label="Patient address"
              value={request.patient}
              onChange={(value) => setRequest((current) => ({ ...current, patient: value }))}
            />
            <Field label="Record type">
              <div className="flex flex-wrap gap-1.5">
                {RECORD_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setRequest((current) => ({ ...current, recordType: type }))}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      request.recordType === type
                        ? 'border-teal-300 bg-teal-50 text-teal-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </Field>
            <button
              type="button"
              onClick={requestRecord}
              disabled={isBusy('requestRecord')}
              className="btn-primary w-full"
            >
              {isBusy('requestRecord') ? <Busy label="Confirming…" /> : 'requestRecord'}
            </button>
          </div>
        </Card>

        <Card
          tone="warn"
          title="Emergency break-glass"
          subtitle="Bypasses consent by design. One hour, one record, permanently logged."
        >
          <div className="space-y-3">
            <Field label="Token ID">
              <input
                className="input"
                value={breakGlass.tokenId}
                onChange={(event) =>
                  setBreakGlass((current) => ({
                    ...current,
                    tokenId: event.target.value.replace(/\D/g, ''),
                  }))
                }
                placeholder="1"
              />
            </Field>
            <Field label="Reason" hint="Stored on-chain forever. Write something you would defend.">
              <input
                className="input"
                value={breakGlass.reason}
                onChange={(event) =>
                  setBreakGlass((current) => ({ ...current, reason: event.target.value }))
                }
                placeholder="e.g., patient unconscious in A&E"
              />
            </Field>
            <button
              type="button"
              onClick={emergencyAccess}
              disabled={isBusy('emergencyAccess')}
              className="btn-secondary w-full border-amber-300 bg-white text-amber-800 hover:bg-amber-50"
            >
              {isBusy('emergencyAccess') ? <Busy label="Confirming…" /> : 'emergencyAccess'}
            </button>
            <p className="text-[11px] leading-relaxed text-slate-600">
              This is the honest exception to patient control. It is capped at one hour and the
              EmergencyAccessUsed event names the clinician and the reason, so it is auditable even
              though it is not based on consent.
            </p>
          </div>
        </Card>
      </div>

      <Card
        title="Records you may currently read"
              subtitle="Access is checked with the contract per record — never assumed from a role name."
        right={loading ? <Spinner className="text-slate-400" /> : null}
      >
        {records.length === 0 && !loading && (
          <EmptyState
            title="No records on this contract"
            hint="An admin needs to mint one first."
          />
        )}

        <ul className="space-y-3">
          {records.map((record) => {
            const allowed = accessMap[record.tokenId];
            return (
              <li
                key={record.tokenId}
                className={`rounded-lg border p-3.5 ${
                  allowed ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={allowed ? 'emerald' : 'slate'}>token #{record.tokenId}</Pill>
                  <span className="text-xs font-semibold text-slate-800">{record.recordType}</span>
                  {record.locked && <Pill tone="slate">soulbound</Pill>}
                  <span className="ml-auto text-[11px] text-slate-500">
                    {allowed ? 'Consent valid now' : 'No consent'}
                  </span>
                </div>

                <p className="mono mt-1.5 truncate text-slate-500">
                  Digest {record.recordHash}
                </p>
                <p className="mono mt-0.5 truncate text-slate-400">
                  Owner {record.patient}
                </p>

                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openRecord(record.tokenId)}
                    disabled={isBusy(`Open record #${record.tokenId}`)}
                    className={allowed ? 'btn-primary' : 'btn-secondary'}
                  >
                    {isBusy(`Open record #${record.tokenId}`) ? (
                      <Busy label="Asking the contract…" />
                    ) : allowed ? (
                      'Open record'
                    ) : (
                      'Try anyway (should be refused)'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiToken(record.tokenId)}
                    className="btn-secondary border-violet-300 text-violet-700 hover:bg-violet-50"
                  >
                    AI options ↓
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {readable.length === 0 && records.length > 0 && (
          <Callout tone="info" className="mt-3">
            You hold no active consent on any record right now. The patient can open a window from
            the Patient console — and the contract will close it again automatically.
          </Callout>
        )}
      </Card>

      {viewing && <ReleasedRecord record={viewing} onClose={() => setViewing(null)} />}

      <div className="mt-5" id="ai-options">
        <AiPanel tokenId={aiToken ?? records[0]?.tokenId} isOwner={false} />
      </div>
    </>
  );
}

function ReleasedRecord({ record, onClose }) {
  return (
    <Card
      className="mt-5"
      tone="ok"
      title={`Record #${record.tokenId} released by the contract`}
      subtitle={`The gate returned: ${record.checkedBy}`}
      right={
        <button type="button" onClick={onClose} className="btn-ghost">
          Close
        </button>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ConsentTimer expiresAt={record.expiresAt} label="Consent" />
        <Pill tone="slate">{record.recordType}</Pill>
        <Pill tone="slate">{formatBytes(record.byteLength)} ciphertext</Pill>
      </div>

      {record.plaintext ? (
        <pre className="max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white p-3.5 text-xs leading-relaxed text-slate-700">
          {record.plaintext}
        </pre>
      ) : (
        <Callout tone="warn" title="Released, but not readable here">
          The bytes arrived but could not be decrypted — this record was encrypted with a different
          key, or it is not text (an image or scan). The digest can still be verified on the Verify
          page.
        </Callout>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        You received this because the contract ran <span className="mono">viewRecord</span> as your
        address and it did not revert. Revoke the consent window and this same request returns
        AccessDenied instead.
      </p>
    </Card>
  );
}
