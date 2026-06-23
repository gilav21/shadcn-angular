# AI backend example

A ~70-line Express server that powers the `aiProvider` hook on both the
**rich text editor** and the **data table**. One endpoint, `POST /api/ai`,
handles every task — the request's `task` field tells it what to do.

> **Why a backend at all?** The `aiProvider` callback could technically call an
> AI API straight from the browser — but that ships your API key to every user.
> Always proxy through a server you control. This is that server.

## Run it

Requires Node 18+.

```bash
cd examples/ai-backend
npm install

# give it your key (either works):
export ANTHROPIC_API_KEY=sk-ant-...
npm start
#   …or, with a .env file (Node 20.6+):
#   cp .env.example .env   # then edit it
#   npm run start:env
```

You should see `✨ AI backend listening on http://localhost:8787`.

Quick smoke test:

```bash
curl -s localhost:8787/api/ai \
  -H 'content-type: application/json' \
  -d '{"task":"rewrite","input":"this sentence are bad written"}'
```

## Wire it to your Angular app

The server enables CORS, so a browser on `http://localhost:4200` can call it
directly. In your component:

```ts
import { AiRequest } from '@gilav21/shadcn-angular';
import { Observable } from 'rxjs';

const ENDPOINT = 'http://localhost:8787/api/ai';

// Streaming provider — drives the editor's live typewriter effect.
// (A plain Promise works too; see the table note below.)
readonly aiProvider = (req: AiRequest): Observable<string> =>
  new Observable<string>((sub) => {
    const ctrl = new AbortController();
    req.signal?.addEventListener('abort', () => ctrl.abort());
    let text = '';
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          sub.next(text); // emit the FULL text so far
        }
        sub.complete();
      })
      .catch((err) => sub.error(err));
    return () => ctrl.abort();
  });
```

```html
<ui-rich-text-editor [aiProvider]="aiProvider" />
<ui-data-table [aiProvider]="aiProvider" [data]="rows" [columns]="cols" />
```

The moment `aiProvider` is set, the AI affordances appear:

- **Editor** — the "✨ Ask AI" chip on selection and the `/ai` slash command.
- **Table** — the "✨ Ask in plain English" toolbar box, plus
  `tableRef.aiFillColumn(columnKey, prompt)` for AI column fill.

**Table-only?** A one-shot Promise is enough (no streaming needed):

```ts
readonly aiProvider = (req: AiRequest): Promise<string> =>
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
    signal: req.signal,
  }).then((r) => r.text());
```

### Alternative: dev-server proxy (no CORS, same-origin)

Instead of CORS, proxy `/api` to this server so the browser calls a relative
URL. Create `proxy.conf.json`:

```json
{ "/api": { "target": "http://localhost:8787", "secure": false } }
```

and run `ng serve --proxy-config proxy.conf.json`. Then use `ENDPOINT = '/api/ai'`.

## What the server does

| `task` | Returns | Backed by |
| --- | --- | --- |
| `rewrite` · `shorten` · `expand` · `fix-grammar` · `translate` · `summarize` · `continue` · `custom` | rewritten / generated prose | a per-task system prompt |
| `nl-filter` | JSON `{ globalFilter?, columnFilters? }` from a plain-English query | `context.columns` |
| `table-fill` | one cell value from the row JSON + prompt | `context.column` |

The model is `claude-opus-4-8` via the official `@anthropic-ai/sdk`, streamed
with `client.messages.stream()`. Swap the model or provider freely — the hook
doesn't care what's behind the endpoint.

## Notes

- **Cancellation** — when the user hits Discard / Try again, the browser aborts
  the request; the server forwards that to the model run (`stream.abort()`).
- **Safety** — the table only applies `nl-filter` results for **known columns**,
  so a stray column name from the model can't break filtering.
- **Harder tasks** — uncomment `thinking: { type: 'adaptive' }` in `server.mjs`
  for better reasoning on the trickier tasks (e.g. `nl-filter`), at the cost of
  a short pause before output starts.
- This is a **starting point**, not production: add auth, rate limiting, request
  size limits, and per-user quotas before exposing it.
