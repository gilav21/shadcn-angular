# Non-Destructive (3-Way Merge) Update — Design Spec

**Date:** 2026-06-29
**Status:** Approved design — implementation is a separate pass (lands on the
same branch as the addon work).

## Context

shadcn-angular copies component **source into the consumer's repo — they own it
and edit it.** Today, when an upstream change touches a file the user has
edited, the CLI's only options are **overwrite the whole file** (losing the
user's edits) or **skip** (never getting the upstream change). That forces a bad
choice on customers:

> *"The component isn't really mine — editing it detaches me from upgrades. So
> can I or can't I change my own component?"* — or — *"Every time there's an
> upstream improvement I want, I have to manually re-apply my edits, or I can't
> get it."*

The fix: a **3-way merge** on update. Apply upstream changes that **don't
overlap** the user's edits automatically; only surface a **real conflict** when
an upstream change and a user edit touch the same lines. This makes "you own the
source" and "you still get upgrades" both true at once.

This is the natural companion to the addon migration work (PR on this branch):
moving `[rowActions]` off the data-table base is exactly the kind of upstream
change that should **merge into** a customized base, not clobber it.

### What exists today (verified)

- **Manifest** (`packages/cli/src/core/manifest.ts`, `components.lock.json`):
  per-file `{ sha256, component }` — **hash only, no content, no version/ref**.
  `fileStatus()` → `clean | modified | untracked` by comparing hashes.
- **Baseline** (`core/baseline.ts`, `registry/legacy-baselines.ts`): historical
  **canonical hashes** per component (prefix/alias-neutralized) — tells us *if*
  a file is pristine, not the content.
- **Conflict classification** (`core/plan.ts` `classifyComponent` /
  `checkFileConflict`): returns `install | skip | conflict`. On `conflict`,
  `performInstall` (`core/install.ts`) either overwrites (if in the overwrite
  set / `--overwrite`) or **declines** — always whole-file.
- **Fetch + transform** (`core/fetch.ts` `fetchAndTransform`): fetches a file
  from `…/{branch}/…/<path>` and rewrites it into the consumer's **prefix** and
  **alias** space. Reusable to bring any version into the consumer's space.
- No `git` runtime dependency; CLI deps: commander, chalk, ora, prompts,
  fs-extra, zod, execa.

## Locked decisions (with the user)

1. **`BASE` source = fetch the historical version by recorded ref.** The
   manifest records, per component, the **commit SHA** it was installed/merged
   at; `update` fetches `BASE` from that ref. (Not shadow copies, not version
   numbers.)
2. **Conflict UX = git-style markers.** Auto-merge every non-overlapping
   upstream hunk; for a true conflict, write standard
   `<<<<<<< yours / ======= / >>>>>>> upstream` markers into the file.
3. **Default everywhere we'd clobber edits** — `update`, `add --overwrite`, and
   the addon install / `apply` overwrite paths. Unedited files fast-path
   overwrite (identical result). `--force` keeps the old whole-file overwrite.

---

## Architecture

### Per-file decision (the heart of it)

For each tracked file the CLI is about to write (in any overwrite-capable path):

```
OURS   = file on disk (may be edited)
THEIRS = fetch @ current branch  → transform to consumer prefix/alias
BASE   = fetch @ recorded ref    → transform to consumer prefix/alias

if OURS == THEIRS                         → skip (already up to date)
else if OURS == BASE (hash-clean)         → write THEIRS   (fast path: unedited)
else if BASE unavailable                  → FALLBACK (see below)
else                                       → diff3(BASE, OURS, THEIRS)
                                              ├─ no conflicts → write merged
                                              └─ conflicts    → write merged WITH
                                                                 <<< markers
advance the component's recorded ref → the version we merged/overwrote TO
```

Equality is by **normalized (LF) hash** (reuse `hashContent` / the canonical
hash), so line-ending and prefix/alias churn never read as edits.

### Modules (small, isolated, testable)

- **`core/merge3.ts`** — pure 3-way line merge. `merge3(base, ours, theirs):
  { content: string; conflicts: number }`. No IO. The riskiest unit → exhaustive
  unit tests. Implementation: a small line-based diff3 (vendored, or a tiny
  zero-dep lib such as `node-diff3`) producing git-style markers. (`git
  merge-file` via `execa` is a possible fast path when git is present, but the
  default path must not require git — keep `merge3` self-contained.)
- **`core/manifest.ts`** — extend with a per-component `ref`. New shape:
  `{ version, files: { <path>: { sha256, component } }, components?: { <name>:
  { ref: string } } }`. Add `recordComponentRef` / `getComponentRef`. Bump
  `MANIFEST_VERSION`; tolerate the old shape (missing `components` → no refs →
  fallback).
- **`core/ref.ts`** — `resolveBranchSha(owner, repo, branch, options)`: resolve
  a branch to its current commit SHA via the GitHub API
  (`GET /repos/{owner}/{repo}/commits/{branch}` → `.sha`, or the lighter refs
  endpoint). Returns null for non-GitHub/custom registries or on failure (→
  fallback). Called once per install/update and recorded for the touched
  components.
