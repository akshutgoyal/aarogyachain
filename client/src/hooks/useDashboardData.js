import { useCallback, useEffect, useMemo, useState } from 'react';
import { getStats, listProfiles } from '../services/api';

// Dashboard data, fetched once per mount and on demand.
//
// Both hooks degrade rather than throw: a dashboard that renders with empty charts
// is more useful on stage than one that renders an error page, and the shell's
// "refresh" already tells the user the truth about connectivity.

export function useStats({ autoRefreshMs = 45_000 } = {}) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setStats(await getStats());
      setError(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!autoRefreshMs) return undefined;
    const timer = setInterval(load, autoRefreshMs);
    return () => clearInterval(timer);
  }, [load, autoRefreshMs]);

  return { stats, loading, error, reload: load };
}

/**
 * Display profiles, plus a lookup that falls back to the on-chain label and then
 * the address — so a dashboard always has something human to show.
 */
export function useProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [available, setAvailable] = useState(true);

  const load = useCallback(async () => {
    try {
      const { profiles: list } = await listProfiles();
      setProfiles(list || []);
      setAvailable(true);
    } catch {
      // The database is optional. Without it we simply show addresses.
      setProfiles([]);
      setAvailable(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const nameFor = useCallback(
    (address, fallbackLabel) => {
      if (!address) return '—';
      const match = profiles.find((p) => p.account === String(address).toLowerCase());
      return match?.displayName || fallbackLabel || null;
    },
    [profiles]
  );

  const byAddress = useMemo(() => {
    const map = {};
    for (const profile of profiles) map[profile.account] = profile;
    return map;
  }, [profiles]);

  return { profiles, nameFor, byAddress, available, reload: load };
}
