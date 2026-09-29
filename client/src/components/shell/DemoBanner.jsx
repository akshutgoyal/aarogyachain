import React from 'react';

// Shown at the top of every console while demoing a persona instead of a wallet.
//
// Reads are real — the persona's dashboards, tables and charts all come from the
// contract — but there is no signer, so anything that writes refuses. That refusal
// is worth saying out loud: a judge pressing "mint" in demo should understand the
// boundary they just hit, not wonder why the button did nothing.
export default function DemoBanner({ onExit }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-200 text-sm">
        ◍
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-amber-900">
          Demo walkthrough — no wallet connected
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
          Everything you see is live chain data for this persona. Reads, charts and
          explanations all work; anything that writes to the chain (minting, granting,
          revoking, signing) will be refused, because there is no wallet to sign with.
          Connect a real wallet to act.
        </p>
      </div>
      <button type="button" onClick={onExit} className="btn-secondary shrink-0">
        Exit demo
      </button>
    </div>
  );
}
