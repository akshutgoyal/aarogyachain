import React from 'react';
import { Link } from 'react-router-dom';
import { useChain, shortAddress } from '../../chain';
import { useStats, useProfiles } from '../../hooks/useDashboardData';
import { CONTRACT_ADDRESS, EXPLORER } from '../../contract';
import { DonutChart, BarsChart, AreaTrend, GaugeChart } from '../../components/viz/charts';
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
import { Card, Spinner, Pill, Callout } from '../../components/ui';

const QUICK_ACTIONS = [
  {
    to: '/admin/console',
    title: 'Mint a record',
    detail: 'Encrypt a file in the browser, anchor its digest, and allocate the token to the patient.',
    gate: 'DEFAULT_ADMIN_ROLE',
    tone: 'teal',
  },
  {
    to: '/admin/console',
    title: 'Register an identity',
    detail: 'Create an on-chain identity for a new wallet. The event is the audit record.',
    gate: 'DEFAULT_ADMIN_ROLE',
    tone: 'teal',
  },
  {
    to: '/admin/console',
    title: 'Grant a role',
    detail: 'MANAGER_ROLE for clinicians and labs, AUDITOR_ROLE for compliance.',
    gate: 'DEFAULT_ADMIN_ROLE',
    tone: 'indigo',
  },
  {
    to: '/admin/console',
    title: 'Revoke a record',
    detail: 'Burn a token when a wallet is lost. Irreversible, and recorded forever.',
    gate: 'DEFAULT_ADMIN_ROLE',
    tone: 'rose',
  },
];

