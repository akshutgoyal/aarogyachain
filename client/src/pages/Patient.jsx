import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isAddress } from 'ethers';
import { useChain } from '../chain';
import { decryptRecord, fromBase64 } from '../crypto';
import { chainEvents, releaseFile } from '../services/api';
import { useTx } from '../hooks/useTx';
import { DEMO_ACCOUNTS } from '../config/demoAccounts';
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

// A short option is included on purpose: watching a window expire on stage in
// under a minute is far more convincing than claiming that it would.
const DURATIONS = [
  { label: '60 seconds', value: 60, note: 'for the demo' },
  { label: '1 hour', value: 3600 },
  { label: '24 hours', value: 86400 },
  { label: '7 days', value: 604800 },
];

export default function Patient() {
  const { account, ownedRecords, readContract, writeContract, refresh } = useChain();
  const { busy, run, isBusy } = useTx({ onDone: useCallback(() => refresh(), [refresh]) });

  const [grants, setGrants] = useState([]);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [grant, setGrant] = useState({ viewer: '', duration: 3600 });
  const [viewing, setViewing] = useState(null);
  const [aiToken, setAiToken] = useState(null);

  const tokenIds = useMemo(() => ownedRecords.map((r) => r.tokenId), [ownedRecords]);

  /**
   * Who currently holds access, and until when.
   *
   * Candidates come from the audit log (every AccessGranted viewer), and each one
   * is then checked against the contract. The event list tells us who to ask
   * about; the contract tells us the truth.
   */
  const loadGrants = useCallback(async () => {
    if (tokenIds.length === 0) {
      setGrants([]);
      return;
    }
    setLoadingGrants(true);
    try {
      const { events } = await chainEvents(200);
      const candidates = new Set(DEMO_ACCOUNTS.map((a) => a.address));
      for (const event of events) {
        if (event.name === 'AccessGranted' && event.args?.viewer) {
          candidates.add(event.args.viewer);
        }
        if (event.name === 'EmergencyAccessUsed' && event.args?.viewer) {
          candidates.add(event.args.viewer);
        }
      }

      const contract = await readContract();
      const rows = [];
      for (const tokenId of tokenIds) {
        for (const viewer of candidates) {
          if (viewer.toLowerCase() === account?.toLowerCase()) continue;
          try {
            const [expiry] = await Promise.all([contract.consent(tokenId, viewer)]);
            const expiryNumber = Number(expiry);
            if (expiryNumber > 0) {
              rows.push({
                tokenId,
                viewer,
                expiresAt: expiryNumber,
                active: expiryNumber * 1000 > Date.now(),
                label:
                  DEMO_ACCOUNTS.find((a) => a.address.toLowerCase() === viewer.toLowerCase())
                    ?.label || 'Unlabelled wallet',
              });
            }
          } catch {
            /* skip */
          }
        }
      }
      setGrants(rows);
    } catch {
      setGrants([]);
    } finally {
      setLoadingGrants(false);
    }
  }, [account, readContract, tokenIds]);

  useEffect(() => {
    loadGrants();
  }, [loadGrants]);

  const grantAccess = () =>
    run('grantAccess', async () => {
      if (!isAddress(grant.viewer)) throw new Error('A valid viewer address is required.');
      const contract = await writeContract();
      const tokenId = tokenIds[0];
      if (!tokenId) throw new Error('You do not own a record yet.');
      const tx = await contract.grantAccess(tokenId, grant.viewer, grant.duration);
      await tx.wait();
      setGrant((current) => ({ ...current, viewer: '' }));
      await loadGrants();
    }, {
      successTitle: 'Consent window opened',
      successDetail:
        'The contract will close it on time, with nobody having to intervene. Check the countdown, then come back after it hits zero.',
    });

  const revokeAccess = (tokenId, viewer) =>
    run(`revokeAccess #${tokenId}`, async () => {
      const contract = await writeContract();
      const tx = await contract.revokeAccess(tokenId, viewer);
      await tx.wait();
      await loadGrants();
    }, {
      successDetail: 'AccessRevoked recorded. The same read now returns AccessDenied, and so does the AI.',
    });

  const openOwnRecord = (tokenId) =>
    run(`Open record #${tokenId}`, async () => {
      const released = await releaseFile(tokenId, account);
      let plaintext = null;
      try {
        plaintext = new TextDecoder().decode(
          await decryptRecord(fromBase64(released.ciphertext), released.contentKey)
        );
      } catch {
        plaintext = null;
      }
      setViewing({ ...released, plaintext });
    });

  if (!account) {
    return (
      <>
        <PageHeader eyebrow="Record owner · Patient" title="Patient console" />
        <EmptyState
          title="Connect a wallet first"
          hint="Switch MetaMask to the Patient account to see the records you own and who can read them."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Record owner · Patient"
        title="Patient console"
        lead="These records are yours. You decide who may read them, for how long, and you can withdraw that at any moment — the contract does the enforcing, so nobody has to be trusted to honour it."
        actions={
          <button type="button" onClick={loadGrants} className="btn-secondary">
            Refresh
          </button>
        }
      />

      {ownedRecords.length === 0 ? (
        <EmptyState
          title="You do not own any records yet"
          hint="An admin mints records to a patient wallet. If a record was issued to a different address, switch MetaMask account — your role is read from the chain, not chosen here."
        />
      ) : (
        <>
          <Card
            className="mb-5"
            title="Your records"
            subtitle={`${ownedRecords.length} soulbound token(s) owned by this wallet`}
          >
            <ul className="space-y-3">
              {ownedRecords.map((record) => (
                <li key={record.tokenId} className="rounded-lg border border-slate-200 p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="teal">token #{record.tokenId}</Pill>
                    <span className="text-xs font-semibold text-slate-800">
                      {record.recordType}
                    </span>
                    {record.locked && <Pill tone="slate">soulbound — cannot be transferred</Pill>}
                    <span className="ml-auto text-[11px] text-slate-500">
                      minted in block {record.mintedAtBlock}
                    </span>
                  </div>
                  <p className="mono mt-1.5 truncate text-slate-500">
                    digest {record.recordHash}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openOwnRecord(record.tokenId)}
                      disabled={isBusy(`Open record #${record.tokenId}`)}
                      className="btn-secondary"
                    >
                      {isBusy(`Open record #${record.tokenId}`) ? (
                        <Busy label="Decrypting…" />
                      ) : (
                        'Open my record'
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
              ))}
            </ul>
          </Card>

          <div className="mb-5" id="ai-consent">
            <AiPanel tokenId={aiToken ?? tokenIds[0]} isOwner />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card
              title="Grant time-boxed access"
              subtitle="You authorise. Nobody can do this on your behalf."
            >
              <div className="space-y-3">
                <AddressInput
                  label="Who may read it"
                  value={grant.viewer}
                  onChange={(value) => setGrant((current) => ({ ...current, viewer: value }))}
                  exclude={[account]}
                  hint="Any wallet works — a doctor, a clinic, an insurer."
                />
                <Field label="For how long">
                  <div className="grid grid-cols-2 gap-2">
                    {DURATIONS.map((duration) => (
                      <button
                        key={duration.value}
                        type="button"
                        onClick={() => setGrant((current) => ({ ...current, duration: duration.value }))}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                          grant.duration === duration.value
                            ? 'border-teal-300 bg-teal-50 text-teal-700'
                            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {duration.label}
                        {duration.note && (
                          <span className="ml-1 text-[10px] font-normal text-slate-400">
                            {duration.note}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </Field>
                <button
                  type="button"
                  onClick={grantAccess}
                  disabled={isBusy('grantAccess')}
                  className="btn-primary w-full"
                >
                  {isBusy('grantAccess') ? <Busy label="Confirming…" /> : 'grantAccess'}
                </button>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Pick 60 seconds to watch the read and the AI summary both stop working on their
                  own, with no further action from anyone.
                </p>
              </div>
            </Card>

            <Card
              title="Who can read your records right now"
              subtitle="Read from the contract's consent map, not from a local record of grants."
              right={loadingGrants ? <Spinner className="text-slate-400" /> : null}
            >
              {grants.length === 0 && !loadingGrants && (
                <EmptyState
                  title="Nobody has access"
                  hint="That is the default state. Consent is something you give, not something you withdraw."
                />
              )}
              <ul className="space-y-3">
                {grants.map((entry) => (
                  <li
                    key={`${entry.tokenId}-${entry.viewer}`}
                    className={`rounded-lg border p-3 ${
                      entry.active ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800">{entry.label}</span>
                      <Pill tone="slate">token #{entry.tokenId}</Pill>
                      <ConsentTimer expiresAt={entry.active ? entry.expiresAt : undefined} />
                    </div>
                    <p className="mono mt-1 truncate text-slate-500">{entry.viewer}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => revokeAccess(entry.tokenId, entry.viewer)}
                        disabled={isBusy(`revokeAccess #${entry.tokenId}`)}
                        className="btn-danger"
                      >
                        {isBusy(`revokeAccess #${entry.tokenId}`) ? (
                          <Busy label="Confirming…" />
                        ) : (
                          'Revoke now'
                        )}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {grants.length > 0 && (
                <Callout tone="info" className="mt-3">
                  Revoking is immediate and public. The moment it lands, the record read and the AI
                  summary both answer with AccessDenied — there is no cache of permission to expire.
                </Callout>
              )}
            </Card>
          </div>
        </>
      )}

      {viewing && (
        <Card
          className="mt-5"
          tone="ok"
          title={`Your record #${viewing.tokenId}`}
          subtitle="You are the owner, so the contract releases this without a consent window."
          right={
            <button type="button" onClick={() => setViewing(null)} className="btn-ghost">
              Close
            </button>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Pill tone="slate">{viewing.recordType}</Pill>
            <Pill tone="slate">digest {viewing.recordHash?.slice(0, 14)}…</Pill>
          </div>
          {viewing.plaintext ? (
            <pre className="max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white p-3.5 text-xs leading-relaxed text-slate-700">
              {viewing.plaintext}
            </pre>
          ) : (
            <Callout tone="warn" title="Released, but not text">
              This record decrypted but is not readable text — most scans are images. Its digest can
              still be verified on the Verify page.
            </Callout>
          )}
        </Card>
      )}
    </>
  );
}
