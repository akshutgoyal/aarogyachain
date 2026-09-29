// The browser's only door to the backend. Every page imports from here, so the
// API surface lives in exactly one file.

import { API_URL } from '../contract';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    const error = new Error(
      'Could not reach the API. Is the backend running on ' + API_URL + '?'
    );
    error.code = 'API_DOWN';
    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `Request failed (${response.status})`);
    error.code = payload.error || 'REQUEST_FAILED';
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

// ---------------------------------------------------------------- chain reads

export const chainStatus = () => request('/chain/status');
export const chainIdentities = () => request('/chain/identities');
export const chainPermissions = (address) => request(`/chain/permissions/${address}`);
export const chainEvents = (limit = 100) => request(`/chain/events?limit=${limit}`);

// -------------------------------------------------------------- record index

export const listRecords = () => request('/records');
export const getRecord = (tokenId) => request(`/records/${tokenId}`);
export const recordsByOwner = (address) => request(`/records/owner/${address}`);

/** Store a record the browser already encrypted. */
export const storeRecord = (body) =>
  request('/records', { method: 'POST', body: JSON.stringify(body) });

/**
 * The consent-gated release. A 403 here is not an error to apologise for — it is
 * the contract refusing, and the code tells you which rule it applied.
 */
export const releaseFile = (tokenId, viewer) =>
  request(`/records/${tokenId}/file?viewer=${viewer}`);

// ------------------------------------------------------------------- the AI

/**
 * TIER B — explain the record's CONTENTS.
 * Needs two consents: the requester may read it, AND the patient has authorised
 * the AI as a viewer in its own right. A 403 here can mean either.
 */
export const aiSummary = (tokenId, viewer) =>
  request('/ai/summary', {
    method: 'POST',
    body: JSON.stringify({ tokenId, viewer }),
  });

/**
 * TIER A — explain the record's ACCESS HISTORY.
 * Built from public chain metadata only: nothing is decrypted, so one consent
 * (the requester may read) is enough.
 */
export const aiAccessHistory = (tokenId, viewer) =>
  request('/ai/access-history', {
    method: 'POST',
    body: JSON.stringify({ tokenId, viewer }),
  });

/** Both consent windows for a record, so the UI never has to guess. */
export const aiStatus = (tokenId) => request(`/ai/status/${tokenId}`);

// ---------------------------------------------------------- dashboard data

/** Aggregates for the dashboards, assembled server-side from chain state. */
export const getStats = () => request('/stats');

// ------------------------------------------------- patient-owned profiles
// Off-chain display data. The chain records that a wallet is "Patient 101" and
// owns token 3; it never learns a name. Writes carry a wallet signature, because
// there is no session to authenticate with.

export const listProfiles = () => request('/profiles');
export const getProfile = (address) => request(`/profiles/${address}`);

export const saveProfile = (address, body) =>
  request(`/profiles/${address}`, { method: 'PUT', body: JSON.stringify(body) });

export const eraseProfile = (address, timestamp, signature) =>
  request(
    `/profiles/${address}?timestamp=${encodeURIComponent(timestamp)}&signature=${encodeURIComponent(signature)}`,
    { method: 'DELETE' }
  );

// ------------------------------------------------------- audit and verify

export const auditRecord = (tokenId) => request(`/audit/${tokenId}`);

export const verifyDigest = (tokenId, fileHash) =>
  request('/verify', {
    method: 'POST',
    body: JSON.stringify({ tokenId, fileHash }),
  });
