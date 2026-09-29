import React from 'react';

// The record lifecycle, as a real diagram rather than prose.
//
// Layout is the same shape the architecture slide uses: an issue path running
// left to right, and three decision points with a red exit. The red exits are the
// argument — they are not error handling, they are the design working.

const STEPS = [
  {
    n: 1,
    title: 'Identity registered',
    detail: 'Admin writes it on-chain. The DID is derived from the key as did:ethr:<chain>:<address>.',
    actor: 'Admin',
  },
  {
    n: 2,
    title: 'Upload and encrypt',
    detail: 'The browser seals the file with its own AES-256-GCM key before anything leaves the tab.',
    actor: 'Manager',
  },
  {
    n: 3,
    title: 'Digest anchored',
    detail: 'Only keccak256 of the ciphertext goes on-chain. The file never does.',
    actor: 'Manager',
  },
  {
    n: 4,
    title: 'Admin mints?',
    detail: 'requestRecord by the clinician, then mintRecord by the admin.',
    actor: 'Admin',
    decision: {
      question: 'DEFAULT_ADMIN_ROLE held?',
      no: 'AccessControl missing-role revert — no token exists',
      yes: 'Token minted to the PATIENT, not the hospital',
    },
  },
  {
    n: 5,
    title: 'Consent window opens',
    detail: 'The patient — never the hospital — grants time-boxed access to a named viewer.',
    actor: 'Patient',
  },
  {
    n: 6,
    title: 'Consent valid?',
    detail: 'Every read re-checks this in the contract. There is no cached permission.',
    actor: 'Contract',
    decision: {
      question: 'canAccess(tokenId, viewer)',
      no: 'Expired / AccessDenied revert — the read is refused',
      yes: 'The contract releases the file location',
    },
  },
  {
    n: 7,
    title: 'Digest matches?',
    detail: 'Re-hash the file and compare with the chain. Free, and open to anyone.',
    actor: 'Anyone',
    decision: {
      question: 'keccak256(file) == on-chain digest',
      no: 'Tampered — the mismatch is public and undeniable',
      yes: 'Authentic',
    },
  },
];

const ACTOR_TONE = {
  Admin: 'bg-teal-50 text-teal-700 ring-teal-200',
  Manager: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  Patient: 'bg-violet-50 text-violet-700 ring-violet-200',
  Contract: 'bg-slate-100 text-slate-700 ring-slate-200',
  Anyone: 'bg-amber-50 text-amber-700 ring-amber-200',
};

function Step({ step }) {
  return (
    <div className="relative min-w-0">
      <div
        className={`h-full rounded-xl border bg-white p-3 shadow-sm ${
          step.decision ? 'border-amber-300' : 'border-slate-200'
        }`}
      >
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
              step.decision ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {step.n}
          </span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ring-1 ring-inset ${
              ACTOR_TONE[step.actor] || ACTOR_TONE.Contract
            }`}
          >
            {step.actor}
          </span>
        </div>

        <p className="text-xs font-semibold leading-snug text-slate-800">{step.title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{step.detail}</p>

        {step.decision && (
          <div className="mt-2 space-y-1">
            <p className="mono text-[10px] text-amber-800">{step.decision.question}</p>
            <p className="rounded border border-rose-200 bg-rose-50 px-1.5 py-1 text-[10px] leading-snug text-rose-800">
              ✕ {step.decision.no}
            </p>
            <p className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-[10px] leading-snug text-emerald-800">
              ✓ {step.decision.yes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LifecycleFlow({ compact = false }) {
  const steps = compact ? STEPS.filter((s) => [2, 4, 6].includes(s.n)) : STEPS;

  return (
    <div>
      <div className="relative">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {steps.map((step) => (
            <Step key={step.n} step={step} />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          The nine events are the audit trail
        </span>
        {[
          'IdentityCreated',
          'RecordRequested',
          'RecordMinted',
          'Locked',
          'AccessGranted',
          'AccessRevoked',
          'EmergencyAccessUsed',
          'RecordRevoked',
          'RoleGranted',
        ].map((name) => (
          <span
            key={name}
            className="mono rounded bg-white px-1.5 py-0.5 text-[9px] text-slate-600 ring-1 ring-inset ring-slate-200"
          >
            {name}
          </span>
        ))}
        <span className="text-[10px] italic text-slate-500">
          Nobody maintains a log file. The chain is the log.
        </span>
      </div>
    </div>
  );
}
