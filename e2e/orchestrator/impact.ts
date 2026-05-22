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
import {
    getComponentForFile,
    getComponentsUsingLibFile,
    getReverseDependents,
    type ComponentName,
} from '../../packages/cli/src/registry/index.js';
import { ALL_COMPONENTS, specLabel } from './specs.js';

/**
 * Files whose change fans out to the full suite — they affect every
 * install behaviour independently of which component changed. The
 * registry-driven classification handles `packages/components/` itself,
 * so neither `ui/<X>/**` nor `lib/**` appear here anymore.
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

interface ImpactResult {
    readonly kind: 'all' | 'none' | 'subset';
    /** Only populated when kind === 'subset'. */
    readonly specs: readonly string[];
}

function computeImpact(changedFiles: readonly string[]): ImpactResult {
    if (changedFiles.length === 0) {
        return { kind: 'none', specs: [] };
    }

    if (changedFiles.some(f => TRIPWIRES.some(re => re.test(f)))) {
        return { kind: 'all', specs: [] };
    }

    const impacted = new Set<string>();

    for (const file of changedFiles) {
        // Per-harness changes scope to exactly that label.
        const harness = /^e2e\/harness\/([^/]+)\//.exec(file);
        if (harness) {
            const label = specForHarnessFolder(harness[1]);
            if (label) impacted.add(label);
            else {
                // New harness folder without a spec entry yet → safest
                // to run everything so the orchestrator surfaces the
                // missing registration.
                return { kind: 'all', specs: [] };
            }
            continue;
        }

        // Registry-driven component lookup. Any file under
        // packages/components/{ui,lib} that the registry knows about
        // maps to one (or many, for libFiles) components; impact those
        // components + everything depending on them, then translate to
        // specs.
        const components = affectedComponentsForFile(file);
        if (components.size > 0) {
            for (const c of components) {
                for (const label of specsTouchingComponent(c)) {
                    impacted.add(label);
                }
            }
            continue;
        }

        // Anything else (docs, demo app, storybook configs, scripts
        // outside packages/cli, etc.) is irrelevant to the e2e pipeline.
        // Ignore.
    }

    if (impacted.size === 0) {
        return { kind: 'none', specs: [] };
    }
    return { kind: 'subset', specs: [...impacted].sort() };
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

    const result = computeImpact(changed);

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

main();
