/**
 * Test impact analyzer for CI. Reads the list of changed files between
 * a base ref and HEAD via `git diff`, classifies each file via the CLI
 * registry, and emits one of three outcomes on stdout:
 *
 *   ALL           — a tripwire was touched (CLI source, orchestrator,
 *                   fixture-app, workflow, root deps), so every spec
 *                   needs to run.
 *   NONE          — no changed file impacts any spec; CI can skip the
 *                   suite entirely.
 *   "a b c d"     — space-separated list of spec labels to run.
 *
 * The workflow consumes this output and either runs `npm run e2e` (ALL),
 * `npm run e2e -- a b c d` (subset), or short-circuits the job (NONE).
 *
 * The classification is registry-driven (single source of truth): for
 * each changed file under `packages/components/`, the analyzer asks the
 * CLI registry which component owns it, then schedules every spec that
 * installs that component OR any of its reverse-dependents. This is the
 * mechanism that makes `chart.utils.ts` schedule only chart specs (not
 * the whole suite) and `command.component.ts` schedule autocomplete
 * automatically.
 *
 * Usage:
 *   tsx e2e/orchestrator/impact.ts --base <git-ref>
 *
 * Local examples:
 *   npm run e2e:impact -- --base origin/master
 *   npm run e2e:impact -- --base HEAD~5
 */
import path from 'node:path';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    getComponentForFile,
    getComponentsUsingLibFile,
    getReverseDependents,
    type ComponentName,
} from '../../packages/cli/src/registry/index.js';
import { ALL_COMPONENTS, specLabel } from './specs.js';

const REGISTRY_FILE = 'packages/cli/src/registry/index.ts';

/**
 * Files whose change fans out to the full suite — they affect every
 * install behaviour independently of which component changed. The
 * registry-driven classification handles `packages/components/` itself,
 * so neither `ui/<X>/**` nor `lib/**` appear here anymore.
 *
 * The registry source file (`packages/cli/src/registry/index.ts`) is
 * data, not behaviour, so it's special-cased BEFORE the tripwire pass
 * and impacted entry-by-entry. The rest of `packages/cli/` is still a
 * blanket tripwire — real CLI code can affect any install.
 */
const TRIPWIRES: readonly RegExp[] = [
    /^packages\/cli\//,
    /^e2e\/orchestrator\//,
    /^e2e\/cli-specs\//,
    /^e2e\/fixture-app\//,
    /^e2e\/playwright\.config\.ts$/,
    /^\.github\/workflows\/e2e\.yml$/,
    /^package\.json$/,
    /^package-lock\.json$/,
];

/**
 * Spec labels whose `names[]` overlaps with the given component name.
 * A change to a component schedules every spec that installs it OR
 * (via the reverse-dep walk done by the caller) any component
 * depending on it.
 */
function specsTouchingComponent(name: string): readonly string[] {
    const labels: string[] = [];
    for (const spec of ALL_COMPONENTS) {
        if (spec.names.includes(name)) labels.push(specLabel(spec));
    }
    return labels;
}

/**
 * Spec label whose harness folder matches the given directory name, or
 * null if none does. Harness-only changes scope to exactly that spec.
 */
function specForHarnessFolder(folder: string): string | null {
    for (const spec of ALL_COMPONENTS) {
        const harness = spec.harnessFolder ?? specLabel(spec);
        if (harness === folder) return specLabel(spec);
    }
    return null;
}

/**
 * Set of components affected by a file change, registry-driven.
 *
 * - Direct hit (a `packages/components/ui/<X>/**` file owned by `X`)
 *   → `X` plus every component transitively depending on `X`.
 * - Lib-file hit (`packages/components/lib/<F>` referenced by N
 *   components) → all N + their reverse-dependents.
 * - Anything else → empty set.
 */
function affectedComponentsForFile(file: string): Set<ComponentName> {
    const out = new Set<ComponentName>();
    const direct = getComponentForFile(file);
    if (direct) {
        out.add(direct);
        for (const d of getReverseDependents(direct)) out.add(d);
        return out;
    }
    // Some libFiles are shared across multiple components (chart.utils,
    // chart.types). `getComponentForFile` returns only the first; ask
    // explicitly for the full set.
    if (file.startsWith('packages/components/lib/')) {
        const libName = path.basename(file);
        const users = getComponentsUsingLibFile(libName);
        for (const u of users) {
            out.add(u);
            for (const d of getReverseDependents(u)) out.add(d);
        }
    }
    return out;
}

