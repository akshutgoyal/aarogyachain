import React from 'react';
import { Link } from 'react-router-dom';
import { EXPLORER, CONTRACT_ADDRESS } from '../contract';

// Landing page, styled after the reference: dark pill navbar, deep-ink hero with
// an orbital route map, then alternating cream / coral / ink / mint bands, each
// opened by a small-caps kicker and an oversized display headline. Product truth
// stays intact — every claim below maps to something the contract actually does.

const NAV_LINKS = [
  { to: '#records', label: 'Records' },
  { to: '#consent', label: 'Consent' },
  { to: '#control', label: 'Control' },
  { to: '#safety', label: 'Safety' },
];

// The orbit: the contract at the centre, the four roles around it. Positions are
// percentages of the SVG viewBox so the map scales with the hero.
const ORBIT_NODES = [
  { x: 50, y: 50, tag: 'contract', label: 'AarogyaChain', sub: 'Sepolia', center: true },
  { x: 16, y: 26, tag: 'PP', label: 'Patient 101', sub: 'record owner' },
  { x: 84, y: 22, tag: 'CD', label: 'Cardiology', sub: 'manager · doctor' },
  { x: 82, y: 76, tag: 'HI', label: 'Hospital IT', sub: 'admin · minter' },
  { x: 15, y: 74, tag: 'CA', label: 'Compliance', sub: 'auditor' },
];

const ORBIT_ROUTES = [
  'M 50 50 C 38 44, 26 38, 16 26',
  'M 50 50 C 62 40, 74 30, 84 22',
  'M 50 50 C 62 58, 74 66, 82 76',
  'M 50 50 C 36 56, 24 64, 15 74',
];

function RouteMap() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="0.4" />
      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.4" />
      {ORBIT_ROUTES.map((d) => (
        <path key={d} d={d} fill="none" stroke="rgba(140,130,255,0.65)" strokeWidth="0.5" className="route-dash" />
      ))}
      {ORBIT_NODES.map((node) =>
        node.center ? (
          <g key={node.label}>
            <circle cx={node.x} cy={node.y} r="6.5" fill="#6c5ce7" />
            <circle cx={node.x} cy={node.y} r="6.5" fill="none" stroke="rgba(108,92,231,0.5)" strokeWidth="1.6" />
            <text x={node.x} y={node.y + 1.6} textAnchor="middle" fill="#fff" fontSize="4.4" fontWeight="700">
              ✚
            </text>
            <text x={node.x} y={node.y + 11} textAnchor="middle" fill="#fff" fontSize="3.4" fontWeight="600">
              {node.label}
            </text>
          </g>
        ) : (
          <g key={node.label}>
            <circle cx={node.x} cy={node.y} r="4.6" fill="#1c1830" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
            <text x={node.x} y={node.y + 1.5} textAnchor="middle" fill="#cfc9ff" fontSize="3" fontWeight="700">
              {node.tag}
            </text>
            <text x={node.x} y={node.y + 8.4} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="2.9" fontWeight="600">
              {node.label}
            </text>
            <text x={node.x} y={node.y + 11.6} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="2.3">
              {node.sub}
            </text>
          </g>
        )
      )}
    </svg>
  );
}

function Kicker({ children, tone = 'grape' }) {
  const tones = {
    grape: 'text-grape',
    teal: 'text-teal-700',
    ink: 'text-ink-950',
    coral: 'text-[#b3402a]',
  };
  return (
    <p className={`text-[11px] font-bold uppercase tracking-[0.22em] ${tones[tone]}`}>{children}</p>
  );
}

