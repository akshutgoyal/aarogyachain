import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/apiRoutes.js';
import { connectDB } from './config/db.js';
import { isConfigured, DEFAULT_MODEL } from './services/gemini.js';
import { warmStats } from './controllers/statsController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
// Record payloads are base64 ciphertext, so the default 100kb limit is far too
// small. The route itself enforces a 20 MB ceiling per record.
app.use(express.json({ limit: '30mb' }));

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({
    name: 'AarogyaChain API',
    tagline:
      'Patient-owned medical records on-chain. The server serves ciphertext and asks the contract for permission.',
    version: '1.0.0',
    docs: {
      health: '/api/health',
      chainStatus: '/api/chain/status',
      identities: '/api/chain/identities',
      permissions: '/api/chain/permissions/:address',
      events: '/api/chain/events',
      records: '/api/records',
      releaseFile: '/api/records/:tokenId/file?viewer=0x…  (consent-gated)',
      aiSummary: 'POST /api/ai/summary { tokenId, viewer }  (consent-gated)',
      audit: '/api/audit/:tokenId',
      verify: 'POST /api/verify { tokenId, fileHash }',
    },
    custody: {
      signingKeys: 'The server holds none. Every write is signed in the browser.',
      recordBytes: 'Stored as ciphertext the server cannot read without a sealed key.',
      geminiKey: 'Server-side only. Never sent to the browser.',
    },
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'NotFound', message: `No route for ${req.method} ${req.path}` });
});

app.use((error, req, res, next) => {
  console.error('[Server] Unhandled error:', error);
  res.status(500).json({ error: 'InternalError', message: error.message });
});

async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log('');
    console.log('  AarogyaChain API');
    console.log(`  → http://localhost:${PORT}`);
    console.log(`  → health      http://localhost:${PORT}/api/health`);
    console.log(`  → chain       http://localhost:${PORT}/api/chain/status`);
    console.log('');
    console.log(`  contract      ${process.env.CONTRACT_ADDRESS || '(CONTRACT_ADDRESS not set)'}`);
    console.log(`  rpc           ${process.env.SEPOLIA_RPC_URL || '(SEPOLIA_RPC_URL not set)'}`);
    console.log(
      `  gemini        ${isConfigured() ? `ready · ${process.env.GEMINI_MODEL || DEFAULT_MODEL}` : 'not configured — set GEMINI_API_KEY'}`
    );
    console.log(
      `  master key    ${process.env.MASTER_KEY ? 'set' : 'MISSING — record uploads will fail'}`
    );
    console.log('');
  });

  // Warm the dashboard aggregates in the background. Assembling them costs several
  // RPC round-trips (about six seconds cold), and the first thing anyone opening
  // the app sees is a dashboard — a blank one is a bad way to start a demo.
  //
  // Deliberately not awaited: startup must not depend on the RPC being reachable,
  // and the API is fully usable without this succeeding.
  warmStats().then((result) => {
    if (result.ok) {
      console.log(
        `[Stats] Dashboard cache warmed — ${result.totals.records} record(s), ${result.totals.identities} identities.`
      );
    } else {
      console.warn(`[Stats] Could not warm the dashboard cache: ${result.message}`);
      console.warn('        Dashboards will still load, just slowly on first open.');
    }
  });
}

startServer();
