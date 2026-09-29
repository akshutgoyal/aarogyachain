import React, { useCallback, useEffect, useState } from 'react';
import { isAddress } from 'ethers';
import { useChain, describeError } from '../chain';
import { encryptRecord, formatBytes, toBase64 } from '../crypto';
import { chainIdentities, chainEvents, storeRecord } from '../services/api';
import { useTx } from '../hooks/useTx';
import { useToast } from '../components/Toast';
import AddressInput from '../components/AddressInput';
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

const RECORD_TYPES = ['MRI_SCAN', 'BLOOD_PANEL', 'XRAY', 'DISCHARGE_SUMMARY', 'PRESCRIPTION'];

export default function Admin() {
  const { account, roles, readContract, writeContract, refresh } = useChain();
  const toast = useToast();
  const onDone = useCallback(() => refresh(), [refresh]);
  const { busy, run, isBusy } = useTx({ onDone });

  const [identities, setIdentities] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // forms
  const [newIdentity, setNewIdentity] = useState({ address: '', label: '' });
  const [roleGrant, setRoleGrant] = useState({ address: '', role: 'MANAGER_ROLE' });
  const [mint, setMint] = useState({ patient: '', recordType: 'MRI_SCAN', file: null });
  const [revokeId, setRevokeId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [identityResult, eventResult] = await Promise.all([chainIdentities(), chainEvents(40)]);
      setIdentities(identityResult.identities || []);
      setEvents(eventResult.events || []);
    } catch (error) {
      setLoadError(describeError(error).detail || error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isAdmin = roles.admin;

  // ------------------------------------------------------------- actions

  const createIdentity = () =>
    run('Register identity', async () => {
      if (!isAddress(newIdentity.address)) throw new Error('A valid address is required.');
      if (!newIdentity.label.trim()) throw new Error('A label is required.');
      const contract = await writeContract();
      const tx = await contract.createIdentity(newIdentity.address, newIdentity.label.trim());
      await tx.wait();
      setNewIdentity({ address: '', label: '' });
      await load();
    }, { successDetail: 'IdentityCreated is now a permanent, public event.' });

  const grantRole = () =>
    run('Grant role', async () => {
      if (!isAddress(roleGrant.address)) throw new Error('A valid address is required.');
      const contract = await writeContract();
      const roleValue =
        roleGrant.role === 'MANAGER_ROLE'
          ? await contract.MANAGER_ROLE()
          : await contract.AUDITOR_ROLE();
      const tx = await contract.grantRole(roleValue, roleGrant.address);
      await tx.wait();
      setRoleGrant((current) => ({ ...current, address: '' }));
      await load();
    }, { successDetail: 'RoleGranted is recorded on-chain and the wallet can now use that console.' });

  const mintRecord = () =>
    run('Mint record', async () => {
      if (!isAddress(mint.patient)) throw new Error('A valid patient address is required.');
      if (!mint.file) throw new Error('Choose a file to attach.');

      // 1. Encrypt HERE. The server receives ciphertext, never the document.
      const buffer = await mint.file.arrayBuffer();
      const { payload, digest, contentKey } = await encryptRecord(buffer);

      // 2. Store the bytes first. If this fails we abort BEFORE minting, because
      //    a token whose bytes nobody holds is worse than no token at all.
      const contract = await readContract();
      const tokenId = Number(await contract.nextTokenId());

      await storeRecord({
        tokenId,
        patient: mint.patient,
        recordType: mint.recordType,
        fileName: mint.file.name,
        mimeType: mint.file.type || 'application/octet-stream',
        contentKey,
        ciphertext: toBase64(payload),
        cid: `local://${digest.slice(2, 14)}`,
      });

      // 3. Only the 32-byte digest goes on-chain.
      const writable = await writeContract();
      const tx = await writable.mintRecord(
        mint.patient,
        digest,
        `local://${digest.slice(2, 14)}`,
        mint.recordType
      );
      await tx.wait();
      setMint({ patient: '', recordType: 'MRI_SCAN', file: null });
    }, {
      successTitle: 'Record minted',
      successDetail: 'The token is now owned by the patient, not by the hospital — check ownerOf on Etherscan.',
    });

  const revokeRecord = () =>
    run('Revoke record', async () => {
      const tokenId = Number(revokeId);
      if (!Number.isInteger(tokenId) || tokenId <= 0) throw new Error('Enter a token id.');
      const contract = await writeContract();
      const tx = await contract.revokeRecord(tokenId);
      await tx.wait();
      setRevokeId('');
      await load();
    }, { successDetail: 'The record is burned on-chain. A replacement would be issued to a new wallet.' });

  const testTransferBlock = () =>
    run(
      'Attempt transfer',
      async () => {
        const contract = await writeContract();
        const tokenId = Number(revokeId) || 1;
        try {
          // A simulated call, so proving the point costs no gas.
          await contract.transferFrom.staticCall(account, account, tokenId);
        } catch (error) {
          return describeError(error).title;
        }
        throw new Error(
          'The transfer succeeded. Soulbound enforcement is broken — that should be impossible.'
        );
      },
      {
        successTitle: 'Reverted, as designed',
        successDetail: (revertName) =>
          `The contract refused the transfer (${revertName}). Even the owner cannot move a record — the code path does not exist.`,
      }
    );

  return (
    <>
      <PageHeader
        eyebrow="Hospital IT · Admin"
        title="Admin console"
        lead="Register identities, grant roles, mint records and revoke them. Only this wallet can mint — and that restriction lives in the contract, not on this page."
        actions={
          <button type="button" onClick={load} className="btn-secondary">
            Refresh
          </button>
        }
      />

      {!account && (
        <Callout tone="warn" className="mb-5" title="Connect the admin wallet">
          Connect MetaMask with the Hospital IT account. If you are using a different account, the
          non-admin revert is worth trying — it is the headline proof.
        </Callout>
      )}

      {account && !isAdmin && (
        <Callout tone="danger" className="mb-5" title="This wallet is not the admin">
          You can still press Mint below. The transaction will revert with a missing-role error —
          the website will not stop you, because the website is not the gate. That failure is the
          demonstration.
        </Callout>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="1 · Register an identity"
          subtitle="Identity creation is itself an auditable on-chain event."
        >
          <div className="space-y-3">
            <AddressInput
              label="Wallet address"
              value={newIdentity.address}
              onChange={(v) => setNewIdentity((c) => ({ ...c, address: v }))}
            />
            <Field label="Label" hint="A role title only — never personal data.">
              <input
                className="input"
                value={newIdentity.label}
                onChange={(event) =>
                  setNewIdentity((c) => ({ ...c, label: event.target.value }))
                }
                placeholder="e.g. Cardiology"
              />
            </Field>
            <button
              type="button"
              onClick={createIdentity}
              disabled={isBusy('Register identity')}
              className="btn-primary w-full"
            >
              {isBusy('Register identity') ? <Busy label="Confirming…" /> : 'createIdentity'}
            </button>
          </div>
        </Card>

        <Card title="2 · Grant a role" subtitle="MANAGER for clinicians and labs, AUDITOR for compliance.">
          <div className="space-y-3">
            <AddressInput
              label="Wallet address"
              value={roleGrant.address}
              onChange={(v) => setRoleGrant((c) => ({ ...c, address: v }))}
            />
            <Field label="Role">
              <div className="flex gap-2">
                {['MANAGER_ROLE', 'AUDITOR_ROLE'].map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setRoleGrant((c) => ({ ...c, role }))}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                      roleGrant.role === role
                        ? 'border-teal-300 bg-teal-50 text-teal-700'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </Field>
            <button
              type="button"
              onClick={grantRole}
              disabled={isBusy('Grant role')}
              className="btn-primary w-full"
            >
              {isBusy('Grant role') ? <Busy label="Confirming…" /> : 'grantRole'}
            </button>
          </div>
        </Card>

        <Card
          className="lg:col-span-2"
          title="3 · Mint a record"
          subtitle="The file is encrypted in this browser. Only the 32-byte digest reaches the chain."
          tone={isAdmin ? 'default' : 'warn'}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <AddressInput
                label="Patient address"
                value={mint.patient}
                onChange={(v) => setMint((c) => ({ ...c, patient: v }))}
                hint="The patient must have a registered identity, or the mint reverts."
              />

              <Field label="Record type">
                <div className="flex flex-wrap gap-1.5">
                  {RECORD_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMint((c) => ({ ...c, recordType: type }))}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                        mint.recordType === type
                          ? 'border-teal-300 bg-teal-50 text-teal-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <div className="space-y-3">
              <Field
                label="Record file"
                hint={
                  mint.file
                    ? `${mint.file.name} · ${formatBytes(mint.file.size)} — will be encrypted before it leaves this tab`
                    : 'Any file. It never leaves the browser in plaintext.'
                }
              >
                <input
                  type="file"
                  onChange={(event) =>
                    setMint((c) => ({ ...c, file: event.target.files?.[0] || null }))
                  }
                  className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white text-xs text-slate-600 file:mr-3 file:cursor-pointer file:rounded-l-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                />
              </Field>

              <button
                type="button"
                onClick={mintRecord}
                disabled={isBusy('Mint record')}
                className="btn-primary w-full"
              >
                {isBusy('Mint record') ? (
                  <Busy label="Encrypting, storing, then minting…" />
                ) : (
                  'Encrypt, store and mintRecord'
                )}
              </button>

              <p className="text-[11px] leading-relaxed text-slate-500">
                Three steps, in this order: encrypt here, store the ciphertext, then put the digest
                on-chain. The contract refuses the third step for any wallet without
                DEFAULT_ADMIN_ROLE.
              </p>
            </div>
          </div>
        </Card>

        <Card
          title="4 · Revoke, and try to break soulbound"
          subtitle="Both are useful on stage. One is irreversible, the other just proves a point."
        >
          <div className="space-y-3">
            <Field label="Token id">
              <input
                className="input"
                value={revokeId}
                onChange={(event) => setRevokeId(event.target.value.replace(/\D/g, ''))}
                placeholder="1"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={revokeRecord}
                disabled={isBusy('Revoke record')}
                className="btn-danger"
              >
                {isBusy('Revoke record') ? <Busy label="Confirming…" /> : 'revokeRecord'}
              </button>
              <button
                type="button"
                onClick={testTransferBlock}
                disabled={isBusy('Attempt transfer')}
                className="btn-secondary"
              >
                {isBusy('Attempt transfer') ? (
                  <Busy label="Simulating…" />
                ) : (
                  'Try transferFrom (should revert)'
                )}
              </button>
            </div>
            <Callout tone="warn">
              Revoking burns the token permanently — it is the documented path for a lost wallet, not
              an undo. The transfer check is a simulated call, so it costs no gas.
            </Callout>
          </div>
        </Card>

        <Card
          title="Registered identities"
          subtitle={`${identities.length} found in the IdentityCreated log`}
          right={loading ? <Spinner className="text-slate-400" /> : null}
        >
          {loadError && (
            <Callout tone="danger" title="Could not read from the backend">
              {loadError}
            </Callout>
          )}
          {!loadError && identities.length === 0 && !loading && (
            <EmptyState title="No identities registered yet" hint="Register one above to begin." />
          )}
          <ul className="divide-y divide-slate-100">
            {identities.map((entry) => (
              <li key={entry.account} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-800">{entry.label}</span>
                    {entry.roles.admin && <Pill tone="teal">admin</Pill>}
                    {entry.roles.manager && <Pill tone="teal">manager</Pill>}
                    {entry.roles.auditor && <Pill tone="teal">auditor</Pill>}
                    {!entry.active && <Pill tone="rose">inactive</Pill>}
                  </div>
                  <p className="mono mt-0.5 text-slate-500">{entry.account}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard?.writeText(entry.account).then(
                        () => toast.ok('Address copied'),
                        () => {}
                      )
                    }
                    className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-50"
                  >
                    copy
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        className="mt-5"
        title="Audit trail — the last events on this contract"
        subtitle="Nobody maintains a log file. The chain is the log."
      >
        {events.length === 0 ? (
          <EmptyState title="No events read yet" />
        ) : (
          <ol className="space-y-2">
            {events.map((event) => (
              <li
                key={`${event.txHash}-${event.name}-${event.blockNumber}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-slate-100 pb-2 last:border-0 last:pb-0"
              >
                <Pill tone="slate">{event.name}</Pill>
                <span className="mono text-slate-400">block {event.blockNumber}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-600">
                  {Object.entries(event.args)
                    .filter(([, v]) => v !== '' && v !== null)
                    .map(([k, v]) => `${k}=${String(v).slice(0, 22)}`)
                    .join('  ')}
                </span>
                <a
                  href={`https://sepolia.etherscan.io/tx/${event.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-teal-700 underline decoration-dotted"
                >
                  etherscan ↗
                </a>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}
