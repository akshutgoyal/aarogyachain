# AarogyaChain

> Patient-owned medical records, verifiable by anyone, instantly.

**Team Nirvans** · Akshut Goyal · Reedhan Garg · Harsh Kumar
**Problem statement:** Blockchain-Based Secure Platform for Identity, Access Control & Digital Asset Management

Live contract (Sepolia): [`0x464e6963cE0D833193C83Fc8Bd081614B9344b03`](https://sepolia.etherscan.io/address/0x464e6963cE0D833193C83Fc8Bd081614B9344b03) · deploy block `11714309`

---

## The problem

Medical records sit fragmented across paper files and private hospital databases.
They are easy to tamper with, easy to lose in a transfer, and impossible to verify
without trusting whoever happens to be holding them. Consent exists as policy rather
than as proof, and the patient — whose data it is — holds nothing.

## The solution, in one line

**Login is a wallet. A record is a soulbound NFT. Permission is a smart contract.**

Three substitutions do all the work:

| Ordinary system | AarogyaChain |
|---|---|
| Username and password | A wallet address — the key *is* the identity |
| A row in a database | A soulbound NFT owned by the patient's wallet |
| A permission flag | A smart contract that re-checks every call |

The fourth claim is why this is not "just a database": **anyone can verify a record
for free, without trusting us.**

---

## What is actually built

| | |
|---|---|
| **Contract** | Solidity 0.8.24, OpenZeppelin ERC-721 + AccessControl, ERC-5192 soulbound. Deployed and live on Sepolia at [`0x464e6963cE0D833193C83Fc8Bd081614B9344b03`](https://sepolia.etherscan.io/address/0x464e6963cE0D833193C83Fc8Bd081614B9344b03) |
| **Frontend** | React 18 + Vite 6 + Tailwind 3 + ethers v6 — one console per role |
| **Backend** | Express 4 + Mongoose 8 — serves ciphertext, indexes the chain, and holds the AI key |
| **AI** | Gemini 3.6 Flash (with Flash/Pro fallbacks), behind the contract's own consent gate |
| **Storage** | Encrypted blobs on disk, behind an interface that IPFS drops into |

---

## Architecture

Three stores, each doing the one job it is best at. Nothing important depends on
any single one of them agreeing with the others.

| Store | Holds | Why |
|---|---|---|
| **Blockchain** | Owner, roles, the 32-byte record digest, consent windows, every event | Truth. Public, immutable, tamper-proof. If anything disagrees with the chain, the chain wins. |
| **Server (disk)** | The encrypted file and its sealed content key | The file itself has no business on a ledger. A 500 MB scan costs the same on-chain as a text file. |
| **MongoDB** | A browse index of identities, records and events | Speed only. It can be dropped and rebuilt from chain logs at any time. |

> **Mongo answers quickly. The chain answers truthfully.**

### What never happens

- The server **never holds a signing key**. Every state change is signed in the user's
  own wallet. There is nothing on the server worth stealing that would let anyone mint.
- The record **never leaves the browser in plaintext**. It is encrypted with a
  per-record AES-256-GCM key generated in the tab; the server receives ciphertext.
- The AI **never receives an unauthorised byte**, and the API key never reaches the browser.

---

## The part worth watching: a consent-gated AI

A patient who owns a record still cannot read an MRI. Ownership without comprehension
is not sovereignty — so Gemini turns data into plain language. It is an **explanation
layer, never a decision layer**: it cannot mint, grant, revoke, or read anything on its own.

Sending a medical record to a third-party model is a **new purpose**, and under a
purpose-limitation reading a new purpose needs its own consent. So the model is used in
two deliberately different ways:

| | **Tier A — access history** | **Tier B — record contents** |
|---|---|---|
| **What it explains** | Who accessed the record, when, and who can read it now | The record itself, in plain language |
| **What the model receives** | Public chain metadata only — event names, addresses, timestamps | The decrypted record |
| **Consent needed** | One: you may read the record | Two: you may read it, **and** the patient has authorised the AI |
| **Why** | This data is already public on the ledger; we are only explaining it | This is a genuine data egress, and calling it anything else would be dishonest |

### How the AI is authorised

Rather than invent a second permission system, the AI is registered as an ordinary
**viewer**. It holds no key and never signs, so it can never act — it can only ever be the
*subject* of a grant. The patient authorises it with the same `grantAccess()` call a
doctor's consent uses, and the server checks it with the same `viewRecord()` call:

```js
// server/src/middleware/consentGate.js
// Gate 1 — may the PERSON read it?
const [cid] = await callAs('viewRecord', [tokenId], viewer);

// Gate 2 — did the patient authorise the AI, separately?
await callAs('viewRecord', [tokenId], aiViewerAddress());
```

Both are `eth_call`s against the live contract. **No contract change was needed** — the
consent primitive already generalises. And the two failures mean different things, which
the UI says explicitly: gate 1 failing is *"you may not read this"*, gate 2 failing is
*"you may read this, but nobody agreed to the model seeing it."*

Revoking AI consent leaves a doctor's access completely untouched, and vice versa.
They are separate windows on the same contract.

**Demonstrate it in four steps:**

1. Open `/ai` and ask as **Patient 101** for the **access history** → it works, because no
   record content was involved.
2. Ask for the **record contents** → refused with `AiConsentRequired`. The patient can read
   their own record, but nobody authorised the model.
3. On `/patient`, press **Authorise AI for this record**, then ask again → a summary.
4. Press **Withdraw AI consent**, ask again → refused. A doctor's read is unaffected.

---

## Enforced gates

Four things the contract refuses, whatever the interface allows:

| Gate | What happens |
|---|---|
| **Admin-only minting** | A non-admin `mintRecord` reverts with the AccessControl missing-role error. |
| **Soulbound** | Even the owner cannot transfer a record. The code path does not exist. |
| **Consent expiry** | After the window closes, the read itself reverts — and so does the AI. |
| **Gated audit** | A non-auditor is refused, and the auditor never receives the file location. |

Plus **free, permissionless verification**: re-hash the file, compare with the on-chain
digest, and get a verdict. It is a `view` call — no gas, no account, no wallet, no trust
in us. Try it on `/verify` with no wallet connected at all.

---

## Running it

### Prerequisites

- **Node.js 18+** and **npm** (check with `node --version`).
- **MetaMask** (or any injected Ethereum wallet), pointed at the **Sepolia** testnet.
  Sepolia ETH for gas is free from a faucet such as
  [Google Cloud's Sepolia faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia).
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey)
  (free tier works; the default model is `gemini-3.6-flash` with automatic fallbacks).
- **MongoDB is optional.** The API boots with no database and rebuilds record metadata
  from chain logs. A free Atlas M0 cluster makes reads faster (see below).

### 1. Clone and install

```bash
git clone https://github.com/akshutgoyal/aarogyachain.git
cd aarogyachain
npm install
```

### 2. Configure the server

```bash
cp server/.env.example server/.env     # then edit server/.env
```

The two values you must fill in:

```bash
# Generate one with the command below — 64 hex chars that seal each record's content key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```env
GEMINI_API_KEY=paste-your-key-here
MASTER_KEY=paste-the-generated-hex-here
```

Chain values (`SEPOLIA_RPC_URL`, `CONTRACT_ADDRESS`, `CONTRACT_DEPLOY_BLOCK`) and the
AI viewer address are already correct in the example file — leave them as they are
unless you deploy your own contract.

### 3. Start it (two terminals)

```bash
npm run start:server                   # http://localhost:5000  (API)
npm run dev:client                     # http://localhost:5173  (site, second terminal)
```

Open `http://localhost:5173`, press **Access Dashboard**, and connect MetaMask on
Sepolia — or use **View demo** below the connect button to explore every console
with no wallet at all.

**MongoDB is optional.** With no `DATABASE_URL` the API starts anyway and rebuilds
record metadata straight from chain logs. To populate the cache deliberately, run
`npm run index`.

Check the database connection at any time:

```bash
npm run ping     # reports host, database, collections and doc counts —
                 # and names the fix for the three Atlas errors that actually happen
```

### 4. (Optional) Connect MongoDB Atlas

MongoDB is a **cache, never the source of truth** — five collections (`Records`,
`Identities`, `Summaries`, `ChainEvents`, `Profiles`), rebuilt from chain logs at
any time with `npm run index`. Connection has a short timeout and every write is
guarded, so the API runs identically with the database off; reads just rebuild
from chain logs instead. The one deliberate off-chain store is `Profiles`
(patient-chosen display names), which never touches the chain.

1. Create a free **M0** cluster (AWS, region closest to you).
2. **Security → Database Access** → add a user with **Read and write to any database**.
3. **Security → Network Access** → allow your IP. Your home IP changes, so `0.0.0.0/0`
   is a common hackathon trade — acceptable for a throwaway free-tier credential,
   not for real patient data.
4. **Connect → Drivers → Node.js** and copy the string. Then one edit:

```env
DATABASE_URL=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/aarogyachain?retryWrites=true&w=majority
```

> **The database name goes in the path.** Omit `/aarogyachain` and Mongo quietly uses
> a database called `test`, and your data appears to vanish. This is the single most
> common Atlas mistake. Also: if the password contains `@ : / ? # [ ] %`, it has to be
> percent-encoded — using letters and digits only avoids the whole problem.

5. `npm run ping` to confirm, then `npm run index` to populate the cache.

Once connected, `/api/records` reports `"source": "database"` instead of `"source": "chain"`.
That flag is the honest indicator of which store answered.

> **Switching the database on must not change a single authorisation outcome.** If it
> ever does, the cache has quietly become a source of truth — exactly the failure the
> architecture exists to prevent. Re-run the consent checks below after any DB change.

## How file storage works, end to end

Encryption is **browser-side only**. Nothing trusts the server with plaintext:

1. **Encrypt (browser).** `client/src/crypto.js` generates a random AES-256-GCM
   content key, encrypts the file to `iv | ciphertext | tag`, and computes
   `keccak256(ciphertext)` — the digest. Only that 32-byte digest ever goes on-chain.
2. **Upload (server).** `POST /api/records` carries `{ tokenId, patient, recordType,
   contentKey (32-byte hex), ciphertext (base64) }`. The server recomputes
   `keccak256(ciphertext)` and refuses the write on mismatch, then stores two files
   beside each other in `server/uploads/` (override with `UPLOAD_DIR`): `<digest>.enc`
   (ciphertext) + `<digest>.key` (the content key sealed under `MASTER_KEY` as
   `iv(12) | tag(16) | ciphertext`, base64). The blob is never overwritten — same
   digest means same bytes. Uploads are capped at 20 MB per record.
3. **Mint (contract).** The admin's `mintRecord(patient, digest, cid, recordType)` anchors
   only the digest. The plaintext was never on the wire.
4. **Read (gated).** `GET /api/records/:tokenId/file?viewer=X` runs `eth_call
   viewRecord(tokenId) { from: viewer }` **before touching disk** (`server/src/middleware/consentGate.js`
   — the contract answers, the server never guesses). Only on a returned CID does it
   unseal the key and return `{ ciphertext, contentKey }` for local WebCrypto decryption.
   If the chain knows the record but this machine holds no bytes (e.g. minted
   elsewhere), the API answers `409 BlobMissing` — by design, not a bug.
5. **Verify (free).** `POST /api/verify` re-runs `verifyRecord` and compares digests; it
   never returns a file.

> Render's free disk is **ephemeral**: `server/uploads/*.enc|*.key` are wiped on every
> redeploy. Use a persistent disk (`UPLOAD_DIR=/opt/data/uploads`) or accept re-uploads
> after each deploy.

### Environment

`server/.env` — copy from `server/.env.example` and fill in `GEMINI_API_KEY` and
`MASTER_KEY`:

```env
PORT=5000
DATABASE_URL=                           # optional — blank means "rebuild from the chain"
GEMINI_API_KEY=                         # server-side only, never in the client bundle
GEMINI_MODEL=gemini-3.6-flash
GEMINI_MODEL_FALLBACKS=gemini-3.1-pro-preview,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite
MASTER_KEY=                             # 64 hex chars, seals each record's content key

SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
CONTRACT_ADDRESS=0x464e6963cE0D833193C83Fc8Bd081614B9344b03
CONTRACT_DEPLOY_BLOCK=11714309
AI_VIEWER_ADDRESS=0x000000000000000000000000000000000000A1A1
```

`client/.env` — only needed if you point the site at a different API or contract
(the committed defaults already target local API + the deployed Sepolia contract):

```env
VITE_API_URL=http://localhost:5000/api
VITE_CONTRACT_ADDRESS=0x464e6963cE0D833193C83Fc8Bd081614B9344b03
VITE_CHAIN_ID=11155111
VITE_AI_VIEWER_ADDRESS=0x000000000000000000000000000000000000A1A1
```

> Vite bakes `VITE_*` values in at **build** time, so changing them means rebuilding
> (locally: restart `npm run dev:client`).

---

## Demo accounts

The wallets already registered on the deployed contract. **The app reads roles from the
chain**, so whichever of these you switch to in MetaMask is recognised automatically —
none of this is hardcoded into the role logic.

| Role | Label | Address |
|---|---|---|
| Admin | Hospital IT | `0xcd026C498Ed36Ba54A9c42CEC6CbdFE1cFD96608` |
| Doctor (Manager) | Cardiology | `0x06Ef1262F7Ab61a960b075833ebf655277d823C6` |
| Auditor | Compliance | `0xF2538724d814ef3900095f6e0fa0DFac8F9ad31d` |
| Patient | Patient 101 | `0xaC0b57F1bAc3964f13a1b232fB73B553F24Ec51B` |

There is **no login page and no test password** — the wallet is the identity. Connect
MetaMask to Sepolia and the correct console is offered to you. `/verify` works with
no wallet at all, and **View demo** on `/access` opens every console wallet-free
— the demo accounts' addresses are shown on the home page, and roles are still read
live from the contract.

---

## Pages

The site has two halves. The **public half** needs no wallet: a landing page, a
wallet gate, and two public utilities. The **product half** opens only after a wallet
connects, and shows only the console that wallet's role entitles it to.

| Route | Who | What it does |
|---|---|---|
| `/` | anyone | Landing page. The only way in is the **Access Dashboard** button, top right |
| `/access` | anyone | The auth screen. Connects MetaMask, reads the wallet's role from the contract, and routes it to the one console it holds. **View demo** below the connect button opens every console wallet-free (see below) |
| `/verify` | public | Re-hash a file and compare with the chain. **No wallet, no account** |
| `/ai` | public | The two tiers of AI use, and a live allow/deny demonstration |
| `/admin` | Hospital IT | Dashboard: identities by role, records by type, consent health, activity, and the identity table |
| `/admin/console` | Hospital IT | Operations: register identity · grant roles · encrypt, store and mint · revoke · try a blocked transfer |
| `/doctor` | Doctor / lab | Dashboard: patient table with names and access state, readable records, per-patient access chart, lifecycle |
| `/doctor/console` | Doctor / lab | Operations: request a record · read with consent · emergency break-glass · ask Gemini |
| `/auditor` | Compliance | Dashboard: metadata-only audit view, event log, audit coverage. **Never the file location** |
| `/patient` | Record owner | Dashboard: your records, who can read them now, AI consent, activity on your records |
| `/patient/console` | Record owner | Operations: grant a time-boxed window · revoke · open a record · manage AI consent |
| `/patient/profile` | Record owner | Your display name and details. Off-chain, signed, deletable |

### Display names, and where they come from

The contract records that a wallet is `Patient 101` and owns its tokens. It never learns
a name — that is deliberate, and it is why the design can claim no personal data on-chain.

So names live in a separate **patient-owned profile**: off-chain, writable only by the
wallet it belongs to, and proved by a **signature** rather than a session (the server
rejects signatures older than five minutes, so a captured one cannot be replayed).
That has three consequences worth understanding before a judge asks:

- A forged profile is worthless. Rewrite every name in the database and ownership, consent
  and verification are all unchanged.
- The patient can erase it. That is the DPDP erasure story for the one thing we hold —
  crypto-shredding covers the record, this covers the name.
- Wherever a name appears, the UI labels it **off-chain**, so the provenance is never
  glossed over.

### Demo mode (no wallet needed)

Below the connect button on `/access`, **View demo** opens a persona picker with the
four roles. Picking one loads that account's *real* chain state — roles, ownership,
consent windows — through the backend's public RPC, with no signer attached:

- Dashboards, tables, charts, the verifier and Gemini explanations all work, because
  they are reads.
- Anything that writes (minting, granting, revoking, signing a profile) refuses,
  because there is no wallet to sign with. The amber banner inside the shell says so
  on every page.
- Each persona is still gated to its own console — demoing the patient never shows
  the admin sidebar. The picker on `/access` lets you switch persona at any time.

The choice survives reloads within the tab (session storage) but never leaves it:
a fresh tab starts clean, and nothing about demo mode weakens the real gate.

---

## Honest limits

These are stated plainly because a sharp judge will ask, and a shrug is worse than an
answer.

- **Records are soulbound**, so no ownership-transfer events exist. That is deliberate.
- **Emergency break-glass bypasses consent by design** — one hour, one record, and the
  reason is permanently on-chain.
- **In this demo the key wrapping is handled by the backend.** Each record has its own
  AES-256-GCM key, sealed under a server master key; the server never stores a raw key.
  Delegating the release of wrapped keys to a decentralised key-management network
  (Lit Protocol) is the **production path, not something we have built**.
- **The Gemini free tier may use content to improve Google's products.** The demo runs
  on synthetic data; production uses the paid tier, where content is not used for training.
- **A summary is not medical advice**, and a hallucination is possible. The record is
  authoritative; the summary is not.
- **The CID is unexposed, not hidden.** Solidity `private` only removes it from the ABI.
  Encryption is what protects the file, and the contract gates the location.
- **ABDM / ABHA and DILRMP are alignment targets**, not built integrations.
- `local://` appears as the record location. Real deployments use IPFS; the storage
  layer is written so that is a swap rather than a rewrite.

---

## Repository layout

```
contracts/AarogyaChain.sol      the deployed contract, as source (Solidity 0.8.24, ERC-721 + AccessControl, ERC-5192 soulbound)
client/                         React 18 + Vite 6 + Tailwind 3 + ethers v6
  src/App.jsx                   routes: / · /access · /verify · /ai · /admin · /doctor · /auditor · /patient (+ consoles)
  src/chain.jsx                 ALL ethers lives here — pages never touch it
  src/contract.js               contract address, chain id, API URL, AI viewer address (VITE_* env)
  src/crypto.js                 browser-side AES-256-GCM + keccak256
  src/services/api.js           the only place that calls the backend
  src/config/demoAccounts.js    demo personas (convenience only — roles always come from the contract)
  src/pages/                    Home, Access gate, Verify, Ai, Profile + one console per role
  src/pages/dashboards/         read-only dashboard per role
  src/components/shell/         AppShell, RoleGate (contract-read role gate), DemoBanner, PublicChrome
  src/components/viz/           charts, lifecycle diagram, stat/table primitives
  vercel.json                   SPA rewrites so /access · /admin · /verify survive refresh
server/                         Express 4 + Mongoose 8
  src/index.js                  entry — `node src/index.js`, CORS open, 30 MB JSON ceiling for ciphertext
  src/routes/apiRoutes.js       /api/health · /api/chain/* · /api/records* · /api/ai/* · /api/audit/:id · /api/verify · /api/stats · /api/profiles*
  src/middleware/consentGate.js THE GATES — requireConsent + requireAiConsent, both eth_calls, never guesses
  src/controllers/              health, chain, stats, records, AI, profiles
  src/services/chain.js         read-only chain access; no signer exists here
  src/services/gemini.js        structured-output call to Gemini (primary + fallbacks, retryable 429/5xx)
  src/services/storage.js       ciphertext blobs + content-key sealing (AES-256-GCM, UPLOAD_DIR-aware)
  src/scripts/indexer.js        `npm run index` — rebuild the Mongo cache from chain logs
  src/scripts/ping.js           `npm run ping` — connection, host, collections, doc counts
render.yaml                     Render blueprint: aarogyachain-api (Root server, health check /api/health)
package.json                    root scripts: dev:client · dev:server · start:server · build:client · index · ping
```

---

## Contract, briefly

| Group | Functions |
|---|---|
| Identity | `createIdentity` · `deactivateIdentity` · `didFor` |
| Records | `requestRecord` (Manager) · `mintRecord` (Admin) · `revokeRecord` (Admin) |
| Consent | `grantAccess` · `revokeAccess` (owner) · `emergencyAccess` (Manager, 1 hour, logged) |
| Reads | `canAccess` · `viewRecord` · `verifyRecord` · `auditRecord` · `locked` |

**Compiling it yourself? Set the EVM version to Cancun.** Solidity 0.8.24 defaults to
the older `shanghai` target, while current OpenZeppelin releases use the `mcopy`
instruction, which exists only from Cancun onwards. Without that setting you get a
`DeclarationError` naming `mcopy` inside `Bytes.sol`. The contract is fine; the
compiler setting is what is wrong.

---

## Verifying the claims yourself

```bash
# Is the database reachable, and which store is answering?
npm run ping
curl localhost:5000/api/records     # "source": "database" | "chain"

# The chain is genuinely reachable from the backend
curl localhost:5000/api/chain/status

# Every identity and role, rebuilt from logs
curl localhost:5000/api/chain/identities

# A viewer with no consent is refused BY THE CONTRACT
curl "localhost:5000/api/records/1/file?viewer=0xF2538724d814ef3900095f6e0fa0DFac8F9ad31d"
# -> 403 {"error":"AccessDenied", ...}

# Verification is free and needs no permission
curl -X POST localhost:5000/api/verify -H 'Content-Type: application/json' \
  -d '{"tokenId":1,"fileHash":"0x72e377aea98522cd2c9f9f4a5941d1bdb2defa5033cc1e2cf1edd7e8b37a5094"}'
# -> {"authentic": true, "verifiedBy": "contract.verifyRecord"}
```

The AI key is server-side only. Confirm it is not in the browser bundle:

```bash
grep -r "AIza" client/dist   # no output
```

---

## Deploying (Vercel + Render)

Two services, deployed separately: the **API** on Render, the **site** on Vercel.

### 1. API on Render (free, no card)

Use **New → Web Service** — *not* Blueprint (`render.yaml` exists in the repo but
Blueprint mode asks for a credit card).

| Setting | Value |
|---|---|
| Root Directory | `server` |
| Build Command | `npm install` |
| Start Command | `node src/index.js` |
| Instance Type | **Free** |
| Health Check Path | `/api/health` |

Then set the environment variables (copy non-secret values from
`server/.env.example`):

- `DATABASE_URL`, `MASTER_KEY`, `GEMINI_API_KEY` — paste your secrets
- `GEMINI_MODEL=gemini-3.6-flash`,
  `GEMINI_MODEL_FALLBACKS=gemini-3.1-pro-preview,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite`
- `SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com`,
  `CONTRACT_ADDRESS=0x464e6963cE0D833193C83Fc8Bd081614B9344b03`,
  `CONTRACT_DEPLOY_BLOCK=11714309`,
  `AI_VIEWER_ADDRESS=0x000000000000000000000000000000000000A1A1`

Two free-tier caveats: the service **sleeps after 15 min idle** (warm it by hitting
`/api/health` before demoing), and its disk is **ephemeral** (uploads vanish on
redeploy — see the storage section). If Atlas is used, add `0.0.0.0/0` to
**Network Access** so Render can reach it.

### 2. Site on Vercel

| Setting | Value |
|---|---|
| Root Directory | `client` |
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Environment variables:

```env
VITE_API_URL=https://<your-render-service>.onrender.com/api
VITE_CONTRACT_ADDRESS=0x464e6963cE0D833193C83Fc8Bd081614B9344b03
VITE_CHAIN_ID=11155111
VITE_AI_VIEWER_ADDRESS=0x000000000000000000000000000000000000A1A1
```

> Vite bakes `VITE_*` in at build time, so **updating an env var requires a
> redeploy**: Dashboard → Settings → Environment Variables → edit → Save →
> Deployments → ⋯ → Redeploy. (CLI: `vercel env add VITE_API_URL production`
> then `vercel --prod`.) `client/vercel.json` already handles SPA rewrites, so
> `/access`, `/admin` and `/verify` survive refresh.
