# CLI — Bounded Network Requests & Correct Package-Manager Detection

> **Status:** Spec — ready for an executing agent
> **Date:** 2026-10-03
> **Source:** code review of `packages/cli/src` (branch `docs/codebase-review-fix-specs`);
> split out of `specs/cli-install-integrity-spec.md` to keep that bundle under
> ten tasks.
> **Living history:** never delete a completed row, a fixed bug or a superseded
> decision — mark it and append below.

> # ✅ NO PREREQUISITES
>
> This spec is self-contained and can start immediately. It depends on no other
> spec in this set.
>
> **Merge-order note (not a prerequisite):** `specs/cli-registry-path-safety-spec.md`
> also edits `registry/load.ts` (the manifest **validator** — this spec touches
> only `fetchManifest`) and `utils/package-manager.ts` (`installPackages`' `--`
> separator — this spec touches only `getPackageManager`). Both specs add
> tests to `utils/package-manager.spec.ts` (the path-safety spec creates it;
> extend it here if it exists). Merge the path-safety spec first and rebase. No overlap with
> `specs/cli-install-integrity-spec.md`.

---

## The invariants

Two independent rules share this bundle because both are small and both sit at
the CLI's boundary with the outside world.

> **N (network):** Every network request the CLI makes either completes or
> fails within a bounded time, with an error that names the URL and says
> whether the host was unreachable, too slow, or answered with an HTTP error —
> after at most one retry on a transient failure — and every existing offline
> fallback still applies.

> **P (package manager):** The CLI installs npm packages with the package
> manager that owns the project — declared `packageManager`, else the nearest
> lockfile up to the repository root — and only when the project declares none
> does it follow the invoking tool, then npm.

---

## 0. Step-0 verification — what the source actually says

Re-read on 2026-10-03. ✓ confirmed · ⚠️ wrong or incomplete · ➕ same class,
not in the review.

| # | Finding | Verdict | Evidence |
| --- | --- | --- | --- |
| V1 | `getPackageManager` returns from `npm_config_user_agent` before it looks at any lockfile (`utils/package-manager.ts:7-23`). | ✓ | as cited |
| V2 | `npx` sets the user agent to npm: `npm exec --yes -- node -e "…"` printed `npm/11.5.1 node/v25.5.0 win32 x64 workspaces/false`. So `npx @gilav21/shadcn-angular add …` in a pnpm or yarn project runs `npm install` and writes a stray `package-lock.json`. | ✓ | probe 2026-10-03 |
| V3 | `bun.lock` is not detected (only `bun.lockb`, `:20`). Bun 1.2.23 writes **`bun.lock`** (verified: a temp project with a `file:` dependency produced `bun.lock`, no `bun.lockb`). | ✓ | probe 2026-10-03 |
| V4 | ➕ Lockfiles are looked up in `cwd` only (`:18-20`). In a workspace (Angular app in `apps/web`, lockfile at the repo root) nothing is found, so the user agent or `npm` wins. ➕ `package-lock.json` is never treated as a signal, so it cannot stop a pnpm user agent from choosing pnpm in an npm project. ➕ The corepack `packageManager` field in `package.json` is ignored. | ➕ | as cited |
| V5 | `installPackages` callers: `core/install.ts:214` (`add`/`update`/`apply`/MCP), `commands/doctor.ts:225` (`doctor --fix`), `core/init-core.ts:34` (`init`). All benefit from one fix. | ✓ | grep |
| V6 | No request has a timeout or `AbortSignal`: `core/fetch.ts:42` (component/block files), `:70` (lib files), `registry/load.ts:84` (startup manifest), `core/ref.ts:54` (GitHub commits API), ➕ `core/sizes.ts:101` (`file-sizes.json`, used by `why`). grep for `AbortSignal` / `timeout` in `src/` (non-spec) → 0 hits. | ✓ + ➕ | grep |
| V7 | ⚠️ "~300 s" is Node's bundled undici default `headersTimeout` / `bodyTimeout` (300 000 ms) for a host that **accepts** the connection and then stalls — documented default, not re-measured here. A host that never accepts the TCP connection hits undici's ~10 s connect timeout instead. Either way the startup manifest load (`program.ts:270-273`) runs before **every** command, so one stalled host blocks the whole CLI. | ⚠️ nuance | undici defaults |
| V8 | Offline fallbacks that must survive: `loadRegistry` warns and applies the bundled snapshot on any failure (`load.ts:136-161`); `resolveRemoteSha` returns `null` (`ref.ts:45-61`); `readFileSizes` returns `null` (`sizes.ts:91-109`); local-monorepo mode reads files from disk with no request (`fetch.ts:28-34`, `:62-68`, `load.ts:79-82`). | ✓ | as cited |
| V9 | ⚠️ The review said `fetchLibContent` "lacks the transport-error wrapping `fetchComponentContent` has". True, **but** `fetchComponentContent` only wraps when a local monorepo dir exists (`fetch.ts:44-50`, `if (localDir)`) — i.e. never for a consumer. Consumers get the raw `TypeError: fetch failed` from **both** functions. The existing test `fetch.spec.ts:40-56` mocks `getLocalComponentsDir` to a fake dir (`:4-7`), so it only samples the monorepo class — a degenerate input per "Writing Tests" case 2. | ⚠️ corrected | as cited |
| V10 | Node ≥ 17.3 provides `AbortSignal.timeout`; the CLI already relies on global `fetch` (Node ≥ 18). No engines field in `packages/cli/package.json`; `@types/node` `^20.14.0`. | ✓ | `packages/cli/package.json:43` |

