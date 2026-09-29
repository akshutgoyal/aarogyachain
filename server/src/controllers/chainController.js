import { ethers } from 'ethers';
import {
  status,
  identities,
  permissions,
  events,
  recordMeta,
  verifyRecord,
} from '../services/chain.js';

/** GET /api/chain/status — proves the read-only RPC path is live. */
export async function chainStatus(req, res) {
  try {
    const info = await status();
    return res.json({
      ok: true,
      ...info,
      explorer: `https://sepolia.etherscan.io/address/${info.contract}`,
      note: 'Read-only. The server holds no signing key — every write is signed in the browser.',
    });
  } catch (error) {
    return res.status(502).json({ ok: false, error: 'ChainUnavailable', message: error.message });
  }
}

/** GET /api/chain/identities — rebuilt from IdentityCreated logs. */
export async function chainIdentities(req, res) {
  try {
    return res.json({ identities: await identities(), source: 'IdentityCreated logs + hasRole' });
  } catch (error) {
    return res.status(502).json({ error: 'ChainUnavailable', message: error.message });
  }
}

/**
 * GET /api/chain/permissions/:address
 * The single source of truth for "what is this wallet?". Both the role badge and
 * the page body read this, so they can never disagree with each other.
 */
export async function chainPermissions(req, res) {
  const { address } = req.params;
  if (!ethers.isAddress(address)) {
    return res.status(400).json({ error: 'BadRequest', message: 'Not a valid address.' });
  }
  try {
    return res.json(await permissions(address));
  } catch (error) {
    return res.status(502).json({ error: 'ChainUnavailable', message: error.message });
  }
}

/** GET /api/chain/events — the audit trail, newest first. */
export async function chainEvents(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    return res.json({ events: await events(limit) });
  } catch (error) {
    return res.status(502).json({ error: 'ChainUnavailable', message: error.message });
  }
}

/**
 * GET /api/audit/:tokenId
 * Mirrors the contract's auditRecord: metadata only. The CID is not included,
 * because the contract never releases it to an auditor.
 */
export async function audit(req, res) {
  const tokenId = Number(req.params.tokenId);
  if (!Number.isInteger(tokenId) || tokenId <= 0) {
    return res.status(400).json({ error: 'BadRequest', message: 'tokenId must be a positive integer.' });
  }
  try {
    const record = await recordMeta(tokenId);
    if (!record) return res.status(404).json({ error: 'RecordNotFound', message: 'No such record.' });
    return res.json({
      tokenId: record.tokenId,
      recordHash: record.recordHash,
      recordType: record.recordType,
      patient: record.patient,
      mintedAtBlock: record.mintedAtBlock,
      mintedTx: record.mintedTx,
      locked: record.locked,
      // Deliberately absent: cid, fileName, mimeType, and the bytes themselves.
      fileReleased: false,
      note: 'Metadata only. The contract does not release the file location to an auditor.',
    });
  } catch (error) {
    return res.status(502).json({ error: 'ChainUnavailable', message: error.message });
  }
}

/**
 * POST /api/verify   { tokenId, fileHash }  OR  { tokenId, ciphertext }
 * Free and permissionless — no wallet, no consent, no account. Returns a verdict
 * and never the record.
 */
export async function verify(req, res) {
  const tokenId = Number(req.body?.tokenId);
  if (!Number.isInteger(tokenId) || tokenId <= 0) {
    return res.status(400).json({ error: 'BadRequest', message: 'tokenId must be a positive integer.' });
  }

  let provided = req.body?.fileHash;
  if (!provided && typeof req.body?.ciphertext === 'string') {
    // Hash it here so a client that only holds the file can still ask.
    provided = ethers.keccak256(Buffer.from(req.body.ciphertext, 'base64'));
  }
  if (typeof provided !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(provided)) {
    return res.status(400).json({
      error: 'BadRequest',
      message: 'Provide fileHash (0x + 64 hex chars) or ciphertext (base64).',
    });
  }

  try {
    const record = await recordMeta(tokenId);
    if (!record) return res.status(404).json({ error: 'RecordNotFound', message: 'No such record.' });

    const [verdict] = await verifyRecord(tokenId, provided);
    return res.json({
      tokenId,
      provided,
      onChain: record.recordHash,
      authentic: verdict,
      verifiedBy: 'contract.verifyRecord',
      // Deliberately not returned: the file, the CID, or anything readable.
    });
  } catch (error) {
    return res.status(502).json({ error: 'ChainUnavailable', message: error.message });
  }
}
