---
name: spec-waves
description: Orchestrate parallel implementation of a spec set. Reads a spec index with its wave/prerequisite/conflict map, spawns one worktree-isolated agent per spec in the current wave, waits for the whole wave at a barrier, then merges every branch into an integration branch — regenerating the registry rather than merging it — runs the full gate suite, cleans up the finished worktrees, and updates the index. Use when asked to "run the wave", "implement the specs in parallel", "fan out the agents", or to execute a spec index produced by the plan-to-specs skill.
allowed-tools: Agent, Read, Edit, Write, Bash, Grep, Glob, TaskList, TaskGet, SendMessage
---

# Spec Waves

Execute a spec index wave by wave: fan out, barrier, merge, clean.

**Announce at start:** "I'm invoking the spec-waves skill to run wave N of
`<index>`."

## Why it exists

Specs produced by `plan-to-specs` are deliberately sized for one agent each.
The value only materialises if they actually run in parallel — and parallel
work on one repo fails in two predictable ways: agents editing the same files,
and agents each regenerating the same generated file. This skill exists to make
the fan-out safe and the merge boring.

---

## The one rule that makes this work

> ## 🔴 NEVER MERGE GENERATED FILES. REGENERATE THEM.
>
> `packages/components/registry.json` is **written by**
> `npx tsx packages/cli/scripts/sync-registry.ts --fix`, derived entirely from
> the component source on disk.
>
> Every agent that adds or edits a component will have regenerated it. If you
> merge N branches that each rewrote it, you get N conflicts in a file whose
> contents are **a pure function of the merge result** — conflicts that are
> pointless to resolve by hand and easy to resolve wrongly.
>
> **Merge the source. Discard `registry.json` from every incoming branch.
> Regenerate once on the integration branch. Commit that.**
>
> ### ⚠️ `packages/cli/src/registry/index.ts` is NOT in this category
>
> **Corrected 2026-08-21, after it silently dropped eight components.**
>
> That file is **hand-authored**: each component's `name`, `category`,
> `description` and `tags` are written by a human (or the agent that added the
> component). `sync-registry --fix` only *fills in* the `files[]`,
> `dependencies` and `libFiles` of entries **that already exist** — it never
> creates an entry. A component with no entry there is simply **absent from the
> registry**, and regenerating will not bring it back.
>
> Discarding it with `--ours` during the Wave 0 merges lost `stat-card`,
> `result`, `error-page`, `histogram`, `boxplot`, `candlestick`, `treemap` and
> `infinite-canvas` — eight of that wave's twelve new components. **Nothing
> failed:** `sync-registry` reported success and wrote a manifest of 157
> components instead of 165. It was caught only by explicitly asserting that
> every new component appears in the regenerated manifest.
>
> **Union-merge it** like `ui/index.ts` and `demo.routes.ts` — take both sides'
> entries, then regenerate. And always run the new-component assertion below.

The same rule applies to any other generated artifact (`documentation.json`,
coverage output, build output). If a file is produced by a command, it is
regenerated, never merged.

---

## Step 0 — The orchestrator runs in the MAIN checkout. Never in a worktree.

> ## 🔴 STOP IF YOU ARE IN A WORKTREE
>
> Check first: if `.git` is a **file** (not a directory), you are in a worktree
> and **cannot run this skill**.
>
> ```bash
> test -f .git && echo "IN A WORKTREE — cannot orchestrate from here"
> ```
>
> This is structural, not stylistic:
>
> - A worktree-isolated session is **blocked from git operations targeting any
>   other worktree** (`git -C <other>` is refused). Step 5 merges N agent
>   branches — impossible from inside a worktree.
> - Git refuses to remove the worktree you are standing in, so Step 7 cannot
>   clean up either.
> - `ExitWorktree` is a **no-op** unless this same session created the worktree
>   via `EnterWorktree` — a pre-assigned worktree cannot be escaped mid-session.
>
> **If you are in a worktree:** commit and push whatever you have, then tell the
> user the session must be restarted from the main checkout. Do not attempt a
> workaround.
>
> **Correct setup:** the orchestrator sits in the main checkout on a branch cut
> from `master` (`git switch -c wave-<n>-integration master`). Only the spawned
> agents get worktrees, via `isolation: "worktree"`.

