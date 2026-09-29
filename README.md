# AarogyaChain

> Patient-owned medical records, verifiable by anyone, instantly.

**Team Nirvans** · Akshut Goyal · Reedhan Garg · Harsh Kumar
**Problem statement:** Blockchain-Based Secure Platform for Identity, Access Control & Digital Asset Management

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
| **AI** | Gemini 3.8 Flash, behind the contract's own consent gate |
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

```bash
npm install
cp server/.env.example server/.env     # then fill in GEMINI_API_KEY and MASTER_KEY
npm run dev:server                     # http://localhost:5000
npm run dev:client                     # http://localhost:5173   (second terminal)
```

Generate a master key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**MongoDB is optional.** With no `DATABASE_URL`, or with Mongo switched off, the API
starts anyway and rebuilds record metadata straight from chain logs. To populate the
cache deliberately, run `npm run index`.

Check the database connection at any time:

```bash
npm run ping     # reports host, database, collections and doc counts —
                 # and names the fix for the three Atlas errors that actually happen
```

### Connecting MongoDB Atlas

1. Create a free **M0** cluster (AWS, region closest to you).
2. **Security → Database Access** → add a user with **Read and write to any database**.
3. **Security → Network Access** → allow your IP. Your home IP changes, so `0.0.0.0/0`
   is a common hackathon trade — acceptable for a throwaway free-tier credential,
   not for real patient data.
4. **Connect → Drivers → Node.js** and copy the string. Then two edits:

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

### Environment

`server/.env`

```env
PORT=5000
DATABASE_URL=mongodb://localhost:27017/aarogyachain   # optional

SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
CONTRACT_ADDRESS=0x464e6963cE0D833193C83Fc8Bd081614B9344b03
CONTRACT_DEPLOY_BLOCK=11714309

GEMINI_API_KEY=          # server-side only
GEMINI_MODEL=gemini-3.8-flash
MASTER_KEY=              # 64 hex chars, seals each record's content key
```

`client/.env`

```env
VITE_API_URL=http://localhost:5000/api
VITE_CONTRACT_ADDRESS=0x464e6963cE0D833193C83Fc8Bd081614B9344b03
VITE_CHAIN_ID=11155111
```

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
MetaMask to Sepolia and the correct console is offered to you. The `/verify` and
`/auditor` pages work with no wallet at all.

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

The contract records that a wallet is `Patient 101` and owns token 3. It never learns a
name — that is deliberate, and it is why the design can claim no personal data on-chain.

So names live in a separate **patient-owned profile**: off-chain, writable only by the
wallet it belongs to, and proved by a **signature** rather than a session. That has three
consequences worth understanding before a judge asks:

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
contracts/AarogyaChain.sol      the deployed contract, as source
client/                         React 18 + Vite + Tailwind + ethers v6
  src/chain.jsx                 ALL ethers lives here — pages never touch it
  src/crypto.js                 browser-side AES-256-GCM + keccak256
  src/services/api.js           the only place that calls the backend
  src/pages/                    one console per role, plus verify and AI
server/                         Express 4 + Mongoose 8
  src/middleware/consentGate.js THE GATE — asks the contract, never guesses
  src/services/chain.js         read-only chain access; no signer exists here
  src/services/gemini.js        structured-output call to Gemini
  src/services/storage.js       ciphertext blobs + content-key sealing
  src/scripts/indexer.js        rebuild the Mongo cache from chain logs
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
