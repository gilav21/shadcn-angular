# CLI: safe `update`, `migrate` command, and edit detection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the CLI from breaking a consumer's app on upgrade — bound `update`'s write set, make `--dry-run` truthful, add an install manifest for exact "you edited this" detection, and add a `migrate` command that converts a legacy single-file install to the folder/trio layout (rewriting imports project-wide) and guarantees a building tree.

**Architecture:** Three sequenced phases over `packages/cli`. Phase 1 adds a shared **layout-detection** module and fixes `update`/`--dry-run` (the urgent breakage). Phase 2 adds the **`components.lock.json` manifest** and wires it into every write path + `doctor`. Phase 3 adds the **`migrate`** command on top: a pure **import-rewrite** transform, a **migrate-core** planner/executor, the command wiring, and integration/e2e tests. Each phase ends green and committable.

**Tech Stack:** TypeScript (ESM, `.js` import suffixes), commander, fs-extra, chalk, ora, prompts, Vitest (`*.spec.ts` co-located in `src`), the `e2e/cli-specs/` black-box harness, Playwright e2e for the final `ng build` smoke.

**Spec:** `docs/superpowers/specs/2026-06-05-cli-migrate-and-edit-detection-design.md`

---

## Completion Log

| Phase / Task | Completed | Score | Rationale |
|---|---|---|---|
| Phase 1 (Tasks 1–3): layout detection + bounded update + dry-run + legacy guard | 2026-06-05 | 95 | Bounded write set proven structurally (`precomputedConflicts` skips dependency re-resolution; `options.overwrite` never forced), so the "Updated 16" blast radius is impossible; closure-wide legacy guard + newly-required-deps consent split both exercised by the `update-guards` cli-spec. `update()` complexity <15 after helper extraction; 9 unit tests + `update-bounded`/`update-guards` cli-specs green. Cosmetic nit: dry-run omits a "skipped" line. |
| Phase 2 (Tasks 4–7): manifest + edit-aware doctor + update warning | 2026-06-05 | 95 | `components.lock.json` hashes through `normalizeContent` (CRLF/LF-safe); two axes correct (local-vs-manifest = edited, manifest-vs-registry = update available); `readManifest` never throws on missing/corrupt. `performInstall` records component+peer writes; pure-skip correctly writes nothing. `classifyDrift`/`worstLocalStatus`/`customizedAmong` correct, non-blocking warning per spec. 203 unit tests + cli-specs green, complexity <15. Cosmetic nits: no manifest version-migration hook; `trim()` in hash (symmetric). |
| Phase 3 (Tasks 8–14): migrate command | 2026-06-05 | 93 | End-to-end flow correct (scan→plan→git-guard→customized-block→dry-run→execute); write set provably bounded to `closure(installed)`; legacy flat files deleted + dropped from manifest. The compile-smoke gate (real production `ng build`) caught a build-breaking bug — `rewriteProjectImports` rewrote the component's own barrel `export * from './button.component'`; fixed by skipping the ui dir, with a regression test. 222 unit tests + migrate/migrate-build cli-specs green; complexity <15. Documented limitation: no-manifest legacy consumers aren't flagged via the spec-C2 remote-compare heuristic — the clean-git guard + "review with git diff" report is the backstop. `--dry-run` made a safe non-blocking preview. |
| Phase 4 Tasks 17–18: Bug 1 historical-hash baseline | 2026-06-06 | 94→fixed | Reviewer confirmed the load-bearing direction is sound — `neutralizePrefix` mirrors `applyPrefixTransforms` token-for-token while preserving the selector segment, so a real rename survives into the hash and a false-"pristine" (data-loss) collapse is structurally impossible; per-name comparison rules out cross-component collisions; `@@`-sentinels can't occur in selectors/import paths; alias `replaceAll` is substring-safe (`@/lib`≠`@/library/`). Closed-loop test ran non-vacuously on a real `button` blob (default + custom prefix), ruling out stale-dist divergence. Sole ding (score 94): the spec's "never throws" wasn't self-contained — a regex-metachar prefix could throw via `new RegExp`. **Fixed post-gate:** `isPristine` now try/catches → conservative `false`, with a regression test (10 baseline tests green). |
| Phase 4 Tasks 15–16: Bug 2 (missing peerFiles) + Bug 3 (cross-component imports) | 2026-06-06 | 95 | Fresh-context reviewer empirically confirmed the Bug 2 regression (reverting `plan.ts:63` to `=== 'changed'` fails the test; `'missing' \|\| 'changed'` passes; identical-peer behavior preserved) and traced Bug 3's scope-safety via `pointsAtUiComponent` — barrel `./button.component` → `ui/button/button.component` (preserved), sibling `../button.component` → `ui/button.component` (rewritten), same-named consumer file untouched. 13 tests + `tsc --noEmit` clean; unused `skip`/`SKIP_DIRS` args fully removed. Nit addressed post-gate: Bug 2 test now asserts all five peer directives. |
| Consumer-safety hardening (4 adversarial review rounds) | 2026-06-06 | — | Paranoid "break a real consumer app" reviews drove fixes: (1) BLOCKER — import-rewrite now scope-aware (only specifiers resolving to `<uiDir>/<name>.component` via alias or relative path), so a consumer's own `foo/card.component` sharing a library name is never corrupted; (2) migrate writes `closure(structural)` (legacy + the deps they need) so no new-API-on-stale-dep skew, leaving unrelated folder components untouched; (3) deletion limited to `.component.{ts,html,css}` (never consumer spec/stories); (4) `update` refreshes shared lib files for its bounded set; (5) partial-failure safety — roll back orphan new folders + finalize a component only when it AND its in-writeSet deps are present (closureWritten, unit-tested), so a mid-stream failure leaves a working tree; (6) `--force`-on-dirty warns of no git backstop; non-fatal lockfile write; git guard scoped to cwd. 231 unit tests + 12/12 CLI e2e (incl. prod-build, add-all-smoke, migrate-build) green. |

---

## File-structure map

**New files**
- `packages/cli/src/core/layout.ts` — layout detection (folderized?, legacy/new entry, `detectLayout`, `scanLayouts`). Shared by `update`, `doctor`, `migrate`.
- `packages/cli/src/core/layout.spec.ts`
- `packages/cli/src/core/manifest.ts` — `components.lock.json` read/write, hashing, status compare.
- `packages/cli/src/core/manifest.spec.ts`
- `packages/cli/src/core/import-rewrite.ts` — pure import-specifier rewrite.
- `packages/cli/src/core/import-rewrite.spec.ts`
- `packages/cli/src/core/migrate-core.ts` — migration planner + executor.
- `packages/cli/src/core/migrate-core.spec.ts`
- `packages/cli/src/commands/migrate.ts` — the command (I/O, guards, report).
- `e2e/cli-specs/update-bounded.ts` — regression spec for Phase 1.
- `e2e/cli-specs/migrate.ts` — black-box spec for Phase 3.

**Modified files**
- `packages/cli/src/commands/update.ts` — bounded write set, truthful dry-run, legacy guard, (Phase 2) manifest write + customized warnings.
- `packages/cli/src/core/install.ts` — record written files into the manifest.
- `packages/cli/src/commands/doctor.ts` — manifest-aware sections + legacy section.
- `packages/cli/src/index.ts` — register the `migrate` command.

---

# Phase 1 — Layout detection + safe `update` / `--dry-run`

## Task 1: Layout-detection module

**Files:**
- Create: `packages/cli/src/core/layout.ts`
- Test: `packages/cli/src/core/layout.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/cli/src/core/layout.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { isFolderized, newEntryFile, legacyEntryFile, detectLayout } from './layout.js';

vi.mock('fs-extra', () => ({ default: { pathExists: vi.fn() } }));
const exists = fs.pathExists as unknown as ReturnType<typeof vi.fn>;

describe('layout helpers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('classifies folderized vs flat registry entries', () => {
    expect(isFolderized('button')).toBe(true);        // files: button/...
    expect(isFolderized('ripple')).toBe(false);       // ripple.directive.ts (flat)
    expect(newEntryFile('button')).toBe('button/button.component.ts');
    expect(legacyEntryFile('button')).toBe('button.component.ts');
    expect(newEntryFile('ripple')).toBeNull();
    expect(legacyEntryFile('ripple')).toBeNull();
  });

  it('detects legacy when flat file exists and folder does not', async () => {
    exists.mockImplementation(async (p: string) =>
      p.endsWith('button.component.ts') && !p.includes(`button${'/'}button`));
    expect(await detectLayout('button', '/ui')).toBe('legacy');
  });

  it('detects new when folder entry exists', async () => {
    exists.mockImplementation(async (p: string) => p.includes('button/button.component.ts'));
    expect(await detectLayout('button', '/ui')).toBe('new');
  });

  it('detects absent when neither exists', async () => {
    exists.mockResolvedValue(false);
    expect(await detectLayout('button', '/ui')).toBe('absent');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run src/core/layout.spec.ts`