## Step 1 — Read the index and pick the wave

The index (e.g. `specs/<plan>-index.md`) provides:

- **Waves** — which specs have no unmet prerequisites.
- **Prerequisites** — per spec.
- **Conflict map** — contested surfaces; two specs sharing one must not run
  together, even if they are in the same wave.
- **Progress table** — what is already written / implemented.

Determine the wave to run: the lowest-numbered wave with unimplemented specs
whose prerequisites are all ✅.

## Step 2 — Preflight. Refuse to start if any check fails.

| Check | Action on failure |
|---|---|
| Every prerequisite spec's task table is fully ✅ with scores ≥ 91 | **STOP.** Name the incomplete prerequisite; do not start the wave. |
| Working tree is clean; you know which branch is the integration base | **STOP.** Ask the user. Never fan out from a dirty tree. |
| No two specs in this wave share a row in the conflict map | **Split the wave** — run the conflicting specs sequentially in sub-waves. |
| Each spec file exists and has a task table + Definition of Done block | **STOP.** The spec is not ready; run `plan-to-specs` on it first. |
| The registry is currently in sync (`npm run check:registry` clean) | Fix before starting, so post-merge drift is unambiguously from this wave. |
| **Docker running + SonarQube reachable** at `http://localhost:9000/api/system/status` | **STOP.** Every task's Definition of Done requires the server scan. Without it every agent reports BLOCKED after doing the work. Ask the user to start Docker and the Sonar container. |
| **`.env` (with `SONAR_TOKEN`) exists in the repo root** | See the gitignored-files trap below. |

### 🔴 The gitignored-files trap

`git worktree add` checks out **tracked** files only. `.env` is gitignored, so
a freshly-created agent worktree has **no `SONAR_TOKEN`** — `npm run sonar`
fails there even when Docker and the server are up, and every task in every
spec reports BLOCKED after the work is already done.

