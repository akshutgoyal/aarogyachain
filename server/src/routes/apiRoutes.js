import { Router } from 'express';
import { getHealth } from '../controllers/healthController.js';
import {
  chainStatus,
  chainIdentities,
  chainPermissions,
  chainEvents,
  audit,
  verify,
} from '../controllers/chainController.js';
import {
  listRecords,
  getRecord,
  listByOwner,
  storeRecord,
  releaseFile,
} from '../controllers/recordController.js';
import { accessHistory, summarize, aiStatus } from '../controllers/aiController.js';
import {
  listProfiles,
  getProfile,
  upsertProfile,
  deleteProfile,
} from '../controllers/profileController.js';
import { stats } from '../controllers/statsController.js';
import { requireConsent, requireAiConsent } from '../middleware/consentGate.js';

const router = Router();

// Organizer's endpoint — untouched.
router.get('/health', getHealth);

// Chain reads. No wallet, no consent, no account.
router.get('/chain/status', chainStatus);
router.get('/chain/identities', chainIdentities);
router.get('/chain/permissions/:address', chainPermissions);
router.get('/chain/events', chainEvents);

// Dashboard aggregates, assembled from chain state.
router.get('/stats', stats);

// Patient-owned display profiles. Off-chain convenience data: the chain records
// that a wallet is "Patient 101", never a name. Writes are authorised by a wallet
// signature rather than a session, because there is no session to have.
router.get('/profiles', listProfiles);
router.get('/profiles/:address', getProfile);
router.put('/profiles/:address', upsertProfile);
router.delete('/profiles/:address', deleteProfile);

// Record index and storage. Note: /owner/:address must precede /:tokenId.
router.get('/records', listRecords);
router.post('/records', storeRecord);
router.get('/records/owner/:address', listByOwner);
router.get('/records/:tokenId', getRecord);

// --- Everything below releases a record, or a reading of one. ---

// One gate: the requester must be entitled to read the record.
router.get('/records/:tokenId/file', requireConsent, releaseFile);

// The access-history explanation reads ONLY public chain metadata — event names,
// addresses and timestamps. Nothing is decrypted, so it needs one gate, not two.
router.post('/ai/access-history', requireConsent, accessHistory);

// The content explanation needs the AI's OWN consent as well, because the record
// is decrypted and transmitted to a third-party model. Two gates, two answers,
// and the failures mean different things — see middleware/consentGate.js.
router.post('/ai/summary', requireConsent, requireAiConsent, summarize);

// Which consent windows exist for this record, so the UI never has to guess.
router.get('/ai/status/:tokenId', aiStatus);

// Metadata-only audit view, and the free public verification primitive.
router.get('/audit/:tokenId', audit);
router.post('/verify', verify);

export default router;