Expected: FAIL — `Cannot find module './layout.js'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/cli/src/core/layout.ts
import fs from 'fs-extra';
import path from 'node:path';
import { registry, getComponentNames, type ComponentName } from '../registry/index.js';

export type InstallLayout = 'new' | 'legacy' | 'absent';

/** True when a component's registry files live under a `<name>/` folder. */
export function isFolderized(name: ComponentName): boolean {
    return registry[name].files.some(f => f.startsWith(`${name}/`));
}

/** New-layout entry file (`<name>/<name>.component.ts`), or null when flat. */
export function newEntryFile(name: ComponentName): string | null {
    return isFolderized(name) ? `${name}/${name}.component.ts` : null;
}

/** Legacy flat entry candidate (`<name>.component.ts`), or null when flat. */
export function legacyEntryFile(name: ComponentName): string | null {
    return isFolderized(name) ? `${name}.component.ts` : null;
}

/** Classify how (or whether) a component is installed under `uiDir`. */
export async function detectLayout(name: ComponentName, uiDir: string): Promise<InstallLayout> {
    const newEntry = newEntryFile(name);
    if (!newEntry) {
        const flat = registry[name].files[0];
        return await fs.pathExists(path.join(uiDir, flat)) ? 'new' : 'absent';
    }
    if (await fs.pathExists(path.join(uiDir, newEntry))) return 'new';
    const legacy = legacyEntryFile(name);
    if (legacy && await fs.pathExists(path.join(uiDir, legacy))) return 'legacy';
    return 'absent';
}

export interface LayoutScan {
    /** Folderized components installed in flat (legacy) form. */
    legacy: ComponentName[];
    /** Components installed in the current (folder) form. */
    current: ComponentName[];
}

/** Scan every registry component's install layout under `uiDir`. */
export async function scanLayouts(uiDir: string): Promise<LayoutScan> {
    const legacy: ComponentName[] = [];
    const current: ComponentName[] = [];
    for (const name of getComponentNames()) {
        const layout = await detectLayout(name, uiDir);
        if (layout === 'legacy') legacy.push(name);
        else if (layout === 'new') current.push(name);
    }
    return { legacy, current };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/cli && npx vitest run src/core/layout.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/core/layout.ts packages/cli/src/core/layout.spec.ts
git commit -m "feat(cli): add layout-detection module (legacy vs folder install)"
```

---

## Task 2: Bound `update`'s write set + truthful `--dry-run` + legacy guard

**Files:**
- Modify: `packages/cli/src/commands/update.ts` (full rewrite of the `update` function; keep `resolveUpdateTargets`)
- Test: `packages/cli/src/commands/update.spec.ts` (extend)