### Refuted / corrected findings (summary)

- ⚠️ V7 — 300 s applies to a stalled-but-connected host; an unreachable host fails in ~10 s. Both are unbounded from the CLI's point of view (no own budget, no URL in the message).
- ⚠️ V9 — the transport wrapping in `fetchComponentContent` is monorepo-only; the fix is "every fetch error names its URL in every mode", not "copy the wrapping into `fetchLibContent`".
- ➕ V4 — workspace roots, `package-lock.json`, and `packageManager` are part of the same class as the reported `npx` case.

---

## B. Product Manager section

### B.1 Business logic

When the registry host, GitHub's API or a mirror is slow or unreachable, every
CLI command now gives up on each request after a fixed budget (15 s by default,
adjustable with `SHADCN_ANGULAR_FETCH_TIMEOUT_MS`), retries once if the failure
looks transient, and reports the URL that failed. The existing offline
behaviour — falling back to the bundled registry, skipping size information,
recording no merge ref — is unchanged, it just happens in seconds instead of
minutes. When a component needs npm packages, the CLI installs them with the
project's own package manager, found from `package.json#packageManager` or the
nearest lockfile, even when the CLI itself was launched with `npx`.

### B.2 Why the customer wants this

- **"`npx shadcn-angular add` hung for five minutes."** A captive portal or a
  stalled proxy holds the startup manifest request open; nothing prints. The
  workaround today is Ctrl-C and guessing.
- **"It said `fetch failed` — fetch *what*?"** Outside the monorepo, the raw
  undici error carries no URL.
- **"`add` created a `package-lock.json` in my pnpm repo."** Every `npx`
  invocation does this. The workaround is deleting the file and re-running
  `pnpm install`, or never using `npx`.
- **"In our monorepo it used npm."** The lockfile lives at the workspace root.

### B.3 Use cases = definition of done

- **UC-1** In a project with `pnpm-lock.yaml`, `npx @gilav21/shadcn-angular
  add <component with npm deps>` runs `pnpm add …` and no `package-lock.json`
  appears. Likewise `yarn.lock` → yarn, `bun.lock` or `bun.lockb` → bun,
  `package-lock.json` / `npm-shrinkwrap.json` → npm.