function Display({ children, light = false }) {
  return (
    <h2
      className={`font-display text-4xl font-bold leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl ${
        light ? 'text-white' : 'text-ink-950'
      }`}
    >
      {children}
    </h2>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-ink-950 font-sans text-white antialiased">
      {/* ------------------------------------------------------- pill navbar */}
      <div className="fixed inset-x-0 top-3 z-40 px-3 sm:top-4 sm:px-5">
        <header className="mx-auto flex h-14 max-w-6xl items-center gap-2 rounded-full border border-white/10 bg-ink-900/90 py-2 pl-4 pr-2 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-grape text-sm font-bold text-white">
              ✚
            </span>
            <span className="font-display text-[15px] font-bold tracking-wide">AAROGYACHAIN</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-6 text-[13px] font-medium text-white/70 md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.to} href={link.to} className="transition hover:text-white">
                {link.label}
              </a>
            ))}
            <Link to="/verify" className="transition hover:text-white">
              Verify
            </Link>
            <Link to="/ai" className="transition hover:text-white">
              Gemini
            </Link>
          </nav>
          <Link
            to="/access"
            className="ml-auto rounded-full bg-grape px-4 py-2 text-[13px] font-semibold text-white shadow-sticker-sm transition hover:brightness-110 sm:px-5"
          >
            Access Dashboard
          </Link>
        </header>
      </div>

      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden pb-16 pt-32 sm:pt-36">
        <div className="bg-dots-dark absolute inset-0" aria-hidden="true" />
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(46rem 26rem at 78% 10%, rgba(108,92,231,0.28), transparent 62%),' +
              'radial-gradient(30rem 22rem at 12% 88%, rgba(255,138,112,0.12), transparent 60%)',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/50">
              AarogyaChain · live on Sepolia
            </p>
            <h1 className="font-display mt-4 text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
              Your records were never meant to be an island.
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/65">
              AarogyaChain links patients, doctors, hospitals and auditors through one contract —
              the patient owns every record, consent is a time-boxed window, and verification is
              free for anyone.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/access"
                className="rounded-full bg-grape px-6 py-3 text-sm font-semibold text-white shadow-sticker-sm transition hover:brightness-110"
              >
                Access Dashboard
              </Link>
              <a
                href="#records"
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/85 transition hover:border-white/50 hover:text-white"
              >
                See how it works
              </a>
            </div>
            <p className="mt-4 text-xs text-white/40">
              Sign-in is your wallet — the contract names your role.
            </p>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-[520px] px-10 py-8 sm:px-14">
            <div className="animate-drift absolute left-0 top-4 z-10 max-w-[210px] rounded-2xl border border-white/10 bg-ink-800/95 p-3 shadow-[0_14px_40px_rgba(0,0,0,0.5)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Patient 101 · grants
              </p>
              <p className="mt-1 text-[13px] font-medium text-white">
                Cardiology may read record #1 for 60 seconds.
              </p>
            </div>
            <div className="animate-drift-late absolute bottom-2 right-0 z-10 max-w-[210px] rounded-2xl border border-white/10 bg-ink-800/95 p-3 shadow-[0_14px_40px_rgba(0,0,0,0.5)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Contract · refuses
              </p>
              <p className="mt-1 text-[13px] font-medium text-white">
                Window expired — <span className="text-coral">Expired()</span>, no read.
              </p>
            </div>
            <RouteMap />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- cream: records */}
      <section id="records" className="relative bg-cream text-ink-950">
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-14 sm:pt-16">
          <Kicker>What does AarogyaChain actually do?</Kicker>
          <div className="mt-3 max-w-3xl">
            <Display>One record. A whole circle of care.</Display>
          </div>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-950/60">
            A record minted once is readable everywhere consent allows — while the patient keeps
            the only keys that matter.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                n: '01 · Sealed here',
                who: 'HI',
                place: 'Hospital IT · encrypts & mints',
                title: 'The file never travels raw',
                body: 'The browser seals the scan with AES-256-GCM before anything leaves the tab. Only a 32-byte digest is anchored on-chain.',
              },
              {
                n: '02 · Consent check',
                who: 'PP',
                place: 'Patient 101 · grants a window',
                title: 'Every read asks the contract',
                body: 'Grant Cardiology sixty seconds and the contract enforces the sixty-first itself. No cached permission, no policy document.',
              },
              {
                n: '03 · Delivered',
                who: 'CD',
                place: 'Cardiology · reads in-window',
                title: 'Same record, verified bytes',
                body: 'The reader re-hashes what they receive against the chain. A match means these bytes are exactly what was registered.',
              },
            ].map((card) => (
              <div
                key={card.n}
                className="rounded-3xl border-2 border-ink-950 bg-white p-5 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-950 font-display text-xs font-bold text-white">
                    {card.who}
                  </span>
                  <div>
                    <p className="font-mono text-[11px] font-bold text-grape">{card.n}</p>
                    <p className="text-xs font-semibold text-ink-950/70">{card.place}</p>
                  </div>
                </div>
                <p className="font-display mt-4 text-lg font-bold">{card.title}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-950/60">{card.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm font-medium text-ink-950/50">
            Same record. Three parties. The patient stays home — in control.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------- coral: consent */}
      <section id="consent" className="relative overflow-hidden bg-coral text-ink-950">
        <div className="bg-dots-light absolute inset-0 opacity-40" aria-hidden="true" />
        <p className="relative mx-auto max-w-6xl px-5 pt-10 text-right text-[11px] font-bold uppercase tracking-[0.22em] text-ink-950/60">
          Detour: time-boxed consent
        </p>
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-4 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <div className="max-w-md -rotate-2 rounded-3xl border-2 border-ink-950 bg-ink-950 p-5 text-white shadow-sticker">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">
                  Consent window · live
                </p>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> 0:47 left
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-grape text-xs font-bold">
                    P
                  </span>
                  <div className="rounded-2xl rounded-tl-md bg-white/10 px-3.5 py-2.5 text-[13px]">
                    Cardiology can read my MRI for the next 60 seconds.
                  </div>
                </div>
                <div className="flex justify-end gap-2.5">
                  <div className="rounded-2xl rounded-tr-md bg-grape px-3.5 py-2.5 text-[13px]">
                    Window open. Timer is the contract's, not mine.
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-coral text-xs font-bold text-ink-950">
                    D
                  </span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <span className="flex-1 rounded-full border border-white/15 px-4 py-2 text-center text-xs font-semibold text-white/60">
                  Revoke anytime
                </span>
                <span className="flex-1 rounded-full bg-white/10 px-4 py-2 text-center text-xs font-semibold text-white/60">
                  Expires on its own
                </span>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <Kicker tone="ink">Can consent meet the moment?</Kicker>
            <div className="mt-3">
              <Display>A hello from your doctor, exactly when allowed.</Display>
            </div>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-950/70">
              Open a window for one clinician and one record — or let it lapse and watch the
              contract refuse the sixty-first second. Temporary access. Permanent proof.
            </p>
            <p className="mt-5 inline-block border-b-2 border-ink-950 pb-1 text-sm font-bold">
              Temporary window. Real enforcement.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- ink: control */}
      <section id="control" className="relative overflow-hidden bg-ink-950">
        <div className="bg-dots-dark absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 lg:grid-cols-2">
          <div>
            <Kicker>Do you lose control of your data?</Kicker>
            <div className="mt-3">
              <Display light>Your records keep the keys.</Display>
            </div>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/60">
              Choose who reads what, for how long — and give each role only the powers it needs.
              The hospital can mint. It can never read.
            </p>
            <Link
              to="/access"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-cream px-6 py-3 text-sm font-semibold text-ink-950 shadow-sticker-sm transition hover:brightness-95"
            >
              Open Dashboard <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <div className="rounded-3xl border border-white/10 bg-ink-900/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)] sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              Patient 101 · record controls
            </p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-ink-950/70 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-white/40">
                Who can read record #1
              </p>
              {[
                { who: 'Cardiology', state: 'On · 0:47 left', on: true },
                { who: 'AarogyaChain AI (Gemini)', state: 'Off · needs its own consent', on: false },
                { who: 'Compliance', state: 'Metadata only · never the file', on: false },
              ].map((row) => (
                <div
                  key={row.who}
                  className="flex items-center justify-between gap-3 border-b border-white/5 py-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-white">{row.who}</p>
                    <p className="text-[11px] text-white/45">{row.state}</p>
                  </div>
                  <span
                    className={`relative h-6 w-11 shrink-0 rounded-full ${row.on ? 'bg-emerald-400' : 'bg-white/15'}`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${row.on ? 'right-0.5' : 'left-0.5'}`}
                    />
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-ink-950/70 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-white/40">
                What each role may do
              </p>
              {['Mint records (admin only)', 'Read with consent (doctor)', 'Audit metadata (auditor)'].map(
                (item) => (
                  <p key={item} className="flex items-center gap-2.5 border-b border-white/5 py-2.5 text-[13px] text-white/75 last:border-0 last:pb-0">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-grape/30 text-[11px] font-bold text-[#cfc9ff]">
                      ✓
                    </span>
                    {item}
                  </p>
                )
              )}
            </div>
            <div className="mt-4 flex items-center gap-4 text-[11px] text-white/45">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Windows enforced
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-coral" /> Soulbound · unmovable
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-300" /> Every event logged
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- mint: safety */}
      <section id="safety" className="bg-mint text-ink-950">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Kicker tone="teal">What happens when something goes wrong?</Kicker>
          <div className="mt-3 max-w-3xl">
            <Display>Safe passage, built into the record.</Display>
          </div>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-950/60">
            Every protection is enforced before access — not apologised for after it. People can
            revoke in one click, and every refusal leaves a clear on-chain trail.
          </p>

          <div className="relative mt-12">
            <div className="absolute left-0 right-0 top-5 hidden h-0.5 bg-ink-950 md:block" aria-hidden="true" />
            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  n: '01',
                  icon: '✓',
                  title: 'Sealed before upload',
                  body: 'Files are encrypted in the browser. The chain anchors only the digest.',
                  cardTag: 'SEALED IN-BROWSER',
                  cardTitle: 'Ciphertext uploaded',
                  cardBody: 'AES-256-GCM · digest on-chain',
                },
                {
                  n: '02',
                  icon: '!',
                  title: 'Granted with context',
                  body: 'Every window names its viewer, its record and its expiry.',
                  cardTag: 'WINDOW OPENED',
                  cardTitle: 'Cardiology · 60 seconds',
                  cardBody: 'Viewer, record and expiry on record',
                },
                {
                  n: '03',
                  icon: '→',
                  title: 'Revoked with care',
                  body: 'Revoke anytime; the refusal is instant and the history stays.',
                  cardTag: 'ACCESS REVOKED',
                  cardTitle: 'Refused · Expired()',
                  cardBody: 'Reason saved · history kept',
                },
              ].map((step) => (
                <div key={step.n}>
                  <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-ink-950 bg-cream font-display text-sm font-bold shadow-sticker-sm">
                    {step.icon}
                  </div>
                  <p className="mt-5 font-display text-lg font-bold">{step.title}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-950/60">{step.body}</p>
                  <div className="mt-4 rounded-3xl border-2 border-ink-950 bg-[#fbfaf6] p-4 shadow-card">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-700">
                      {step.cardTag}
                    </p>
                    <p className="mt-1.5 text-sm font-bold">{step.cardTitle}</p>
                    <p className="mt-0.5 text-xs text-ink-950/55">{step.cardBody}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- final CTA */}
      <section className="relative overflow-hidden">
        <div className="bg-dots-dark absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-5 py-24 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">
            The map is open
          </p>
          <h2 className="font-display mx-auto mt-4 max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Make your health part of something you own.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] text-white/60">
            Open a route to care you control — records you hold, consent you grant, proof anyone
            can check.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/access"
              className="rounded-full bg-grape px-6 py-3 text-sm font-semibold text-white shadow-sticker-sm transition hover:brightness-110"
            >
              Access Dashboard
            </Link>
            <Link
              to="/verify"
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/85 transition hover:border-white/50 hover:text-white"
            >
              Verify a record first
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-7">
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-grape text-xs font-bold text-white">
              ✚
            </span>
            <span className="font-display text-sm font-bold tracking-wide">AAROGYACHAIN</span>
          </span>
          <a
            href={EXPLORER}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-white/40 underline decoration-dotted hover:text-white/70"
          >
            {CONTRACT_ADDRESS}
          </a>
          <div className="ml-auto flex flex-wrap gap-5 text-[13px] font-medium text-white/55">
            <a href="#records" className="hover:text-white">Records</a>
            <a href="#consent" className="hover:text-white">Consent</a>
            <a href="#control" className="hover:text-white">Control</a>
            <a href="#safety" className="hover:text-white">Safety</a>
            <Link to="/access" className="font-semibold text-white hover:text-white">
              Access Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