- **`core/fetch.ts`** — add a ref-pinned fetch (`fetchAtRef(file, ref,
  options)`) that fetches from `…/{ref}/…/<path>` and runs the same
  `transform`. `BASE` and `THEIRS` both go through `transform` so all three
  inputs share the consumer's prefix/alias space.
- **`core/install.ts` / `core/plan.ts`** — the write path branches on the
  per-file decision above instead of the binary overwrite/decline. A new
  `mergeWrite(file, …)` orchestrates fetch(BASE,THEIRS) → `merge3` → write +
  report. `--force` short-circuits to the existing whole-file overwrite.

### Ref advancement (git-like)

After a file is written (overwritten or merged), the component's recorded `ref`
advances to **the version it was brought up to** (the current branch's resolved
SHA). So the next update computes `BASE` from *that* version — the user's edits
sit "on top of" the new baseline, exactly like a git merge. A file left with
unresolved `<<<` markers still works next time (markers are just lines diff3
handles), but the dev is warned to resolve them.

### Fallback (no `BASE`)

When `BASE` can't be obtained — no recorded ref (component installed before this
feature), the ref-fetch fails (offline), or a non-GitHub custom registry can't
resolve a SHA — fall back to **today's** behavior (overwrite if in the overwrite
set / `--force`, else decline) and print a one-line notice:
`can't 3-way merge <file> (no baseline ref) — re-run with --force to overwrite,
or update will record a ref for next time`. So the feature **only ever
improves** on today and never blocks.

### Reporting & exit

After an update, print a summary: *merged cleanly* (n), *merged with conflicts*
(n, list the files), *overwritten* (n, unedited), *skipped* (n). If any file has
conflict markers, warn loudly with the file list and the marker legend; in
non-interactive runs (`--yes`/CI) exit non-zero so a pipeline notices unresolved
conflicts. `update`/`add`/`apply` already surface breaking changes (added in the
addon work) — the merge summary prints alongside.

---

## Scope & flags

- **Commands:** `update` (primary), `add --overwrite`, and the addon overwrite
  paths (`apply` install-if-missing, `add <parent>/<addon>` re-install).
- **`--force`** (alias of/with the existing `--overwrite` semantics): skip the
  merge, whole-file overwrite (the escape hatch).
- **`--dry-run`:** compute and report the merge outcome (clean / would-conflict)
  per file without writing.
- Unedited tracked files and brand-new files never trigger a merge.

## Files to create / modify (representative)

- `packages/cli/src/core/merge3.ts` (+ `.spec.ts`) — NEW, pure 3-way merge.
- `packages/cli/src/core/ref.ts` (+ `.spec.ts`) — NEW, branch→SHA + ref-fetch.
- `packages/cli/src/core/manifest.ts` — per-component `ref`, version bump,
  back-compat read.
- `packages/cli/src/core/fetch.ts` — `fetchAtRef` / ref-pinned transform.
- `packages/cli/src/core/install.ts`, `core/plan.ts` — merge-aware write path,
  `--force` bypass, reporting.
- `packages/cli/src/commands/update.ts`, `add.ts`, `apply.ts` — wire the merge
  default + summary; `--force` option.
- `packages/cli/src/index.ts` — `--force` flag where missing.

## Publish impact

Changes **CLI logic** (merge path, ref handling) and the **manifest shape**
(per-component `ref`, version bump) → **npm publish required**. Add to the
pending-releases memory when it lands. (Registry data is unaffected.)

## Verification

- **Unit (`merge3`):** clean auto-merge of disjoint hunks; real conflict →
  markers + correct conflict count; both-sides-add-same / both-add-different;
  whitespace-only churn; empty/one-line files; idempotent re-merge.
- **Unit (manifest/ref):** record + read per-component ref; old-shape manifest →
  no ref (fallback); `resolveBranchSha` parses the API response / null on
  failure.
- **Integration:** `classifyComponent`/`mergeWrite` chooses skip / fast-overwrite
  / merge / fallback correctly given hash + ref state.
- **Real-CLI e2e (the gate):** install a component into the fixture app, record
  its ref; edit a **non-conflicting** line; point `THEIRS` at a newer version
  (a fixture registry edit) and `update` → assert the upstream change is present
  AND the user's edit survived, with no markers. Then edit a **conflicting**
  line and `update` → assert `<<<` markers and a non-zero exit under `--yes`.
  Verify `--force` overwrites and `--dry-run` writes nothing.
- **Back-compat:** a project with an old (ref-less) manifest updates via the
  fallback without error.

## Open decisions (call out, don't block)

- **Merge granularity:** line-based diff3 (recommended — simple, language-
  agnostic, git-familiar markers). AST-aware merging is out of scope.
- **`merge3` engine:** vendored diff3 vs a tiny zero-dep lib — decide at
  implementation; either must be self-contained (no `git` requirement) and
  produce git-style markers.
- **Ref granularity:** per-component ref (recommended — all of a component's
  files share an install ref) vs per-file. Per-component keeps the manifest
  small; revisit only if components start mixing refs.
- **Custom-registry ref resolution:** GitHub is first-class; other hosts fall
  back (no merge) until/unless a ref-resolution adapter is added.

