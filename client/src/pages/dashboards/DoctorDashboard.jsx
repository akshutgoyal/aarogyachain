import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useChain, shortAddress } from '../../chain';
import { useStats, useProfiles } from '../../hooks/useDashboardData';
import { DonutChart, BarsChart, AreaTrend, AccessBars, GaugeChart } from '../../components/viz/charts';
import LifecycleFlow from '../../components/viz/LifecycleFlow';
import ConsentTimer from '../../components/ConsentTimer';
import {
  ChartCard,
  DataTable,
  DonutLegend,
  EmptyPanel,
  OffChainBadge,
  ProgressBar,
  StatCard,
} from '../../components/viz/primitives';
import { Callout, Card, Pill, Spinner } from '../../components/ui';

export default function DoctorDashboard() {
  const { account, roles } = useChain();
  const { stats, loading, error } = useStats();
  const { nameFor } = useProfiles();

  // Which records this wallet may read right now, straight from the consent rows
  // the backend read out of the contract.
  const mine = useMemo(() => {
    if (!stats || !account) return { active: [], expired: [] };
    const lower = account.toLowerCase();
    const forMe = stats.consents.filter((c) => c.viewer.toLowerCase() === lower);
    return {
      active: forMe.filter((c) => c.active),
      expired: forMe.filter((c) => !c.active),
    };
  }, [stats, account]);

  const accessibleTokenIds = useMemo(
    () => new Set(mine.active.map((c) => c.tokenId)),
    [mine.active]
  );

  const accessibleRecords = useMemo(
    () => (stats ? stats.records.filter((r) => accessibleTokenIds.has(r.tokenId)) : []),
    [stats, accessibleTokenIds]
  );

  if (loading && !stats) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Reading the contract…
      </div>
    );
  }

  if (error && !stats) {
    return <EmptyPanel title="Could not read dashboard data" hint={error} />;
  }

  // ---- derived shapes ---------------------------------------------------
  const patientsWithRecords = stats.patients.filter((p) => p.records > 0);
  const patientsReachable = patientsWithRecords.filter((p) =>
    stats.records.some((r) => r.patient === p.address && accessibleTokenIds.has(r.tokenId))
  );

  const accessSplit = [
    { name: 'Readable now', value: accessibleRecords.length },
    {
      name: 'No active consent',
      value: Math.max(0, stats.totals.records - accessibleRecords.length),
    },
  ];

  const coverage = stats.totals.records > 0 ? accessibleRecords.length / stats.totals.records : 0;

  const patientRows = stats.patients
    .filter((p) => p.records > 0 || p.roles.manager)
    .map((patient) => {
      const theirRecords = stats.records.filter((r) => r.patient === patient.address);
      const readable = theirRecords.filter((r) => accessibleTokenIds.has(r.tokenId));
      const expired = mine.expired.filter((c) => theirRecords.some((r) => r.tokenId === c.tokenId));
      return {
        ...patient,
        recordCount: theirRecords.length,
        readableCount: readable.length,
        expiredCount: expired.length,
        expiresAt: mine.active.find((c) => theirRecords.some((r) => r.tokenId === c.tokenId))
          ?.expiresAt,
        state:
          readable.length > 0
            ? 'readable'
            : expired.length > 0
              ? 'expired'
              : theirRecords.length > 0
                ? 'none'
                : 'no-records',
      };
    })
    .sort((a, b) => b.readableCount - a.readableCount || b.recordCount - a.recordCount);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
            Clinician · Manager role
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Clinical workspace
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
            Every record below is filtered by what the contract says you may read. Nothing here is
            cached permission — each row was checked against{' '}
            <span className="mono text-xs">canAccess</span> as this wallet.
          </p>
        </div>
        {!roles.manager && (
          <Callout tone="warn" className="max-w-sm">
            This wallet does not hold MANAGER_ROLE, so requesting records will revert.
          </Callout>
        )}
      </header>

      {/* ------------------------------------------------------ stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Readable right now"
          value={accessibleRecords.length}
          tone="teal"
          hint={`of ${stats.totals.records} record(s) on the contract`}
        />
        <StatCard
          label="Patients on record"
          value={patientsWithRecords.length}
          hint={`${patientsReachable.length} with a live window for you`}
        />
        <StatCard
          label="Expired windows"
          value={mine.expired.length}
          tone={mine.expired.length > 0 ? 'amber' : 'default'}
          hint="Lapsed on their own — nothing to revoke"
        />
        <StatCard label="Records by type" value={stats.recordsByType.length} hint="Distinct kinds issued" />
        <StatCard
          label="Chain events"
          value={stats.totals.events}
          hint={`Block ${stats.chain.blockNumber ?? '—'}`}
        />
      </div>

      {/* ---------------------------------------------------------- charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="My access right now"
          subtitle="Readable against everything minted"
          right={
            <div className="w-36">
              <DonutLegend data={accessSplit} />
            </div>
          }
        >
          <DonutChart
            data={accessSplit}
            centerValue={accessibleRecords.length}
            centerLabel={`of ${stats.totals.records} readable`}
          />
        </ChartCard>

        <ChartCard title="Records by type" subtitle="Across the whole contract">
          <BarsChart data={stats.recordsByType} horizontal />
        </ChartCard>

        <ChartCard title="Access coverage" subtitle="Share of the contract you can currently read">
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <GaugeChart
                value={accessibleRecords.length}
                max={Math.max(stats.totals.records, 1)}
                label="of all records"
              />
            </div>
            <div className="px-3 pb-1">
              <ProgressBar
                value={Math.round(coverage * 100)}
                label="Readable vs minted"
                sublabel={`${accessibleRecords.length} / ${stats.totals.records}`}
              />
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Contract activity"
          subtitle="When records and consent windows moved"
          height={220}
        >
          <AreaTrend data={stats.activityByDay} color="#6366f1" label="events" />
        </ChartCard>

        <ChartCard
          title="Per-patient access"
          subtitle="Readable against not-yet-authorised, per patient"
          height={220}
        >
          <AccessBars
            data={patientRows
              .filter((row) => row.recordCount > 0)
              .map((row) => ({
                name: row.displayName || row.label || shortAddress(row.address),
                readable: row.readableCount,
                locked: Math.max(0, row.recordCount - row.readableCount),
              }))}
          />
        </ChartCard>
      </div>

      {/* -------------------------------------------------- patient table */}
      <Card
        title="Patients and access"
        subtitle="Names come from patient-owned off-chain profiles; access comes from the contract"
        right={<Pill tone="slate">{patientRows.length} patient(s)</Pill>}
      >
        <DataTable
          rowKey={(row) => row.address}
          columns={[
            {
              key: 'name',
              label: 'Patient',
              render: (row) => {
                const name = row.displayName || nameFor(row.address, row.label) || 'Unnamed';
                return (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-slate-800">{name}</span>
                    {row.displayName ? (
                      <OffChainBadge />
                    ) : (
                      <span className="text-[10px] text-slate-400">no profile set</span>
                    )}
                    <span className="mono text-[10px] text-slate-400">
                      {shortAddress(row.address)}
                    </span>
                  </div>
                );
              },
            },
            {
              key: 'records',
              label: 'Records',
              align: 'right',
              render: (row) => (
                <span className="tabular-nums">
                  {row.readableCount} / {row.recordCount}
                </span>
              ),
            },
            {
              key: 'state',
              label: 'Access state',
              render: (row) => {
                if (row.state === 'readable')
                  return <Pill tone="emerald">readable now</Pill>;
                if (row.state === 'expired') return <Pill tone="amber">window expired</Pill>;
                if (row.state === 'none') return <Pill tone="slate">no consent</Pill>;
                return <span className="text-slate-400">—</span>;
              },
            },
            {
              key: 'expiresAt',
              label: 'Window',
              render: (row) =>
                row.state === 'readable' ? (
                  <ConsentTimer expiresAt={row.expiresAt} />
                ) : (
                  <span className="text-[11px] text-slate-400">—</span>
                ),
            },
            {
              key: 'actions',
              label: '',
              align: 'right',
              render: () => (
                <Link to="/doctor/console" className="text-[11px] font-medium text-teal-700 underline">
                  Open record →
                </Link>
              ),
            },
          ]}
          rows={patientRows}
          empty="No patients with records yet"
        />
      </Card>

      {/* ------------------------------------------- accessible records */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Records you may read now"
          subtitle="Confirmed by the contract, with the window that permits it"
        >
          {accessibleRecords.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              No active consent window for this wallet. A patient can open one from their console.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {accessibleRecords.map((record) => {
                const consent = mine.active.find((c) => c.tokenId === record.tokenId);
                const patient = stats.patients.find((p) => p.address === record.patient);
                return (
                  <li key={record.tokenId} className="flex flex-wrap items-center gap-2 py-2.5">
                    <Pill tone="teal">#{record.tokenId}</Pill>
                    <span className="text-xs font-medium text-slate-800">{record.recordType}</span>
                    <span className="text-[11px] text-slate-500">
                      {patient?.displayName || record.patientLabel || shortAddress(record.patient)}
                    </span>
                    <span className="ml-auto">
                      <ConsentTimer expiresAt={consent?.expiresAt} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3">
            <Link to="/doctor/console" className="btn-secondary w-full">
              Open the records console
            </Link>
          </div>
        </Card>

        <Card title="Clinical actions" subtitle="Both are recorded on-chain and both are gated">
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-800">Request a record</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Emits <span className="mono">RecordRequested</span>. The admin decides whether to
                mint — a clinician requesting is not a clinician minting.
              </p>
              <Link to="/doctor/console" className="btn-secondary mt-2 w-full">
                requestRecord
              </Link>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <p className="text-xs font-semibold text-slate-800">Emergency break-glass</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                Bypasses consent by design. One hour, one record, and the stated reason is permanent.
              </p>
              <Link
                to="/doctor/console"
                className="btn-secondary mt-2 w-full border-amber-300 text-amber-800 hover:bg-amber-50"
              >
                emergencyAccess
              </Link>
            </div>
          </div>
        </Card>
      </div>

      <Card
        title="Record lifecycle"
        subtitle="You act at steps 2 and 5; the contract decides at 4 and 6"
      >
        <LifecycleFlow />
      </Card>
    </div>
  );
}
