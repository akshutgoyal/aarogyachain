import React, { useEffect, useState } from 'react';
import { Pill } from './ui';

// A live countdown against the on-chain expiry. The point of showing it is that
// the deadline is not a UI convention — when it reaches zero, the contract stops
// authorising the read, which is a different and stronger claim.

function remaining(expiresAtSeconds) {
  if (!expiresAtSeconds) return null;
  const ms = expiresAtSeconds * 1000 - Date.now();
  if (ms <= 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

export default function ConsentTimer({ expiresAt, label = 'Consent' }) {
  const [text, setText] = useState(() => remaining(expiresAt));

  useEffect(() => {
    setText(remaining(expiresAt));
    const timer = setInterval(() => setText(remaining(expiresAt)), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (!expiresAt) return <Pill tone="slate">{label}: none granted</Pill>;
  if (!text) return <Pill tone="rose">{label}: expired</Pill>;

  const expiresOn = new Date(expiresAt * 1000);
  return (
    <Pill tone="emerald" className="tabular-nums">
      {label} valid {text} · until{' '}
      {expiresOn.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })}
    </Pill>
  );
}