---

## Implementation decisions (locked at implementation, 2026-06-29)

1. **BASE transport.** Resolved two ways: GitHub API branch→SHA + raw fetch at
   that SHA for remote installs; **git** (`git rev-parse` + `git show
   <ref>:<path>`) when running against the local components dir (monorepo /
   offline — where the e2e lives). Both go through `transform`. `null` (→
   fallback) for non-GitHub custom registries or any failure.
2. **diff3 engine = vendored zero-dep** line-based diff3 in `core/merge3.ts`
   (git-style markers). No new npm dependency.
3. **One overwrite flag.** Reuse the existing **`--overwrite`** as the single
   whole-file-overwrite bypass and add it to `update`. The spec's `--force`
   wording is superseded — keeping two flags for the same behavior is confusing.
   (`migrate --force` = "dirty tree" is unrelated and unchanged.)
4. **Explicit override = clobber + advance ref.** An explicit override —
   the `--overwrite` flag OR an interactive "overwrite" selection
   (`InstallInput.forceOverwrite`) — overwrites the file whole and advances the
   ref. The no-baseline **warn-and-skip** fallback applies ONLY to an edited
   file with no recorded baseline AND no explicit override; it does **not**
   advance the ref (recording a ref a file isn't actually at would be lying).
   Write-set authorization (the `overwrite` array) is separate from clobber
   intent: `update`'s programmatic write set 3-way merges, it does not clobber.
5. **Ref advancement is component-level and conservative.** Because the ref is
   per-component but outcomes are per-file, a component's ref advances only when
   at least one file was written and **none** fell back (`shouldAdvanceRef`).
   Otherwise a fell-back file would sit under a ref it isn't at, and a later
   update would compute its BASE at the wrong ref. (Per-file refs would lift
   this — see the ref-granularity open decision; deferred to keep the lock-file
   small.)

## Completion Log

Per-task review-gate results (bar ≥95, project policy). Highest score per task.

| Task | Description | Completed | Score | Rationale |
| ---- | ----------- | --------- | ----- | --------- |
| 1 | `core/merge3.ts` — vendored pure line-based diff3 (+19 unit tests) | 2026-06-29 | 96 | Correct, self-contained diff3; empirically lossless on adjacency, interleaving, delete-vs-edit, LCS-ambiguous, co-located insertions, empty/one-line/no-trailing-newline, idempotent re-merge. Eslint/sonarjs clean, readonly, no `any`. Caught & fixed a false-conflict bug on adjacent disjoint edits before it shipped. |
| 2 | `core/ref.ts` — branch→ref + ref-pinned BASE fetch (git local / GitHub remote); `transformSource` extraction; `getRepoSlug` (+15 tests) | 2026-06-29 | 96 | Local/remote detection matches the locked decision; all custom-registry + failure paths → null without throwing; remote fetch pins the ref URL. Caught & fixed an execa trailing-newline-strip bug (would inject phantom EOF hunks); fix + the execa contract it relies on are both test-guarded. |
| 3 | `core/manifest.ts` — per-component `ref`, `MANIFEST_VERSION`→2, back-compat read (+8 tests) | 2026-06-29 | 97 | Purely additive `components?` field; all 9 `Manifest` consumers still compile; refs round-trip write→read; old ref-less manifest reads clean to undefined; `components` omitted when empty, sorted when present. |
| 4 | merge write-path: `core/merge.ts` (`classifyMerge`/`mergeWriteFile`/`shouldAdvanceRef`/`MergeReport`) + `install.ts` integration (+ tests) | 2026-06-29 | 96 | Decision tree correct vs all locked decisions; explicit override (flag/interactive) clobbers + advances ref; no-baseline fallback warns + skips without advancing; conservative component-level ref advancement fixes the per-file/per-component hazard (caught at review 93, fixed via `shouldAdvanceRef`); BASE fetched only for a real merge; edits never silently lost. |
| 5 | command wiring + reporting: `update` merge-default + `--overwrite`, `add` `forceOverwrite`, pristine lib refresh, merge summary + non-zero exit on conflicts (+ helpers + tests) | 2026-06-29 | 96 | `update` drops blanket overwrite → edited files 3-way merge (write set stays bounded), `--overwrite` clobbers; `add` explicit selection clobbers only the chosen set; pristine libs refresh while edited libs are preserved; non-zero exit gated on conflicts + `--yes`; summary helpers unit-tested. |
| 6 | real-CLI e2e gate: `e2e/cli-specs/merge-update.ts` (+ `CLI_SPECS` registration) | 2026-06-29 | 96 | Drives the built CLI against the fixture; BASE=`git show HEAD`, THEIRS=temporarily-mutated working tree (restored in `finally`, verified byte-identical). All 5 gate items load-bearing: clean merge (edit survives + upstream applied + no markers + exit 0), conflict (full `<<</===/>>>` markers + non-zero exit under `--yes`), `--overwrite` clobbers, `--dry-run` writes nothing, ref-less manifest → keep-and-warn fallback. `npm run e2e -- merge-update` → 1/1, git clean. |