**Before fan-out, copy the untracked-but-required files into each worktree**
(or set `SONAR_TOKEN` in the agents' environment). At minimum:

```bash
cp <repo-root>/.env <worktree>/.env
```

Verify inside one worktree before spawning the rest.

**⚠️ History on this machine (2026-08-20).** A stale `SONAR_TOKEN` was set as a
**Windows User-level environment variable** (not a bash profile — checked
`~/.bashrc`, `~/.bash_profile`, `~/.profile`) and it was **invalid**
(`/api/authentication/validate` → `{"valid":false}`) while the `.env` token was
valid. `resolveSonarToken` prefers the environment, so every sonar invocation
401'd.

**Fixed at source:** the User-level variable was reset to the `.env` value and
validated (`{"valid":true}`).

**But:** a process inherits its environment block at launch. Any session, shell,
or agent started *before* that fix still carries the old invalid token, and so
does every child it spawns. A restart of the tool is required for the durable
fix to take effect.

Therefore **keep the inline unset in agent prompts regardless** — it is correct
whether or not the environment is stale, and costs nothing:

```bash
unset SONAR_TOKEN; npm run sonar
```

Put this in every agent's prompt. Diagnose with:

```bash
curl -s -u "$SONAR_TOKEN:" http://localhost:9000/api/authentication/validate
```

Fixing the profile export at the source is the durable fix and worth raising
with the user.

`node_modules` has the same character. If the project does not use a shared
store, each worktree needs an install before its gates can run — budget for it
or the first agent's first gate will fail confusingly.

Report the plan to the user before spawning: which specs, how many agents, and
the integration branch name. Fan-out is expensive; make it visible.

## Step 3 — Fan out, one worktree-isolated agent per spec

Spawn all agents for the wave **in a single message** so they run concurrently.
Each gets `isolation: "worktree"` so it has its own checkout and cannot collide
with its peers.

```
Agent(
  name: "<spec-slug>",
  subagent_type: "general-purpose",
  isolation: "worktree",
  description: "Implement <spec-slug>",
  prompt: <the template below>
)
```

**Agent prompt template:**

```
Implement the spec at `specs/<name>-spec.md`, start to finish.

Rules — these are not negotiable:

1. Read the ENTIRE spec first, including the dependency banner. If the banner
   says prerequisites are missing and you cannot verify they are complete,
   STOP and report "BLOCKED: <reason>" without writing any code.
2. Work the task table STRICTLY top to bottom. Do not reorder, do not skip,
   do not batch.
3. Tests come FIRST. The QA section lists the tests to write before any
   implementation. Write them, watch them fail, then implement.
4. A task is Done only when it meets ALL FIVE criteria in the spec's
   "Definition of Done": tests pass, coverage not reduced, `npm run lint`
   clean, full SonarQube server scan clean, and review-gate ≥ 91.
   Invoke the `review-gate` skill for the last one — do not self-score.
   If SONAR_TOKEN / the server / Docker is unavailable, the task is BLOCKED,
   not done. Report it and stop.
5. After each task passes, update that row in the spec: Status ✅, Completed
   timestamp, review score, and a 1-2 sentence retrospective. Commit the
   implementation and the spec update together.
6. Stay INSIDE your worktree. Never touch another spec's files. If you believe
   you need to edit a file outside this spec's scope, STOP and report instead.
7. You MAY run `sync-registry --fix` locally so your build and tests pass.
   Expect it to be discarded at merge time — the integrator regenerates it.
   Never hand-edit `registry.json` or `packages/cli/src/registry/index.ts`.
8. When every task is ✅, report: branch name, tasks completed, review scores,
   and anything you deliberately left out.

Do not ask questions. If the spec cannot answer something, that is a spec bug —
report it as BLOCKED with the specific gap.
```

### ⚠️ Disk contention is the real parallelism ceiling — stagger the launch

**Observed 2026-08-20:** eight agents launched at once produced six concurrent
dependency installs plus three concurrent Sonar scans on one machine. A single
`npm install` took **27+ minutes**, stalling agents before they could run a
single test. The bottleneck was disk, not CPU or the model.

Each worktree needs its own `node_modules`, and each task runs
`npm run coverage` (full suite) plus a ~10-minute Sonar scan. That is a lot of
I/O multiplied by N.

Mitigations, in order of preference:

1. **Stagger the launch.** Spawn 2–3 agents, wait until their installs finish,
   then spawn the next batch. Total wall-clock is usually *lower* than an
   all-at-once launch that thrashes.
2. **Pre-seed dependencies** if the harness stages them (this repo has
   `.claude/worktrees/nm-tmp`). Verify the stage is current — if the main
   checkout's `node_modules` was reinstalled after the stage was built, it is
   stale and every worktree falls back to a full install.
3. **Size the wave to the machine**, not to the spec count. A wave of 8 specs
   can still be run as three sub-waves.

Never let an agent skip a gate because the machine is slow. Slow is not
blocked — tell the agent to wait, and fix the sequencing at the orchestrator
level.

Track the spawned agents. Do **not** poll them; the harness notifies on
completion.

## Step 4 — The barrier

**Wait for every agent in the wave before merging anything.** This is one of
the few places a true barrier is correct: the merge and the registry
regeneration need the complete set, and a partial merge would regenerate the
registry against an incomplete source tree.

While waiting, do not start the next wave and do not begin merging early
finishers.

Classify each result:

| Result | Handling |
|---|---|
| ✅ All tasks done, scores ≥ 91 | Include in the merge |
| ⚠️ Partially done | **Do not merge.** Leave the worktree intact. Report which tasks landed. |
| 🛑 BLOCKED | **Do not merge.** Keep the worktree. Surface the blocker to the user verbatim. |
| ❌ Failed / died | Keep the worktree for forensics. Report. |

A wave with any non-✅ result is a **partial wave**: merge the successes, report
the rest, and do not mark the wave complete in the index.

### Shared registration points — the conflict map's blind spot

A conflict map built from *component* surfaces will miss the files that every
component-adding bundle must touch in order to register itself. Observed
2026-08-20: four of eight bundles concurrently edited each of

- `packages/components/ui/index.ts` (the barrel)
- `demo/src/app/demo.routes.ts` (the demo route)
- `demo/src/app/app.ts` (the demo nav)

These are **append-only insertions**, so most auto-merge and the rest resolve as
a **union of both sides** — every entry is additive and independent. Merge
noise, not a design conflict.

Two rules that keep it noise:

1. **Tell agents not to reorder, sort or "tidy" these files.** One reformat
   turns a trivial union merge into a genuine conflict across every bundle.
2. **List them in the conflict map as `union-merge` surfaces**, distinct from
   `serialise` surfaces, so a future orchestrator reads them as expected
   overlap rather than a planning error.

Audit for them before fan-out — and again mid-wave, which is how this was
caught:

```bash
for w in <each worktree>; do git -C "$w" diff --name-only <base>...HEAD; done \
  | sort | uniq -c | sort -rn | awk '$1>1'
```

## Step 5 — Merge

Merge **sequentially in index order** so that any conflict is reproducible.

```bash
git switch -c wave-<n>-integration <base>

# For each successful spec branch, in index order:
git merge --no-ff <spec-branch> -m "merge(<spec>): <summary>"
```

**Handling `registry.json`** — on any conflict, do not resolve by hand:

```bash
git checkout --ours packages/components/registry.json
git add packages/components/registry.json
```

**Handling `packages/cli/src/registry/index.ts`** — union-merge it. Its
entries are hand-authored and `--ours` **deletes** any the other branch added.
Take both sides: keep your entries, splice in theirs.

Then, once **all** branches are merged, regenerate from the merged source:

```bash
npx tsx packages/cli/scripts/sync-registry.ts --fix
git add packages/components/registry.json packages/cli/src/registry/index.ts
git commit -m "chore(registry): regenerate after wave-<n> merge"
```

**Then assert every new component actually landed** — a lost entry is silent:

```bash
node -e "
const fs=require('fs'),cp=require('child_process');
const r=JSON.parse(fs.readFileSync('packages/components/registry.json','utf8'));
const comps=Array.isArray(r)?r:Object.values(r.components||r);
const NEW=process.argv.slice(1);
const tracked=cp.execSync('git ls-files packages/components/ui',{encoding:'utf8'})
  .split('
').filter(Boolean).map(f=>f.replace('packages/components/ui/',''));
let bad=0;
for(const n of NEW){
  const c=comps.find(x=>x.name===n);
  if(!c){bad++;console.log('!! NOT IN REGISTRY',n);continue;}
  const own=tracked.filter(f=>f.startsWith(n+'/')&&/\.(ts|html|css)\$/.test(f)&&!/\.(spec|stories)\./.test(f));
  const missing=own.filter(f=>!(c.files||[]).includes(f));
  if(missing.length){bad++;console.log('FAIL',n,'MISSING:',missing.join(', '));}
  else console.log('ok',n,'files:'+(c.files||[]).length);
}
process.exit(bad?1:0);
" <every-new-component-name>
```

This also catches the `sub/` omission: `getEntryFile` prefers
`<name>/index.ts` as the root of the import walk, so a `files[]` not seeded
with the folder barrel starts the walk at the component file and **never
reaches `sub/`**.

Any other conflict is a real conflict in hand-written code — resolve it
deliberately, and record in the index that two specs contended on a surface the
conflict map missed. **That is a bug in the index; fix the map.**

### Regenerate the derived docs — once, on the integration branch

`packages/cli/scripts/gen-component-docs.ts` derives which demo route previews
which component by **parsing `demo.routes.ts`** and reading each demo file's
imports. Every bundle that adds a demo route therefore invalidates
`demo/public/component-docs.json` and `demo/public/llms.txt`.

```bash
npm run docs:regen    # compodoc + the three generators, ~30s
npm run docs:check    # fails loudly if regeneration was skipped
```

This one cannot merge silently stale — `docs:check` and byte-for-byte
regeneration unit tests both catch it — but it *will* fail the integration gate
if forgotten, and the failure reads as a docs bug rather than a missing step.

### 🔴 Regenerate the utils baselines — once, on the integration branch

**If the wave broadly edited `packages/components/ui/**`, the baselines are
now stale and `doctor --fix` will silently stop pruning stale files while still
reporting success.**

This failure is invisible to every normal gate: unit tests, lint, tsc, the AOT
build and SonarQube all pass, because no code path changed — only generated
data. It is caught *only* by `e2e/clean-reinstall`, where the tell is runtime
collapsing (≈6.6s instead of ≈80.8s).

```bash
npm run build:cli
node packages/cli/scripts/gen-component-baselines.mjs   # + the legacy/lib variants
```

Do this **once, after all branches are merged** — never per agent, or the three
baseline files conflict. The generators read `git log --all`, so their output is
worktree-independent.

Consequence: **a wave that broadly edits `ui/**` is a publish wave.** Record it
in the pending-releases memory and hand off — publishing is manual and 2FA
gated. Never run `npm publish`.

## Step 6 — Gate the integration branch

The merge result is code no single agent ever tested. Run the full suite:

```bash
npm run check:registry     # must be clean — proves the regeneration is right
npm run lint
npm run typecheck
npm run test-visual        # full suite; zero failures tolerated
npm run coverage
npm run sonar              # full server scan, zero new issues
npm run e2e:impact -- --base <base>   # then run the impacted subset
```

**Run e2e SERIALLY (`--workers 1`) on a loaded box.** Each spec starts its own
`ng serve`; several at once on a machine also running Sonar scans produces
`ng serve did not become ready within 120000ms` — a false failure that looks
exactly like a real one. Observed 2026-08-20: 3 of 4 specs failed in parallel
and all passed serially. If an e2e failure appears, re-run it serially *before*
diagnosing it as a defect.

**Three ways to prove an e2e failure is environmental before chasing it:**

1. **Control run.** After `e2e:reset`, run a spec the change never touched. If
   it passes, the harness is sound and the fixture was dirty.
2. **Does the failing *set* change between runs with no code change?** A real
   regression is deterministic — it cannot fail spec A on one run and spec B on
   the next. A shifting failure set is proof of nondeterminism, full stop.
3. **Read the failure artifact, not just the message.** Snapshots showing the
   *wrong page* (a demo landing page, an unrelated block) mean the harness demo
   never mounted — an environment failure. Assertion *mismatches* on the right
   page are what a real regression looks like.

Two related load flakes worth recognising rather than re-diagnosing:

- Tests that shell out to `git` (e.g. `baseline.spec.ts`) time out at 5s under
  contention but pass in ~430ms in isolation.
- A test-chain abort can skip `fix-lcov.mjs`, leaving lcov paths unnormalised;
  re-run it manually before scanning.

Zero test failures is the project standard — a pre-existing failure is still a
failure. If the integration branch fails a gate that every individual branch
passed, that is a genuine cross-spec interaction: fix it on the integration
branch and note it in the index.

### The review gate catches what a green suite cannot — do not trade it away

When quota or wall-clock pressure mounts, the review gate looks like the
cheapest thing to drop. It is the most expensive.

Observed 2026-08-21, in one bundle, **both invisible to a fully green test
suite** and both found by a reviewer reading code against the spec:

- **A tree-corrupting drop target.** An outline row hosting its own child list
  registered in the same group, so the pointer over that child made it the
  *deepest* hit and therefore the drop target — dropping detached the item's
  own subtree by re-inserting it into a list it owned. Confirmed by probe:
  disabling the guard makes the test fail with the exact cycle.
- **A stale-guard race.** Only the async branch bumped the staleness token, so
  a later synchronous move left a stale guard promise free to revert the
  component and double-emit its change event.

Neither was a style opinion; neither would have been caught by more tests of
the kind already written, because both required reasoning about *interactions
the tests did not model*. Scores of 87 and 88 on otherwise-passing work.

Corollary: a reviewer's finding should be verified **by probe** — disable the
fix and confirm the test fails for the stated reason — not merely by re-reading
the diff. This cuts both ways: in the same bundle a reviewer then **disproved
the implementer's fix** by probe, and was right.

#### A stubbed test is testing the assertion, not the behaviour

That third round found the real fault was **one line older than the feature**:
an unscoped `querySelectorAll('[data-slot="sortable-item"]')` matched nested
lists' rows *and* the drag ghost's duplicate — six or seven elements for a
three-row outline — so every derived index was off, corrupting both the cycle
guard and the drop-index computation independently. A third copy of the same
query sat elsewhere in the file.

**Three of the implementer's own tests passed straight over it**, each for a
different and instructive reason:

- one exercised **index 0**, the single position where an off-by-N vanishes;
- one asserted the hit **result** rather than element **identity**;
- the rest **stubbed `getBoundingClientRect` and hand-set the drag state**.

The rule, worth applying beyond drag-and-drop: *a test that stubs the geometry
and hand-sets the interaction state is testing its own assertion, not the
behaviour.* For anything geometric — drag, virtualization, layout, hit-testing
— require at least one **real-pointer, real-layout, nothing-stubbed** spec.
The replacement here drove `mousedown → mousemove → mouseup` against real
layout and failed on the pre-fix code with `expected [...] to have a length of
3 but got 2`, catching both defects at once.

Corollary for reviewers: "add a real-interaction test" is a **necessary**
finding, not a nice-to-have, whenever the existing coverage is entirely
stubbed.

### 🔴 `EXECUTION SUCCESS` from the scanner does NOT mean results are queryable

The SonarQube scanner uploads a report and exits successfully; the **server**
then queues a compute-engine task to process it. Querying the issues API in
that window silently returns the **previous** scan's data — no error, no
warning, just stale numbers that look like a result.

Observed 2026-08-21: an agent's first "clean" reading was exactly this — the
prior scan's state, reported as if it were the new one. A fix loop built on
that would confirm itself indefinitely.

**Always gate the query on the CE task, not on the scanner's exit:**

```bash
curl -s -u "$TOKEN:" \
  "http://localhost:9000/api/ce/component?component=<projectKey>" \
  | grep -o '"status":"[A-Z]*"'
# only query /api/issues/search once this reports SUCCESS
```

This compounds with the two traps below: a stale read, scoped by a directory
query that matches nothing, validated against no positive control, produces a
confident zero that is wrong three times over.

### Exclusions must carry a positive control that fails when the bug is fixed

An exclusion is indistinguishable from someone hiding a failure — unless it is
built to expire. When a bundle must exclude a known-broken target from a gate,
require a **control test asserting the defect still exists**, so the exclusion
**fails the day the underlying bug is fixed**.

Observed 2026-08-21: a bundle excluded two components from an a11y gate by name
(each rendering an unfocusable scroll container, defects in component source
rather than in the bundle's own work) and paired the exclusion with a control
that breaks once they are repaired. The suppression is documented rather than
buried, cannot silently rot into permanence, and converts itself into a tracked
obligation.

Apply the same rule to Sonar accepted-findings entries and to any skipped test.

### Prove a pre-existing condition by measurement, not by assertion

"That warning was already there" is checkable: stash the change, rebuild,
compare. The same bundle proved a demo bundle-budget warning pre-existing with
two numbers (2.38 MB without its changes, 2.35 MB with) rather than asserting
it. Cheap, and it converts an excuse into evidence.

### Validate a clean gate result before believing it

"Zero issues" from a scoped query is indistinguishable from a broken query that
matched nothing. Before an agent reports a clean gate on a *filtered* result,
require two checks:

1. **A positive control** — run the same query shape against a file known to be
   dirty and confirm it returns findings.
   *Observed 2026-08-20:* querying SonarQube by **directory** returned
   `total: 0` while querying the same code by explicit **file key** returned 5
   real issues. The zero was an artifact of the query shape, not a clean
   result. Prefer explicit file keys, and never accept a directory-scoped zero
   without a control.
2. **Proof the code is in scope** — e.g. `api/measures/component` returning
   non-zero `ncloc` for the changed sources.

And require the caveat stated plainly: if the tool's own exclusions cover some
of the changed paths, "zero issues" is meaningful only for the paths actually
analysed. A report that says *"clean for the four shipped sources, vacuous for
the excluded e2e paths"* is worth more than one claiming blanket compliance —
and the second kind is what lets a gate quietly stop being a gate.

This matters most exactly when a gate has been swamped by noise: a scan
reporting tens of thousands of junk findings trains everyone to filter, and a
badly-scoped filter then returns a comforting zero.

### A fix is not verified until the gate is re-run

Fixes can **trade** findings rather than remove them — especially ARIA and lint
fixes, where satisfying one rule introduces a violation of another. Observed
2026-08-20: a round of ARIA fixes went 5 findings → 4, with **two new ones**
created by the fix itself. The agent only knew because it re-scanned.

Require the loop to be *scan → fix → re-scan → confirm zero*, and require the
per-round counts in the report. "Fixed" without a confirming re-scan is a
claim, not a result.

Two corollaries seen in the same round:

- **Prefer the native element over the ARIA role.** `<section>` with an
  accessible name *is* a region landmark, so `role="region"` was redundant
  markup. This matches the project's own a11y direction.
- **Beware a role that suppresses assistive behaviour for projected content.**
  `role="application"` would have satisfied the rule while disabling browse
  mode over the consumer's own components inside the container — trading their
  accessibility for a clean report. A rule satisfied at the user's expense is
  not satisfied.

## Step 7 — Clean up worktrees

**Only after the integration branch is green.**

For each successfully merged spec:

```bash
git worktree list                       # confirm the path
git branch --merged | grep <spec-branch>  # PROVE it is merged
git worktree remove <path>
git branch -d <spec-branch>             # -d, never -D
```

> ### 🔴 NEVER use a recursive filesystem delete on a worktree
>
> **This destroyed the main checkout's `node_modules` on 2026-08-20.**
>
> Worktrees here get `node_modules` as a **directory junction** to the main
> checkout (that is what `.claude/worktrees/nm-tmp` stages). PowerShell
> `Remove-Item -Recurse -Force` and `rm -rf` **follow junctions and delete the
> target**, so deleting a worktree that way wipes the real `node_modules` — and
> it took 511 tracked files under `demo/` and `packages/cli/` with it.
>
> - Use `git worktree remove` **only**. If it refuses, find out why.
> - If a directory must be cleared by hand, use `cmd /c rmdir /s /q <path>`,
>   which does **not** traverse junctions. Never `Remove-Item -Recurse`/`rm -rf`.
> - Recovery if it happens anyway: `git restore .` for tracked files, `npm ci`
>   for `node_modules`. Untracked files are unrecoverable.

### Sonar project keys must be per-agent

Every agent scanning the shared `sonar.projectKey=shadcn-angular` means each
one's "no new issues" verdict is measured against a project polluted by the
other branches in flight — agents get blamed for each other's issues, and the
gate becomes non-deterministic.

Set a distinct key per agent (`scripts/sonar.mjs` reads `SONAR_PROJECT_KEY`):

```bash
export SONAR_PROJECT_KEY=shadcn-angular-<spec-slug>
unset SONAR_TOKEN; npm run sonar
```

Delete the scratch projects from the server after the wave merges.

Rules:

- **Never remove a worktree whose branch is not merged.** Use `git branch
  --merged` as proof, not memory.
- **Never `-D`.** If `-d` refuses, the branch has unmerged commits — stop and
  investigate.
- Keep the worktrees of blocked/failed/partial agents. They are the recovery
  point.
- Run `git worktree prune` at the end to clear stale metadata.

## Step 8 — Update the index and report

- Mark each merged spec ✅ in the Progress table.
- Mark the wave complete only if **every** spec in it merged.
- If the conflict map proved wrong, correct it now.
- Report to the user: specs merged, review scores, gates run, worktrees
  removed, worktrees deliberately kept and why, and what the next wave is.

Do not start the next wave without checking in — the user may want to
re-prioritise based on what this wave revealed.

---

## Windows / this-repo gotchas

Carried from project memory; these will otherwise burn a cycle each:

- **`sync-registry` reports false CRLF drift** on `rich-text-editor/addons/full/index.ts`.
  Run `sync-registry --fix` and then push with **no checkout in between** — a
  checkout re-introduces the drift.
- **The pre-push hook runs on deletions too.** Use `SKIP_SIMPLE_GIT_HOOKS=1`
  for delete-only pushes, and only those.
- **Storybook port 6006 leaks** after a killed hook. If a gate hangs on it,
  `taskkill` the stuck PID.
- **Run coverage legs via npm/npx** — the Bash tool's PATH lacks `cross-env`.

---

## Failure playbook

| Symptom | Cause | Response |
|---|---|---|
| Many conflicts in `registry.json` | Someone tried to merge it | Abort the merge, redo with the discard-and-regenerate rule |
| Dozens of e2e specs fail with `Cannot find module './test-pages/*-demo.component'` | `e2e/.workers/_pristine` is a **once-ever** snapshot that `ensurePristine()` never refreshes | Call `removeWorkerClones()` from `e2e/orchestrator/worker.ts` (it exists and is called from nowhere), then re-run. Kill any `esbuild.exe`/`node.exe` holding those paths first, or the delete fails partway |
| An e2e spec fails with `ng serve did not become ready within 120000ms` | Often NOT a timeout — `ng serve` never came up because the **build failed**. The runner only reports the deadline it was waiting on | Run that spec alone and grep the log for `ERROR`/`TS####` before writing it off as contention |
| `check:registry` dirty after regeneration | A spec hand-edited a generated file, or the CRLF gotcha | Find the hand-edit; re-run `--fix` without an intervening checkout |
| Integration green, individual branches green, e2e fails | Cross-spec interaction | Fix on the integration branch; add the surface to the conflict map |
| Agent reports BLOCKED on SonarQube | Token/server/Docker missing | The work is blocked, not done — get the token from the user; never accept the eslint subset |
| Two agents edited the same file | Conflict map was wrong | Merge carefully, then fix the map before the next wave |

---

## Checklist

- [ ] Prerequisites verified complete before fan-out
- [ ] No two specs in the wave share a contested surface
- [ ] All agents spawned in ONE message, each `isolation: "worktree"`
- [ ] Waited for the full wave at the barrier — no early merging
- [ ] Generated files discarded on merge, regenerated once at the end
- [ ] Full gate suite run on the integration branch
- [ ] Worktrees removed only with `git branch --merged` as proof
- [ ] Blocked/failed worktrees kept, and the user told why
- [ ] Index updated: progress, wave status, and any conflict-map correction
