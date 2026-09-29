import React, { useCallback, useEffect, useState } from 'react';
import { useChain, describeError } from '../chain';
import { listRecords, auditRecord, chainEvents } from '../services/api';
import { useTx } from '../hooks/useTx';
import { Callout, Card, EmptyState, PageHeader, Pill, Spinner } from '../components/ui';

export default function Auditor() {
  const { account, roles, writeContract } = useChain();
  const { run, isBusy } = useTx();

  const [records, setRecords] = useState([]);
  const [audits, setAudits] = useState({});
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAuditor = roles.auditor;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ records: all }, { events: log }] = await Promise.all([
        listRecords(),
        chainEvents(100),
      ]);
      setRecords(all);
      setEvents(log);

      // Every record's metadata, which is all an auditor is ever given.
      const collected = {};
      for (const record of all) {
        try {
          collected[record.tokenId] = await auditRecord(record.tokenId);
        } catch {
          /* skip */
        }
      }
      setAudits(collected);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * The point of this button: a wallet without AUDITOR_ROLE is refused by the
   * contract. The page could have hidden it, but hiding it would prove nothing.
   */
  const tryAuditCall = (tokenId) =>
    run(`auditRecord #${tokenId}`, async () => {
      const contract = await writeContract();
      try {
        await contract.auditRecord.staticCall(tokenId);
        return 'allowed';
      } catch (error) {
        return describeError(error).title;
      }
    }, {
      successTitle: (result) =>
        result === 'allowed' ? 'The contract allowed it' : 'Refused by the contract',
      successDetail: (result) =>
        result === 'allowed'
          ? 'This wallet holds AUDITOR_ROLE. Note what came back: hash, type, time and owner — and no file location.'
          : `The call reverted with "${result}". The website did not hide the button; the contract rejected the call.`,
    });

  return (
    <>
      <PageHeader
        eyebrow="Compliance · Auditor"
        title="Auditor console"
        lead="An auditor can prove a record is authentic and see everything that happened to it, without ever being able to read it. That separation is enforced by the contract, not promised by policy."
        actions={
          <button type="button" onClick={load} className="btn-secondary">
            Refresh
          </button>
        }
      />

      <Callout tone="info" className="mb-5" title="Metadata only — by design">
        The auditor view returns the digest, the record type, the mint time and the owner. It never
        returns the file location, so there is no path from this page to the document. Solidity
        <span className="mono"> private </span>
        only removes the CID from the ABI — encryption is what actually protects the file, and the
        contract gates the location.
      </Callout>

      {account && !isAuditor && (
        <Callout tone="warn" className="mb-5" title="This wallet does not hold AUDITOR_ROLE">
          Press the audit check below and watch the contract refuse it. That refusal is the feature.
        </Callout>
      )}

      <Card
        title="Records on this contract"
        subtitle="Read straight from the chain, with no wallet required."
        right={loading ? <Spinner className="text-slate-400" /> : null}
      >
        {records.length === 0 && !loading ? (
          <EmptyState title="No records to audit" />
        ) : (
          <ul className="space-y-3">
            {records.map((record) => {
              const audit = audits[record.tokenId];
              return (
                <li key={record.tokenId} className="rounded-lg border border-slate-200 p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="slate">token #{record.tokenId}</Pill>
                    <span className="text-xs font-semibold text-slate-800">
                      {record.recordType}
                    </span>
                    {record.locked && <Pill tone="slate">soulbound</Pill>}
                    <span className="ml-auto text-[11px] text-slate-500">
                      block {record.mintedAtBlock}
                    </span>
                  </div>

                  <dl className="mt-2.5 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                        Record digest
                      </dt>
                      <dd className="mono truncate text-slate-700">{record.recordHash}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] uppercase tracking-wide text-slate-400">Owner</dt>
                      <dd className="mono truncate text-slate-700">{record.patient}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                        File location (CID)
                      </dt>
                      <dd className="text-xs text-rose-600">
                        Withheld — {audit?.fileReleased === false ? 'not released' : 'never returned'}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] uppercase tracking-wide text-slate-400">
                        Mint transaction
                      </dt>
                      <dd className="truncate text-xs">
                        <a
                          href={`https://sepolia.etherscan.io/tx/${record.mintedTx}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-teal-700 underline decoration-dotted"
                        >
                          {record.mintedTx?.slice(0, 18)}… ↗
                        </a>
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={() => tryAuditCall(record.tokenId)}
                      disabled={isBusy(`auditRecord #${record.tokenId}`)}
                      className="btn-secondary"
                    >
                      {isBusy(`auditRecord #${record.tokenId}`)
                        ? 'Asking the contract…'
                        : 'Call auditRecord as this wallet'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card
        className="mt-5"
        title="The complete event log"
        subtitle="Nobody maintains this. The chain is the log."
      >
        {events.length === 0 ? (
          <EmptyState title="No events" />
        ) : (
          <ol className="space-y-1.5">
            {events.map((event, index) => (
              <li
                key={`${event.txHash}-${index}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-slate-100 pb-1.5 last:border-0"
              >
                <span className="mono text-slate-400">{event.blockNumber}</span>
                <Pill tone="slate">{event.name}</Pill>
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-600">
                  {Object.entries(event.args)
                    .filter(([, value]) => value !== '' && value !== null)
                    .map(([key, value]) => `${key}=${String(value).slice(0, 24)}`)
                    .join('   ')}
                </span>
                <a
                  href={`https://sepolia.etherscan.io/tx/${event.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-teal-700 underline decoration-dotted"
                >
                  ↗
                </a>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}
