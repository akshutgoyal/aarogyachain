// Gemini, as an explanation layer.
//
// What this module is allowed to do:  turn data the caller is ALREADY AUTHORISED
//                                     to see into plain language.
// What it can never do:               mint, grant, revoke, or read anything the
//                                     contract has not already released. It holds
//                                     no key and writes no on-chain state.
//
// Transport note: Gemini's current API is the Interactions endpoint
// (POST /v1beta/interactions with response_format). The older `:generateContent`
// shape is not what this API serves any more.
//
// Response shape note: the REST API does NOT return `output_text`. It returns a
// `steps` array containing a `thought` step and a `model_output` step, and the
// text lives in model_output.content[].text. Parsing only `output_text` yields an
// empty string and every call appears to fail.

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

export const DEFAULT_MODEL = 'gemini-3.6-flash';

// Models are tried in order. A sponsored hackathon runs its demos at peak load,
// and a 503 from one model must not take the whole feature down.
//
// Primary is gemini-3.6-flash (verified reliable on this key). As requested, the
// first fallback is gemini-3.1-pro-preview — note it has failed before on a
// free-tier key with 429 "0 input tokens per minute", so Flash fallbacks follow
// it rather than the chain ending there. A busy Pro must not take the demo down.
const FALLBACKS = [
  'gemini-3.1-pro-preview',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

const DISCLAIMER =
  'This is a plain-language explanation of a health record, not medical advice. ' +
  'The record itself is authoritative and should be read by a clinician.';

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

function modelChain() {
  const primary = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const configured = (process.env.GEMINI_MODEL_FALLBACKS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return [...new Set([primary, ...configured, ...FALLBACKS])];
}

// ------------------------------------------------------------- schemas

/** Schema for explaining a record's CONTENTS. */
export const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    plain_summary: {
      type: 'string',
      description: 'Three to five sentences explaining the record to someone with no medical training.',
    },
    record_type_in_words: {
      type: 'string',
      description: 'The kind of record in everyday language, e.g. "a chest X-ray scan".',
    },
    key_findings: {
      type: 'array',
      description: 'The main points, one short sentence each, in plain language.',
      items: { type: 'string' },
    },
    values_to_note: {
      type: 'array',
      description: 'Measurements or observations worth paying attention to. Empty if none.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'What the measurement is called.' },
          value: { type: 'string', description: 'The value as written in the record, with units.' },
          why_it_matters: { type: 'string', description: 'One sentence, in plain language.' },
        },
        required: ['name', 'value', 'why_it_matters'],
      },
    },
    questions_for_your_doctor: {
      type: 'array',
      description: 'Questions the patient could usefully ask a clinician about this record.',
      items: { type: 'string' },
    },
    confidence_note: {
      type: 'string',
      description: 'What was unclear, illegible or missing in the record. Empty string if nothing.',
    },
    disclaimer: { type: 'string' },
  },
  required: [
    'plain_summary',
    'record_type_in_words',
    'key_findings',
    'questions_for_your_doctor',
    'disclaimer',
  ],
};

/**
 * Schema for explaining an ACCESS HISTORY.
 *
 * This variant is fed only public chain metadata — addresses, event names and
 * timestamps — and never a single byte of a medical record. It is therefore safe
 * to run for anyone entitled to read the record, with no extra consent, because
 * nothing confidential crosses the boundary.
 */
export const ACCESS_HISTORY_SCHEMA = {
  type: 'object',
  properties: {
    plain_summary: {
      type: 'string',
      description: 'Two to four sentences describing who accessed this record and when, in plain language.',
    },
    timeline: {
      type: 'array',
      description: 'One entry per event, in order.',
      items: {
        type: 'object',
        properties: {
          when: { type: 'string', description: 'Human-readable date and time.' },
          who: { type: 'string', description: 'The party involved, described by role if the label is known.' },
          what: { type: 'string', description: 'What happened, in plain language.' },
        },
        required: ['when', 'who', 'what'],
      },
    },
    notable: {
      type: 'array',
      description: 'Anything a patient should particularly notice, such as break-glass access or repeated grants. Empty if none.',
      items: { type: 'string' },
    },
    currently_has_access: {
      type: 'array',
      description: 'Who can read this record right now, as names or short addresses. Empty if nobody.',
      items: { type: 'string' },
    },
    disclaimer: { type: 'string' },
  },
  required: ['plain_summary', 'timeline', 'notable', 'disclaimer'],
};

