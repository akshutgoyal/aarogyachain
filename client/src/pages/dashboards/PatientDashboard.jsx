import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useChain, shortAddress } from '../../chain';
import { useStats, useProfiles } from '../../hooks/useDashboardData';
import { AI_VIEWER_ADDRESS, AI_VIEWER_LABEL } from '../../contract';
import { DonutChart, BarsChart, AreaTrend } from '../../components/viz/charts';
import ConsentTimer from '../../components/ConsentTimer';
import LifecycleFlow from '../../components/viz/LifecycleFlow';
import {
  ChartCard,
  DataTable,
  DonutLegend,
  EmptyPanel,
  ProgressBar,
  StatCard,
} from '../../components/viz/primitives';
import { Card, Callout, Pill, Spinner } from '../../components/ui';

function short(recordType) {
  return String(recordType || 'Record')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function PatientDashboard() {
  const { account, ownedRecords } = useChain();
  const { stats, loading, error } = useStats();
  const { byAddress } = useProfiles();

  const myTokenIds = useMemo(
    () => new Set(ownedRecords.map((record) => record.tokenId)),
    [ownedRecords]
  );

  const myRecords = useMemo(
    () => (stats ? stats.records.filter((record) => myTokenIds.has(record.tokenId)) : []),
    [stats, myTokenIds]
  );

  // Consent rows for MY records. Split the AI viewer out, because it is a
  // different kind of reader: nobody looks at the record through it.
  const consents = useMemo(() => {
    if (!stats) return { humans: [], ai: null };
    const rows = stats.consents.filter((consent) => myTokenIds.has(consent.tokenId));
    const aiRows = rows.filter(
      (row) => row.viewer.toLowerCase() === AI_VIEWER_ADDRESS.toLowerCase()
    );
    return {
      humans: rows.filter((row) => row.viewer.toLowerCase() !== AI_VIEWER_ADDRESS.toLowerCase()),
      ai: aiRows[0] || null,
    };
  }, [stats, myTokenIds]);

  const activeHumans = consents.humans.filter((row) => row.active);

  const myEvents = useMemo(() => {
    if (!stats) return [];
    return stats.recentEvents.filter((event) => {
      const args = event.args || {};
      if (args.tokenId !== undefined) return myTokenIds.has(Number(args.tokenId));
      return String(args.patient || '').toLowerCase() === String(account || '').toLowerCase();
    });
  }, [stats, myTokenIds, account]);

  if (loading && !stats) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Reading your records from the contract…
      </div>
    );
  }
  if (error && !stats) return <EmptyPanel title="Could not read dashboard data" hint={error} />;

  const profile = account ? byAddress[account.toLowerCase()] : null;
  const profileFields = [
    profile?.displayName,
    profile?.dateOfBirth,
    profile?.bloodGroup,
    profile?.allergies,
    profile?.emergencyContact,
  ].filter(Boolean).length;

  const types = Object.entries(
    myRecords.reduce((acc, record) => {
      acc[record.recordType] = (acc[record.recordType] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const eventsByDay = Object.entries(
    myEvents.reduce((acc, event) => {
      const day = new Date().toISOString().slice(0, 10);
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">
            Patient · record owner
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {profile?.displayName ? `Hello, ${profile.displayName}` : 'Your health records'}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
            These records are yours. The hospital minted them but cannot move them, read them, or
            open them to anyone without your say-so — and every access is on the record, permanently.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/patient/profile" className="btn-secondary">
            {profile ? 'Edit my profile' : 'Add my details'}
          </Link>
          <Link to="/patient/console" className="btn-primary">
            Manage access
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Records you own"
          value={myRecords.length}
          tone="violet"
          hint="Soulbound — nobody can transfer them"
        />
        <StatCard
          label="Reading now"
          value={activeHumans.length}
          tone={activeHumans.length > 0 ? 'amber' : 'teal'}
          hint={`${consents.humans.length - activeHumans.length} lapsed`}
        />
        <StatCard
          label="AI processing"
          value={consents.ai?.active ? 'On' : 'Off'}
          tone={consents.ai?.active ? 'violet' : 'default'}
          hint={consents.ai?.active ? 'You authorised Gemini' : 'Not authorised'}
        />
        <StatCard label="Events on your records" value={myEvents.length} hint="Public and permanent" />
        <StatCard
          label="Profile completeness"
          value={`${profileFields}/5`}
          hint="Off-chain, and yours to delete"
        />
      </div>

      {activeHumans.length > 0 && (
        <Callout tone="warn" title={`${activeHumans.length} wallet(s) can read your records right now`}>
          That is because you allowed it. You can close any of these windows immediately from the
          access console, and the contract will refuse their next read the moment it lands.
        </Callout>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Your records by type"
          subtitle="What the hospital has issued to you"
          right={
            types.length > 0 ? (
              <div className="w-32">
                <DonutLegend data={types} />
              </div>
            ) : null
          }
        >
          <DonutChart data={types} centerLabel="records" />
        </ChartCard>

        <ChartCard title="Who you have shared with" subtitle="Active windows only" height={230}>
          <BarsChart
            data={consents.humans.map((row) => {
              const holder = stats.patients.find((p) => p.address === row.viewer);
              return {
                name: holder?.displayName || holder?.label || shortAddress(row.viewer),
                value: row.active ? 1 : 0,
              };
            })}
            horizontal
            colors={['#0d9488', '#14b8a6', '#0f766e']}
          />
        </ChartCard>

        <Card title="Consent windows on your records" subtitle="Read from the contract, not from our notes">
          {consents.humans.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              Nobody has ever been granted access. That is the default.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {consents.humans.map((row) => {
                const holder = stats.patients.find((p) => p.address === row.viewer);
                return (
                  <li
                    key={`${row.tokenId}-${row.viewer}`}
                    className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0"
                  >
                    <span className="text-xs font-medium text-slate-800">
                      {holder?.displayName || holder?.label || shortAddress(row.viewer)}
                    </span>
                    <Pill tone="slate">#{row.tokenId}</Pill>
                    <span className="ml-auto">
                      <ConsentTimer expiresAt={row.active ? row.expiresAt : undefined} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3">
            <Link to="/patient/console" className="btn-secondary w-full">
              Open the access console
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Activity on your records"
          subtitle="Mints, requests and consent changes — all public"
          height={220}
        >
          <AreaTrend data={eventsByDay} color="#8b5cf6" label="events" />
        </ChartCard>

        <Card
          title="AI consent"
          subtitle={AI_VIEWER_LABEL}
          tone={consents.ai?.active ? 'ai' : 'default'}
        >
          <div className="mb-3">
            <ProgressBar
              value={consents.ai?.active ? 1 : 0}
              max={1}
              tone={consents.ai?.active ? 'violet' : 'slate'}
              label="Authorised to explain record contents"
              sublabel={consents.ai?.active ? 'Granted' : 'Not granted'}
            />
          </div>
          <p className="text-[11px] leading-relaxed text-slate-600">
            Sending a record to a model is a separate purpose from reading it, so it has its own
            consent. Gemini can explain your access history without this — that only uses public
            chain metadata.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Link
              to="/patient/console"
              className="btn-secondary w-full border-violet-300 text-violet-700 hover:bg-violet-50"
            >
              Manage AI consent
            </Link>
            <Link to="/ai" className="btn-ghost w-full">
              See what Gemini is given
            </Link>
          </div>
        </Card>
      </div>

      <Card
        title="Your records"
        subtitle="Ownership read from ownerOf() on the contract"
        right={<Pill tone="violet">{myRecords.length} token(s)</Pill>}
      >
        <DataTable
          rowKey={(row) => row.tokenId}
          columns={[
            { key: 'tokenId', label: 'Token', render: (row) => <Pill tone="violet">#{row.tokenId}</Pill> },
            { key: 'recordType', label: 'Type', render: (row) => short(row.recordType) },
            {
              key: 'locked',
              label: 'Transferable',
              render: () => <span className="text-slate-500">No — soulbound</span>,
            },
            {
              key: 'readers',
              label: 'Who can read it',
              align: 'right',
              render: (row) => {
                const readers = consents.humans.filter((c) => c.tokenId === row.tokenId && c.active);
                return readers.length === 0 ? (
                  <span className="text-slate-400">only you</span>
                ) : (
                  <span className="tabular-nums text-amber-700">{readers.length} wallet(s)</span>
                );
              },
            },
            { key: 'mintedAtBlock', label: 'Minted in block', align: 'right' },
            {
              key: 'open',
              label: '',
              align: 'right',
              render: (row) => (
                <Link
                  to="/patient/console"
                  className="text-[11px] font-medium text-violet-700 underline"
                >
                  Open →
                </Link>
              ),
            },
          ]}
          rows={myRecords}
          empty="You do not own any records yet"
        />
      </Card>

      <Card title="How your record moves" subtitle="You control steps 5 and 6">
        <LifecycleFlow />
      </Card>
    </div>
  );
}
