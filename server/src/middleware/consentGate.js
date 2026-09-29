// THE CONSENT GATES.
//
// There are two of them, and keeping them separate is the point.
//
// GATE 1 — may this PERSON read the record?
//   The server cannot *be* the viewer — it holds no key — so instead of
//   re-implementing the access rule, it asks the contract to run its own check
//   as that address:
//
//       eth_call { from: viewer } -> viewRecord(tokenId)
//
//   If the call returns, the contract authorised the viewer and we hold the CID
//   it released. If it reverts, the contract refused.
//
// GATE 2 — has the patient authorised sending the CONTENT to the model?
//   Reading a record and transmitting it to a third party are different acts.
//   Under a purpose-limitation reading, the second needs its own consent. Rather
//   than invent a parallel permission system, the AI is registered as an ordinary
//   viewer: the patient grants it a window with the SAME grantAccess() a doctor
//   uses, and we check it with the SAME viewRecord() call.
//
// Nowhere in this file is there an `if (role === 'admin')`. The rules live in
// Solidity and this module only reports their verdicts.

import { ethers } from 'ethers';
import { callAs, decodeRevert } from '../services/chain.js';

const STATUS_FOR = {
  AccessDenied: 403,
  Expired: 403,
  NotAuthorized: 403,
  AccessControlUnauthorizedAccount: 403,
  RecordNotFound: 404,
  ERC721NonexistentToken: 404,
};

const MESSAGE_FOR = {
  AccessDenied: 'The record owner has not granted this viewer access.',
  Expired:
    'The consent window for this viewer has closed. The contract no longer authorises the read.',
  RecordNotFound: 'No record exists for that token id.',
  NotAuthorized: 'The contract refused this call for that address.',
};

/** The AI service's on-chain identity. It holds no key and never signs. */
export function aiViewerAddress() {
  const configured = process.env.AI_VIEWER_ADDRESS || '0x000000000000000000000000000000000000A1A1';
  return ethers.getAddress(configured);
}

/**
 * Ask the contract whether `viewer` may read `tokenId`.
 * Returns `{ ok: true, cid }` or `{ ok: false, status, error, message }`.
 */
export async function checkRead(tokenId, viewer) {
  try {
    const [cid] = await callAs('viewRecord', [tokenId], viewer);
    return { ok: true, cid, checkedBy: 'contract.viewRecord' };
  } catch (error) {
    const decoded = decodeRevert(error);
    if (!decoded) {
      return {
        ok: false,
        status: 502,
        error: 'ChainUnavailable',
        message:
          'Could not reach the contract to check consent. ' +
          (error?.shortMessage || error?.message || 'Unknown RPC error.'),
      };
    }
    return {
      ok: false,
      status: STATUS_FOR[decoded.name] || 403,
      error: decoded.name,
      message: MESSAGE_FOR[decoded.name] || 'The contract refused this read.',
    };
  }
}

function parseTarget(req) {
  const rawTokenId = req.params.tokenId ?? req.body?.tokenId ?? req.query?.tokenId;
  const viewer = req.params.viewer ?? req.body?.viewer ?? req.query?.viewer;
  const tokenId = Number(rawTokenId);

  if (!Number.isInteger(tokenId) || tokenId <= 0) {
    return { error: { status: 400, body: { error: 'BadRequest', message: 'tokenId must be a positive integer.' } } };
  }
  if (typeof viewer !== 'string' || !ethers.isAddress(viewer)) {
    return { error: { status: 400, body: { error: 'BadRequest', message: 'A valid viewer address is required.' } } };
  }
  return { tokenId, viewer };
}

/**
 * GATE 1 — the requester must be entitled to read the record.
 * Populates `req.consent` with the CID the contract released.
 */
export async function requireConsent(req, res, next) {
  const parsed = parseTarget(req);
  if (parsed.error) return res.status(parsed.error.status).json(parsed.error.body);

  const { tokenId, viewer } = parsed;
  const result = await checkRead(tokenId, viewer);

  if (!result.ok) {
    return res.status(result.status).json({
      error: result.error,
      message: result.message,
      tokenId,
      viewer,
    });
  }

  req.consent = { tokenId, viewer, cid: result.cid, checkedBy: result.checkedBy };
  return next();
}

/**
 * GATE 2 — the patient must have authorised the AI to handle this record.
 *
 * Deliberately reports itself separately from gate 1, because the two failures
 * mean entirely different things: gate 1 failing is "you may not read this",
 * gate 2 failing is "you may read this, but nobody agreed to the model seeing it".
 */
export async function requireAiConsent(req, res, next) {
  const tokenId = req.consent?.tokenId ?? Number(req.body?.tokenId ?? req.params.tokenId);
  if (!Number.isInteger(tokenId) || tokenId <= 0) {
    return res.status(400).json({ error: 'BadRequest', message: 'tokenId must be a positive integer.' });
  }

  const aiAddress = aiViewerAddress();
  const result = await checkRead(tokenId, aiAddress);

  if (!result.ok) {
    if (result.error === 'ChainUnavailable') {
      return res.status(result.status).json({ error: result.error, message: result.message });
    }
    return res.status(403).json({
      error: 'AiConsentRequired',
      contractSaid: result.error,
      message:
        result.error === 'Expired'
          ? 'The patient\u2019s consent for AI processing has expired. The record is unchanged and still readable by its authorised viewers \u2014 only the explanation is withheld.'
          : 'The patient has not authorised sending this record to the AI. Consent for AI processing is separate from consent to read, and has not been granted.',
      aiViewer: aiAddress,
      tokenId,
    });
  }

  req.aiConsent = { aiViewer: aiAddress, cidAi: result.cid, checkedBy: result.checkedBy };
  return next();
}
