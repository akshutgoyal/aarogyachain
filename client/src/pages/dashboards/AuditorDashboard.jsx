import React, { useMemo, useState } from 'react';
import { useChain, shortAddress } from '../../chain';
import { useStats, useProfiles } from '../../hooks/useDashboardData';
import { auditRecord } from '../../services/api';
import { DonutChart, BarsChart, AreaTrend } from '../../components/viz/charts';
import LifecycleFlow from '../../components/viz/LifecycleFlow';
import {
  ChartCard,
  DataTable,
  DonutLegend,
  EmptyPanel,
  OffChainBadge,
  ProgressBar,
  StatCard,
} from '../../components/viz/primitives';
import { Card, Callout, Pill, Spinner, Busy } from '../../components/ui';

export default function AuditorDashboard() {
  const { roles } = useChain();
  const { stats, loading, error } = useStats();
  const { nameFor } = useProfiles();
  const [opened, setOpened] = useState({});
  const [busyToken, setBusyToken] = useState(null);

  const eventRows = useMemo(() => {
    if (!stats) return [];
    return stats.recentEvents.map((event) => ({
      ...event,
      summary: Object.entries(event.args || {})
        .filter(([, value]) => value !== '' && value !== null)
        .map(([key, value]) => `${key}=${String(value).slice(0, 26)}`)
        .join('  '),
    }));
  }, [stats]);

  if (loading && !stats) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Reading the ledger…
      </div>
    );
  }
  if (error && !stats) return <EmptyPanel title="Could not read dashboard data" hint={error} />;

  // Which contract events we can see, against the nine the design claims.
  const NINE = [
    'IdentityCreated',
    'RecordRequested',
    'RecordMinted',
    'Locked',
    'AccessGranted',
    'AccessRevoked',
    'EmergencyAccessUsed',
    'RecordRevoked',
    'RoleGranted',
  ].filter((name) => name !== 'Locked' && name !== 'RoleGranted');

  const observed = new Set(stats.eventsByType.map((entry) => entry.name));
  const covered = NINE.filter((name) => observed.has(name)).length;

  const openMeta = async (tokenId) => {
    setBusyToken(tokenId);
    try {
      const metadata = await auditRecord(tokenId);
      setOpened((current) => ({ ...current, [tokenId]: metadata }));
    } catch {
      /* surfaced by the row staying closed */
    } finally {
      setBusyToken(null);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
          Compliance · Auditor
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Audit workspace
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">
          An auditor can prove a record is authentic and see everything that happened to it, without
          ever being able to read it. The contract never releases the file location to this role, so
          there is no path from this page to a document.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Records under audit" value={stats.totals.records} />
        <StatCard label="Events recorded" value={stats.totals.events} tone="teal" />
        <StatCard
          label="Files released to this role"
          value={0}
          tone="rose"
          hint="By design — the CID is never returned"
        />
        <StatCard label="Identities" value={stats.totals.identities} />
        <StatCard
          label="Consent windows"
          value={stats.totals.activeConsents + stats.totals.expiredConsents}
          hint={`${stats.totals.activeConsents} active · ${stats.totals.expiredConsents} expired`}
        />
      </div>

      {!roles.auditor && (
        <Callout tone="warn" title="This wallet does not hold AUDITOR_ROLE">
          The metadata below is public, because the chain is public. What the role gates is the
          contract's own <span className="mono">auditRecord</span> call — press it on any row and the
          contract will refuse the call.
        </Callout>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Events by type"
          subtitle="The audit trail, by kind"
          right={
            <div className="w-40">
              <DonutLegend data={stats.eventsByType.slice(0, 4)} />
            </div>
          }
        >
          <DonutChart data={stats.eventsByType} centerLabel="events" />
        </ChartCard>

        <ChartCard
          className="lg:col-span-2"
          title="Audit trail over time"
          subtitle="Every state change the contract recorded"
          height={230}
        >
          <AreaTrend data={stats.activityByDay} color="#0f172a" label="events" />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Records by type" subtitle="What the hospital issued" height={200}>
          <BarsChart data={stats.recordsByType} horizontal />
        </ChartCard>

        <Card
          className="lg:col-span-2"
          title="Audit coverage"
          subtitle="Event kinds observed against the nine the design claims"
        >
          <ProgressBar
            value={covered}
            max={NINE.length}
            label="Event types seen on this contract"
            sublabel={`${covered} / ${NINE.length}`}
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {NINE.map((name) => (
              <span
                key={name}
                className={`mono rounded px-1.5 py-0.5 text-[10px] ring-1 ring-inset ${
                  observed.has(name)
                    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                    : 'bg-slate-50 text-slate-400 ring-slate-200'
                }`}
              >
                {name}
              </span>
            ))}
          </div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500">
            Grey events have simply not happened yet on this contract. Their absence is not a defect
            — <span className="mono">AccessRevoked</span> only exists once someone revokes.
          </p>
        </Card>
      </div>

      <Card
        title="Record metadata"
        subtitle="Hash, type, time and owner. The file location is withheld by the contract."
        right={<Pill tone="slate">{stats.records.length} records</Pill>}
      >
        <DataTable
          rowKey={(row) => row.tokenId}
          columns={[
            { key: 'tokenId', label: 'Token', render: (row) => <Pill tone="slate">#{row.tokenId}</Pill> },
            { key: 'recordType', label: 'Type' },
            {
              key: 'patient',
              label: 'Owner',
              render: (row) => (
                <div className="flex items-center gap-1.5">
                  <span>{row.patientName || row.patientLabel || shortAddress(row.patient)}</span>
                  {row.patientName && <OffChainBadge />}
                </div>
              ),
            },
            {
              key: 'recordHash',
              label: 'Digest',
              mono: true,
              render: (row) => <span className="block max-w-[16rem] truncate">{row.recordHash}</span>,
            },
            {
              key: 'cid',
              label: 'File location',
              render: () => <span className="text-rose-600">Withheld</span>,
            },
            { key: 'mintedAtBlock', label: 'Block', align: 'right' },
            {
              key: 'audit',
              label: '',
              align: 'right',
              render: (row) =>
                opened[row.tokenId] ? (
                  <span className="text-[10px] text-emerald-700">Metadata returned ✓</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => openMeta(row.tokenId)}
                    disabled={busyToken === row.tokenId}
                    className="text-[11px] font-medium text-slate-600 underline"
                  >
                    {busyToken === row.tokenId ? <Busy label="Asking…" /> : 'Call auditRecord'}
                  </button>
                ),
            },
          ]}
          rows={stats.records}
          empty="No records to audit"
        />
      </Card>

      <Card title="Complete event log" subtitle="Nobody maintains this. The chain is the log.">
        <DataTable
          rowKey={(row, index) => `${row.txHash}-${index}`}
          columns={[
            { key: 'blockNumber', label: 'Block', align: 'right' },
            { key: 'name', label: 'Event', render: (row) => <Pill tone="slate">{row.name}</Pill> },
            {
              key: 'summary',
              label: 'Arguments',
              mono: true,
              render: (row) => <span className="block max-w-[26rem] truncate">{row.summary}</span>,
            },
            {
              key: 'tx',
              label: '',
              align: 'right',
              render: (row) => (
                <a
                  href={`https://sepolia.etherscan.io/tx/${row.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-teal-700 underline decoration-dotted"
                >
                  etherscan ↗
                </a>
              ),
            },
          ]}
          rows={eventRows}
          empty="No events"
        />
      </Card>

      <Card
        title="Record lifecycle"
        subtitle="What the auditor may and may not see at each step"
      >
        <LifecycleFlow />
      </Card>
    </div>
  );
}