- **UC-2** When the lockfile is in an ancestor directory (workspace root, up to
  and including the directory that contains `.git`), that package manager is
  used.
- **UC-3** A `package.json` `packageManager` field (`"pnpm@9.1.0"`,
  `"yarn@4.1.0"`, `"bun@1.2.0"`, `"npm@10.0.0"`) in the nearest deciding
  directory wins over lockfiles in that directory.
- **UC-4** With no field and no lockfile up to the repository root, the
  invoking tool's user agent decides (`pnpm dlx` → pnpm), else npm.
- **UC-5** With several lockfiles in the deciding directory, the one matching
  the user agent wins; otherwise the precedence pnpm › yarn › bun › npm applies
  and a warning names the lockfiles found.
- **UC-6** A host that accepts the connection and never answers makes each
  request fail after the budget with `Timed out after 15000 ms: <url>`; at
  startup the CLI then prints the existing `⚠ Could not fetch the live
  component registry (…); using the bundled copy, which may be stale.` and the
  command continues. `SHADCN_ANGULAR_FETCH_TIMEOUT_MS=2000` shortens the
  budget.
- **UC-7** A transient failure on the first attempt (connection reset /
  refused, timeout, HTTP 5xx or 429) is retried once; success on the retry is
  silent. An HTTP 4xx other than 429 is not retried.
- **UC-8** Outside the monorepo, a transport failure fetching a component,
  block **or lib** file reads `Could not reach the registry (<url>): <cause>`;
  an HTTP error reads `Failed to fetch from <url>: <status> <statusText>`.
- **UC-9** Offline behaviour is unchanged: local-monorepo mode makes no
  request; `why` without network prints no size line; a failed GitHub-API ref
  lookup records no ref.

### B.4 Explicitly out of scope

- Proxy configuration (`HTTPS_PROXY`), custom CA certificates, auth headers for
  private forks.
- Parallelising or caching file fetches.
- Installing the package manager itself (corepack enable) or validating its
  version.
- The `--` separator and npm-spec validation → `specs/cli-registry-path-safety-spec.md`.
- Exit codes on failed installs → `specs/cli-install-integrity-spec.md`.
- A CLI flag for the timeout (the env var is enough; no MCP parity entry
  needed).

---

## C. QA section — tests are written FIRST

