import { SummaryModel, isDbReady } from '../models/index.js';
import { recordMeta, events, blockTimestamps, labelMap, call, transactionSenders } from '../services/chain.js';
import { hasBlob, readDecryptedText } from '../services/storage.js';
import { explainRecord, explainAccessHistory, isConfigured, DEFAULT_MODEL } from '../services/gemini.js';
import { aiViewerAddress } from '../middleware/consentGate.js';

const TOKEN_EVENTS = [
  'RecordRequested',
  'RecordMinted',
  'RecordRevoked',
  'AccessGranted',
  'AccessRevoked',
  'EmergencyAccessUsed',
];

function short(address) {
  if (typeof address !== 'string' || address.length < 10) return String(address);
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// TIER A — explain a record's ACCESS HISTORY.
//
// This is the safe-by-construction use of Gemini. The prompt is built only from
// public chain metadata: event names, addresses and timestamps. Not one byte of
// a medical record reaches the model, and nothing is decrypted. So it needs no
// content consent — only that the requester is entitled to read the record, and
// in practice that data is already public on the ledger.
// ---------------------------------------------------------------------------

export async function accessHistory(req, res) {
  const { tokenId, viewer } = req.consent;

  if (!isConfigured()) {
    return res.status(503).json({
      error: 'AI_NOT_CONFIGURED',
      message:
        'GEMINI_API_KEY is not set, so no explanation can be produced. ' +
        'Add it to server/.env and restart. Access control is unaffected — the consent gate passed.',
      consentGranted: true,
    });
  }

  try {
    const meta = await recordMeta(tokenId);
    if (!meta) return res.status(404).json({ error: 'RecordNotFound', message: 'No such record.' });

    const [all, labels] = await Promise.all([events(500), labelMap()]);

    // Only this token's history. `RecordRevoked` and `RecordMinted` carry the
    // token id; the consent events do too, so one filter covers them all.
    const relevant = all.filter((event) => {
      if (!TOKEN_EVENTS.includes(event.name)) return false;
      const args = event.args || {};
      if (args.tokenId !== undefined) return String(args.tokenId) === String(tokenId);
      // RecordRequested has no tokenId — it is matched on the patient instead.
      return String(args.patient).toLowerCase() === String(meta.patient).toLowerCase();
    });

    const times = await blockTimestamps(relevant.map((event) => event.blockNumber));
    const senders = await transactionSenders(relevant.map((event) => event.txHash));

    // The event log is HISTORY. It cannot tell anyone who holds access right now,
    // because a consent window closes silently — there is no "expired" event to
    // read. Left to itself the model will happily say "Cardiology currently has
    // access" about a window that shut six days ago. So ask the contract for the
    // truth and hand it over as the authoritative block.
    const candidates = new Set();
    for (const event of relevant) {
      const args = event.args || {};
      for (const key of ['viewer', 'requester', 'admin', 'patient']) {
        if (typeof args[key] === 'string') candidates.add(args[key]);
      }
    }
    if (meta.patient) candidates.add(meta.patient);

    const now = Math.floor(Date.now() / 1000);
    const currentAccess = [];
    for (const address of candidates) {
      try {
        const [allowed] = await call('canAccess', [tokenId, address]);
        const [expiryRaw] = await call('consent', [tokenId, address]);
        const expiry = Number(expiryRaw);
        // No entry at all means this party was never granted anything.
        if (!allowed && expiry === 0) continue;
        currentAccess.push({
          who: labels[address.toLowerCase()] || short(address),
          address,
          status: allowed ? 'ACTIVE' : 'EXPIRED',
          expiresAt: expiry
            ? new Date(expiry * 1000).toISOString().replace('T', ' ').slice(0, 16)
            : null,
        });
      } catch {
        /* skip */
      }
    }

    const rows = relevant.map((event) => {
      const args = event.args || {};
      // Which field names the actor differs per event. `RecordMinted` is the odd
      // one out: it names the patient the token was allocated to, not the admin
      // who minted it, so fall back to the transaction sender.
      let actor = args.viewer || args.requester || args.admin || args.patient || '';
      if (event.name === 'RecordMinted' && senders[event.txHash]) {
        actor = senders[event.txHash];
      }
      const actorLabel = labels[String(actor).toLowerCase()];
      const detail = Object.entries(args)
        .filter(([key, value]) => !['tokenId', 'viewer', 'requester', 'admin', 'patient'].includes(key))
        .filter(([, value]) => value !== '' && value !== null)
        .map(([key, value]) => `${key}=${String(value).slice(0, 40)}`)
        .join(' ');
      return {
        when: times[event.blockNumber]
          ? times[event.blockNumber].replace('T', ' ').slice(0, 16)
          : `block ${event.blockNumber}`,
        event: event.name,
        who: actorLabel ? `${actorLabel} (${short(actor)})` : short(actor) || 'unknown',
        detail,
      };
    });

    const { summary, model, usage } = await explainAccessHistory({
      tokenId,
      recordType: meta.recordType,
      owner: labels[String(meta.patient).toLowerCase()] || short(meta.patient),
      rows,
      currentAccess,
    });

    return res.json({
      summary,
      model,
      usage,
      cached: false,
      consentGranted: true,
      checkedBy: 'contract.viewRecord',
      aiConsentRequired: false,
      dataSentToModel: 'public chain metadata only — no record content, nothing decrypted',
      eventsConsidered: rows.length,
      currentAccess,
      viewer,
    });
  } catch (error) {
    return res.status(error.code === 'AI_UPSTREAM' ? 502 : 500).json({
      error: error.code || 'AI_FAILED',
      message: error.message,
    });
  }
}

// ---------------------------------------------------------------------------
// TIER B — explain a record's CONTENTS.
//
// Mounted behind BOTH gates: the requester must be entitled to read the record,
// AND the patient must have authorised the AI as a viewer in its own right.
// By the time this runs, two separate contract calls have said yes.
// ---------------------------------------------------------------------------

export async function summarize(req, res) {
  const { tokenId, viewer, cid } = req.consent;
  const aiViewer = req.aiConsent?.aiViewer || aiViewerAddress();

  if (!isConfigured()) {
    return res.status(503).json({
      error: 'AI_NOT_CONFIGURED',
      message:
        'GEMINI_API_KEY is not set, so no summary can be produced. ' +
        'Add it to server/.env and restart. Access control is unaffected — both consent gates passed.',
      consentGranted: true,
      aiConsentGranted: true,
    });
  }

  try {
    const meta = await recordMeta(tokenId);
    if (!meta) return res.status(404).json({ error: 'RecordNotFound', message: 'No such record.' });

    const digest = meta.recordHash;

    // The cache is consulted only AFTER both gates, so a cache hit is never a bypass.
    if (isDbReady()) {
      const cached = await SummaryModel.findOne({ recordHash: digest.toLowerCase() }).lean();
      if (cached) {
        return res.json({
          summary: cached.summary,
          model: cached.model,
          cached: true,
          consentGranted: true,
          aiConsentGranted: true,
          checkedBy: 'contract.viewRecord',
          aiViewer,
          cid,
        });
      }
    }

    if (!(await hasBlob(digest))) {
      return res.status(409).json({
        error: 'BlobMissing',
        message:
          'Both consent gates passed, but this server does not hold the record bytes. ' +
          'The token was minted from a different machine, or the uploads directory was cleared. ' +
          'Mint a fresh record from the Admin console to demonstrate the full path.',
        recordHash: digest,
      });
    }

    // Decrypt only now — after two separate authorisations, never before.
    const { text, bytes, truncatedAtSource } = await readDecryptedText(digest);
    if (!text.trim()) {
      return res.status(422).json({
        error: 'EmptyRecord',
        message: 'This record decrypted to no readable text — it may be an image or an unsupported format.',
      });
    }

    const { summary, model, usage, truncated } = await explainRecord({
      recordType: meta.recordType,
      text,
    });

    if (isDbReady()) {
      await SummaryModel.findOneAndUpdate(
        { recordHash: digest.toLowerCase() },
        { recordHash: digest.toLowerCase(), model, summary },
        { upsert: true }
      );
    }

    return res.json({
      summary,
      model,
      usage,
      cached: false,
      consentGranted: true,
      aiConsentGranted: true,
      checkedBy: 'contract.viewRecord',
      aiViewer,
      cid,
      sourceBytes: bytes,
      sourceTruncated: truncated || truncatedAtSource,
    });
  } catch (error) {
    if (error.code === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'AI_NOT_CONFIGURED', message: error.message });
    }
    return res.status(error.code === 'AI_UPSTREAM' ? 502 : 500).json({
      error: error.code || 'AI_FAILED',
      message: error.message,
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    });
  }
}

// ---------------------------------------------------------------------------
// Consent status, so the UI can show both windows without guessing.
// ---------------------------------------------------------------------------

export async function aiStatus(req, res) {
  const tokenId = Number(req.params.tokenId);
  if (!Number.isInteger(tokenId) || tokenId <= 0) {
    return res.status(400).json({ error: 'BadRequest', message: 'tokenId must be a positive integer.' });
  }

  const aiViewer = aiViewerAddress();
  try {
    const [expiryForAi] = await call('consent', [tokenId, aiViewer]);
    const aiExpiry = Number(expiryForAi);

    let aiActive = false;
    if (aiExpiry > 0) {
      const now = Math.floor(Date.now() / 1000);
      aiActive = aiExpiry > now;
    }

    return res.json({
      tokenId,
      aiViewer,
      aiConsent: {
        granted: aiExpiry > 0,
        active: aiActive,
        expiresAt: aiExpiry || null,
      },
      configured: isConfigured(),
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
      note: 'The AI is an ordinary viewer. The patient grants it with grantAccess() and revokes it with revokeAccess().',
    });
  } catch (error) {
    return res.status(502).json({ error: 'ChainUnavailable', message: error.message });
  }
}
