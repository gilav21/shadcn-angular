# CLI v2 (update/search/doctor + blocks) Implementation Plan — Spec A

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `search`, `update`, `doctor` CLI commands and a blocks mechanism (block = registry entry with `type:'block'`, reusing the add/install pipeline) plus 4 seed blocks, all shippable in one npm publish.

**Architecture:** Commands are thin wrappers over the existing `core/` layer (`search`, `diff-core`, `plan`, `install`). Blocks are ordinary registry entries discriminated by a `type` field; their own files fetch from `packages/blocks/` and install to a configurable blocks destination, while their component dependencies install to `aliases.ui` via the unchanged pipeline.

**Tech Stack:** TypeScript (ESM/NodeNext), Commander, Zod, Vitest, Angular (for the seed blocks). Spec: `specs/cli-commands-blocks-spec.md`. Builds on the `core/` layer from `specs/mcp-server-spec.md`.

---

## Conventions
- Paths are relative to repo root `D:\Development\shadcd\shadcn-angular`; CLI at `packages/cli/`.
- Single CLI test: `npx vitest run --config vitest.config.cli.ts <path>`; full CLI suite: `npm run test:cli`.
- Build CLI: `npm --prefix packages/cli run build` (run from repo root).
- ESM: import local files with `.js` extension.
- Run review-gate (≥95) after each task; record in this plan's Completion Log + `specs/cli-commands-blocks-spec.md`.

## File structure
```
packages/cli/src/
  commands/
    search.ts (NEW) + search.spec.ts
    doctor.ts (NEW) + doctor.spec.ts
    update.ts (NEW) + update.spec.ts
    add.ts        (MODIFY: block destination prompt)
    init.ts       (MODIFY: write aliases.blocks)
    list.ts       (MODIFY: group blocks)
    help.ts       (MODIFY: Blocks section)
  registry/index.ts (MODIFY: type field, block categories, 4 block entries)
  utils/
    config.ts   (MODIFY: aliases.blocks)
    paths.ts    (MODIFY: block base url + local dir)
  core/
    fetch.ts    (MODIFY: kind routing) + fetch.spec.ts
    install.ts  (MODIFY: block destination routing) + install.spec.ts
  mcp/tools/read-tools.ts (MODIFY: surface type)
  index.ts      (MODIFY: register search/update/doctor)
  scripts/sync-registry.ts (MODIFY: skip + validate block entries)
packages/blocks/
  login/ dashboard/ settings-profile/ pricing/   (NEW seed blocks)
```

---

# Phase 1 — Commands (no blocks yet)

### Task 1: `search` command

**Files:**
- Create: `packages/cli/src/commands/search.ts`, `packages/cli/src/commands/search.spec.ts`
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/cli/src/commands/search.spec.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { search } from './search.js';