/**
 * Extract `<name> → entire-block-text` from a registry source file.
 * Each entry's text spans from `<name>:` up to the matching closing
 * brace at the same indent level. Comparing block text catches changes
 * to any field (`files`, `dependencies`, `libFiles`, etc.) without
 * caring about the exact shape.
 *
 * The regex matches both bare identifiers (`eyedropper:`) and quoted
 * keys (`'color-picker':`) at the top level of `defineRegistry({...})`.
 */
export function parseRegistryEntries(source: string): Map<string, string> {
    const out = new Map<string, string>();
    const entryHeader = /^ {2}(?:'([\w-]+)'|([\w-]+)):\s*\{/gm;
    let match: RegExpExecArray | null;
    while ((match = entryHeader.exec(source)) !== null) {
        const name = match[1] ?? match[2];
        const start = match.index;
        const end = findMatchingBraceEnd(source, start + match[0].length - 1, start);
        out.set(name, source.slice(start, end));
    }
    return out;
}

/**
 * Walk forward from `from` (the entry's opening `{`) balancing braces,
 * returning the index just past the matching closing `}`. Falls back to
 * `fallback` if the braces never balance.
 */
function findMatchingBraceEnd(source: string, from: number, fallback: number): number {
    let depth = 0;
    for (let i = from; i < source.length; i++) {
        const c = source[i];
        if (c === '{') {
            depth++;
        } else if (c === '}') {
            depth--;
            if (depth === 0) return i + 1;
        }
    }
    return fallback;
}

/**
 * Diff two registry source strings and return the set of entry names
 * whose contents differ (added, removed, or modified). Used to scope
 * impact when only the registry source file changed.
 */
export function diffRegistryEntries(baseSource: string, headSource: string): Set<string> {
    const base = parseRegistryEntries(baseSource);
    const head = parseRegistryEntries(headSource);
    const changed = new Set<string>();
    const all = new Set<string>([...base.keys(), ...head.keys()]);
    for (const name of all) {
        if (base.get(name) !== head.get(name)) changed.add(name);
    }
    return changed;
}

/**
 * Load the registry file at `base` (via `git show`) and at HEAD (via
 * the working tree), then return the set of entry names that changed.
 * Returns null when the base version can't be read — caller should
 * fall back to ALL.
 */
function changedRegistryEntries(base: string): Set<string> | null {
    try {
        const baseSource = execSync(
            `git show ${base}:${REGISTRY_FILE}`,
            { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
        );
        const headSource = readFileSync(REGISTRY_FILE, 'utf-8');
        return diffRegistryEntries(baseSource, headSource);
    } catch {
        return null;
    }
}

interface ImpactResult {
    readonly kind: 'all' | 'none' | 'subset';
    /** Only populated when kind === 'subset'. */
    readonly specs: readonly string[];
}

function computeImpact(base: string, changedFiles: readonly string[]): ImpactResult {
    if (changedFiles.length === 0) {
        return { kind: 'none', specs: [] };
    }

    // The registry source file is data, not behaviour — handle it the
    // same way `packages/components/lib/**` is handled. The rest of
    // `packages/cli/` still falls through to the tripwire pass below.
    let registryChanged: Set<string> | null = null;
    let remaining: readonly string[] = changedFiles;
    if (changedFiles.includes(REGISTRY_FILE)) {
        registryChanged = changedRegistryEntries(base);
        if (registryChanged === null) {
            // Base version couldn't be read; safest is to run everything.
            return { kind: 'all', specs: [] };
        }
        remaining = changedFiles.filter(f => f !== REGISTRY_FILE);
    }

    if (remaining.some(f => TRIPWIRES.some(re => re.test(f)))) {
        return { kind: 'all', specs: [] };
    }

    const impacted = new Set<string>();

    if (registryChanged) {
        addRegistryImpact(registryChanged, impacted);
    }

    if (!addFileImpact(remaining, impacted)) {
        return { kind: 'all', specs: [] };
    }

    if (impacted.size === 0) {
        return { kind: 'none', specs: [] };
    }
    return { kind: 'subset', specs: [...impacted].sort() };
}

/**
 * For every changed registry entry, impact the specs touching that
 * component plus the specs touching each of its reverse dependents.
 */
function addRegistryImpact(registryChanged: Set<string>, impacted: Set<string>): void {
    for (const name of registryChanged) {
        // `name` is a registry entry key — treat it as a component
        // name for lookup. Both helpers tolerate unknown names
        // (return empty), so removed entries don't blow up.
        addLabelsForComponent(name, impacted);
        for (const dep of getReverseDependents(name as ComponentName)) {
            addLabelsForComponent(dep, impacted);
        }
    }
}

function addLabelsForComponent(component: string, impacted: Set<string>): void {
    for (const label of specsTouchingComponent(component)) {
        impacted.add(label);
    }
}

/**
 * Map each remaining changed file to impacted spec labels. Returns
 * false when a file forces a full run (a new harness folder without a
 * registered spec); true otherwise.
 */
function addFileImpact(remaining: readonly string[], impacted: Set<string>): boolean {
    for (const file of remaining) {
        // Per-harness changes scope to exactly that label.
        const harness = /^e2e\/harness\/([^/]+)\//.exec(file);
        if (harness) {
            const label = specForHarnessFolder(harness[1]);
            if (!label) {
                // New harness folder without a spec entry yet → safest
                // to run everything so the orchestrator surfaces the
                // missing registration.
                return false;
            }
            impacted.add(label);
            continue;
        }

        // Registry-driven component lookup. Any file under
        // packages/components/{ui,lib} that the registry knows about
        // maps to one (or many, for libFiles) components; impact those
        // components + everything depending on them, then translate to
        // specs.
        for (const c of affectedComponentsForFile(file)) {
            addLabelsForComponent(c, impacted);
        }

        // Anything else (docs, demo app, storybook configs, scripts
        // outside packages/cli, etc.) is irrelevant to the e2e pipeline.
        // Ignore.
    }
    return true;
}

function getChangedFiles(base: string): string[] {
    // `--diff-filter=ACMRT` keeps Added, Copied, Modified, Renamed,
    // type-changed entries. Deleted (D) and unmerged (U) files don't
    // need re-running by definition. The three-dot form (`A...B`) means
    // "B since the merge base with A" — what GitHub Actions PRs want.
    const stdout = execSync(
        `git diff --diff-filter=ACMRT --name-only ${base}...HEAD`,
        { encoding: 'utf-8' },
    );
    return stdout.split('\n').map(s => s.trim()).filter(Boolean);
}

function parseBase(): string {
    const i = process.argv.indexOf('--base');
    if (i === -1 || i === process.argv.length - 1) {
        console.error(
            '[e2e:impact] missing required --base <ref>. Example: --base origin/master',
        );
        process.exit(2);
    }
    return process.argv[i + 1];
}

function main(): void {
    const base = parseBase();
    let changed: string[];
    try {
        changed = getChangedFiles(base);
    } catch (err) {
        console.error(`[e2e:impact] git diff failed against ${base}:`, err);
        process.exit(3);
    }

    const result = computeImpact(base, changed);

    // Diagnostics go to stderr so the workflow can still grab the
    // single-line decision from stdout.
    console.error(`[e2e:impact] base=${base}`);
    console.error(`[e2e:impact] changed files: ${changed.length}`);
    for (const f of changed.slice(0, 20)) console.error(`  - ${f}`);
    if (changed.length > 20) console.error(`  … and ${changed.length - 20} more`);
    console.error(`[e2e:impact] decision: ${result.kind}` +
        (result.kind === 'subset' ? ` (${result.specs.length} specs)` : ''));

    switch (result.kind) {
        case 'all':
            console.log('ALL');
            return;
        case 'none':
            console.log('NONE');
            return;
        case 'subset':
            console.log(result.specs.join(' '));
            return;
    }
}

// Only run when invoked directly — guard so importing this module from
// a spec file doesn't trigger `process.exit` from `parseBase`.
const isEntry =
    Boolean(process.argv[1]) &&
    path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isEntry) main();