export default function AdminDashboard() {
  const { account, roles, identity } = useChain();
  const { stats, loading, error } = useStats();
  const { nameFor } = useProfiles();

  if (loading && !stats) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Reading the contract…
      </div>
    );
  }

  if (error && !stats) {
    return (
      <EmptyPanel
        title="Could not read dashboard data"
        hint={`${error}. The backend reads chain state directly, so this is usually the API or the RPC endpoint.`}
      />
    );
  }

  const totals = stats.totals;
  const rolesAssigned = stats.identitiesByRole
    .filter((entry) => entry.name !== 'Unassigned')
    .reduce((sum, entry) => sum + entry.value, 0);
  const consentTotal = totals.activeConsents + totals.expiredConsents;
  const consentHealth = consentTotal > 0 ? Math.round((totals.activeConsents / consentTotal) * 100) : 100;

  return (
    <div className="space-y-5">
      {/* ---------------------------------------------------------- header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
            Hospital IT · Admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Hospital operations
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
            Only this wallet can mint records or create identities, and that gate lives in the
            contract — not in the interface. Everything below is read from chain state.
          </p>
        </div>
        {!roles.admin && (
          <Callout tone="warn" className="max-w-sm">
            This wallet does not hold DEFAULT_ADMIN_ROLE. Mint attempts will revert — which is worth
            demonstrating once.
          </Callout>
        )}
      </header>

      {/* ------------------------------------------------------ stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Registered identities"
          value={totals.identities}
          tone="teal"
          hint={`${rolesAssigned} carry a role · ${totals.identities - rolesAssigned} unassigned`}
        />
        <StatCard
          label="Records minted"
          value={totals.records}
          hint="Soulbound, owned by patients"
        />
        <StatCard
          label="Active consent windows"
          value={totals.activeConsents}
          tone={totals.activeConsents > 0 ? 'teal' : 'default'}
          hint={`${totals.expiredConsents} expired`}
        />
        <StatCard
          label="Distinct viewers"
          value={totals.distinctViewers}
          hint="Wallets holding access right now"
        />
        <StatCard
          label="Chain events"
          value={totals.events}
          hint={`Block ${stats.chain.blockNumber ?? '—'}`}
        />
      </div>

      {/* ---------------------------------------------------------- charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Identities by role"
          subtitle="Who holds what on this contract"
          right={
            <div className="w-32">
              <DonutLegend data={stats.identitiesByRole} />
            </div>
          }
        >
          <DonutChart data={stats.identitiesByRole} centerLabel="identities" />
        </ChartCard>

        <ChartCard title="Records by type" subtitle="What has been issued">
          <BarsChart data={stats.recordsByType} horizontal />
        </ChartCard>

        <ChartCard title="Consent window health" subtitle="Active against expired windows">
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <GaugeChart
                value={totals.activeConsents}
                max={Math.max(consentTotal, 1)}
                label="currently active"
              />
            </div>
            <div className="px-3 pb-1">
              <ProgressBar
                value={totals.activeConsents}
                max={Math.max(consentTotal, 1)}
                label="Active vs all windows ever granted"
                sublabel={`${totals.activeConsents} / ${consentTotal}`}
              />
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
                Windows close on their own — the contract enforces expiry with nobody intervening.
              </p>
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Activity over time"
          subtitle="Every state change is an on-chain event"
          height={230}
        >
          <AreaTrend data={stats.activityByDay} label="events" />
        </ChartCard>

        <ChartCard title="Events by type" subtitle="The audit trail, by kind" height={230}>
          <BarsChart data={stats.eventsByType} horizontal />
        </ChartCard>
      </div>

      {/* --------------------------------------------------- quick actions */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Administrative actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.title}
              to={action.to}
              className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-300 hover:shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800 group-hover:text-teal-800">
                  {action.title}
                </p>
                <span className="text-slate-300 transition group-hover:text-teal-500">→</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{action.detail}</p>
              <p className="mono mt-2 text-[9px] text-slate-400">requires {action.gate}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- identity table */}
      <Card
        title="Identities on this contract"
        subtitle="Rebuilt from IdentityCreated logs, with roles read from AccessControl"
        right={<Pill tone="slate">{stats.patients.length} wallets</Pill>}
      >
        <DataTable
          rowKey={(row) => row.address}
          columns={[
            {
              key: 'name',
              label: 'Holder',
              render: (row) => {
                const name = row.displayName || nameFor(row.address, row.label);
                return (
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-800">{name}</span>
                    {row.displayName && <OffChainBadge />}
                  </div>
                );
              },
            },
            { key: 'address', label: 'Wallet', mono: true, render: (row) => shortAddress(row.address) },
            {
              key: 'roles',
              label: 'Roles',
              render: (row) => {
                const held = [
                  row.roles.admin && 'Admin',
                  row.roles.manager && 'Manager',
                  row.roles.auditor && 'Auditor',
                ].filter(Boolean);
                return held.length ? (
                  <div className="flex flex-wrap gap-1">
                    {held.map((role) => (
                      <Pill key={role} tone="teal">
                        {role}
                      </Pill>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400">none</span>
                );
              },
            },
            {
              key: 'records',
              label: 'Records owned',
              align: 'right',
              render: (row) => <span className="tabular-nums">{row.records}</span>,
            },
            {
              key: 'consentsActive',
              label: 'Active consents',
              align: 'right',
              render: (row) => (
                <span className={`tabular-nums ${row.consentsActive > 0 ? 'text-teal-700' : 'text-slate-400'}`}>
                  {row.consentsActive}
                </span>
              ),
            },
          ]}
          rows={stats.patients}
          empty="No identities yet"
        />
      </Card>

      {/* --------------------------------------------------------- flow */}
      <Card
        title="Record lifecycle"
        subtitle="Where the contract stops things — and the three exits that are the design working"
      >
        <LifecycleFlow />
      </Card>

      <p className="text-[11px] text-slate-500">
        Contract{' '}
        <a href={EXPLORER} target="_blank" rel="noreferrer" className="mono text-teal-700 underline">
          {CONTRACT_ADDRESS}
        </a>{' '}
        · read at {new Date(stats.generatedAt).toLocaleTimeString()}
        {stats.cached && ' (cached)'}
      </p>
    </div>
  );
}
