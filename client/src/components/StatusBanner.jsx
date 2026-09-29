import React, { useEffect, useState } from 'react';
import { useChain } from '../chain';
import { CONTRACT_ADDRESS, CHAIN_ID, EXPLORER } from '../contract';
import { chainStatus } from '../services/api';

// Global state lives here, in one sticky strip — not scattered across pages as
// per-page notices. Green means the whole read path is live; anything else says
// exactly what is wrong and what to do about it.

export default function StatusBanner() {
  const { wrongNetwork, switchNetwork, hasWallet } = useChain();
  const [api, setApi] = useState({ state: 'checking' });

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const status = await chainStatus();
        if (!alive) return;
        setApi({ state: 'ok', ...status });
      } catch (error) {
        if (!alive) return;
        setApi({ state: 'down', message: error.message });
      }
    };
    check();
    const timer = setInterval(check, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const healthy = api.state === 'ok' && !wrongNetwork;

  const tone = wrongNetwork
    ? 'bg-amber-50 text-amber-900 border-amber-200'
    : api.state === 'down'
      ? 'bg-rose-50 text-rose-900 border-rose-200'
      : 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <div className={`border-b text-[11px] ${tone}`}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              healthy ? 'bg-emerald-500' : wrongNetwork ? 'bg-amber-500' : 'bg-rose-500'
            }`}
          />
          {healthy ? 'Sepolia · live' : wrongNetwork ? 'Wrong network' : 'Chain unreachable'}
        </span>

        <span className="hidden text-slate-400 sm:inline">|</span>

        <span className="inline-flex items-center gap-1.5">
          contract{' '}
          <a
            href={EXPLORER}
            target="_blank"
            rel="noreferrer"
            className="font-mono underline decoration-dotted hover:text-teal-700"
          >
            {CONTRACT_ADDRESS.slice(0, 8)}…{CONTRACT_ADDRESS.slice(-6)}
          </a>
          <span className="text-slate-400">↗</span>
        </span>

        <span className="hidden text-slate-400 sm:inline">|</span>
        <span>chain id {CHAIN_ID}</span>

        <span className="hidden text-slate-400 sm:inline">|</span>
        <span>
          api{' '}
          {api.state === 'checking'
            ? 'checking…'
            : api.state === 'ok'
              ? `ok · token #${api.nextTokenId ?? '—'} next`
              : 'unreachable'}
        </span>

        {wrongNetwork && hasWallet && (
          <button
            type="button"
            onClick={switchNetwork}
            className="ml-auto rounded border border-amber-300 bg-white px-2 py-0.5 font-medium text-amber-800 hover:bg-amber-100"
          >
            Switch to Sepolia
          </button>
        )}
      </div>
    </div>
  );
}