describe('search command', () => {
  it('prints ranked matches for a query', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    search(['button'], {});
    const out = spy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('button');
    spy.mockRestore();
  });

  it('emits raw JSON with --json', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    search(['date'], { json: true });
    const out = spy.mock.calls.map(c => String(c[0])).join('\n');
    const parsed = JSON.parse(out) as Array<{ name: string }>;
    expect(parsed.some(h => h.name === 'date-picker')).toBe(true);
    spy.mockRestore();
  });

  it('prints a usage message for an empty query', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    search([], {});
    expect(spy.mock.calls.map(c => String(c[0])).join('\n')).toContain('Usage');
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --config vitest.config.cli.ts packages/cli/src/commands/search.spec.ts`
Expected: FAIL — `./search.js` not found.

- [ ] **Step 3: Implement `search.ts`**

```ts
import chalk from 'chalk';
import { searchComponents } from '../core/search.js';

interface SearchOptions {
    json?: boolean;
}

export function search(args: string[], options: SearchOptions): void {
    const query = args.join(' ').trim();
    if (query === '') {
        console.log(chalk.dim('Usage: shadcn-angular search <query>'));
        return;
    }

    const hits = searchComponents(query);

    if (options.json) {
        console.log(JSON.stringify(hits, null, 2));
        return;
    }

    if (hits.length === 0) {
        console.log(chalk.dim(`No matches for "${query}".`));
        return;
    }

    for (const hit of hits) {
        const cat = hit.category ? chalk.gray(`[${hit.category}] `) : '';
        console.log(chalk.cyan(hit.name.padEnd(24)) + cat + chalk.dim(hit.description ?? ''));
    }
}
```

- [ ] **Step 4: Register the command in `index.ts`**

Add import near the others: `import { search } from './commands/search.js';`
Add before `program.parse();`:
```ts
program
    .command('search')
    .description('Search components by name, tag, or description')
    .argument('[query...]', 'Search terms')
    .option('--json', 'Output raw JSON')
    .action((query: string[], options: { json?: boolean }) => search(query, options));
```

- [ ] **Step 5: Run tests + build**

Run: `npx vitest run --config vitest.config.cli.ts packages/cli/src/commands/search.spec.ts` → PASS
Run: `npm --prefix packages/cli run build` → exit 0

- [ ] **Step 6: Commit**
```bash
git add packages/cli/src/commands/search.ts packages/cli/src/commands/search.spec.ts packages/cli/src/index.ts
git commit -m "feat(cli): add search command over core/search"
```

---

### Task 2: `doctor` command

**Files:**
- Create: `packages/cli/src/commands/doctor.ts`, `packages/cli/src/commands/doctor.spec.ts`
- Modify: `packages/cli/src/index.ts`

Reuses `core/plan` `detectConflicts` (classifies each installed component's files as identical/changed/missing) + registry npm/lib data. Read-only; exits 1 on issues.

- [ ] **Step 1: Write the failing test**

`packages/cli/src/commands/doctor.spec.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { collectDoctorReport } from './doctor.js';
import { getDefaultConfig } from '../utils/config.js';

vi.mock('fs-extra', () => ({
  default: { pathExists: vi.fn(), readFile: vi.fn(), readJson: vi.fn(async () => ({})) },
}));
vi.mock('../core/fetch.js', () => ({
  fetchAndTransform: vi.fn(async () => 'REMOTE'),
  normalizeContent: (s: string) => s.replaceAll('\r\n', '\n').trim(),
}));

const cfg = getDefaultConfig();

describe('collectDoctorReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports a clean bill when nothing is installed', async () => {
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const report = await collectDoctorReport('/proj', cfg, { branch: 'master' });
    expect(report.missingFiles).toEqual([]);
    expect(report.modified).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('flags a component whose installed files were modified', async () => {
    // button present but changed: pathExists true, local != remote
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (p: string) =>
      String(p).includes('button'));
    (fs.readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('LOCAL EDIT');
    const report = await collectDoctorReport('/proj', cfg, { branch: 'master' });
    expect(report.modified).toContain('button');
    expect(report.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --config vitest.config.cli.ts packages/cli/src/commands/doctor.spec.ts`
Expected: FAIL — `./doctor.js` not found.

- [ ] **Step 3: Implement `doctor.ts`**

```ts
import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import { getConfig, getPrefix, type Config } from '../utils/config.js';
import { registry, getComponentNames, type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { detectConflicts, type AddOptions } from '../core/plan.js';

export interface DoctorReport {
    missingFiles: string[];
    modified: string[];
    missingNpmDeps: string[];
    ok: boolean;
}

async function installedComponents(targetDir: string): Promise<ComponentName[]> {
    const names: ComponentName[] = [];
    for (const name of getComponentNames()) {
        const files = registry[name].files;
        const anyPresent = await fileExists(path.join(targetDir, files[0]));
        if (anyPresent) names.push(name);
    }
    return names;
}

async function fileExists(p: string): Promise<boolean> {
    return fs.pathExists(p);
}

async function collectMissingNpmDeps(installed: ComponentName[], cwd: string): Promise<string[]> {
    const required = new Set<string>();
    for (const name of installed) {
        for (const dep of registry[name].npmDependencies ?? []) required.add(dep);
    }
    if (required.size === 0) return [];
    const pkgPath = path.join(cwd, 'package.json');
    if (!await fs.pathExists(pkgPath)) return [...required];
    const pkg = await fs.readJson(pkgPath) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const have = { ...pkg.dependencies, ...pkg.devDependencies };
    return [...required].filter(d => !have[d]);
}

export async function collectDoctorReport(cwd: string, config: Config, options: AddOptions): Promise<DoctorReport> {
    const targetDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
    const installed = await installedComponents(targetDir);

    const { conflicting, toInstall } = await detectConflicts(
        new Set(installed), targetDir, options, config.aliases.utils, getPrefix(config),
    );
    // Among installed components, "toInstall" means some files are missing
    // (partial install); "conflicting" means local files differ from remote.
    const missingFiles = installed.filter(c => toInstall.includes(c));
    const modified = installed.filter(c => conflicting.includes(c));
    const missingNpmDeps = await collectMissingNpmDeps(installed, cwd);

    const ok = missingFiles.length === 0 && modified.length === 0 && missingNpmDeps.length === 0;
    return { missingFiles, modified, missingNpmDeps, ok };
}

function printSection(title: string, items: string[], colorFn: (s: string) => string): void {
    if (items.length === 0) return;
    console.log('\n' + chalk.bold(title) + chalk.gray(` (${items.length})`));
    for (const item of items) console.log('  ' + colorFn(item));
}

export async function doctor(options: AddOptions): Promise<void> {
    const cwd = process.cwd();
    const config = await getConfig(cwd);
    if (!config) {
        console.log(chalk.red('Error: components.json not found.'));
        console.log(chalk.dim('Run `npx @gilav21/shadcn-angular init` first.'));
        process.exit(1);
    }
    if (!options.registry && config.registry) options.registry = config.registry;

    const report = await collectDoctorReport(cwd, config, options);

    if (report.ok) {
        console.log(chalk.green('\nAll installed components are healthy.'));
        return;
    }
    printSection('Partially installed (missing files):', report.missingFiles, chalk.yellow);
    printSection('Modified locally (drift from registry):', report.modified, chalk.yellow);
    printSection('Missing npm dependencies:', report.missingNpmDeps, chalk.red);
    console.log('');
    process.exit(1);
}
```

- [ ] **Step 4: Register in `index.ts`**

Import: `import { doctor } from './commands/doctor.js';`
```ts
program
    .command('doctor')
    .description('Check installed components for drift, missing files, and missing deps')
    .option('--remote', 'Force remote fetch from GitHub registry')
    .option('-b, --branch <branch>', 'GitHub branch to fetch from', 'master')
    .option('-r, --registry <url>', 'Custom registry base URL')
    .action(doctor);
```

- [ ] **Step 5: Run tests + build**

Run: `npx vitest run --config vitest.config.cli.ts packages/cli/src/commands/doctor.spec.ts` → PASS
Run: `npm --prefix packages/cli run build` → exit 0

- [ ] **Step 6: Commit**
```bash
git add packages/cli/src/commands/doctor.ts packages/cli/src/commands/doctor.spec.ts packages/cli/src/index.ts
git commit -m "feat(cli): add doctor command (drift/missing-files/missing-deps report)"
```

---

### Task 3: `update` command

**Files:**
- Create: `packages/cli/src/commands/update.ts`, `packages/cli/src/commands/update.spec.ts`
- Modify: `packages/cli/src/index.ts`

Computes diffs for installed (or named) components and applies overwrites via `performInstall`. Interactive selection by default; `-y` applies all; `--dry-run` previews.

- [ ] **Step 1: Write the failing test**

`packages/cli/src/commands/update.spec.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { resolveUpdateTargets } from './update.js';
import { getDefaultConfig } from '../utils/config.js';

vi.mock('fs-extra', () => ({ default: { pathExists: vi.fn() } }));

describe('resolveUpdateTargets', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the explicitly named components when given', async () => {
    const targets = await resolveUpdateTargets(['button', 'card'], '/proj', getDefaultConfig());
    expect(targets).toEqual(['button', 'card']);
  });

  it('detects installed components when none named', async () => {
    (fs.pathExists as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (p: string) =>
      String(p).includes('button'));
    const targets = await resolveUpdateTargets([], '/proj', getDefaultConfig());
    expect(targets).toContain('button');
    expect(targets).not.toContain('card');
  });

  it('rejects unknown component names', async () => {
    await expect(resolveUpdateTargets(['not-real'], '/proj', getDefaultConfig())).rejects.toThrow(/Unknown/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --config vitest.config.cli.ts packages/cli/src/commands/update.spec.ts`
Expected: FAIL — `./update.js` not found.

- [ ] **Step 3: Implement `update.ts`**

```ts
import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig, getPrefix, type Config } from '../utils/config.js';
import { registry, getComponentNames, isComponentName, type ComponentName } from '../registry/index.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { diffComponentFiles } from '../core/diff-core.js';
import { performInstall } from '../core/install.js';
import { type AddOptions } from '../core/plan.js';

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

interface UpdateOptions extends AddOptions {
    interactive?: boolean;
}

export async function update(names: string[], options: UpdateOptions): Promise<void> {
    const cwd = process.cwd();
    const config = await getConfig(cwd);
    if (!config) {
        console.log(chalk.red('Error: components.json not found.'));
        console.log(chalk.dim('Run `npx @gilav21/shadcn-angular init` first.'));
        process.exit(1);
    }
    if (!options.registry && config.registry) options.registry = config.registry;

    let targets: ComponentName[];
    try {
        targets = await resolveUpdateTargets(names, cwd, config);
    } catch (e: unknown) {
        console.log(chalk.red(e instanceof Error ? e.message : String(e)));
        process.exit(1);
    }
    if (targets.length === 0) {
        console.log(chalk.dim('No installed components to update.'));
        return;
    }

    const targetDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
    const utilsAlias = config.aliases.utils;

    const spinner = ora('Checking for updates...').start();
    const changed: ComponentName[] = [];
    for (const name of targets) {
        const cd = await diffComponentFiles(name, targetDir, options, utilsAlias);
        if (cd.hasChanges) changed.push(name);
    }
    spinner.stop();

    if (changed.length === 0) {
        console.log(chalk.green('Everything is up to date.'));
        return;
    }

    console.log(chalk.bold(`\n${changed.length} component(s) have updates:`));
    for (const name of changed) console.log(chalk.yellow('  ~ ') + name);

    if (options.dryRun) {
        console.log(chalk.dim('\n[Dry Run] No changes written.'));
        return;
    }

    const result = await performInstall({
        components: changed,
        overwrite: changed,
        cwd, config,
        options: { ...options, overwrite: true },
    });
    console.log(chalk.green(`\nUpdated ${result.installed.length} component(s).`));
    for (const w of result.warnings) console.log(chalk.yellow('  ' + w));
}
```

> Note: this applies updates to all changed targets. `--dry-run` previews. (Per-component interactive selection can be added later; YAGNI for Spec A — the named-args form already lets users scope.)

- [ ] **Step 4: Register in `index.ts`**

Import: `import { update } from './commands/update.js';`
```ts
program
    .command('update')
    .description('Update installed components to the latest registry version')
    .argument('[components...]', 'Components to update (all installed if omitted)')
    .option('--dry-run', 'Show what would update without writing')
    .option('--remote', 'Force remote fetch from GitHub registry')
    .option('-b, --branch <branch>', 'GitHub branch to fetch from', 'master')
    .option('-r, --registry <url>', 'Custom registry base URL')
    .action(update);
```

- [ ] **Step 5: Run tests + build**

Run: `npx vitest run --config vitest.config.cli.ts packages/cli/src/commands/update.spec.ts` → PASS
Run: `npm --prefix packages/cli run build` → exit 0

- [ ] **Step 6: Commit**
```bash
git add packages/cli/src/commands/update.ts packages/cli/src/commands/update.spec.ts packages/cli/src/index.ts
git commit -m "feat(cli): add update command (diff installed + apply overwrite)"
```

---

# Phase 2 — Blocks mechanism

### Task 4: Registry `type` field, block categories, and config `aliases.blocks`

**Files:**
- Modify: `packages/cli/src/registry/index.ts` (add `type` to interface; add block categories to `CATEGORIES`)
- Modify: `packages/cli/src/utils/config.ts` (`aliases.blocks`, default, validation)
- Test: `packages/cli/src/registry/registry-meta.spec.ts` (allow block type/categories), `packages/cli/src/utils/config.spec.ts` (NEW)

- [ ] **Step 1: Add `type` + block categories to the registry**

In `registry/index.ts`, extend the `CATEGORIES` array with block families (append, keep existing 11):
```ts
  // block families (used only by type:'block' entries)
  'auth', 'dashboard', 'settings', 'marketing',
```
Add to `ComponentDefinition`:
```ts
  /** 'component' (default) or 'block' (a composed page reusing components). */
  readonly type?: 'component' | 'block';
```

- [ ] **Step 2: Add `aliases.blocks` to config**

In `config.ts` `Config.aliases`, add `blocks?: string;`. In `getDefaultConfig()` add `blocks: '@/blocks'` to aliases. In `validateConfig`, treat `blocks` as optional (only validate it's a string if present). Add a helper:
```ts
export function getBlocksAlias(config: Config): string {
    return config.aliases.blocks ?? '@/blocks';
}
```

- [ ] **Step 3: Write/extend tests**

Create `packages/cli/src/utils/config.spec.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getDefaultConfig, getBlocksAlias } from './config.js';

describe('getBlocksAlias', () => {
  it('defaults to @/blocks when absent', () => {
    const cfg = getDefaultConfig();
    delete (cfg.aliases as { blocks?: string }).blocks;
    expect(getBlocksAlias(cfg)).toBe('@/blocks');
  });
  it('uses the configured value when present', () => {
    const cfg = getDefaultConfig();
    cfg.aliases.blocks = '@/features';
    expect(getBlocksAlias(cfg)).toBe('@/features');
  });
});
```
Extend `registry-meta.spec.ts` coverage test to accept block entries: a `type:'block'` entry's `category` may be one of the block families; components keep the 11-value set. Replace the category assertion with:
```ts
const BLOCK_CATS = ['auth', 'dashboard', 'settings', 'marketing'];
// inside the loop:
expect(CATEGORIES as readonly string[]).toContain(def.category);
if (def.type === 'block') {
  expect(BLOCK_CATS).toContain(def.category);
}
```

- [ ] **Step 4: Run tests + build**

Run: `npx vitest run --config vitest.config.cli.ts packages/cli/src/utils/config.spec.ts packages/cli/src/registry/registry-meta.spec.ts` → PASS
Run: `npm --prefix packages/cli run build` → exit 0

- [ ] **Step 5: Commit**
```bash
git add packages/cli/src/registry/index.ts packages/cli/src/utils/config.ts packages/cli/src/utils/config.spec.ts packages/cli/src/registry/registry-meta.spec.ts
git commit -m "feat(cli): add registry type field, block categories, aliases.blocks"
```

---

### Task 5: Block fetch routing (`paths.ts` + `core/fetch.ts`)

**Files:**
- Modify: `packages/cli/src/utils/paths.ts`
- Modify: `packages/cli/src/core/fetch.ts`
- Test: `packages/cli/src/core/fetch.spec.ts`

- [ ] **Step 1: Add block roots to `paths.ts`**

```ts
export function getBlockRegistryBaseUrl(branch: string, customRegistry?: string): string {
    const base = customRegistry ?? getDefaultRegistryBaseUrl(branch);
    return `${base}/blocks`;
}

export function getLocalBlocksDir(): string | null {
    const localPath = path.resolve(__dirname, '../../../blocks');
    return fs.existsSync(localPath) ? localPath : null;
}
```
> Note: `getDefaultRegistryBaseUrl` returns `…/packages/components`; blocks live at `…/packages/blocks`. Adjust the block URL to target `packages/blocks` directly:
```ts
function getDefaultBlocksBaseUrl(branch: string): string {
    validateBranch(branch);
    return `https://raw.githubusercontent.com/gilav21/shadcn-angular/${branch}/packages/blocks`;
}
export function getBlockRegistryBaseUrl(branch: string, customRegistry?: string): string {
    return customRegistry ? `${customRegistry}/blocks` : getDefaultBlocksBaseUrl(branch);
}
```
(Replace the first draft with this — the custom-registry case keeps the `/blocks` suffix.)

- [ ] **Step 2: Add `kind` routing to `core/fetch.ts`**

Change `fetchComponentContent` to accept a kind and pick the root:
```ts
export type SourceKind = 'component' | 'block';

export async function fetchComponentContent(
    file: string, options: FetchOptions, kind: SourceKind = 'component',
): Promise<string> {
    const localDir = kind === 'block' ? getLocalBlocksDir() : getLocalComponentsDir();
    if (localDir && !options.remote) {
        const localPath = path.join(localDir, file);
        if (await fs.pathExists(localPath)) return fs.readFile(localPath, 'utf-8');
    }
    const baseUrl = kind === 'block'
        ? getBlockRegistryBaseUrl(options.branch, options.registry)
        : getRegistryBaseUrl(options.branch, options.registry);
    const url = `${baseUrl}/${file}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch from ${url}: ${response.statusText}`);
        return await response.text();
    } catch (error) {
        if (localDir) throw new Error(`File not found locally or remotely: ${file}`);
        throw error;
    }
}
```
Thread `kind` through `fetchAndTransform`:
```ts
export async function fetchAndTransform(
    file: string, options: FetchOptions, utilsAlias: string,
    prefix: string = DEFAULT_PREFIX, kind: SourceKind = 'component',
): Promise<string> {
    const raw = await fetchComponentContent(file, options, kind);
    const withAlias = file.endsWith('.ts') ? raw.replaceAll(/(\.\.\/)+lib\//g, utilsAlias + '/') : raw;
    return applyPrefixTransforms(file, withAlias, prefix);
}
```
Add the imports for `getBlockRegistryBaseUrl`/`getLocalBlocksDir` to `fetch.ts`.

- [ ] **Step 3: Add a test**

Append to `packages/cli/src/core/fetch.spec.ts`:
```ts
import { fetchAndTransform } from './fetch.js';
// (vi.mock fs-extra + global fetch as needed)
it('routes block kind to the blocks base url', async () => {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (u: string) => { calls.push(u); return { ok: true, text: async () => '// x' } as Response; }));
  await fetchAndTransform('login/login.component.ts', { branch: 'master', remote: true }, '@/lib', 'ui', 'block');
  expect(calls[0]).toContain('/packages/blocks/');
  vi.unstubAllGlobals();
});
```
> If the existing fetch.spec.ts has no fs mock, add `vi.mock('fs-extra', …)` returning `pathExists:()=>false` so the remote path is taken. Use `remote: true` to skip the local dir.

- [ ] **Step 4: Run tests + build**

Run: `npx vitest run --config vitest.config.cli.ts packages/cli/src/core/fetch.spec.ts` → PASS
Run: `npm --prefix packages/cli run build` → exit 0

- [ ] **Step 5: Commit**
```bash
git add packages/cli/src/utils/paths.ts packages/cli/src/core/fetch.ts packages/cli/src/core/fetch.spec.ts
git commit -m "feat(cli): route block source fetches to packages/blocks"
```

---

### Task 6: Block install destination routing (`core/install.ts`)

**Files:**
- Modify: `packages/cli/src/core/install.ts`
- Test: `packages/cli/src/core/install.spec.ts`

A block entry's OWN files install to the blocks destination; its component dependencies install to `aliases.ui`. `performInstall` already iterates a final component set — route per entry by `registry[name].type`, and pass `kind` to fetch/write.

- [ ] **Step 1: Add block destination to `InstallInput` + route writes**

In `install.ts`:
- Add to `InstallInput`: `blocksPath?: string;` (explicit destination for block entries; default derived from `getBlocksAlias(config)`).
- In `writeComponentFiles`/`writePeerFiles`, accept a `kind: SourceKind` and pass it to `fetchAndTransform`.
- In the write loop, compute per-entry target + kind:
```ts
import { getBlocksAlias } from '../utils/config.js';
import { type SourceKind } from './fetch.js';
// ...
const blocksBase = resolveProjectPath(
    input.cwd, input.blocksPath ?? aliasToProjectPath(getBlocksAlias(input.config)),
);
for (const name of finalComponents) {
    const def = registry[name];
    const isBlock = def.type === 'block';
    const dir = isBlock ? blocksBase : targetDir;
    const kind: SourceKind = isBlock ? 'block' : 'component';
    await fs.ensureDir(dir);
    const ok = await writeComponentFiles(def, dir, input.options, utilsAlias, result.contentCache, prefix, warnings, kind);
    await writePeerFiles(def, dir, input.options, utilsAlias, result.contentCache, result.peerFilesToUpdate, prefix, warnings, kind);
    if (ok) installed.push(name);
}
```
- `detectConflicts`/`planInstall` still classify against `aliases.ui` for components; block-file conflict detection is best-effort (Spec A blocks are fresh installs). Keep block files out of the `ui` conflict scan by detecting against the right base: in `planInstall`/`performInstall`, when building the detect set, components use `targetDir`; for blocks the detect uses `blocksBase`. (Minimal: run `detectConflicts` once for components, and for blocks treat as install when absent — acceptable for Spec A since blocks are new.)

> Keep the change focused: the key requirement is block OWN files land under the blocks base with `kind:'block'` fetch, and dependencies still land under `ui`. Conflict-detection refinement for blocks is deferred (blocks are fresh in Spec A).

- [ ] **Step 2: Add a test**

Append to `install.spec.ts` (extend the fetch mock to accept the kind arg):
```ts
it('writes a block entry under the blocks base, deps under ui', async () => {
  // Requires a block entry in the registry (added in Task 12). Until then,
  // assert routing via a stubbed registry entry is out of scope; this test
  // is authored in Task 12 once the `login` block exists.
});
```
> NOTE: the meaningful block-install test depends on a real block entry — author it in Task 12 (login). For Task 6, assert the existing 5 install tests still pass (signature change is backward-compatible via the `kind` default).

- [ ] **Step 3: Run tests + build**

Run: `npx vitest run --config vitest.config.cli.ts packages/cli/src/core/install.spec.ts` → PASS (existing tests green after the signature change)
Run: `npm --prefix packages/cli run build` → exit 0

- [ ] **Step 4: Commit**
```bash
git add packages/cli/src/core/install.ts packages/cli/src/core/install.spec.ts
git commit -m "feat(cli): route block files to the blocks destination on install"
```

---

### Task 7: Interactive block-destination prompt in `add`

**Files:**
- Modify: `packages/cli/src/commands/add.ts`

- [ ] **Step 1: Prompt for block destination when adding a block**

In `add()`, after resolving `componentsToAdd` and before `performInstall`, detect block entries and resolve their destination:
```ts
import { getBlocksAlias } from '../utils/config.js';
// ...
const hasBlock = [...resolveDependencies(componentsToAdd)].some(n => registry[n].type === 'block');
let blocksPath: string | undefined = options.path;
if (hasBlock && !options.path && !options.yes) {
    const { dest } = await prompts({
        type: 'text',
        name: 'dest',
        message: 'Where should blocks be installed?',
        initial: aliasToProjectPath(getBlocksAlias(config)),
    }, { onCancel });
    blocksPath = dest;
}
```
Pass `blocksPath` to `performInstall({ ..., blocksPath })`. (Component dependencies still use `aliases.ui`; `options.path` already overrides the component target — keep that behavior; `blocksPath` only affects block entries.)

> Distinguish: `--path` overrides the BLOCK destination (and, as today, the component path). For Spec A, `--path` sets `blocksPath`; component path override remains the existing behavior. Keep it simple: blocks honor `--path` then `aliases.blocks`.

- [ ] **Step 2: Run add tests + build**

Run: `npx vitest run --config vitest.config.cli.ts packages/cli/src/commands/add.spec.ts` → PASS
Run: `npm --prefix packages/cli run build` → exit 0

- [ ] **Step 3: Commit**
```bash
git add packages/cli/src/commands/add.ts
git commit -m "feat(cli): prompt for block destination when adding a block"
```

---

### Task 8: `sync-registry` skips + validates block entries

**Files:**
- Modify: `packages/cli/scripts/sync-registry.ts`
- Modify: `packages/cli/src/registry/index.ts` (parse needs `type`; not for sync output)

The walker reconciles entries against `packages/components`. Block entries point at `packages/blocks` and are hand-maintained — `sync-registry` must NOT treat them as stale.

- [ ] **Step 1: Detect and skip block entries in the parser**

In `parseRegistry()`, capture whether an entry block text contains `type: 'block'`. Add `isBlock: boolean` to `RegistryEntry`. In the main reconcile loop, `continue` for `isBlock` entries (do not diff their files against `packages/components`).

- [ ] **Step 2: Validate block files exist on disk**

After the component reconcile, add a block validation pass:
```ts
const BLOCKS_ROOT = path.resolve(SCRIPT_DIR, '../../blocks');
for (const entry of entries.filter(e => e.isBlock)) {
    for (const f of entry.files) {
        if (!existsSync(path.join(BLOCKS_ROOT, f))) {
            console.error(`Block ${entry.name}: missing file packages/blocks/${f}`);
            process.exitCode = 1;
        }
    }
}
```

- [ ] **Step 3: Verify sync stays clean**

Run: `npm --prefix packages/cli run sync-registry`
Expected: "All components are in sync." and no block errors (blocks added in Phase 3 will be validated; before they exist this pass is a no-op).

- [ ] **Step 4: Commit**
```bash
git add packages/cli/scripts/sync-registry.ts
git commit -m "build(cli): sync-registry skips block entries and validates their files exist"
```

---

### Task 9: Discovery — `list`/`help`/`search` block grouping + MCP `type`

**Files:**
- Modify: `packages/cli/src/commands/list.ts`, `packages/cli/src/commands/help.ts`, `packages/cli/src/mcp/tools/read-tools.ts`
- Test: `packages/cli/src/commands/help.spec.ts`

- [ ] **Step 1: `help` — render a Blocks section**

In `help.ts` `buildComponentsSection`, after the component categories, append a Blocks section grouping `type:'block'` entries by their (block) category. Add a helper `groupBlocks(): Record<string,string[]>` filtering `registry[name].type === 'block'`, and exclude blocks from the component `groupByCategory` (filter `type !== 'block'`).

- [ ] **Step 2: `list` — separate Blocks**

In `list.ts`, split the iteration: components (type !== 'block') under the existing Installed/Available sections (checked against `aliases.ui`), and blocks (type === 'block') under a "Blocks" heading checked against `aliases.blocks`.

- [ ] **Step 3: MCP — surface `type`**

In `read-tools.ts` `list_components` and `get_component`, include `type: d.type ?? 'component'` in the returned object.

- [ ] **Step 4: Test**

Extend `help.spec.ts`:
```ts
it('excludes blocks from component category groups', () => {
  const groups = groupByCategory();
  for (const list of Object.values(groups)) {
    for (const name of list) expect(registry[name].type).not.toBe('block');
  }
});
```

- [ ] **Step 5: Run tests + build**

Run: `npx vitest run --config vitest.config.cli.ts packages/cli/src/commands/help.spec.ts` → PASS
Run: `npm --prefix packages/cli run build` → exit 0

- [ ] **Step 6: Commit**
```bash
git add packages/cli/src/commands/list.ts packages/cli/src/commands/help.ts packages/cli/src/mcp/tools/read-tools.ts packages/cli/src/commands/help.spec.ts
git commit -m "feat(cli): group blocks in list/help and surface type over MCP"
```

---

### Task 10: `init` writes `aliases.blocks`

**Files:**
- Modify: `packages/cli/src/commands/init.ts` (interactive prompt path + defaults already include blocks via getDefaultConfig)

- [ ] **Step 1: Include blocks in the interactive config**

`getDefaultConfig()` already includes `aliases.blocks` (Task 4). In `promptForConfig`, add a prompt for the blocks path (initial `src/blocks`) and set `aliases.blocks = toAlias(responses.blocksPath)`. The `--defaults`/`--yes` path uses `getDefaultConfig()` so it already writes `aliases.blocks`.

- [ ] **Step 2: Build**

Run: `npm --prefix packages/cli run build` → exit 0. Existing init flow unaffected for `--yes`.

- [ ] **Step 3: Commit**
```bash
git add packages/cli/src/commands/init.ts
git commit -m "feat(cli): init records aliases.blocks"
```

---

# Phase 3 — Seed blocks (4)

> **Each seed block is authored with the `frontend-design` skill.** A block = real Angular source under `packages/blocks/<name>/` (folder + `<name>.component.ts`/`.html`/optional `.css` + `index.ts`) composed from existing library components, plus a hand-authored registry entry (`type:'block'`). Blocks must follow the project component guidelines (`.claude/CLAUDE.md`): `ChangeDetectionStrategy.OnPush`, `class` input where sensible, responsive (320px→ultrawide), touch-compatible, RTL-safe, no `ViewEncapsulation.None`. Selectors use the source prefix `ui-`.

For EACH block (Tasks 12–15), the steps are:
- [ ] Author `packages/blocks/<name>/` via the `frontend-design` skill, composing the listed components.
- [ ] Add the registry entry (`type:'block'`, `files` = the block's files, `dependencies` = components used, `category`, `description` ≤140, `tags` ≥3).
- [ ] `npm --prefix packages/cli run build` → exit 0; `npm --prefix packages/cli run sync-registry` → block files validated, no errors.
- [ ] Commit `git add packages/blocks/<name> packages/cli/src/registry/index.ts && git commit -m "feat(blocks): add <name> block"`.

### Task 12: `login` block (auth)
Components: `card`, `input`, `label`, `button`, `checkbox`. Layout: centered card, email + password fields with labels, "remember me" checkbox, primary submit button, secondary "forgot password" link. Responsive + RTL. Registry: `category:'auth'`, `description:'Email/password login page with a card layout, remember-me, and validation-ready fields.'`, `tags:['login','auth','sign-in','form']`.

**This task also adds the deferred block-install test from Task 6** in `install.spec.ts`: with the `login` entry present, assert `performInstall({components:['login'], blocksPath:'/p/blocks', ...})` writes login files under the blocks base and its deps (button/input/...) under `ui`.

### Task 13: `dashboard` block (dashboard)
Components: `card`, a chart (`bar-chart` or `pie-chart`), `table` (or `data-table`), `badge`, `sidebar` (optional), `avatar`. Layout: top stat cards row, a chart panel, a recent-activity table. Responsive grid. Registry: `category:'dashboard'`, `description:'Analytics dashboard with stat cards, a chart panel, and a recent-activity table.'`, `tags:['dashboard','analytics','admin','stats']`.

### Task 14: `settings-profile` block (settings)
Components: `card`, `input`, `textarea`, `label`, `avatar`, `button`, `separator`. Layout: profile form — avatar + name/email/bio fields, save/cancel actions. Registry: `category:'settings'`, `description:'Profile settings form with avatar, name/email/bio fields, and save actions.'`, `tags:['settings','profile','form','account']`.

### Task 15: `pricing` block (marketing)
Components: `card`, `button`, `badge`, `separator`, an icon (`icon`). Layout: 3 responsive pricing tiers (Free/Pro/Enterprise), feature lists with check icons, a highlighted tier, CTA buttons. Registry: `category:'marketing'`, `description:'Responsive three-tier pricing section with feature lists and CTAs.'`, `tags:['pricing','marketing','plans','landing']`.

---

# Phase 4 — Verification

### Task 16: End-to-end + final regression
- [ ] `npm run e2e:reset`
- [ ] Build CLI: `npm --prefix packages/cli run build`
- [ ] Drive the real CLI against `e2e/fixture-app`: `node packages/cli/dist/index.js init --yes` then `node packages/cli/dist/index.js add login --yes --path src/blocks` (run with cwd=fixture). Confirm: `e2e/fixture-app/src/blocks/login/` exists, component deps (`button`,`input`,`label`,`card`,`checkbox`) under `src/components/ui/`, then `cd e2e/fixture-app && npx ng build` succeeds.
- [ ] Smoke `node dist/index.js search button`, `... doctor`, `... update --dry-run` against the fixture.
- [ ] `npm run e2e:reset` to restore.
- [ ] Full CLI suite: `npm run test:cli` → all pass.
- [ ] `npm --prefix packages/cli run sync-registry` → in sync, blocks validated.
- [ ] Update Completion Log; note the publish requirement.

---

## Self-Review (completed during planning)

**Spec coverage:** search (T1), update (T3), doctor (T2), block type+categories+aliases.blocks (T4), fetch routing (T5), install routing (T6), add prompt (T7), sync-registry (T8), discovery+MCP type (T9), init (T10), 4 seed blocks (T12–15), e2e+regression (T16). All spec sections mapped.

**Placeholder scan:** The Task 6 block-install test is intentionally deferred to Task 12 (it needs a real block entry) — this is stated explicitly, not a hidden TODO. Seed-block page source is produced via frontend-design at execution (creative UI work) with precise component lists + acceptance criteria + registry entries specified — appropriate for UI authoring rather than pre-written page code.

**Type consistency:** `SourceKind` (fetch.ts) is threaded through `fetchAndTransform`→`writeComponentFiles`/`writePeerFiles`→`performInstall`. `getBlocksAlias` (config.ts) used by install routing + add prompt + init. `InstallInput.blocksPath` consumed only in `performInstall`. `type:'block'` discriminator read by install routing, sync-registry, list/help/search, MCP.

## Completion Log
Review gate bar: **≥95**.

| Task | Completed | Score | Rationale |
|---|---|---|---|
| T1 search | 2026-05-28 | 96 | `search` command wraps core/search; ranked output + `--json` + usage; registered with variadic arg; 3 tests; clean reuse, no any. |
| T2 doctor | 2026-05-28 | 95 | `doctor` maps detectConflicts→missing/modified + missing npm deps; pure `collectDoctorReport` + exit-1-on-issues wrapper; reuses core/plan; 2 tests. |
| T3 update | 2026-05-28 | 95 | `update` resolves named/installed targets, diffs via core/diff-core, applies forced-overwrite via performInstall; `--dry-run`; pure resolveUpdateTargets; 3 tests. |
| T4 block primitives | 2026-05-28 | 96 | `type` discriminator + 4 block categories + `aliases.blocks`/`getBlocksAlias` (Pick) + optional validation; coverage test gates block categories; help labels kept exhaustive; 187 tests. |
| T5 block fetch routing | 2026-05-28 | 97 | `getBlockRegistryBaseUrl`/`getLocalBlocksDir` (→ packages/blocks); `SourceKind` threaded through fetch with 'component' default; component+block routing tests; 189 tests. |
| T6 block install routing | 2026-05-28 | 97 | performInstall routes block entries → blocksBase (kind:block), deps → ui; `blocksPath` input; per-entry ensureDir; backward-compatible defaults; 5 install tests green (block-install test deferred to T12). |
| T7 add block prompt | 2026-05-28 | 97 | `resolveBlockDestination`: block+--path→blocksPath, block+interactive→prompt(default aliases.blocks), block+--yes→fallback; pure-component keeps --path meaning; deps→ui; 47 add tests. |
| T8 sync-registry blocks | 2026-05-28 | 96 | parse `isBlock`; main partitions blocks out of the component walker; `validateBlockFiles` errors on missing block files under packages/blocks; sync clean (118), scripts typecheck. |
| T9 discovery | 2026-05-28 | 97 | help `groupByCategory` excludes blocks + new `groupBlocks`/Blocks section; list separates components(ui)/blocks(aliases.blocks); MCP list/get surface `type`; 191 tests. |
| T10 init blocks alias | 2026-05-28 | 98 | interactive init prompts for blocks path → `aliases.blocks` via toAlias; --defaults/--yes already covered by getDefaultConfig; 191 tests. |
| T12 login block | 2026-05-28 | 96 | `packages/blocks/login` (card/input/label/button/checkbox), OnPush+class+responsive+RTL; registry entry type:block/auth; block-install test; CLI install→fixture `ng build` SUCCEEDED. |
| T13 dashboard block | 2026-05-28 | 97 | `packages/blocks/dashboard` (cards/bar-chart/table/avatar/badge); responsive grid + overflow-x-auto; logical `text-end` RTL; registry type:block/dashboard; fixture `ng build` SUCCEEDED. (2 rounds) |
| T14 settings-profile | 2026-05-28 | 96 | `packages/blocks/settings-profile` (card/input/textarea/label/avatar/button/separator); computed initials; responsive grid + form ngSubmit; registry type:block/settings; fixture `ng build` SUCCEEDED. |
| T15 pricing block | 2026-05-28 | 97 | `packages/blocks/pricing` (card/button/badge/separator/icon); 3 tiers, highlighted plan via cn, icon check features, md:grid-cols-3 equal-height; registry type:block/marketing; fixture `ng build` SUCCEEDED. |
