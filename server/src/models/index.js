import mongoose from 'mongoose';

export const isDbReady = () => mongoose.connection.readyState === 1;

const RecordSchema = new mongoose.Schema(
  {
    tokenId: { type: Number, required: true, unique: true, index: true },
    patient: { type: String, required: true, index: true, lowercase: true },
    recordType: { type: String, required: true },
    // keccak256 of the ciphertext. Also the on-disk blob name and the on-chain anchor.
    recordHash: { type: String, required: true, unique: true, index: true, lowercase: true },
    cid: { type: String, default: '' },
    // Content key, sealed under the server master key. Never the raw key.
    sealedKey: { type: String, required: true },
    fileName: { type: String, default: 'record.bin' },
    mimeType: { type: String, default: 'application/octet-stream' },
    sizeBytes: { type: Number, default: 0 },
    mintedAtBlock: { type: Number, default: 0 },
    mintedTx: { type: String, default: '' },
  },
  { timestamps: true }
);

const IdentitySchema = new mongoose.Schema(
  {
    account: { type: String, required: true, unique: true, lowercase: true, index: true },
    label: { type: String, default: '' },
    active: { type: Boolean, default: true },
    registeredAtBlock: { type: Number, default: 0 },
    roles: {
      admin: { type: Boolean, default: false },
      manager: { type: Boolean, default: false },
      auditor: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// Cached AI explanation, keyed by the digest. Same bytes -> same explanation,
// so a repeat request costs nothing and the demo cannot trip a rate limit.
const SummarySchema = new mongoose.Schema(
  {
    recordHash: { type: String, required: true, unique: true, lowercase: true, index: true },
    model: { type: String, default: '' },
    summary: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

const ChainEventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    blockNumber: { type: Number, required: true },
    txHash: { type: String, required: true },
    logIndex: { type: Number, default: 0 },
    args: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);
ChainEventSchema.index({ txHash: 1, name: 1, logIndex: 1 }, { unique: true });

/**
 * Off-chain, patient-owned display profile.
 *
 * Deliberately NOT part of the trust story, and the UI says so. The chain records
 * that a wallet is "Patient 101" and owns token 3; it never learns a name. This
 * collection exists so a dashboard can show "Akshut Goyal" instead of an address,
 * and it is:
 *   - editable only by the wallet it belongs to, proved by signature, not a session
 *   - deletable by that wallet
 *   - worthless to an attacker: forge every name in here and ownership, access
 *     control and verification are all unchanged
 *
 * The rule the deck already commits to still holds: nothing authoritative is PII.
 */
const ProfileSchema = new mongoose.Schema(
  {
    account: { type: String, required: true, unique: true, lowercase: true, index: true },
    displayName: { type: String, default: '', trim: true, maxlength: 80 },
    dateOfBirth: { type: String, default: '' },
    bloodGroup: { type: String, default: '' },
    allergies: { type: String, default: '', maxlength: 300 },
    emergencyContact: { type: String, default: '', maxlength: 120 },
    // Provenance for the UI badge: this was written by the wallet holder.
    verifiedBySignature: { type: Boolean, default: false },
    lastSignedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Guarded so `node --watch` reloads do not throw OverwriteModelError.
export const RecordModel = mongoose.models.Record || mongoose.model('Record', RecordSchema);
export const IdentityModel = mongoose.models.Identity || mongoose.model('Identity', IdentitySchema);
export const SummaryModel = mongoose.models.Summary || mongoose.model('Summary', SummarySchema);
export const ChainEventModel = mongoose.models.ChainEvent || mongoose.model('ChainEvent', ChainEventSchema);
export const ProfileModel = mongoose.models.Profile || mongoose.model('Profile', ProfileSchema);

export const allModels = [RecordModel, IdentityModel, SummaryModel, ChainEventModel, ProfileModel];
