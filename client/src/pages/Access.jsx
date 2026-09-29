import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useChain, hasWallet, shortAddress } from '../chain';
import { ROLES, ROLE_ORDER } from '../contract';
import { demoAddressFor } from '../chain';
import { Card, Callout, Spinner } from '../components/ui';

// The wallet gate. /access is the only door into the product: it asks the visitor
// to connect MetaMask, reads the connected address's role from the contract, and
// routes each wallet to the ONE console it holds.
//
// A patient can never reach the admin console from here; a doctor can never reach
// the patient console. Which destination exists for a given wallet is decided by
// chain state, not by anything the visitor clicks.
//
// Below the wallet sits the demo bypass: "View demo" opens a persona picker with
// the same four roles. A persona loads that account's REAL chain state (roles,
// ownership, consent windows) through the backend — but there is no signer, so
// reads and charts work while writes refuse. The banner inside the shell says so.

const ROLE_BLURB = {
  admin: 'Hospital IT — full controls: identities, roles, records.',
  doctor: 'Clinician — handles records and requests under live consent.',
  auditor: 'Compliance — metadata and the event log, never the file.',
  patient: 'Record owner — your records, your consent, your call.',
};

/**
 * The demo bypass: "View demo" opens a persona picker with the four roles.
 * Shared by both walletless states (MetaMask present or not) so a judge on a
 * machine without a wallet still reaches every console.
 */
