import React, { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useChain, hasWallet, shortAddress } from '../chain';
import { ROLES } from '../contract';
import { Card, Callout, Spinner } from '../components/ui';

// The wallet gate. /access is the only door into the product: it asks the visitor
// to connect MetaMask, reads the connected address's role from the contract, and
// routes each wallet to the ONE console it holds.
//
// A patient can never reach the admin console from here; a doctor can never reach
// the patient console. Which destination exists for a given wallet is decided by
// chain state, not by anything the visitor clicks.

const ROLE_BLURB = {
  admin: 'Hospital IT — full controls: identities, roles, records.',
  doctor: 'Clinician — records and requests within live consent.',
  auditor: 'Compliance — metadata and the event log, never a file.',
  patient: 'Record owner — your records, your consent, your call.',
};

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
  } = useChain();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from;

  // Once the chain has named the role, leave: the wallet belongs on its own
  // console, not on this page.
  useEffect(() => {
    if (account && primaryRole) {
      navigate(ROLES[primaryRole].path, { replace: true });
    }
  }, [account, primaryRole, navigate]);

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
          {!hasWallet() ? (
            <Callout tone="warn" title="No wallet detected">
              MetaMask (or any injected Ethereum wallet) is required to enter the dashboard.
              Install it, then return here. Verification, meanwhile, needs no wallet at all —{' '}
              <Link to="/verify" className="font-semibold underline">
                verify a record
              </Link>
              .
            </Callout>
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
                This asks MetaMask to reveal the address — nothing is signed and nothing moves.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
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

              {wrongNetwork ? (
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
