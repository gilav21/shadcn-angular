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
> `packages/components/registry.json` and
> `packages/cli/src/registry/index.ts` are both **written by**
> `npx tsx packages/cli/scripts/sync-registry.ts --fix`, derived entirely from
> the component source on disk.
>
> Every agent that adds or edits a component will have regenerated both. If you
> merge N branches that each rewrote them, you get N conflicts in a file whose
> contents are **a pure function of the merge result** — conflicts that are
> pointless to resolve by hand and easy to resolve wrongly.
>
> **Merge the source. Discard both generated files from every incoming branch.
> Regenerate once on the integration branch. Commit that.**

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

## Step 5 — Merge

Merge **sequentially in index order** so that any conflict is reproducible.

```bash
git switch -c wave-<n>-integration <base>

# For each successful spec branch, in index order:
git merge --no-ff <spec-branch> -m "merge(<spec>): <summary>"
```

**Handling the generated files** — on any conflict in
`packages/components/registry.json` or `packages/cli/src/registry/index.ts`,
do not resolve by hand:

```bash
git checkout --ours packages/components/registry.json
git checkout --ours packages/cli/src/registry/index.ts
git add packages/components/registry.json packages/cli/src/registry/index.ts
```

Then, once **all** branches are merged, regenerate from the merged source:

```bash
npx tsx packages/cli/scripts/sync-registry.ts --fix
git add packages/components/registry.json packages/cli/src/registry/index.ts
git commit -m "chore(registry): regenerate after wave-<n> merge"
```

Any other conflict is a real conflict in hand-written code — resolve it
deliberately, and record in the index that two specs contended on a surface the
conflict map missed. **That is a bug in the index; fix the map.**

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

Zero test failures is the project standard — a pre-existing failure is still a
failure. If the integration branch fails a gate that every individual branch
passed, that is a genuine cross-spec interaction: fix it on the integration
branch and note it in the index.

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