const MAX_RECORD_CHARS = 60_000;

// ------------------------------------------------------------- transport

function extractText(payload) {
  // 1. The documented convenience field, in case a gateway provides it.
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }

  // 2. The real REST shape: steps[] with a model_output step.
  if (Array.isArray(payload?.steps)) {
    const parts = [];
    for (const step of payload.steps) {
      if (step?.type !== 'model_output' || !Array.isArray(step.content)) continue;
      for (const part of step.content) {
        if (part?.type === 'text' && typeof part.text === 'string') parts.push(part.text);
      }
    }
    if (parts.length) return parts.join('');
  }

  // 3. Older/alternate shapes, kept so a response-format change degrades instead
  //    of throwing. Dead fallbacks cost nothing; a broken demo costs everything.
  const outputs = payload?.outputs || payload?.output;
  if (Array.isArray(outputs)) {
    for (const output of outputs) {
      if (typeof output?.text === 'string' && output.text.trim()) return output.text;
      const parts = output?.content?.parts || output?.parts;
      if (Array.isArray(parts)) {
        const joined = parts.map((p) => p?.text || '').join('').trim();
        if (joined) return joined;
      }
    }
  }
  const candidateText = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof candidateText === 'string' && candidateText.trim()) return candidateText;

  return null;
}

/**
 * One call, with model fallback.
 *
 * Returns the parsed JSON, the model that actually answered, and token usage so
 * the UI can show what the explanation cost.
 */
async function callGemini({ input, schema }) {
  if (!isConfigured()) {
    const err = new Error(
      'GEMINI_API_KEY is not set. Add it to server/.env — see server/.env.example.'
    );
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  const chain = modelChain();
  const attempts = [];

  for (const model of chain) {
    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'x-goog-api-key': process.env.GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input,
          response_format: { type: 'text', mime_type: 'application/json', schema },
        }),
      });
    } catch (networkError) {
      attempts.push(`${model}: ${networkError.message}`);
      continue;
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
      attempts.push(`${model}: ${detail}`);
      // Only a busy/rate-limited model is worth retrying elsewhere. A 400 means
      // the request is wrong, and every other model will reject it identically.
      if (RETRYABLE.has(response.status)) continue;
      const err = new Error(`Gemini request failed: ${detail}`);
      err.code = 'AI_UPSTREAM';
      err.status = response.status;
      throw err;
    }

    const raw = extractText(payload);
    if (!raw) {
      attempts.push(`${model}: response contained no text`);
      continue;
    }

    try {
      return {
        data: JSON.parse(raw),
        model,
        usage: {
          totalTokens: payload?.usage?.total_tokens ?? null,
          reasoningTokens: payload?.usage?.total_thought_tokens ?? null,
        },
      };
    } catch {
      attempts.push(`${model}: returned text that was not valid JSON`);
      continue;
    }
  }

  const err = new Error(
    `Every Gemini model refused the request. Tried ${chain.join(', ')}. ` +
      `Last errors — ${attempts.slice(-3).join(' | ')}`
  );
  err.code = 'AI_UPSTREAM';
  err.status = 503;
  throw err;
}

export function isConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

// ------------------------------------------------------------- prompts

function recordPrompt({ recordType, text, language }) {
  // Role framing goes in the prompt itself rather than a system-instruction
  // field: this endpoint is new, and the prompt-string form is the one the
  // published examples use, so it cannot drift out from under us.
  return `You are explaining a medical record to the patient it belongs to.

HARD RULES
1. Describe what the record says. Never diagnose, never name a condition the record does not name itself.
2. Never recommend treatment, medication, dosage or a care plan.
3. Never state or guess a prognosis.
4. If a value or section is illegible, missing or ambiguous, say so in confidence_note rather than filling the gap.
5. Do not invent reference ranges. If a range is not written in the record, do not add one.
6. Keep language plain. Assume no medical training.
7. Write in ${language || 'English'}.
8. Always set disclaimer to exactly: "${DISCLAIMER}"

RECORD TYPE: ${recordType || 'unspecified'}

RECORD CONTENT
---
${text}
---

Return the structured JSON described by the schema.`;
}

