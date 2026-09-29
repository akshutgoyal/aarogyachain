import React, { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useChain, shortAddress } from '../../chain';
import { ROLES, CONTRACT_ADDRESS, EXPLORER } from '../../contract';
import StatusBanner from '../StatusBanner';
import DemoBanner from './DemoBanner';

// Application shell, shown ONLY inside a role's own console.
//
// Role isolation is the point: the sidebar renders the current wallet's role
// section and nothing else — a patient sees "My health" plus the public links,
// never a doctor or admin entry. Combined with RoleGate (which decides which
// wallet may load which route at all), there is no cross-role surface to click
// into.

// Back to the product, or back out to the public site. The public utilities stay
// reachable from inside the shell, but the way out is explicit.
const SHARED_NAV = [
  { to: '/verify', label: 'Verify a record', icon: '✓' },
  { to: '/ai', label: 'Gemini explanations', icon: '✦' },
  { to: '/', label: 'Public site', icon: '◈' },
];

const ROLE_NAV = {
  admin: {
    title: 'Hospital IT',
    items: [
      { to: '/admin', label: 'Dashboard', icon: '▤', end: true },
      { to: '/admin/console', label: 'Operations', icon: '⌘' },
    ],
  },
  doctor: {
    title: 'Clinician',
    items: [
      { to: '/doctor', label: 'Dashboard', icon: '▤', end: true },
      { to: '/doctor/console', label: 'Records & requests', icon: '⌘' },
    ],
  },
  auditor: {
    title: 'Compliance',
    items: [
      { to: '/auditor', label: 'Dashboard', icon: '▤', end: true },
      { to: '/auditor/console', label: 'Audit view', icon: '⌘' },
    ],
  },
  patient: {
    title: 'My health',
    items: [
      { to: '/patient', label: 'Dashboard', icon: '▤', end: true },
      { to: '/patient/console', label: 'My records', icon: '⌘' },
      { to: '/patient/profile', label: 'My profile', icon: '☺' },
    ],
  },
};

function NavItem({ item, onNavigate }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
          isActive
            ? 'bg-teal-50 font-medium text-teal-800'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      <span className="w-4 text-center text-xs opacity-70">{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

export default function AppShell({ children }) {
  const { account, primaryRole, identity, roles, isPatient, isDemo, exitDemo, refresh, refreshing } =
    useChain();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Inside the shell a wallet always holds a role — RoleGate only renders this
  // subtree after that check passes. A null nav here cannot happen in practice,
  // and if it did, showing only the public links is the safe failure.
  const nav = primaryRole ? ROLE_NAV[primaryRole] : null;

  // Every role this wallet holds, so the topbar never contradicts the page.
  const heldRoles = [
    roles.admin && 'Admin',
    roles.manager && 'Manager',
    roles.auditor && 'Auditor',
    isPatient && 'Patient',
  ].filter(Boolean);

  const close = () => setOpen(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* ---------------------------------------------------------- sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-[11px] font-bold text-white">
            ✚
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-900">AarogyaChain</span>
        </div>

        <div className="p-3">
          {nav && (
            <>
              <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {nav.title} · your console
              </p>
              <nav className="space-y-0.5">
                {nav.items.map((item) => (
                  <NavItem key={item.to} item={item} onNavigate={close} />
                ))}
              </nav>
            </>
          )}

          <p className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Public
          </p>
          <nav className="space-y-0.5">
            {SHARED_NAV.map((item) => (
              <NavItem key={item.to} item={item} onNavigate={close} />
            ))}
          </nav>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Contract
            </p>
            <a
              href={EXPLORER}
              target="_blank"
              rel="noreferrer"
              className="mono mt-1 block break-all text-[10px] text-teal-700 underline decoration-dotted"
            >
              {CONTRACT_ADDRESS}
            </a>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              Sepolia · read-only from the server. Every write is signed in your wallet.
            </p>
          </div>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={close}
          className="fixed inset-0 z-30 bg-slate-900/20 lg:hidden"
        />
      )}

      {/* ------------------------------------------------------------ main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Toggle navigation"
          >
            ☰
          </button>

          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">
              {nav ? `${nav.title} console` : 'AarogyaChain'}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {location.pathname.replace(/^\//, '').replace(/\//g, ' · ')}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => refresh()}
              disabled={refreshing}
              title="Re-read your role from the contract"
              className="hidden rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 sm:block"
            >
              {refreshing ? 'reading…' : 'refresh'}
            </button>

            {account && (
              <Link
                to="/access"
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1 pl-1 pr-2.5 hover:border-teal-300"
                title={
                  isDemo
                    ? 'Exit demo or switch persona'
                    : 'Switch wallet — re-enter with a different account'
                }
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold ${
                    isDemo ? 'bg-amber-100 text-amber-700' : 'bg-teal-50 text-teal-700'
                  }`}
                >
                  {(identity.label || account).slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-[11px] font-medium leading-tight text-slate-800">
                    {identity.label || 'Unregistered'}
                    {isDemo && <span className="ml-1 text-amber-700">· demo</span>}
                  </span>
                  <span className="mono block text-[10px] leading-tight text-slate-400">
                    {shortAddress(account)}
                  </span>
                </span>
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-800 ring-1 ring-inset ring-teal-200">
                  {primaryRole ? ROLES[primaryRole].label : 'No role'}
                  {heldRoles.length > 1 && ` +${heldRoles.length - 1}`}
                </span>
              </Link>
            )}
          </div>
        </header>

        <StatusBanner />

        <main className="min-w-0 flex-1 p-4 lg:p-6">
          {isDemo && <DemoBanner onExit={exitDemo} />}
          {children}
        </main>
      </div>
    </div>
  );
}