Behavior (per spec A1/A2 and the `migrate` handoff):
1. If any update target is installed in **legacy** layout → abort, point at `migrate`.
2. Compute the dependency closure of the targets; partition into `alreadyInstalled` (target or already in folder form) and `newlyRequired` (a dep the new version needs that isn't installed).
3. If `newlyRequired` is non-empty and `--yes` was not passed → print them and **abort** (writing the target without them would break the build).
4. Otherwise the **universe** = targets ∪ alreadyInstalled-deps (∪ newlyRequired when `--yes`). Detect conflicts over exactly that universe and pass it to `performInstall` as `precomputedConflicts` with `overwrite = universe` and **without** `options.overwrite` — so nothing outside the universe is ever touched.
5. `--dry-run` prints the exact created/modified/skipped set + the newly-required note, and writes nothing.

- [ ] **Step 1: Write the failing tests**

Add to `packages/cli/src/commands/update.spec.ts`:

```ts
import { partitionClosure } from './update.js';

describe('partitionClosure', () => {
  it('splits a closure into already-installed vs newly-required', () => {
    const res = partitionClosure(
      ['data-table'],                       // targets
      new Set(['button', 'data-table']),    // installed (folder form)
      new Set(['data-table', 'button', 'context-menu']), // closure
    );
    expect(res.alreadyInstalled.sort()).toEqual(['button', 'data-table']);
    expect(res.newlyRequired).toEqual(['context-menu']);
  });

  it('treats every closure member as already-installed when all present', () => {
    const res = partitionClosure(['button'], new Set(['button', 'ripple']), new Set(['button', 'ripple']));
    expect(res.newlyRequired).toEqual([]);
    expect(res.alreadyInstalled.sort()).toEqual(['button', 'ripple']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run src/commands/update.spec.ts`
Expected: FAIL — `partitionClosure` is not exported.

- [ ] **Step 3: Rewrite `update.ts`**

```ts
// packages/cli/src/commands/update.ts
import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig, getPrefix, type Config } from '../utils/config.js';
import { registry, getComponentNames, isComponentName, type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { resolveDependencies } from '../core/resolve.js';
import { detectConflicts, type AddOptions } from '../core/plan.js';
import { performInstall } from '../core/install.js';
import { scanLayouts } from '../core/layout.js';

export async function resolveUpdateTargets(
    names: string[], cwd: string, config: Config,
): Promise<ComponentName[]> {
    if (names.length > 0) {
        const invalid = names.filter(n => !isComponentName(n));
        if (invalid.length) throw new Error(`Unknown component(s): ${invalid.join(', ')}`);
        return names as ComponentName[];
    }
    const targetDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
    const installed: ComponentName[] = [];
    for (const name of getComponentNames()) {
        if (await fs.pathExists(path.join(targetDir, registry[name].files[0]))) installed.push(name);
    }
    return installed;
}

export interface ClosurePartition {
    alreadyInstalled: ComponentName[];
    newlyRequired: ComponentName[];
}

/** Split a dependency closure into already-installed vs newly-required deps. */
export function partitionClosure(
    targets: ComponentName[], installed: Set<ComponentName>, closure: Set<ComponentName>,
): ClosurePartition {
    const targetSet = new Set(targets);
    const alreadyInstalled: ComponentName[] = [];
    const newlyRequired: ComponentName[] = [];
    for (const name of closure) {
        if (targetSet.has(name) || installed.has(name)) alreadyInstalled.push(name);
        else newlyRequired.push(name);
    }
    return { alreadyInstalled, newlyRequired };
}

function abortConfig(): never {
    console.log(chalk.red('Error: components.json not found.'));
    console.log(chalk.dim('Run `npx @gilav21/shadcn-angular init` first.'));
    process.exit(1);
}

export async function update(names: string[], options: AddOptions): Promise<void> {
    const cwd = process.cwd();
    const config = await getConfig(cwd);
    if (!config) abortConfig();
    if (!options.registry && config.registry) options.registry = config.registry;

    const targetDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
    const utilsAlias = config.aliases.utils;
    const prefix = getPrefix(config);

    const scan = await scanLayouts(targetDir);

    let targets: ComponentName[];
    try {
        targets = await resolveUpdateTargets(names, cwd, config);
    } catch (e: unknown) {
        console.log(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
    }

    const legacyTargets = targets.filter(t => scan.legacy.includes(t));
    if (legacyTargets.length > 0) {
        console.log(chalk.yellow('\nThis project uses the legacy single-file component layout.'));
        console.log(chalk.yellow(`Affected: ${legacyTargets.join(', ')}`));
        console.log(chalk.dim('`update` cannot safely patch the new folder layout in place.'));
        console.log(chalk.dim('Run `npx @gilav21/shadcn-angular migrate` first.'));
        process.exit(1);
    }

    if (targets.length === 0) {
        console.log(chalk.dim('No installed components to update.'));
        return;
    }

    const installedSet = new Set<ComponentName>([...scan.current, ...targets]);
    const closure = resolveDependencies(targets);
    const { alreadyInstalled, newlyRequired } = partitionClosure(targets, installedSet, closure);

    if (newlyRequired.length > 0 && !options.yes) {
        console.log(chalk.yellow(`\nThese updates require new dependencies not yet installed:`));
        for (const n of newlyRequired) console.log(chalk.yellow('  + ') + n);
        console.log(chalk.dim('\nRe-run with --yes to install them (skipping would break the build).'));
        process.exit(1);
    }

    const universe = new Set<ComponentName>([...alreadyInstalled, ...(options.yes ? newlyRequired : [])]);

    const spinner = ora('Checking for updates...').start();
    const conflicts = await detectConflicts(universe, targetDir, options, utilsAlias, prefix);
    spinner.stop();

    const created = conflicts.toInstall;
    const modified = conflicts.conflicting;
    if (created.length === 0 && modified.length === 0) {
        console.log(chalk.green('Everything is up to date.'));
        return;
    }

    console.log(chalk.bold(`\nUpdate plan:`));
    for (const n of modified) console.log(chalk.yellow('  ~ ') + n + chalk.dim(' (modified)'));
    for (const n of created) console.log(chalk.green('  + ') + n + chalk.dim(' (new dependency)'));

    if (options.dryRun) {
        console.log(chalk.dim('\n[Dry Run] No changes written.'));
        return;
    }

    const result = await performInstall({
        components: [...universe],
        overwrite: [...universe],
        cwd, config,
        options,
        precomputedConflicts: conflicts,
    });
    console.log(chalk.green(`\nUpdated ${result.installed.length} component(s).`));
    for (const w of result.warnings) console.log(chalk.yellow('  ' + w));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && npx vitest run src/commands/update.spec.ts`
Expected: PASS (existing `resolveUpdateTargets` tests + new `partitionClosure` tests).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/update.ts packages/cli/src/commands/update.spec.ts
git commit -m "fix(cli): bound update write set, truthful dry-run, legacy-layout guard"
```

---

## Task 3: Regression cli-spec — `update` blast radius + dry-run accuracy

**Files:**
- Create: `e2e/cli-specs/update-bounded.ts`
- Check: `e2e/cli-specs/_types.ts` (the `CliSpec` interface — already provides `runCli`/`captureCli`/`fixtureApp`)

This is the black-box gate proving bugs 1 + 2 fixed. It runs against the fixture app like `list-and-diff.ts`.

- [ ] **Step 1: Write the spec**

```ts
// e2e/cli-specs/update-bounded.ts
import fs from 'node:fs';
import path from 'node:path';
import { assertContains, assertNotContains, type CliSpec } from './_types.js';

/**
 * Proves the two `update` regressions are fixed:
 *  - `update <name>` only touches the named component + already-installed
 *    deps, NOT the full transitive closure.
 *  - `--dry-run` reports the same set the real run would write.
 */
const spec: CliSpec = async ({ runCli, captureCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    await runCli(['add', 'button', '--yes']);

    const uiDir = path.join(fixtureApp, 'src', 'components', 'ui');
    const before = new Set(fs.readdirSync(uiDir));

    // Modify the local button so update has something to write.
    const buttonTs = path.join(uiDir, 'button', 'button.component.ts');
    fs.appendFileSync(buttonTs, '\n// local drift\n');

    // Dry-run must mention button and write nothing.
    const dry = await captureCli(['update', 'button', '--dry-run']);
    assertContains(dry.stdout, 'button', 'dry-run should list the component it would update');
    assertContains(dry.stdout, 'Dry Run', 'dry-run must announce itself');
    const afterDry = new Set(fs.readdirSync(uiDir));
    if (afterDry.size !== before.size) {
        throw new Error('dry-run must not create or remove any files');
    }

    // Real run: only button (+ its installed dep ripple) — never a wide closure.
    const run = await captureCli(['update', 'button', '--yes']);
    assertContains(run.stdout, 'Updated', 'update should report completion');
    const afterRun = fs.readdirSync(uiDir);
    // No unrelated component folder (e.g. dialog/select/calendar) should appear.
    for (const stray of ['dialog', 'select', 'calendar', 'command', 'popover']) {
        if (afterRun.includes(stray)) {
            throw new Error(`update button must not install unrelated component "${stray}"`);
        }
    }
    assertNotContains(run.stdout, 'Updated 16', 'update must not fan out to the full closure');
};

export default spec;
```

- [ ] **Step 2: Verify the cli-spec is auto-discovered**

Run: `npm run e2e:cli -- update-bounded` (or the repo's cli-spec runner — confirm the exact script in `package.json`; `list-and-diff.ts` is the sibling reference).
Expected: the spec runs and PASSES against current Phase-1 code.

> If no `e2e:cli` script exists, find how `list-and-diff.ts` is invoked (grep `cli-specs` in `e2e/` and root `package.json`) and use that runner. Do not invent a new harness.

- [ ] **Step 3: Commit**

```bash
git add e2e/cli-specs/update-bounded.ts
git commit -m "test(cli): regression spec for bounded update + dry-run accuracy"
```

---

# Phase 2 — Install manifest + edit-aware `doctor`

## Task 4: Manifest module

**Files:**
- Create: `packages/cli/src/core/manifest.ts`
- Test: `packages/cli/src/core/manifest.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/cli/src/core/manifest.spec.ts
import { describe, it, expect } from 'vitest';
import {
  emptyManifest, recordFile, removeFiles, fileStatus, hashContent,
} from './manifest.js';

describe('manifest', () => {
  it('hashes content ignoring CRLF/LF differences', () => {
    expect(hashContent('a\r\nb')).toBe(hashContent('a\nb'));
  });

  it('records a file then reports it clean for identical content', () => {
    const m = emptyManifest();
    recordFile(m, 'button/button.component.ts', 'export const x = 1;', 'button');
    expect(fileStatus(m, 'button/button.component.ts', 'export const x = 1;')).toBe('clean');
  });

  it('reports modified when local content drifts from the recorded hash', () => {
    const m = emptyManifest();
    recordFile(m, 'button/button.component.ts', 'original', 'button');
    expect(fileStatus(m, 'button/button.component.ts', 'edited')).toBe('modified');
  });

  it('reports untracked when the file is not in the manifest', () => {
    expect(fileStatus(emptyManifest(), 'x.ts', 'whatever')).toBe('untracked');
  });

  it('removeFiles drops entries', () => {
    const m = emptyManifest();
    recordFile(m, 'a.ts', '1', 'a');
    removeFiles(m, ['a.ts']);
    expect(fileStatus(m, 'a.ts', '1')).toBe('untracked');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run src/core/manifest.spec.ts`
Expected: FAIL — `Cannot find module './manifest.js'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/cli/src/core/manifest.ts
import fs from 'fs-extra';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { normalizeContent } from './fetch.js';

export const MANIFEST_FILENAME = 'components.lock.json';
export const MANIFEST_VERSION = 1;

export interface ManifestEntry {
    sha256: string;
    component: string;
}
export interface Manifest {
    version: number;
    files: Record<string, ManifestEntry>;
}
export type FileStatus = 'clean' | 'modified' | 'untracked';

/** Hash normalized (LF) content so line-ending churn never reads as an edit. */
export function hashContent(content: string): string {
    return createHash('sha256').update(normalizeContent(content), 'utf8').digest('hex');
}

export function emptyManifest(): Manifest {
    return { version: MANIFEST_VERSION, files: {} };
}

export async function readManifest(cwd: string): Promise<Manifest> {
    const p = path.join(cwd, MANIFEST_FILENAME);
    if (!await fs.pathExists(p)) return emptyManifest();
    try {
        const data = await fs.readJson(p) as Partial<Manifest>;
        if (!data || typeof data.files !== 'object' || data.files === null) return emptyManifest();
        return { version: data.version ?? MANIFEST_VERSION, files: data.files as Record<string, ManifestEntry> };
    } catch {
        return emptyManifest();
    }
}

export async function writeManifest(cwd: string, manifest: Manifest): Promise<void> {
    const sorted = Object.fromEntries(
        Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b)),
    );
    await fs.writeJson(path.join(cwd, MANIFEST_FILENAME), { version: MANIFEST_VERSION, files: sorted }, { spaces: 2 });
}

export function recordFile(manifest: Manifest, file: string, content: string, component: string): void {
    manifest.files[file] = { sha256: hashContent(content), component };
}

export function removeFiles(manifest: Manifest, files: string[]): void {
    for (const f of files) delete manifest.files[f];
}

/** Compare a local file against the recorded baseline. */
export function fileStatus(manifest: Manifest, file: string, localContent: string): FileStatus {
    const entry = manifest.files[file];
    if (!entry) return 'untracked';
    return entry.sha256 === hashContent(localContent) ? 'clean' : 'modified';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/cli && npx vitest run src/core/manifest.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/core/manifest.ts packages/cli/src/core/manifest.spec.ts
git commit -m "feat(cli): components.lock.json manifest module (hash baseline)"
```

---

## Task 5: Record written files into the manifest from `performInstall`

**Files:**
- Modify: `packages/cli/src/core/install.ts`
- Test: `packages/cli/src/core/install.spec.ts` (extend — confirm a manifest is written after install)

Thread a `Manifest` through the write helpers and persist it once at the end of `performInstall`.

- [ ] **Step 1: Write the failing test**

Add to `packages/cli/src/core/install.spec.ts` (follow the file's existing setup/mocks; the assertion is that after `performInstall` the manifest file exists with a hash entry for each written component file). If the existing spec uses a temp dir, reuse that pattern; otherwise add:

```ts
import { readManifest } from './manifest.js';
// ... within an existing temp-dir install test, after performInstall(...):
const manifest = await readManifest(tmpCwd);
expect(Object.keys(manifest.files).length).toBeGreaterThan(0);
expect(Object.values(manifest.files)[0]).toHaveProperty('sha256');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run src/core/install.spec.ts`
Expected: FAIL — manifest file absent / `files` empty.

- [ ] **Step 3: Edit `install.ts`**

Add the import:

```ts
import { readManifest, writeManifest, recordFile, removeFiles, type Manifest } from './manifest.js';
```

Change `writeComponentFiles` and `writePeerFiles` to accept a `manifest` + `name` and record each successful write. Update their signatures and call sites; in `writeComponentFiles`:

```ts
async function writeComponentFiles(
    component: ComponentDefinition, targetDir: string, options: AddOptions,
    utilsAlias: string, contentCache: Map<string, string>, prefix: string, warnings: string[],
    manifest: Manifest, kind: SourceKind = 'component',
): Promise<boolean> {
    let success = true;
    for (const file of component.files) {
        const targetPath = path.join(targetDir, file);
        try {
            const content = contentCache.get(file) ?? await fetchAndTransform(file, options, utilsAlias, prefix, kind);
            await fs.ensureDir(path.dirname(targetPath));
            await fs.writeFile(targetPath, content);
            recordFile(manifest, file, content, component.name);
        } catch (err: unknown) {
            warnings.push(`Could not add ${file}: ${err instanceof Error ? err.message : String(err)}`);
            success = false;
        }
    }
    return success;
}
```

Apply the same `recordFile(manifest, file, content, component.name)` after the successful `fs.writeFile` in `writePeerFiles` (signature gains `manifest`). Then in `performInstall`, load and persist the manifest:

```ts
export async function performInstall(input: InstallInput): Promise<InstallResult> {
    const warnings: string[] = [];
    const targetDir = resolveTargetDir(input);
    const utilsAlias = input.config.aliases.utils;
    const prefix = getPrefix(input.config);
    const overwriteSet = new Set(input.overwrite ?? []);
    const manifest = await readManifest(input.cwd);   // <-- load baseline

    // ... unchanged conflict/declined/finalComponents logic ...

    if (finalComponents.length === 0) {
        return { installed: [], skipped: result.toSkip, declined, warnings };
    }

    // ... in the write loop, pass `manifest`:
    const ok = await writeComponentFiles(component, dir, input.options, utilsAlias, result.contentCache, prefix, warnings, manifest, kind);
    await writePeerFiles(component, dir, input.options, utilsAlias, result.contentCache, result.peerFilesToUpdate, prefix, warnings, manifest, kind);

    // ... after libFiles/npm/shortcut steps:
    await writeManifest(input.cwd, manifest);
    return { installed, skipped: result.toSkip, declined, warnings };
}
```

> `component.name` is a `string` on `ComponentDefinition`; `recordFile`'s `component` param is `string`, so no cast needed. `removeFiles` is imported now for Phase 3 reuse — if the linter flags it unused in this task, add it in Task 11 instead. Prefer leaving it out here to satisfy `noUnusedLocals`; import only `readManifest, writeManifest, recordFile, type Manifest`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && npx vitest run src/core/install.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/core/install.ts packages/cli/src/core/install.spec.ts
git commit -m "feat(cli): write components.lock.json on install"
```

---

## Task 6: Edit-aware `doctor` (manifest split + legacy section)

**Files:**
- Modify: `packages/cli/src/commands/doctor.ts`
- Test: `packages/cli/src/commands/doctor.spec.ts` (extend)

Split the single "Modified locally (drift)" into two precise verdicts using the manifest, and add a legacy-layout section.

- [ ] **Step 1: Write the failing test**

Add to `packages/cli/src/commands/doctor.spec.ts` a test for the new pure classifier `classifyDrift` (extracted so it's unit-testable without I/O):

```ts
import { classifyDrift } from './doctor.js';

describe('classifyDrift', () => {
  it('flags user-edited when local differs from manifest baseline', () => {
    // manifest says hash(A); local is A (clean) vs B (edited)
    const out = classifyDrift(
      ['button'],                                  // components that differ from registry
      { button: 'modified' },                      // local-vs-manifest status per component
    );
    expect(out.userEdited).toEqual(['button']);
    expect(out.updateAvailable).toEqual([]);
  });

  it('flags update-available when local matches manifest but registry moved on', () => {
    const out = classifyDrift(['button'], { button: 'clean' });
    expect(out.updateAvailable).toEqual(['button']);
    expect(out.userEdited).toEqual([]);
  });

  it('treats untracked (no manifest) drift as update-available', () => {
    const out = classifyDrift(['button'], { button: 'untracked' });
    expect(out.updateAvailable).toEqual(['button']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run src/commands/doctor.spec.ts`
Expected: FAIL — `classifyDrift` not exported.

- [ ] **Step 3: Edit `doctor.ts`**

Add imports and the pure classifier; extend the report + printing. Add:

```ts
import { readManifest, fileStatus, type FileStatus } from '../core/manifest.js';
import { scanLayouts } from '../core/layout.js';

export interface DriftSplit {
    userEdited: string[];
    updateAvailable: string[];
}

/** Split components that differ from the registry into "you edited it" vs
 * "a newer version exists", using the per-component local-vs-manifest status. */
export function classifyDrift(
    differsFromRegistry: string[], localStatus: Record<string, FileStatus>,
): DriftSplit {
    const userEdited: string[] = [];
    const updateAvailable: string[] = [];
    for (const name of differsFromRegistry) {
        if (localStatus[name] === 'modified') userEdited.push(name);
        else updateAvailable.push(name);
    }
    return { userEdited, updateAvailable };
}
```

In `collectDoctorReport`, after computing `modified` (differs from registry), compute each component's worst local-vs-manifest status across its files, then `classifyDrift`. Extend `DoctorReport` with `userEdited`, `updateAvailable`, and `legacy: string[]` (from `scanLayouts(targetDir).legacy`). In `doctor`, replace the single drift section with:

```ts
printSection('Locally modified (your edits — back them up before update):', report.userEdited, chalk.yellow);
printSection('Update available (newer registry version):', report.updateAvailable, chalk.cyan);
printSection('Legacy single-file layout — run `migrate`:', report.legacy, chalk.magenta);
```

Compute per-component local status like:

```ts
const manifest = await readManifest(cwd);
const localStatus: Record<string, FileStatus> = {};
for (const name of modified) {
    let worst: FileStatus = 'clean';
    for (const file of registry[name].files) {
        const p = path.join(targetDir, file);
        if (!await fs.pathExists(p)) continue;
        const s = fileStatus(manifest, file, await fs.readFile(p, 'utf-8'));
        if (s === 'modified') { worst = 'modified'; break; }
        if (s === 'untracked') worst = 'untracked';
    }
    localStatus[name] = worst;
}
const { userEdited, updateAvailable } = classifyDrift(modified, localStatus);
```

Update the `ok` computation to include `legacy.length === 0`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && npx vitest run src/commands/doctor.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/doctor.ts packages/cli/src/commands/doctor.spec.ts
git commit -m "feat(cli): edit-aware doctor (split user-edits vs updates, legacy section)"
```

---

## Task 7: Warn about customized files in `update`

**Files:**
- Modify: `packages/cli/src/commands/update.ts`
- Test: `packages/cli/src/commands/update.spec.ts` (extend — pure helper)

Before overwriting, list components whose local content differs from the manifest baseline so the user knows their edits will be replaced.

- [ ] **Step 1: Write the failing test**

```ts
import { customizedAmong } from './update.js';
import { emptyManifest, recordFile } from '../core/manifest.js';

describe('customizedAmong', () => {
  it('returns components whose local content drifts from the manifest', () => {
    const m = emptyManifest();
    recordFile(m, 'button/button.component.ts', 'orig', 'button');
    const local = new Map([['button/button.component.ts', 'edited']]);
    expect(customizedAmong(['button'], m, local, (n) => [`${n}/${n}.component.ts`])).toEqual(['button']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run src/commands/update.spec.ts`
Expected: FAIL — `customizedAmong` not exported.

- [ ] **Step 3: Add the helper + wire it in**

```ts
import { fileStatus, type Manifest } from '../core/manifest.js';

/** Components (among `names`) with at least one locally-modified file vs baseline. */
export function customizedAmong(
    names: ComponentName[], manifest: Manifest,
    localContent: Map<string, string>, filesOf: (n: ComponentName) => string[],
): ComponentName[] {
    return names.filter(n =>
        filesOf(n).some(f => {
            const local = localContent.get(f);
            return local !== undefined && fileStatus(manifest, f, local) === 'modified';
        }),
    );
}
```

In `update`, after `detectConflicts`, read the manifest and the modified components' local file contents, compute `customizedAmong(modified, manifest, localMap, n => registry[n].files)`, and print a warning block listing them with "your local edits will be overwritten — review with `git diff` after updating." (Non-blocking for `update`; blocking is reserved for `migrate` per spec.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && npx vitest run src/commands/update.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/update.ts packages/cli/src/commands/update.spec.ts
git commit -m "feat(cli): update warns about locally-customized components before overwrite"
```

---

# Phase 3 — `migrate` command

## Task 8: Import-rewrite transform (pure, exhaustive)

**Files:**
- Create: `packages/cli/src/core/import-rewrite.ts`
- Test: `packages/cli/src/core/import-rewrite.spec.ts`

- [ ] **Step 1: Write the failing tests (the full negative/edge matrix from the spec)**

```ts
// packages/cli/src/core/import-rewrite.spec.ts
import { describe, it, expect } from 'vitest';
import { rewriteSpecifier, rewriteImports } from './import-rewrite.js';

const migrated = new Set(['button', 'data-table']);

describe('rewriteSpecifier', () => {
  it('rewrites alias and relative forms to the folder barrel', () => {
    expect(rewriteSpecifier('@/components/ui/button.component', migrated)).toBe('@/components/ui/button');
    expect(rewriteSpecifier('./button.component', migrated)).toBe('./button');
    expect(rewriteSpecifier('../../ui/button.component', migrated)).toBe('../../ui/button');
  });
  it('strips an explicit .ts extension', () => {
    expect(rewriteSpecifier('./button.component.ts', migrated)).toBe('./button');
  });
  it('handles multi-word component names', () => {
    expect(rewriteSpecifier('@/components/ui/data-table.component', migrated)).toBe('@/components/ui/data-table');
  });
  it('does not touch non-migrated components', () => {
    expect(rewriteSpecifier('@/components/ui/input.component', migrated)).toBeNull();
  });
  it('does not touch substring collisions', () => {
    expect(rewriteSpecifier('@/components/ui/button-group.component', migrated)).toBeNull();
    expect(rewriteSpecifier('@/components/ui/icon-button.component', migrated)).toBeNull();
  });
  it('does not match when .component is not the final segment', () => {
    expect(rewriteSpecifier('@/ui/my-button.component-helpers', migrated)).toBeNull();
  });
});

describe('rewriteImports (file-level)', () => {
  it('rewrites from-imports, preserving quote style and bindings', () => {
    const src = `import { ButtonComponent } from "@/components/ui/button.component";\n`;
    const { content, changed } = rewriteImports(src, migrated);
    expect(changed).toBe(true);
    expect(content).toBe(`import { ButtonComponent } from "@/components/ui/button";\n`);
  });
  it('rewrites export-from and dynamic import()', () => {
    const src =
      `export { X } from './button.component';\n` +
      `const m = import('./data-table.component');\n`;
    const { content } = rewriteImports(src, migrated);
    expect(content).toContain(`from './button'`);
    expect(content).toContain(`import('./data-table')`);
  });
  it('leaves comments and unrelated strings alone', () => {
    const src = `// see button.component for details\nconst s = 'button.component';\n`;
    const { content, changed } = rewriteImports(src, migrated);
    expect(changed).toBe(false);
    expect(content).toBe(src);
  });
  it('preserves CRLF line endings', () => {
    const src = `import { B } from './button.component';\r\nconst x = 1;\r\n`;
    const { content } = rewriteImports(src, migrated);
    expect(content).toBe(`import { B } from './button';\r\nconst x = 1;\r\n`);
  });
  it('is idempotent', () => {
    const once = rewriteImports(`import { B } from './button.component';`, migrated).content;
    const twice = rewriteImports(once, migrated).content;
    expect(twice).toBe(once);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run src/core/import-rewrite.spec.ts`
Expected: FAIL — `Cannot find module './import-rewrite.js'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/cli/src/core/import-rewrite.ts

/** Module-specifier matcher: `from '...'`, `import('...')`, `require('...')`. */
const SPECIFIER_RE = /(\bfrom\s*|(?:\bimport|\brequire)\s*\(\s*)(['"])([^'"]+)\2/g;

/** A specifier's final path segment is `<name>.component` (optional `.ts`). */
const SEGMENT_RE = /(^|.*\/)([^/]+)\.component$/;

/**
 * Rewrite one module specifier ending in `/<name>.component` (for a migrated
 * `<name>`) to the folder barrel `/<name>`. Returns null when unchanged.
 */
export function rewriteSpecifier(spec: string, migrated: ReadonlySet<string>): string | null {
    const noExt = spec.endsWith('.ts') ? spec.slice(0, -3) : spec;
    const m = SEGMENT_RE.exec(noExt);
    if (!m) return null;
    const name = m[2];
    if (!migrated.has(name)) return null;
    return `${m[1]}${name}`;
}

/** Rewrite every migrated import specifier in a source file. */
export function rewriteImports(
    source: string, migrated: ReadonlySet<string>,
): { content: string; changed: boolean } {
    let changed = false;
    const content = source.replaceAll(SPECIFIER_RE, (full, prefix: string, quote: string, spec: string) => {
        const next = rewriteSpecifier(spec, migrated);
        if (next === null) return full;
        changed = true;
        return `${prefix}${quote}${next}${quote}`;
    });
    return { content, changed };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/cli && npx vitest run src/core/import-rewrite.spec.ts`
Expected: PASS (all cases, including negatives, CRLF, idempotency).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/core/import-rewrite.ts packages/cli/src/core/import-rewrite.spec.ts
git commit -m "feat(cli): pure import-specifier rewrite for migrate"
```

---

## Task 9: Migrate-core — planner

**Files:**
- Create: `packages/cli/src/core/migrate-core.ts`
- Test: `packages/cli/src/core/migrate-core.spec.ts`

The planner is I/O-light: it takes a `LayoutScan` + the registry and computes the migration plan. Source-file scanning for imports is a separate, injectable function so the planner stays unit-testable.

- [ ] **Step 1: Write the failing test**

```ts
// packages/cli/src/core/migrate-core.spec.ts
import { describe, it, expect } from 'vitest';
import { planMigration } from './migrate-core.js';

describe('planMigration', () => {
  it('migrates legacy components and pulls newly-required deps', () => {
    const plan = planMigration({
      legacy: ['button', 'data-table'],
      current: ['data-table'],            // data-table already a folder (refresh)
    });
    // structural = legacy ones; data-table appears in legacy here means flat — keep as given
    expect(plan.structural).toContain('button');
    // newDeps: deps of migrated set not already installed (e.g. data-table -> context-menu)
    expect(Array.isArray(plan.newDeps)).toBe(true);
    expect(plan.migratedNames.has('button')).toBe(true);
  });

  it('returns an empty plan when nothing is legacy', () => {
    const plan = planMigration({ legacy: [], current: ['button'] });
    expect(plan.structural).toEqual([]);
    expect(plan.newDeps).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run src/core/migrate-core.spec.ts`
Expected: FAIL — `Cannot find module './migrate-core.js'`.

- [ ] **Step 3: Write the planner**

```ts
// packages/cli/src/core/migrate-core.ts
import { registry, type ComponentName } from '../registry/index.js';
import { resolveDependencies } from './resolve.js';
import { type LayoutScan } from './layout.js';

export interface MigrationPlan {
    /** Legacy (flat) components to convert to folder form. */
    structural: ComponentName[];
    /** Already-folder components whose content will be refreshed. */
    refresh: ComponentName[];
    /** Dependencies newly required by the migrated set, not yet installed. */
    newDeps: ComponentName[];
    /** All names whose imports must be rewritten project-wide. */
    migratedNames: Set<string>;
}

/** Compute the migration plan from a layout scan (pure). */
export function planMigration(scan: LayoutScan): MigrationPlan {
    const structural = [...scan.structural ?? scan.legacy];
    const installed = new Set<ComponentName>([...scan.legacy, ...scan.current]);

    // Everything we will write content for: legacy (structural) + current (refresh).
    const writeSet = new Set<ComponentName>([...scan.legacy, ...scan.current]);

    // Newly-required deps: closure of the write set minus what's installed.
    const closure = resolveDependencies([...writeSet]);
    const newDeps = [...closure].filter(n => !installed.has(n));

    const migratedNames = new Set<string>(scan.legacy);

    return {
        structural,
        refresh: [...scan.current],
        newDeps,
        migratedNames,
    };
}
```

> `scan.structural` doesn't exist on `LayoutScan`; the `?? scan.legacy` is defensive — replace the first line with `const structural = [...scan.legacy];` when typing (kept explicit here so the intent is clear). `structural` = legacy components.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/cli && npx vitest run src/core/migrate-core.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/core/migrate-core.ts packages/cli/src/core/migrate-core.spec.ts
git commit -m "feat(cli): migrate-core planner"
```

---

## Task 10: Migrate-core — project source scan + import rewrite on disk

**Files:**
- Modify: `packages/cli/src/core/migrate-core.ts`
- Test: `packages/cli/src/core/migrate-core.spec.ts` (extend with a temp-dir test)

Add `rewriteProjectImports(projectRoot, migratedNames)`: walk `*.ts`/`*.html` source files (skip `node_modules`, `dist`, `.git`), apply `rewriteImports`, write back changed files, return the list of changed file paths.

- [ ] **Step 1: Write the failing test**

```ts
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { rewriteProjectImports } from './migrate-core.js';

it('rewrites imports across project source files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mig-'));
  await fs.outputFile(path.join(dir, 'src/app.component.ts'),
    `import { B } from '@/components/ui/button.component';\n`);
  await fs.outputFile(path.join(dir, 'node_modules/x/y.ts'),
    `import { B } from '@/components/ui/button.component';\n`); // must be skipped
  const changed = await rewriteProjectImports(dir, new Set(['button']));
  expect(changed).toHaveLength(1);
  expect(await fs.readFile(path.join(dir, 'src/app.component.ts'), 'utf-8'))
    .toContain(`from '@/components/ui/button'`);
  expect(await fs.readFile(path.join(dir, 'node_modules/x/y.ts'), 'utf-8'))
    .toContain(`button.component`); // untouched
  await fs.remove(dir);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run src/core/migrate-core.spec.ts`
Expected: FAIL — `rewriteProjectImports` not exported.

- [ ] **Step 3: Implement the scanner**

```ts
// append to packages/cli/src/core/migrate-core.ts
import fs from 'fs-extra';
import path from 'node:path';
import { rewriteImports } from './import-rewrite.js';

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.angular', 'coverage']);
const SOURCE_EXT = new Set(['.ts', '.html']);

async function collectSourceFiles(root: string): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dir: string): Promise<void> => {
        for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (!SKIP_DIRS.has(entry.name)) await walk(path.join(dir, entry.name));
            } else if (SOURCE_EXT.has(path.extname(entry.name))) {
                out.push(path.join(dir, entry.name));
            }
        }
    };
    await walk(root);
    return out;
}

/** Rewrite migrated imports across all project source files; return changed paths. */
export async function rewriteProjectImports(
    projectRoot: string, migratedNames: ReadonlySet<string>,
): Promise<string[]> {
    if (migratedNames.size === 0) return [];
    const changed: string[] = [];
    for (const file of await collectSourceFiles(projectRoot)) {
        const source = await fs.readFile(file, 'utf-8');
        const result = rewriteImports(source, migratedNames);
        if (result.changed) {
            await fs.writeFile(file, result.content);
            changed.push(file);
        }
    }
    return changed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/cli && npx vitest run src/core/migrate-core.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/core/migrate-core.ts packages/cli/src/core/migrate-core.spec.ts
git commit -m "feat(cli): migrate-core project-wide import rewriter"
```

---

## Task 11: Migrate-core — delete legacy flat files + manifest update

**Files:**
- Modify: `packages/cli/src/core/migrate-core.ts`
- Test: `packages/cli/src/core/migrate-core.spec.ts` (extend)

Add `deleteLegacyFiles(uiDir, structural)`: for each migrated `<name>`, remove `<name>.component.ts` and any sibling flat `<name>.component.{html,css,spec.ts,stories.ts}` that exist; return deleted relative paths (for manifest cleanup + report).

- [ ] **Step 1: Write the failing test**

```ts
import { deleteLegacyFiles } from './migrate-core.js';

it('deletes the legacy flat files for a migrated component', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'del-'));
  await fs.outputFile(path.join(dir, 'button.component.ts'), 'x');
  await fs.outputFile(path.join(dir, 'button.component.html'), 'x');
  await fs.outputFile(path.join(dir, 'input.component.ts'), 'x'); // not migrated
  const deleted = await deleteLegacyFiles(dir, ['button']);
  expect(deleted).toContain('button.component.ts');
  expect(deleted).toContain('button.component.html');
  expect(await fs.pathExists(path.join(dir, 'button.component.ts'))).toBe(false);
  expect(await fs.pathExists(path.join(dir, 'input.component.ts'))).toBe(true);
  await fs.remove(dir);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run src/core/migrate-core.spec.ts`
Expected: FAIL — `deleteLegacyFiles` not exported.

- [ ] **Step 3: Implement**

```ts
// append to packages/cli/src/core/migrate-core.ts
const LEGACY_SUFFIXES = ['.component.ts', '.component.html', '.component.css', '.component.spec.ts', '.component.stories.ts'];

/** Remove legacy flat files for each migrated component; return deleted rel paths. */
export async function deleteLegacyFiles(
    uiDir: string, structural: ComponentName[],
): Promise<string[]> {
    const deleted: string[] = [];
    for (const name of structural) {
        for (const suffix of LEGACY_SUFFIXES) {
            const rel = `${name}${suffix}`;
            const abs = path.join(uiDir, rel);
            if (await fs.pathExists(abs)) {
                await fs.remove(abs);
                deleted.push(rel);
            }
        }
    }
    return deleted;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/cli && npx vitest run src/core/migrate-core.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/core/migrate-core.ts packages/cli/src/core/migrate-core.spec.ts
git commit -m "feat(cli): migrate-core legacy flat-file removal"
```

---

## Task 12: `migrate` command (guards, plan, execute, report)

**Files:**
- Create: `packages/cli/src/commands/migrate.ts`
- Modify: `packages/cli/src/index.ts` (register the command)
- Test: covered by the cli-spec in Task 13 (the command is I/O orchestration; pure logic is already tested in Tasks 8–11)

- [ ] **Step 1: Write the command**

```ts
// packages/cli/src/commands/migrate.ts
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig, getPrefix } from '../utils/config.js';
import { registry, type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { scanLayouts } from '../core/layout.js';
import { planMigration, rewriteProjectImports, deleteLegacyFiles } from '../core/migrate-core.js';
import { performInstall } from '../core/install.js';
import { readManifest, fileStatus, removeFiles, writeManifest } from '../core/manifest.js';
import { normalizeContent } from '../core/fetch.js';
import { type AddOptions } from '../core/plan.js';

function gitTreeClean(cwd: string): boolean {
    try {
        const out = execSync('git status --porcelain', { cwd, encoding: 'utf-8' });
        return out.trim() === '';
    } catch {
        return false; // not a git repo, or git missing → treat as "not clean"
    }
}

async function customizedComponents(
    cwd: string, uiDir: string, names: ComponentName[],
): Promise<ComponentName[]> {
    const manifest = await readManifest(cwd);
    const out: ComponentName[] = [];
    for (const name of names) {
        const legacy = `${name}.component.ts`;
        const p = path.join(uiDir, legacy);
        if (!await fs.pathExists(p)) continue;
        if (fileStatus(manifest, legacy, await fs.readFile(p, 'utf-8')) === 'modified') out.push(name);
    }
    return out;
}

export async function migrate(options: AddOptions): Promise<void> {
    const cwd = process.cwd();
    const config = await getConfig(cwd);
    if (!config) {
        console.log(chalk.red('Error: components.json not found.'));
        console.log(chalk.dim('Run `npx @gilav21/shadcn-angular init` first.'));
        process.exit(1);
    }
    if (!options.registry && config.registry) options.registry = config.registry;

    const uiDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
    const scan = await scanLayouts(uiDir);
    const plan = planMigration(scan);

    if (plan.structural.length === 0) {
        console.log(chalk.green('Nothing to migrate — no legacy single-file components found.'));
        return;
    }

    if (!options.dryRun && !gitTreeClean(cwd) && !(options as { force?: boolean }).force) {
        console.log(chalk.red('\nYour git working tree is not clean (or this is not a git repo).'));
        console.log(chalk.dim('Commit/stash first so the migration is one reviewable diff, or pass --force.'));
        process.exit(1);
    }

    const customized = await customizedComponents(cwd, uiDir, plan.structural);
    if (customized.length > 0 && !options.yes) {
        console.log(chalk.yellow('\nThese components have local edits and will be overwritten:'));
        for (const n of customized) console.log(chalk.yellow('  ~ ') + n);
        console.log(chalk.dim('\nBack them up, then re-run with --yes to proceed.'));
        process.exit(1);
    }

    console.log(chalk.bold('\nMigration plan:'));
    console.log(chalk.dim('  Convert to folder layout: ') + plan.structural.join(', '));
    if (plan.refresh.length) console.log(chalk.dim('  Refresh: ') + plan.refresh.join(', '));
    if (plan.newDeps.length) console.log(chalk.dim('  New dependencies: ') + plan.newDeps.join(', '));

    if (options.dryRun) {
        console.log(chalk.dim('\n[Dry Run] No changes written.'));
        return;
    }

    const spinner = ora('Migrating...').start();

    // 1. Write new folder/trio files for structural + refresh + newDeps.
    const writeSet = [...new Set<ComponentName>([...plan.structural, ...plan.refresh, ...plan.newDeps])];
    const result = await performInstall({
        components: writeSet,
        overwrite: writeSet,
        cwd, config, options: { ...options, overwrite: true },
    });

    // 2. Delete legacy flat files + drop them from the manifest.
    const deleted = await deleteLegacyFiles(uiDir, plan.structural);
    const manifest = await readManifest(cwd);
    removeFiles(manifest, deleted);
    await writeManifest(cwd, manifest);

    // 3. Rewrite imports project-wide.
    const rewritten = await rewriteProjectImports(cwd, plan.migratedNames);

    spinner.stop();

    console.log(chalk.green(`\nMigrated ${result.installed.length} component(s).`));
    console.log(chalk.dim(`  Deleted ${deleted.length} legacy file(s).`));
    console.log(chalk.dim(`  Rewrote imports in ${rewritten.length} file(s).`));
    if (plan.newDeps.length) console.log(chalk.dim(`  Installed deps: ${plan.newDeps.join(', ')}`));
    for (const w of result.warnings) console.log(chalk.yellow('  ' + w));
    console.log(chalk.cyan('\nNext: run `ng build` to verify, then review with `git diff`.'));
    void getPrefix; void registry; void normalizeContent; // keep imports honest; remove any genuinely unused before commit
}
```

> Before committing, delete the `void …;` line and any imports it references that you did not end up using, to satisfy `noUnusedLocals`/`noUnusedParameters` (CLAUDE.md §4). Re-add `--force` as a real boolean option type instead of the inline cast if you prefer — see Step 2.

- [ ] **Step 2: Register the command in `index.ts`**

Add the import and command block:

```ts
import { migrate } from './commands/migrate.js';

program
    .command('migrate')
    .description('Migrate legacy single-file components to the folder/trio layout')
    .option('-y, --yes', 'Overwrite locally-customized components without prompting')
    .option('--dry-run', 'Show the migration plan without writing')
    .option('--force', 'Proceed even if the git working tree is dirty / not a repo')
    .option('--remote', 'Force remote fetch from GitHub registry')
    .option('-b, --branch <branch>', 'GitHub branch to fetch from', 'master')
    .option('-r, --registry <url>', 'Custom registry base URL')
    .action(migrate);
```

> Add `force?: boolean;` to `AddOptions` in `packages/cli/src/core/plan.ts` so the command reads `options.force` without a cast; then remove the `(options as {force?: boolean})` cast in `migrate.ts`.

- [ ] **Step 3: Build the CLI to verify it compiles**

Run: `cd packages/cli && npm run build`
Expected: clean TypeScript build, no `ts(6133)` unused-symbol errors.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/migrate.ts packages/cli/src/index.ts packages/cli/src/core/plan.ts
git commit -m "feat(cli): migrate command (guarded flat->folder + import rewrite)"
```

---

## Task 13: `migrate` black-box cli-spec on a fabricated legacy fixture

**Files:**
- Create: `e2e/cli-specs/migrate.ts`

The current CLI can't *produce* legacy state, so the spec **fabricates** it: install normally, then collapse `button` into a flat `button.component.ts` and point an app file at the old path, commit, then run `migrate` and assert the end state.

- [ ] **Step 1: Write the spec**

```ts
// e2e/cli-specs/migrate.ts
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { assertContains, type CliSpec } from './_types.js';

const spec: CliSpec = async ({ runCli, captureCli, fixtureApp }) => {
    await runCli(['init', '--yes']);
    await runCli(['add', 'button', '--yes']);

    const uiDir = path.join(fixtureApp, 'src', 'components', 'ui');

    // Fabricate a legacy install: a flat button.component.ts, folder removed.
    const folder = path.join(uiDir, 'button');
    const flat = path.join(uiDir, 'button.component.ts');
    fs.writeFileSync(flat, fs.readFileSync(path.join(folder, 'button.component.ts')));
    fs.rmSync(folder, { recursive: true, force: true });

    // An app file importing the legacy path.
    const appFile = path.join(fixtureApp, 'src', 'legacy-consumer.ts');
    fs.writeFileSync(appFile, `import { ButtonComponent } from '@/components/ui/button.component';\nexport const C = ButtonComponent;\n`);

    // Clean git tree so the guard passes.
    execSync('git add -A && git -c user.email=t@t -c user.name=t commit -m fixture -q', { cwd: fixtureApp });

    const out = await captureCli(['migrate', '--yes']);
    assertContains(out.stdout, 'Migrated', 'migrate should report completion');

    // Folder restored, flat removed.
    if (!fs.existsSync(path.join(uiDir, 'button', 'button.component.ts'))) {
        throw new Error('migrate should write the folder entry');
    }
    if (fs.existsSync(flat)) throw new Error('migrate should delete the legacy flat file');

    // Import rewritten in the app file.
    const rewritten = fs.readFileSync(appFile, 'utf-8');
    assertContains(rewritten, `'@/components/ui/button'`, 'app import should point at the folder barrel');
    if (rewritten.includes('button.component')) {
        throw new Error('no legacy .component specifier should remain');
    }
};

export default spec;
```

- [ ] **Step 2: Run it**

Run: the cli-spec runner (same as Task 3) targeting `migrate`.
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/cli-specs/migrate.ts
git commit -m "test(cli): migrate black-box spec on fabricated legacy fixture"
```

---

## Task 14: End-to-end `ng build` smoke for migrate

**Files:**
- Add an e2e harness spec under `e2e/` following the existing Playwright harness pattern (`e2e/README.md`), OR extend the cli-spec from Task 13 with a real `tsc --noEmit` over the fixture app if the cli-spec harness already has the fixture installed.

The goal: prove the migrated consumer app **compiles** — the gate unit tests can't reach.

- [ ] **Step 1: Decide the cheapest real-compile gate**

Inspect `e2e/README.md` and `e2e/orchestrator/` to see whether the cli-spec fixture app can run `npx tsc --noEmit` or `ng build` after `migrate`. Prefer extending Task 13's spec with:

```ts
// after the import assertions, compile the fixture app:
execSync('npx tsc --noEmit -p tsconfig.json', { cwd: fixtureApp, stdio: 'pipe' });
```

wrapped so a non-zero exit throws with the compiler output attached.

- [ ] **Step 2: Run the full impacted e2e subset**

Run: `npm run e2e:impact -- --base origin/master` then the impacted specs (per CLAUDE.md "E2E Authoring Workflow").
Expected: migrate + update specs PASS; the migrated fixture compiles.

- [ ] **Step 3: Commit**

```bash
git add e2e/
git commit -m "test(e2e): migrate smoke — migrated consumer app compiles"
```

---

# Final verification

- [ ] **Run the full CLI unit suite**

Run: `cd packages/cli && npm test`
Expected: all `*.spec.ts` PASS.

- [ ] **Sonar pass on changed files**

Use the `sonar` skill / `npm run` Sonar task per CLAUDE.md §4 on every new/changed file. Zero issues (watch `readonly`, `Number.*`, `.replaceAll`, cognitive complexity ≤15, no unused symbols).

- [ ] **Run the review-gate skill** (per project policy — bar ≥95 for architecture-refactor-adjacent work).

- [ ] **Publish note:** per the registry-publish memory, these fixes only reach consumers on an npm publish of `@gilav21/shadcn-angular`. Track this PR and publish when merged. Do **not** mark the consumer's issue resolved until published.

---

## Self-review (completed by plan author)

- **Spec coverage:** A1 → Task 2; A2 → Task 2 (+ Task 3 gate); A3 → Task 6; B detection → Task 1; B import-rewrite → Task 8; B plan/execute → Tasks 9–12; B guards (git-clean, --dry-run, --yes, customized-block) → Task 12; C manifest → Tasks 4–5; C doctor split → Task 6; C update warning → Task 7; testing: B-unit/detect → Tasks 1,8; B-integ/B-guard → Tasks 10,11,13; B-e2e → Task 14; update regression → Task 3. **No gaps.**
- **Placeholder scan:** two snippets carry an inline instruction to replace with the clean form before committing — `scan.structural ?? scan.legacy` in Task 9 (use `[...scan.legacy]`) and the `void …` honesty line in Task 12 (delete unused imports instead). No "TBD/handle edge cases" left.
- **Type consistency:** `ComponentName`, `Manifest`, `FileStatus`, `LayoutScan`, `MigrationPlan`, `ClosurePartition` names are used identically across tasks; `recordFile(manifest,file,content,component)`, `fileStatus(manifest,file,local)`, `rewriteImports(source,migrated)→{content,changed}`, `rewriteSpecifier(spec,migrated)→string|null` signatures match every call site.

---

# Phase 4 — Customization-safe migrate (Bugs 1–4 from published 0.0.33)

> Implements **Revision 2** of the spec. Execution mode: **inline**, TDD,
> **review-gate after every task** (bar ≥95). Bugs 2 & 3 are already coded
> (uncommitted) — Tasks 15–16 add their tests and finalize them; Tasks 17–20
> build the Bug 1 baseline/partition; Tasks 21–22 verify end-to-end. CLI wording
> follows the spec's **warm, customer-first tone note**.

**New files**
- `packages/cli/scripts/gen-legacy-baselines.mjs` — one-shot git-history miner.
- `packages/cli/src/registry/legacy-baselines.ts` — generated, committed
  `export const LEGACY_BASELINES` (~55 KB; `.ts` not `.json` so it bundles with
  zero build config).
- `packages/cli/src/core/baseline.ts` — `canonicalize`, `canonicalHash`,
  `isPristine`, `loadBaselines`.
- `packages/cli/src/core/baseline.spec.ts`

**Modified files**
- `packages/cli/src/core/plan.ts` — (Bug 2, done) queue `'missing'` peer files.
- `packages/cli/src/core/plan.spec.ts` — add the `'missing'`-peer test.
- `packages/cli/src/core/migrate-core.ts` — (Bug 3, done) uiDir-inclusive rewrite;
  `planMigration(scan, customized)` partition (customized / blocked).
- `packages/cli/src/core/migrate-core.spec.ts` — partition tests.
- `packages/cli/src/utils/prefix.ts` — export `neutralizePrefix` (ungated mirror).
- `packages/cli/src/commands/migrate.ts` — baseline detection, never-overwrite-
  customized, warm 3-group report, backup notice, stale-comment + Bug 4 wording.
- `e2e/cli-specs/migrate.ts`, `e2e/cli-specs/migrate-build.ts`.

---

## Task 15: Bug 2 — install a `'missing'` peer file (finalize + test)

**Files:** Modify (done) `packages/cli/src/core/plan.ts`; Test `packages/cli/src/core/plan.spec.ts`.

- [ ] **Step 1: Add the failing test** — a component whose `peerFiles` target is
  absent on disk gets that file into `peerFilesToUpdate`.

```ts
it('queues a peer file that is missing on disk (not just changed)', async () => {
  const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'peer-'));
  try {
    const peerSet = new Set<string>();
    const cache = new Map<string, string>();
    await classifyComponent(
      'data-table', targetDir, { branch: 'main', remote: false } as AddOptions,
      '@/components/lib', cache, peerSet, 'ui',
    );
    expect(peerSet.has('context-menu-attach.directive.ts')).toBe(true);
  } finally { await fs.remove(targetDir); }
});
```

- [ ] **Step 2: Run** `cd packages/cli && npx vitest run src/core/plan.spec.ts` — PASS (code in place).
- [ ] **Step 3: review-gate** (Task 15) → commit `fix(cli): install missing peerFiles on add/update/migrate (review >=95)`.

---

## Task 16: Bug 3 — uiDir-inclusive scoped rewrite (finalize) + stale comment + Bug 4 wording

**Files:** Modify (done) `migrate-core.ts`; Modify `commands/migrate.ts`; Test (done) `migrate-core.spec.ts`.

- [ ] **Step 1** `cd packages/cli && npx vitest run src/core/migrate-core.spec.ts` — PASS.
- [ ] **Step 2** Replace the now-false `migrate.ts` comment ("skips uiDir") with:

```ts
// rewriteProjectImports scans every project file INCLUDING the ui dir, because a
// pre-existing folder component can import a now-migrated sibling via the old
// flat path (`../button.component`). Each rewrite is scoped to specifiers that
// resolve to <uiDir>/<name>.component, so a component's own barrel self-reference
// and a consumer file sharing a library name are both left untouched.
```

- [ ] **Step 3** Retarget the report "Next" line to `git diff` + `ng build` (Bug 4: no manual step).
- [ ] **Step 4: review-gate** (Task 16) → commit `fix(cli): rewrite cross-component sibling imports on migrate (review >=95)`.

---

## Task 17: Baseline generator + generated data file

**Files:** Create `packages/cli/scripts/gen-legacy-baselines.mjs`; Create (generated) `packages/cli/src/registry/legacy-baselines.ts`.

- [ ] **Step 1: Write the generator.** Mines every distinct historical blob of
  each `ui/<name>.component.ts` across `git log --all`, canonicalizes with the
  SAME projection as `baseline.ts` (`prefix:'ui'`, repo-relative `../lib/`),
  hashes, dedupes, emits a sorted TS module.

```js
// packages/cli/scripts/gen-legacy-baselines.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalize } from '../dist/core/baseline.js'; // built first (see Task 18)

const git = (a) => execFileSync('git', a, { encoding: 'utf-8', maxBuffer: 1 << 30 });
const UI = 'packages/components/ui';
const paths = [...new Set(
  git(['log','--all','--name-only','--pretty=format:','--',`${UI}/*.component.ts`])
    .split('\n').filter(p => /^packages\/components\/ui\/[a-z][a-z0-9-]*\.component\.ts$/.test(p)),
)];
const out = {};
for (const p of paths) {
  const name = p.slice(UI.length + 1, -'.component.ts'.length);
  const commits = git(['log','--all','--pretty=format:%H','--',p]).split('\n').filter(Boolean);
  const hashes = new Set();
  for (const c of commits) {
    let raw; try { raw = git(['show', `${c}:${p}`]); } catch { continue; }
    hashes.add(createHash('sha256').update(canonicalize(raw, 'ui', '')).digest('hex'));
  }
  if (hashes.size) out[name] = [...hashes].sort();
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a],[b]) => a.localeCompare(b)));
writeFileSync(new URL('../src/registry/legacy-baselines.ts', import.meta.url),
  `// GENERATED by scripts/gen-legacy-baselines.mjs — do not edit by hand.\n` +
  `export const LEGACY_BASELINES: Readonly<Record<string, readonly string[]>> = ${JSON.stringify(sorted, null, 2)} as const;\n`);
console.log(`Wrote ${Object.keys(sorted).length} components, ${Object.values(sorted).reduce((n,a)=>n+a.length,0)} hashes.`);
```

- [ ] **Step 2: Run** after `baseline.ts` + build (Task 18):
  `cd packages/cli && node scripts/gen-legacy-baselines.mjs` → ~103 comps / ~850 hashes.
- [ ] **Step 3: Commit** script + generated file with Task 18.

---

## Task 18: `baseline.ts` — canonicalize / hash / isPristine (TDD)

**Files:** Create `core/baseline.ts` + `core/baseline.spec.ts`; Modify `utils/prefix.ts` (export `neutralizePrefix`).

- [ ] **Step 1: Failing tests** — canonical projection invariant under the
  install transform across a prefix/alias matrix; `isPristine` true for an
  installed-but-unedited file (default + custom prefix/alias), false for an edit,
  false when no baseline entry exists.

```ts
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { canonicalize, isPristine } from './baseline.js';
import { applyPrefixTransforms } from '../utils/prefix.js';

const RAW = `import { x } from '../lib/utils';\n@Component({ selector: 'ui-button', template: '<ui-button-x></ui-button-x>' })\nexport class B {}`;
const install = (raw: string, prefix: string, alias: string) =>
  applyPrefixTransforms('x.component.ts', raw.replaceAll(/(\.\.\/)+lib\//g, alias + '/'), prefix);

it('canonical form is invariant under install transform', () => {
  const base = canonicalize(RAW, 'ui', '');
  for (const p of ['ui','acme','my-ui']) for (const a of ['@/components/lib','@/lib','~/ui/lib'])
    expect(canonicalize(install(RAW, p, a), p, a)).toBe(base);
});

const baselines = { button: [createHash('sha256').update(canonicalize(RAW,'ui','')).digest('hex')] };
it('isPristine true for unedited install, false for edit, false for unknown', () => {
  expect(isPristine(baselines,'button',install(RAW,'ui','@/components/lib'),'ui','@/components/lib')).toBe(true);
  expect(isPristine(baselines,'button',install(RAW,'acme','@/lib'),'acme','@/lib')).toBe(true);
  expect(isPristine(baselines,'button',install(RAW,'ui','@/components/lib')+'\n// edit','ui','@/components/lib')).toBe(false);
  expect(isPristine(baselines,'unknown',RAW,'ui','@/components/lib')).toBe(false);
});
```

- [ ] **Step 2: `neutralizePrefix` in `prefix.ts`** — ungated mirror of the
  anchored selector/tag rewrites, mapping a given (validated kebab) prefix to a
  fixed token; safe to interpolate into a RegExp.
- [ ] **Step 3: `baseline.ts`** — `neutralizeAlias` (repo `../lib/` AND installed
  `<alias>/` → fixed token), `canonicalize = normalize(neutralizePrefix(neutralizeAlias(...)))`,
  `canonicalHash`, `loadBaselines() = LEGACY_BASELINES`, `isPristine` (no entry → false/conservative).

  > **Bootstrap:** create a 1-line stub `export const LEGACY_BASELINES = {} as const;`
  > first, `npm run build`, run the Task 17 generator (imports `dist/core/baseline.js`),
  > then rebuild. Generator and runtime share ONE `canonicalize` — that identity
  > is what makes a pristine file match.

- [ ] **Step 4: Run** `npx vitest run src/core/baseline.spec.ts` — PASS.
- [ ] **Step 5: Generate real baseline** (Task 17 Step 2), rebuild, re-run suite.
- [ ] **Step 5b: Closed-loop test against the REAL generated baseline** (advisor
  #2 — the synthetic round-trip can't catch generator↔runtime divergence, stale
  `dist`, or real-blob edge cases). Add a test that reads an actual historical
  blob via git, forward-transforms it (default prefix + a real alias), and
  asserts `isPristine` is `true` against the generated `LEGACY_BASELINES`:

```ts
import { execFileSync } from 'node:child_process';
import { loadBaselines, isPristine } from './baseline.js';
// `it` guarded: skip when not in a git checkout (published-package test runs).
it('a real historical button blob is recognized as pristine end-to-end', () => {
  let raw: string;
  try {
    raw = execFileSync('git', ['show', 'e57aa55:packages/components/ui/button.component.ts'], { encoding: 'utf-8' });
  } catch { return; } // not a git checkout → skip
  const installed = raw.replaceAll(/(\.\.\/)+lib\//g, '@/components/lib/'); // default prefix → no selector rewrite
  expect(isPristine(loadBaselines(), 'button', installed, 'ui', '@/components/lib')).toBe(true);
});
```

  This exercises generator → baked hashes → runtime `canonicalize` on REAL data,
  the default-prefix majority case (reduces to "does the alias rewrite invert").
- [ ] **Step 6: review-gate** (Task 18) → commit `feat(cli): historical-hash baseline for legacy edit detection (review >=95)`.

---

## Task 19: `planMigration` partition — customized / blocked (TDD)

**Files:** Modify `core/migrate-core.ts` + `core/migrate-core.spec.ts`.

- [ ] **Step 1: Failing tests.**

```ts
it('migrates a pristine closure and flags a customized leaf only', () => {
  const plan = planMigration({ legacy: ['button','badge'], current: [] }, new Set(['badge']));
  expect(plan.customized).toEqual(['badge']);
  expect(plan.structural).toContain('button');
  expect(plan.blocked).toEqual([]);
});
it('blocks the dependents of a customized shared dependency', () => {
  const plan = planMigration({ legacy: ['button','ripple'], current: [] }, new Set(['ripple']));
  expect(plan.customized).toEqual(['ripple']);
  expect(plan.blocked).toContain('button');
  expect(plan.structural).not.toContain('button');
  expect(plan.writeSet).not.toContain('ripple');
});
```

- [ ] **Step 2: Implement** — extend `MigrationPlan` with `customized` +
  `blocked`; `planMigration(scan, customized = new Set())`:

```ts
export function planMigration(scan: LayoutScan, customized: ReadonlySet<ComponentName> = new Set()): MigrationPlan {
  const customizedLegacy = scan.legacy.filter(n => customized.has(n));
  const customizedSet = new Set(customizedLegacy);
  const migratable = (n: ComponentName) => [...resolveDependencies([n])].every(d => !customizedSet.has(d));
  const structural = scan.legacy.filter(migratable);
  const blocked = scan.legacy.filter(n => !customizedSet.has(n) && !migratable(n));
  const installed = new Set<ComponentName>([...scan.legacy, ...scan.current]);
  const writeSet = [...resolveDependencies(structural)];
  const writeSetSet = new Set(writeSet);
  return { structural, customized: customizedLegacy, blocked, writeSet,
    newDeps: writeSet.filter(n => !installed.has(n)),
    refreshed: writeSet.filter(n => scan.current.includes(n)),
    untouched: scan.current.filter(n => !writeSetSet.has(n)) };
}
```

- [ ] **Step 3: Run** migrate-core suite — PASS (optional arg keeps old tests green).
- [ ] **Step 4: review-gate** (Task 19) → commit `feat(cli): migrate partitions customized vs migratable closures (review >=95)`.

---

## Task 20: `migrate.ts` wiring — never overwrite customized, warm report, backup notice

**Files:** Modify `commands/migrate.ts`.

- [ ] **Step 1** `detectCustomizedLegacy(uiDir, legacy, prefix, utilsAlias)` reads
  each `<name>.component.ts` and collects those failing `isPristine` (unreadable → customized).
- [ ] **Step 2** Rebuild `migrate()`: scan → if no legacy, "Nothing to migrate" →
  detect customized → `planMigration(scan, customized)` → **remove** `blockOnCustomized`
  and the `--yes`-gated overwrite (customized are never in `structural` now) →
  print backup notice → if `structural` empty, print warm customized/blocked
  report and return 0 → else `executeMigration` + warm report.
- [ ] **Step 3** Warm, customer-first 3-group report (Migrated / "we kept your
  customizations safe" / "deferred — builds on a customized component"), each
  flagged line paired with a friendly concrete next step (back up, `add --overwrite`,
  `git diff`). No apologies/curtness (spec tone note).
- [ ] **Step 4** Backup notice helper printed once before execute (first-migration
  blind-spot; clean-tree = safety net).
- [ ] **Step 5: Run** `cd packages/cli && npm test` — PASS; `npm run build`.
- [ ] **Step 6: review-gate** (Task 20) → commit `feat(cli): migrate protects customized components, never overwrites (review >=95)`.

---

## Task 21: e2e — customized-skipped, peerFiles, cross-component build

> **CRITICAL (advisor #1):** the existing `migrate.ts`/`migrate-build.ts` fabricate
> a *synthetic* `ui-button` (`template: ''`). Under the new logic that content
> matches no historical blob → classified **customized → NOT migrated**, so every
> "button migrates / flat deleted / import rewritten" assertion breaks. The
> pristine-migrate path now **requires real baseline-matching content.** Both
> facts established from history: no flat `.html`/`.css` ever shipped (inline-only,
> so detection-reads-`.ts` vs deletes-`.{ts,html,css}` is a non-issue); and
> `data-table` was **never** a flat file (so Bug 2 cannot be tested via "migrate a
> legacy data-table" — use the add/refresh vector).

**Files:** Modify `e2e/cli-specs/migrate.ts`, `e2e/cli-specs/migrate-build.ts`; add `e2e/cli-specs/peerfiles-missing.ts`.

- [ ] **Step 1 — real-content helper.** Both migrate specs need a *pristine* flat
  button. Fetch a real historical blob in-repo and write it as the legacy flat
  file (canonicalizes to a baseline hash → classified pristine → migrates):

```ts
import { execFileSync } from 'node:child_process';
function writeRealLegacyButton(uiDir: string): void {
  const raw = execFileSync('git',
    ['show', 'e57aa55:packages/components/ui/button.component.ts'], { encoding: 'utf-8' });
  // Write the repo-form blob verbatim; canonicalize() neutralizes `../lib/` too,
  // so it matches the baseline whether or not the alias is rewritten.
  fs.writeFileSync(path.join(uiDir, 'button.component.ts'), raw);
  fs.rmSync(path.join(uiDir, 'button'), { recursive: true, force: true });
}
```

- [ ] **Step 2 — `migrate.ts`:** replace the synthetic button with
  `writeRealLegacyButton`; keep the existing migrate/delete/import-rewrite
  assertions (now they pass because button is pristine). **Add a customized
  component:** write a *second* flat component with our selector but
  non-baseline content (e.g. an edited `badge.component.ts` carrying
  `selector: 'ui-badge'` + extra code); assert after migrate it is **left flat**,
  **no `badge/` folder** was created, and the report lists it under "kept your
  customizations." Keep the existing consumer-`card` (own selector) untouched check.
- [ ] **Step 3 — `migrate-build.ts`:** replace synthetic button with
  `writeRealLegacyButton`; add consumer-owned `my-widget/my-widget.component.ts`
  importing button via `../button.component`, referenced from `app.ts`; assert
  it's rewritten to `../button` and the production `ng build` succeeds (Bug 3 e2e).
- [ ] **Step 4 — Bug 2 vector (`peerfiles-missing.ts`):** `init` → `add data-table --yes`
  → delete the 5 context-menu peer `.directive.ts` files from the ui dir →
  `add data-table --overwrite --yes` (re-classifies; `'missing'` peer files
  re-queued) → assert all 5 directive files exist again on disk. No build (file-level).
- [ ] **Step 5: Run** `npm run build:cli && npm run e2e -- migrate migrate-build peerfiles-missing add-all-smoke prod-build`.
- [ ] **Step 6: review-gate** (Task 21) → commit `test(e2e): customized-safe migrate + cross-component build + missing peerFiles (review >=95)`.

---

## Task 22: Final verification + finish

- [ ] Full CLI unit suite `cd packages/cli && npm test` green.
- [ ] Sonar on every new/changed file (zero issues; `readonly`, `Number.*`,
  `.replaceAll`, complexity ≤15, no unused, validated-prefix regex).
- [ ] Full e2e `npm run e2e` (or impacted subset + add-all-smoke + prod-build + migrate-build).
- [ ] Update spec + plan Completion Logs with Phase 4 scores.
- [ ] finishing-a-development-branch → push, update PR #71, reply to the 0.0.33
  report. **Registry-publish policy: a new publish is required — confirm with the
  user first.** Teammate verifies `file-viewer` keeps its `reextract*` inputs.

---

## Self-review (Phase 4)

- **Spec coverage (Rev 2):** Bug 2 → 15; Bug 3 → 16; Bug 1 baseline → 17–18;
  partition/policy → 19; never-overwrite + warm report + backup → 20; Bug 4 →
  16/20; tests → 21. No gaps.
- **Tone:** every flagged-component string pairs "what" with a friendly next step.
- **Type consistency:** optional `customized` arg keeps old `planMigration` call
  sites compiling; `canonicalize`/`isPristine`/`neutralizePrefix` signatures match
  all call sites and the generator.
- **Bootstrapping:** baseline.ts ⇄ generator circular import resolved by stub-then-generate.