function accessHistoryPrompt({ tokenId, recordType, owner, rows, currentAccess = [] }) {
  // NOTE: this prompt is built from public chain metadata only. No field here
  // can contain the content of a medical record, by construction.
  const table = rows
    .map((r) => `  ${r.when} | ${r.event} | actor=${r.who} | ${r.detail}`)
    .join('\n');

  const current =
    currentAccess.length > 0
      ? currentAccess
          .map((entry) => `  ${entry.who} (${entry.address}) — ${entry.status}${entry.expiresAt ? `, window ${entry.status === 'ACTIVE' ? 'ends' : 'ended'} ${entry.expiresAt}` : ''}`)
          .join('\n')
      : '  (nobody)';

  return `You are explaining a medical record's ACCESS HISTORY to the patient who owns it.

You are given ONLY on-chain metadata: who did what, and when. You have not been given the record's
contents and must not speculate about them. Never describe or guess any diagnosis, result or finding.

The two sections below have DIFFERENT authority, and getting this wrong is the main way to be wrong:
- ACCESS EVENTS is history. It shows what happened, not what is true now.
- CURRENT ACCESS is authoritative and was read from the contract at this moment. A consent window
  closes silently — there is no "expired" event to read, so a grant in the history may well have
  lapsed. Never state that somebody has access unless CURRENT ACCESS marks them ACTIVE.

RULES
1. Describe access events only. Do not infer or invent clinical information of any kind.
2. Treat CURRENT ACCESS as the truth for the present moment; treat the event list as the past.
3. If a grant has since lapsed, say that it was time-limited and has now ended. Do not describe it
   as ongoing, and do not describe it as suspicious.
4. Use plain, non-technical language. Assume no medical or blockchain training.
5. Where a role label is available (for example "Cardiology"), use the label; otherwise use a shortened address.
6. In "notable", flag only what a patient would reasonably want to know, especially break-glass access.
   An expired window is not notable. Do not describe ordinary consent as a security incident.
7. Set "currently_has_access" from CURRENT ACCESS only — the names marked ACTIVE, and nobody else.
8. Always set disclaimer to exactly: "${DISCLAIMER}"

RECORD: token #${tokenId}, type ${recordType || 'unspecified'}, owned by ${owner || 'unknown'}

ACCESS EVENTS (chronological — history only)
${table || '  (no access events recorded)'}

CURRENT ACCESS (authoritative, read from the contract just now)
${current}

Return the structured JSON described by the schema.`;
}

// ------------------------------------------------------------- public API

/** Explain one decrypted record. The caller MUST have passed the consent gate. */
export async function explainRecord({ recordType, text, language }) {
  const truncated = text.length > MAX_RECORD_CHARS;
  const { data, model, usage } = await callGemini({
    input: recordPrompt({
      recordType,
      language,
      text: truncated ? text.slice(0, MAX_RECORD_CHARS) : text,
    }),
    schema: SUMMARY_SCHEMA,
  });

  if (!data.disclaimer) data.disclaimer = DISCLAIMER;
  return { summary: data, model, usage, truncated };
}

/**
 * Explain a record's access history from chain metadata alone.
 * No confidential content is sent, so this needs no content consent.
 */
export async function explainAccessHistory({ tokenId, recordType, owner, rows, currentAccess }) {
  const { data, model, usage } = await callGemini({
    input: accessHistoryPrompt({ tokenId, recordType, owner, rows, currentAccess }),
    schema: ACCESS_HISTORY_SCHEMA,
  });

  if (!data.disclaimer) data.disclaimer = DISCLAIMER;
  return { summary: data, model, usage };
}

export { DISCLAIMER };