> **The agent must write every test in this section before writing any
> implementation code.** Tests fail first, then implementation makes them pass.
> Follow `.claude/CLAUDE.md` "Writing Tests": real-shaped inputs, one test per
> behaviour, assert outcomes (the chosen manager, the error text, the elapsed
> bound, the server's request count), not internal calls.

Runner: `npm run test:cli`. Coverage leg: `npm run coverage:cli`.

### C.1 Traceability table

| Test ID | Test name | Proves | Type | File |
| --- | --- | --- | --- | --- |
| T-1 | `detects the package manager that owns the project` — **real temp dirs**, `npm_config_user_agent` set per row and restored; `it.each`: `pnpm-lock.yaml` + UA npm (the `npx` case) → pnpm · `yarn.lock` → yarn · `bun.lock` → bun · `bun.lockb` → bun · `package-lock.json` + UA pnpm → npm · lockfile at the repo root (`.git` dir there) with cwd `apps/web` → that manager · `packageManager: "yarn@4.1.0"` beside `package-lock.json` → yarn · nothing up to `.git` + UA `pnpm/9.0.0 …` → pnpm · nothing + no UA → npm · a stray `yarn.lock` **above** the `.git` root is ignored | UC-1 … UC-4 | unit (real fs) | `utils/package-manager.spec.ts` (new) |
| T-2 | `breaks a multi-lockfile tie by user agent, else by precedence with a warning` — `yarn.lock` + `package-lock.json`: UA yarn → yarn, no warning; no UA → yarn by precedence (pnpm › yarn › bun › npm) + warning naming both files | UC-5 | unit (real fs) | `utils/package-manager.spec.ts` |
| T-3 | `installPackages runs the detected manager` — pnpm project, UA npm; `execa` mocked (the process boundary); assert the binary is `pnpm` and the subcommand `add` | UC-1 | unit | `utils/package-manager.spec.ts` |
| T-4 | `a request to a host that never answers fails within the budget and names the URL` — local `node:http` server that accepts and never responds; `fetchWithTimeout(url, undefined, { timeoutMs: 200, retries: 0 })`; assert rejection text `Timed out after 200 ms: <url>` and elapsed < 1 s | UC-6 | unit (real socket) | `utils/http.spec.ts` (new) |
| T-5 | `retries once on a transient failure and not on a client error` — local server scripted per request; `it.each`: socket destroyed then 200 → resolves, 2 requests; 503 then 200 → resolves, 2 requests; 429 then 200 → resolves, 2 requests; 404 → resolves with the 404 response, **1** request; 503, 503 → resolves with the second 503 response after **2** requests (one retry only, the caller decides what a 5xx means); headers sent then body stalls → rejects within the budget | UC-7 | unit (real socket) | `utils/http.spec.ts` |
| T-6 | `SHADCN_ANGULAR_FETCH_TIMEOUT_MS sets the default budget` — env set to `150`, no explicit option, never-answering server; rejection text names `150 ms` | UC-6 | unit | `utils/http.spec.ts` |
| T-7 | `startup falls back to the bundled registry when the manifest host stalls` — `loadRegistry({ registry: 'http://127.0.0.1:<port>' })` against the never-answering server with the env budget at 150 ms; assert it resolves `false` within 2 s and the existing warning text appears | UC-6, UC-9 | integration (real socket) | `registry/load.spec.ts` |
| T-8 | `fetch errors name the URL in consumer mode too` — **extend the existing** `fetch.spec.ts:40-56` describe with the missing input class: `getLocalComponentsDir` / `getLocalLibDir` → `null` (consumer); `it.each` over `fetchComponentContent` (component), `fetchComponentContent` (block) and `fetchLibContent`: transport failure → `Could not reach the registry (<url>): fetch failed`; HTTP 404 → `Failed to fetch from <url>: 404 Not Found`. Keep the monorepo rows (`File not found locally or remotely`) | UC-8 | unit | `core/fetch.spec.ts` |
| T-9 | `every call site is bounded and keeps its offline fallback` — one row per call site, env budget 150 ms: `fetchComponentContent` (consumer mode, `--registry` pointed at the never-answering local server) → rejects with `Timed out after 150 ms: <url>` within 2 s; `fetchLibContent` → same; `loadFileSizes` (`registry` → local server) → `null` within 2 s; `resolveRef` (its GitHub API URL is hard-coded, so `fetch` is stubbed with a promise that only settles when `init.signal` aborts — a faithful stall) → `null` within 2 s; local-monorepo `fetchComponentContent` makes **no** request (server request count 0) | UC-6, UC-9 | unit (real socket) | `core/fetch.spec.ts`, `core/sizes.spec.ts`, `core/ref.spec.ts` |

Every UC-1 … UC-9 appears at least once.

### C.2 Test types

- **Unit with real I/O** — package-manager detection on real temp directories
  (the walk-up and `.git` boundary only exist on a real tree); network tests
  against a real `node:http` server bound to `127.0.0.1:0` (an actual stall,
  an actual reset), never a `fetch` stub, because the behaviour under test *is*
  what undici + `AbortSignal` do. Budgets are injected small (150–200 ms) so
  the suite stays fast; no fake timers (they do not drive undici sockets).
- **Existing stub-based tests** (`fetch.spec.ts`, `load.spec.ts`) keep their
  `vi.stubGlobal('fetch', …)` style where they test messages, not timing.
- No e2e: the e2e runner installs from the local monorepo (no network, no npm
  deps in today's manifest), so it cannot observe either rule. No Storybook /
  a11y.
- **Measured assertion** (perf claim): T-4 and T-7 assert an elapsed-time
  upper bound, not a vibe.

### C.3 Edge cases and failure modes the tests must cover

- The reported `npx` case is the **pnpm lockfile + npm user agent** row (T-1).
- Workspace root above cwd, and a lockfile **above** the repository root that
  must be ignored (T-1).
- `bun.lock` (text, Bun ≥ 1.2) and `bun.lockb` (binary, older) — both (T-1).
- Retry boundaries: exactly one retry; 404 never retried; 429 retried (T-5).
- The timeout must cover the **body** too, not only the headers: one T-5 row
  sends headers then stalls the body → rejects within the budget.
- A response that arrives just before the budget must not be aborted mid-read
  by a stale timer (clear the timer / scope the signal per attempt).
- Env var invalid (`abc`, `0`, `-5`) → default 15 000 ms, no crash (one T-6
  row).
- Consumer mode **and** monorepo mode for error texts (T-8) — the class the
  existing test missed.

### C.4 Coverage expectation

New files ≥ 95 % lines: `utils/http.ts`, `utils/package-manager.ts` (now
tested for the first time). Touched files must not drop below their current
`npm run coverage:cli` line coverage: `core/fetch.ts`, `registry/load.ts`,
`core/ref.ts`, `core/sizes.ts`.

### C.5 Mutation check (mandatory before Task 4)

1. P: put the user agent back in front of lockfiles → T-1 `npx` row red.
2. P: look in `cwd` only → T-1 workspace row red. Walk past `.git` → T-1
   stray-lockfile row red. Drop `bun.lock` → T-1 red. Ignore `packageManager`
   → T-1 red.
3. N: route any one call site back to bare `fetch` → its row goes red
   (`load.ts` → T-7; `fetch.ts` component / lib, `sizes.ts`, `ref.ts` → the
   matching T-9 row).
4. N: retry on 404 → T-5 red. Retry twice → T-5 red. Never retry → T-5 red.
5. N: drop the URL from the timeout message → T-4 red. Restore the
   `if (localDir)` guard around the transport wrapping → T-8 consumer rows red.

---

## D. Architecture section

### D.1 Usability — the public API

No new flags. One new environment variable.

**Simple mode** — nothing to do:

```bash
npx @gilav21/shadcn-angular add data-table      # pnpm project → `pnpm add …`, bounded requests
```

**Custom mode** — slow network or very strict CI budget:

```bash
SHADCN_ANGULAR_FETCH_TIMEOUT_MS=45000 npx @gilav21/shadcn-angular update --yes
```

**What a stalled host looks like:**

```text
⚠ Could not fetch the live component registry (Timed out after 15000 ms: https://raw.githubusercontent.com/…/registry.json); using the bundled copy, which may be stale.
```

CLI-internal API (new `packages/cli/src/utils/http.ts`):

```ts
export interface FetchBudget {
  /** Per-attempt budget covering connect, headers and body. Default: env SHADCN_ANGULAR_FETCH_TIMEOUT_MS or 15 000. */
  readonly timeoutMs?: number;
  /** Extra attempts after a transient failure. Default 1. */
  readonly retries?: number;
  /** Pause before a retry. Default 500 ms. */
  readonly retryDelayMs?: number;
}
/** Thrown for transport failures and timeouts; message always names the URL. */
export class NetworkError extends Error {
  readonly url: string;
  readonly kind: 'timeout' | 'unreachable';
}
/**
 * fetch() with a per-attempt AbortSignal.timeout and one retry on transient
 * failures (transport error, timeout, 5xx, 429). Resolves with the Response for
 * any other status (the caller decides what a 404 means); reads the body inside
 * the budget via the returned `text()` / `json()`.
 */
export function fetchWithTimeout(url: string, init?: RequestInit, budget?: FetchBudget): Promise<Response>;
export function fetchText(url: string, init?: RequestInit, budget?: FetchBudget): Promise<{ status: number; statusText: string; ok: boolean; text: string }>;
```

`utils/package-manager.ts`:

```ts
/** The manager that owns the project at `cwd` (see invariant P). */
export async function getPackageManager(cwd: string): Promise<PackageManager>;
```

### D.2 Efficiency

Budget: each request ≤ `timeoutMs` per attempt, ≤ 2 attempts + 500 ms → worst
case ≈ 30.5 s per request at the default, versus ~300 s today. The startup
manifest is one request. File fetches are sequential today; this spec does not
change their count. Package-manager detection adds at most one `stat` per
lockfile name per ancestor directory up to the repo root — microseconds.

### D.3 DX for the consuming developer

- **Must learn:** nothing; optionally `SHADCN_ANGULAR_FETCH_TIMEOUT_MS`
  (documented in `packages/cli/README.md` troubleshooting, one paragraph).
- **Messages (exact):** `Timed out after <n> ms: <url>` ·
  `Could not reach the registry (<url>): <cause>` ·
  `Failed to fetch from <url>: <status> <statusText>` ·
  `Found several lockfiles (yarn.lock, package-lock.json); using yarn. Delete the
  ones you don't use, or set "packageManager" in package.json.`

### D.4 Implementation options

#### (a) Timeouts

**Option 1 — `AbortSignal.timeout(ms)` inline at each of the five call
sites.** Pros: tiny diff. Cons: five copies of retry logic and of the
URL-naming error; the next call site forgets.

**Option 2 — One `fetchWithTimeout` / `fetchText` helper in `utils/http.ts`
used by all five call sites.** Pros: the rule lives once; testable against a
real socket. Cons: one new module.

**Option 3 — A global undici `Agent` with `headersTimeout` / `bodyTimeout` via
`setGlobalDispatcher`.** Cons: requires importing `undici` (a dependency the
CLI does not declare), changes timeouts for any code in the process, and gives
no retry or URL in the message.

**✅ Chosen: Option 2.** Body reading happens inside the budget (`fetchText`)
because a stalled body is the same failure as stalled headers.

#### (b) Retry policy

**Option 1 — No retry.** Cons: one reset on a flaky network fails a 40-file
install. **Option 2 — One retry on transient classes only, fixed 500 ms
delay.** **Option 3 — Exponential backoff, N retries.** Cons: multiplies the
worst-case wait the invariant exists to bound.

**✅ Chosen: Option 2.**

#### (c) Package-manager decision order

**Option 1 — Lockfile in `cwd`, then user agent (the review's proposal).**
Cons: misses workspaces, `package-lock.json`, `packageManager` (V4).

**Option 2 — Walk up from `cwd` to the repository root (`.git`, else the
filesystem root); the first directory with a `packageManager` field or any
lockfile decides (field › lockfile; several lockfiles → user-agent tie-break,
else precedence + warning); nothing found → user agent → npm.**
Pros: matches how pnpm / yarn / corepack themselves find the project root.
Cons: slightly more code.

**✅ Chosen: Option 2.** `package.json` parse errors are ignored (treated as no
field), never thrown.

### D.5 Risks

| Risk | Mitigation |
| --- | --- |
| 15 s too short on a slow mirror. | Env override; budget is per attempt and covers one small file. |
| A retry duplicates a non-idempotent request. | Every CLI request is a `GET`. |
| Tests binding sockets flake on a busy box. | Bind `127.0.0.1:0`, close the server in `afterEach`, budgets ≥ 150 ms, upper bounds generous (≤ 2 s) — see the vitest-hang memory: never two browser runs at once (this is the node leg, but keep servers closed). |
| A repo without `.git` (tarball checkout) walks to the filesystem root and picks a stray lockfile. | Documented; `packageManager` in the project's `package.json` overrides. |
| Rebase conflict with the path-safety spec in `package-manager.ts` / `load.ts`. | Banner merge order; disjoint functions. |

### D.6 Publish verdict

**A CLI npm publish IS required** — all changes are CLI logic under
`packages/cli/src/**` (`utils/http.ts`, `utils/package-manager.ts`,
`core/fetch.ts`, `core/ref.ts`, `core/sizes.ts`, `registry/load.ts`); nothing
is served live from `master`. Checked against `.claude/CLAUDE.md` "When a CLI
npm Publish Is Required". **Publish is manual (passkey / 2FA) and is done by
the human after the PR is merged to `master`.**

---

## E. Task table (ordered = implementation order)

| # | Task | Proves | Status | Completed | Score | Retrospective |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Write failing tests T-1 … T-9 (`utils/package-manager.spec.ts` — new, or extend it if the path-safety spec already created it; new `utils/http.spec.ts`; **extend** the existing `fetch.spec.ts:40-56` with the consumer-mode class; additions to `load.spec`, `ref.spec`, `sizes.spec`). Confirm each fails for the right reason. | UC-1 … UC-9 | ⬜ Not started | — | — | — |
| 2 | `getPackageManager` per §D.4 (c): walk-up to `.git`, `packageManager` field, `bun.lock` + `bun.lockb`, `package-lock.json` / `npm-shrinkwrap.json`, tie-break + warning | UC-1 … UC-5 | ⬜ Not started | — | — | — |
| 3 | `utils/http.ts` (`fetchWithTimeout`, `fetchText`, `NetworkError`, env budget); route `fetch.ts` (component/block + lib, URL-naming errors in every mode), `load.ts` `fetchManifest`, `ref.ts` `resolveRemoteSha`, `sizes.ts` `readFileSizes` through it; README troubleshooting paragraph for `SHADCN_ANGULAR_FETCH_TIMEOUT_MS` | UC-6 … UC-9 | ⬜ Not started | — | — | — |
| 4 | Gates: mutation check §C.5; `npm run test:cli`; `npm run coverage:cli`; `npm run lint`; `npm run e2e -- button` (regression smoke for the install path); `npm run sonar:gate` with the four verdict checks from `.claude/CLAUDE.md` §4; record "**CLI publish required — manual, after merge**" in the completion log | all | ⬜ Not started | — | — | — |

### Implementation notes the executing agent must honour

- State invariant N or P in the implementing commit message and re-read the
  diff against it (`.claude/CLAUDE.md` "Fixing Bugs" §3).
- `pnpm` / `yarn` are **not installed** on the authoring machine; T-1 … T-3
  never execute a package manager (detection is pure filesystem + env, and
  `execa` is mocked in T-3).
- No new runtime dependencies (no `undici` import, no `which-pm`).
- Sonar rules from `.claude/CLAUDE.md` §4 apply (cognitive complexity ≤ 15 —
  split the walk-up from the per-directory decision; `Number.parseInt` /
  `Number.isFinite` for the env var).

---

## Definition of Done (per task)

A task row may be marked ✅ Done only when **all** of these pass:

1. **Fully tested** — every test named for this task is written and passing.
2. **Fully covered** — no uncovered lines introduced in the files touched.
3. **Zero lint errors** — `npm run lint` clean.
4. **Zero SonarQube issues** — the **full server scan** (`npm run sonar:gate`
   against `http://localhost:9000` — coverage re-measured unless the tree
   fingerprint proves it current) run and clean on the changed code. eslint is NOT a substitute. If the token, server, or Docker
   is unavailable, the task is **blocked, not done** — stop and tell the user.
5. **Review gate ≥ 91** — invoke the `review-gate` skill and reach a score of
   at least 91 from a fresh independent reviewer.

Then, and only then, update this spec's task row with:

- **Completed** — the date/time (`date +"%Y-%m-%d %H:%M"`).
- **Score** — the review-gate score.
- **Retrospective** — 1–2 sentences: what went well, and what to improve later.

Marking a row Done without all five is a process violation, not a shortcut.

---

## Completion Log

| Row | Date | Task | Reviewer score | Notes |
| --- | --- | --- | --- | --- |
