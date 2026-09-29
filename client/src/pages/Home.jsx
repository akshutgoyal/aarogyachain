import React from 'react';
import { Link } from 'react-router-dom';
import { EXPLORER, CONTRACT_ADDRESS } from '../contract';

// Public landing page. Deliberately chromeless: no sidebar, no topbar, no role
// navigation. The only way into the product is the Access Dashboard button, which
// leads to /access — a wallet gate that fetches the connected account's role and
// routes each wallet to the ONE console it holds.

const SUBSTITUTIONS = [
  {
    from: 'Username and password',
    to: 'A wallet — the key is the identity',
    why: 'There is no account database to breach and nothing to register before you can prove who you are.',
  },
  {
    from: 'A row in a database',
    to: 'A soulbound NFT owned by the patient',
    why: 'ownerOf(tokenId) is the record-to-identity link. The hospital mints it, the patient holds it — and nobody can move it.',
  },
  {
    from: 'A permission flag',
    to: 'A smart contract that re-checks every call',
    why: 'A modified frontend cannot bypass the rules. The contract refuses regardless of what the page allows.',
  },
];

const ROLES = [
  {
    name: 'Patient',
    line: 'Own your records. Grant time-boxed access. Revoke at will.',
    accent: 'violet',
  },
  {
    name: 'Doctor',
    line: 'Request records. Read with consent. Break-glass when it counts.',
    accent: 'indigo',
  },
  {
    name: 'Auditor',
    line: 'Verify every hash and every event. Never touch a file.',
    accent: 'slate',
  },
  {
    name: 'Admin',
    line: 'Register identities. Mint records. Carry the only keys that can.',
    accent: 'teal',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Connect your wallet',
    body: 'MetaMask is the sign-in. No username, no password, no account database to breach.',
  },
  {
    n: '02',
    title: 'The contract names your role',
    body: 'Your address is looked up on-chain. Admin, doctor, auditor or patient — you open the console you hold, and nothing else.',
  },
  {
    n: '03',
    title: 'Consent gates everything',
    body: 'Every read is checked against the contract as you. Access expires on its own; the window, not a policy, is the proof.',
  },
];

const ACCENTS = {
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-600',
  teal: 'border-teal-200 bg-teal-50 text-teal-700',
};

function Logo({ dark = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-sm font-bold text-white shadow-sm">
        ✚
      </span>
      <span className={`text-lg font-semibold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
        AarogyaChain
      </span>
    </span>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* ---------------------------------------------------------- top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <Logo />
          <nav className="ml-6 hidden items-center gap-5 text-sm text-slate-600 md:flex">
            <a href="#how" className="hover:text-slate-900">How it works</a>
            <a href="#roles" className="hover:text-slate-900">Roles</a>
            <a href="#trust" className="hover:text-slate-900">Trust model</a>
            <Link to="/verify" className="hover:text-slate-900">Verify a record</Link>
            <Link to="/ai" className="hover:text-slate-900">Gemini explanations</Link>
          </nav>
          <div className="ml-auto">
            <Link
              to="/access"
              className="btn-primary shadow-sm"
            >
              Access Dashboard →
            </Link>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(52rem 30rem at 82% -8%, rgba(13,148,136,0.14), transparent 60%),' +
              'radial-gradient(40rem 26rem at 8% 8%, rgba(99,102,241,0.10), transparent 60%)',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal-800">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              Live on Sepolia · patient-held records
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl">
              Medical records the patient owns, and anyone can verify.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">
              Reports today sit on scattered hospital servers and in messaging threads. Fake ones
              are trivial to produce, staff snooping leaves no trace, and consent exists as policy
              rather than proof. AarogyaChain replaces the account, the row and the permission flag
              with three things the patient controls.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/access" className="btn-primary px-5 py-2.5 text-[15px]">
                Access Dashboard →
              </Link>
              <Link to="/verify" className="btn-secondary px-5 py-2.5 text-[15px]">
                Verify a record — no wallet needed
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Sign-in is your wallet. The page you land on depends on the role the contract says
              that wallet holds.
            </p>
          </div>

          {/* Proof card — the three substitutions, as the hero visual. */}
          <div className="space-y-3">
            {SUBSTITUTIONS.map((item) => (
              <div
                key={item.to}
                className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur"
              >
                <p className="text-[11px] uppercase tracking-wide text-slate-400 line-through">
                  {item.from}
                </p>
                <p className="mt-1 text-[15px] font-semibold text-slate-900">{item.to}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{item.why}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- how it works */}
      <section id="how" className="border-t border-slate-100 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
            How it works
          </p>
          <h2 className="mt-2 max-w-xl text-2xl font-semibold tracking-tight text-slate-900">
            Three steps from a stranger to a consent-checked reader.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="font-mono text-xs text-teal-600">{step.n}</p>
                <p className="mt-2 text-[15px] font-semibold text-slate-900">{step.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- roles */}
      <section id="roles" className="border-t border-slate-100">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
            One console per role
          </p>
          <h2 className="mt-2 max-w-xl text-2xl font-semibold tracking-tight text-slate-900">
            You open the console you hold. The others never appear.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((role) => (
              <div key={role.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${ACCENTS[role.accent]}`}
                >
                  {role.name}
                </span>
                <p className="mt-3 text-[13px] leading-relaxed text-slate-600">{role.line}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[13px] text-slate-500">
            A patient never sees the admin console; a doctor never sees another patient's keys.
            The guard reads the contract, not the URL — a bookmarked link cannot put anyone
            somewhere they are not entitled to be.
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------- trust/AI */}
      <section id="trust" className="border-t border-slate-100 bg-slate-50/60">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-14 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
              Trust model
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">
              Only the digest crosses the boundary.
            </h3>
            <ul className="mt-4 space-y-2.5 text-[13px] leading-relaxed text-slate-600">
              <li>
                <strong className="text-slate-800">The truth anchor:</strong> a 32-byte keccak256
                digest of the encrypted file. Tiny, permanent, public.
              </li>
              <li>
                <strong className="text-slate-800">Identity and roles:</strong> registration and
                role grants are themselves auditable events.
              </li>
              <li>
                <strong className="text-slate-800">The consent window:</strong> the contract must
                hold it, because the contract is what enforces the expiry.
              </li>
              <li>
                <strong className="text-slate-800">Everything else stays off-chain:</strong> the
                encrypted file, the wrapped keys, and the Gemini call.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-6 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">
              Gemini, consent-gated
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">
              An explanation layer, never a decision layer.
            </h3>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-700">
              Gemini turns an already-authorised record into plain language. It runs off-chain,
              holds no key, writes no state, and cannot mint or grant anything. It is served
              behind the same consent check as the record itself: the server asks the contract,
              as you, before a single byte reaches the model.
            </p>
            <p className="mt-3 text-[13px]">
              <Link to="/ai" className="font-semibold text-violet-700 underline">
                See the two-tier gate in action →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- footer */}
      <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-8">
          <Logo dark />
          <p className="text-xs text-slate-400">
            Patient-held health records on Sepolia.{' '}
            <a
              href={EXPLORER}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] text-teal-300 underline decoration-dotted"
            >
              {CONTRACT_ADDRESS}
            </a>
          </p>
          <div className="ml-auto flex flex-wrap gap-4 text-[13px]">
            <Link to="/verify" className="hover:text-white">Verify</Link>
            <Link to="/ai" className="hover:text-white">Gemini</Link>
            <Link to="/access" className="font-semibold text-teal-300 hover:text-teal-200">
              Access Dashboard →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
