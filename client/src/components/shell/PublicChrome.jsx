import React from 'react';
import { Link } from 'react-router-dom';

// Slim public chrome: the logo, the two public utilities, and the dashboard door.
// No sidebar, no role navigation — those belong to the product shell, which only a
// connected wallet with a role ever sees.
export default function PublicChrome({ children }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-sm font-bold text-white shadow-sm">
              ✚
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-900">AarogyaChain</span>
          </Link>
          <nav className="ml-2 hidden items-center gap-5 text-sm text-slate-600 sm:flex">
            <Link to="/verify" className="hover:text-slate-900">Verify a record</Link>
            <Link to="/ai" className="hover:text-slate-900">Gemini explanations</Link>
          </nav>
          <div className="ml-auto">
            <Link to="/access" className="btn-primary shadow-sm">
              Access Dashboard →
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