function DemoPicker({ open, onToggle, busy, onPick }) {
  return (
    <div className="mt-4 border-t border-slate-100 pt-3 text-center">
      <button
        type="button"
        onClick={onToggle}
        className="text-[13px] font-medium text-slate-500 underline decoration-dotted underline-offset-4 hover:text-slate-800"
      >
        {open ? 'Hide the demo walkthrough' : 'View demo — no wallet needed'}
      </button>

      {open && (
        <div className="mt-3 space-y-2 text-left">
          <p className="text-[11px] leading-relaxed text-slate-500">
            Pick a persona. You will see that role's live dashboard — real chain data
            for the account it belongs to. Reads, charts and explanations work; anything
            that writes refuses, because there is no wallet to sign with.
          </p>
          {ROLE_ORDER.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => onPick(role)}
              disabled={busy !== null}
              className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-left transition hover:border-teal-300 hover:bg-teal-50/40 disabled:opacity-60"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                {ROLES[role].label.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-slate-800">
                  {busy === role ? 'Loading live state…' : `Explore as ${ROLES[role].label}`}
                </span>
                <span className="block truncate text-[11px] text-slate-500">
                  {ROLE_BLURB[role]}
                </span>
                <span className="mono block truncate text-[10px] text-slate-400">
                  {demoAddressFor(role)}
                </span>
              </span>
              <span aria-hidden="true" className="shrink-0 text-slate-300">→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Access() {
  const {
    account,
    primaryRole,
    identity,
    connecting,
    refreshing,
    walletError,
    connect,
    wrongNetwork,
    switchNetwork,
    isDemo,
    enterDemo,
    exitDemo,
  } = useChain();
  const navigate = useNavigate();
  const location = useLocation();
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoBusy, setDemoBusy] = useState(null);

  const from = location.state?.from;

  // A demo persona already active belongs on its own console, not on this page.
  // The effect below only moves CONNECTED wallets; demo personas stay put so the
  // visitor can read this page, switch persona, or exit — otherwise /access could
  // never be opened while demoing.
  useEffect(() => {
    if (account && primaryRole && !isDemo) {
      navigate(ROLES[primaryRole].path, { replace: true });
    }
  }, [account, primaryRole, isDemo, navigate]);

  const pickPersona = async (role) => {
    setDemoBusy(role);
    try {
      await enterDemo(role);
      navigate(ROLES[role].path, { replace: true });
    } finally {
      setDemoBusy(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-slate-200/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-sm font-bold text-white shadow-sm">
              ✚
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-900">AarogyaChain</span>
          </Link>
          <span className="text-xs uppercase tracking-wider text-slate-400">Access</span>
          <div className="ml-auto">
            <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">
              ← Back to home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-12">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
          Access Dashboard
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Connect to enter.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Your wallet is the sign-in. Once connected, the contract decides which console opens —
          admin, doctor, auditor or patient — and every other access point stays hidden.
        </p>

        <Card
          className="mt-6"
          title={account ? 'Wallet connected' : 'Connect your MetaMask wallet'}
          subtitle={
            account
              ? 'Reading your role from the contract…'
              : 'The authorisation prompt comes from MetaMask itself, never from this page.'
          }
        >
          {!hasWallet() && !account ? (
            <>
              <Callout tone="warn" title="No wallet detected">
                MetaMask (or any injected Ethereum wallet) is required to sign in — but you can
                still explore every console with the demo walkthrough below. Verification needs
                no wallet at all —{' '}
                <Link to="/verify" className="font-semibold underline">
                  verify a record
                </Link>
                .
              </Callout>
              <DemoPicker
                open={demoOpen}
                onToggle={() => setDemoOpen((value) => !value)}
                busy={demoBusy}
                onPick={pickPersona}
              />
            </>
          ) : !account ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={connect}
                disabled={connecting}
                className="btn-primary w-full py-2.5 text-[15px]"
              >
                {connecting ? (
                  <>
                    <Spinner /> Waiting for MetaMask…
                  </>
                ) : (
                  'Connect MetaMask'
                )}
              </button>
              {walletError && (
                <Callout tone="danger" title={walletError.title}>
                  {walletError.detail}
                </Callout>
              )}
              <p className="text-[11px] leading-relaxed text-slate-500">
                This asks MetaMask to reveal your address — nothing is signed and nothing moves.
              </p>

              {/* ------------------------------------------------ demo bypass */}
              {/* Shown in BOTH walletless states — with or without MetaMask — so a
                  judge on a machine without a wallet still reaches every console. */}
              <DemoPicker
                open={demoOpen}
                onToggle={() => setDemoOpen((value) => !value)}
                busy={demoBusy}
                onPick={pickPersona}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {isDemo ? (
                <Callout tone="warn" title={`Exploring as ${identity.label || (primaryRole ? ROLES[primaryRole].label : 'persona')}`}>
                  Data and charts below are that persona's live chain data. Switch persona
                  below, or exit the demo to sign in with a real wallet.
                  <button type="button" onClick={exitDemo} className="btn-secondary mt-2 w-full">
                    Exit demo
                  </button>
                </Callout>
              ) : (
                wrongNetwork && (
                  <Callout tone="warn" title="Wrong network">
                    This contract lives on Sepolia. Switch networks in MetaMask to continue.
                    <button
                      type="button"
                      onClick={switchNetwork}
                      className="btn-secondary mt-2 w-full"
                    >
                      Switch to Sepolia
                    </button>
                  </Callout>
                )
              )}
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm text-teal-700">
                  ◈
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {identity.label || 'Unregistered wallet'}
                  </p>
                  <p className="mono truncate text-slate-500">{account}</p>
                </div>
              </div>

              {isDemo && primaryRole ? (
                // In demo the network question is moot (no wallet) and the role is
                // always known — the persona WAS chosen. Just offer the console.
                <Callout tone="ok" title={`${ROLES[primaryRole].label} console ready`}>
                  {ROLE_BLURB[primaryRole]} You are exploring, not signed in — write actions will be refused.
                  <span className="mt-2 block">
                    <Link
                      to={ROLES[primaryRole].path}
                      className="font-semibold underline"
                    >
                      Open the {ROLES[primaryRole].label} console →
                    </Link>
                  </span>
                </Callout>
              ) : wrongNetwork ? (
                <Callout tone="warn" title="Wrong network">
                  This contract lives on Sepolia. Switch networks in MetaMask to continue.
                  <button
                    type="button"
                    onClick={switchNetwork}
                    className="btn-secondary mt-2 w-full"
                  >
                    Switch to Sepolia
                  </button>
                </Callout>
              ) : primaryRole ? (
                <Callout tone="ok" title={`${ROLES[primaryRole].label} — opening your dashboard`}>
                  {ROLE_BLURB[primaryRole]} Redirecting now…
                  <span className="mt-2 block">
                    <Link
                      to={ROLES[primaryRole].path}
                      className="font-semibold underline"
                    >
                      Open the {ROLES[primaryRole].label} console →
                    </Link>
                  </span>
                </Callout>
              ) : refreshing ? (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <Spinner /> Reading the contract…
                </p>
              ) : (
                <Callout tone="warn" title="This wallet holds no role here">
                  Nothing is wrong — this address was simply never registered. An administrator
                  has to create an identity for {shortAddress(account)} and grant it a role before
                  a console can open.
                </Callout>
              )}

              {/* Persona switching while demoing lives here, next to the exit. */}
              {isDemo && (
                <DemoPicker
                  open={demoOpen}
                  onToggle={() => setDemoOpen((value) => !value)}
                  busy={demoBusy}
                  onPick={pickPersona}
                />
              )}

              {from && (
                <p className="text-[11px] text-slate-500">
                  You tried to open <span className="mono">{from}</span> — sign in with a wallet
                  that holds that role.
                </p>
              )}
            </div>
          )}
        </Card>

        <div className="mt-4 flex justify-center gap-5 text-[13px] text-slate-500">
          <Link to="/verify" className="hover:text-slate-900">
            Verify a record
          </Link>
          <Link to="/ai" className="hover:text-slate-900">
            Gemini explanations
          </Link>
          <Link to="/" className="hover:text-slate-900">
            What is AarogyaChain?
          </Link>
        </div>
      </main>
    </div>
  );
}
