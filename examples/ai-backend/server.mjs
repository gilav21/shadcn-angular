// Minimal AI backend for the shadcn-angular `aiProvider` hook.
//
// One endpoint (POST /api/ai) serves BOTH the rich-text editor and the data
// table. The browser never sees your API key — it lives here, on the server.
//
//   1. cp .env.example .env   (or: export ANTHROPIC_API_KEY=sk-ant-...)
//   2. npm install
//   3. npm start              -> http://localhost:8787
//
// Then point the frontend `aiProvider` at http://localhost:8787/api/ai
// (see README.md for the exact provider snippet).

import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

// Reads ANTHROPIC_API_KEY from the environment.
const client = new Anthropic();

const app = express();
app.disable('x-powered-by'); // don't advertise the framework/version
// Allow only the Angular dev server origin (this is a local example backend).
app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

// ── Per-task system prompts ───────────────────────────────────────────────
// The `task` field on the request tells us what the user asked for.

const EDITOR_SYSTEM = {
  rewrite:
    'Rewrite the text to read more clearly while preserving its meaning and voice. Return ONLY the rewritten text — no preamble, no quotes.',
  shorten: 'Make the text shorter and tighter without losing key information. Return ONLY the result.',
  expand: 'Expand the text with relevant, useful supporting detail. Return ONLY the result.',
  'fix-grammar': 'Fix spelling, grammar, and punctuation. Keep the meaning and tone. Return ONLY the corrected text.',
  translate: 'Translate the text. The target language is given in the instruction. Return ONLY the translation.',
  summarize: 'Summarize the text in one or two sentences. Return ONLY the summary.',
  continue: 'Continue the text naturally from where it ends. Return ONLY the continuation (do not repeat the input).',
  custom: 'Apply the user instruction to the given text. Return ONLY the result.',
};

function systemFor(task, context) {
  if (task === 'nl-filter') {
    const columns = JSON.stringify(context?.columns ?? []);
    return (
      'You convert a natural-language request into a data-table filter. ' +
      `The available columns (key + header) are: ${columns}. ` +
      'Reply with ONLY minified JSON of the shape ' +
      '{"globalFilter"?: string, "columnFilters"?: {"<columnKey>": <value>}}. ' +
      'Use columnFilters for column-specific conditions and globalFilter for a free-text search across columns. ' +
      'Only use the column keys listed above. No prose, no markdown, no code fences.'
    );
  }
  if (task === 'table-fill') {
    const column = context?.column ?? 'cell';
    return (
      `You generate the value for the "${column}" column of a table row. ` +
      'The user message is the row (as JSON) plus an instruction. ' +
      'Return ONLY the cell value as plain text — nothing else.'
    );
  }
  return EDITOR_SYSTEM[task] ?? 'You are a helpful writing assistant. Return ONLY the result.';
}

// ── The endpoint ──────────────────────────────────────────────────────────
// Streams the model's output token-by-token. The editor reads the stream for
// its live typewriter effect; the table reads the whole body (it just wants
// the final string / JSON), so the same streaming endpoint serves both.

app.post('/api/ai', async (req, res) => {
  const { task, input, prompt, context } = req.body ?? {};
  if (typeof input !== 'string') {
    res.status(400).json({ error: 'A string `input` is required.' });
    return;
  }

  const userText = prompt ? `${prompt}\n\n${input}` : input;
  res.setHeader('content-type', 'text/plain; charset=utf-8');

  const stream = client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    // For harder tasks you can turn on adaptive thinking (adds a short pause
    // before the answer streams, in exchange for better reasoning):
    //   thinking: { type: 'adaptive' },
    system: systemFor(task, context),
    messages: [{ role: 'user', content: userText }],
  });

  // If the browser cancels (Discard / Try again sends an AbortSignal that
  // closes this request), stop the model run too.
  req.on('close', () => stream.abort());

  try {
    stream.on('text', (delta) => res.write(delta));
    await stream.finalMessage();
    res.end();
  } catch (err) {
    console.error('[ai] request failed:', err);
    if (res.headersSent) res.end();
    else res.status(500).json({ error: 'AI request failed.' });
  }
});

const port = process.env.PORT ?? 8787;
app.listen(port, () => console.log(`✨ AI backend listening on http://localhost:${port}`));
