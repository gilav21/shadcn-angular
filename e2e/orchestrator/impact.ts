/**
 * Test impact analyzer for CI. Reads the list of changed files between
 * a base ref and HEAD via `git diff`, classifies each file, and emits
 * one of three outcomes on stdout:
 *
 *   ALL           — a tripwire was touched (CLI source, orchestrator,
 *                   fixture-app, shared lib, workflow, root deps), so
 *                   every spec needs to run.
 *   NONE          — no changed file impacts any spec; CI can skip the
 *                   suite entirely.
 *   "a b c d"     — space-separated list of spec labels to run.
 *
 * The workflow consumes this output and either runs `npm run e2e` (ALL),
 * `npm run e2e -- a b c d` (subset), or short-circuits the job (NONE).
 *
 * Usage:
 *   tsx e2e/orchestrator/impact.ts --base <git-ref>
 *
 * Local examples:
 *   npm run e2e:impact -- --base origin/master
 *   npm run e2e:impact -- --base HEAD~5
 */
import { execSync } from 'node:child_process';
import { ALL_COMPONENTS, CLI_SPECS, specLabel } from './specs.js';

/**
 * Patterns whose change should fan out to the full suite. Tripwires are
 * files whose meaning is "this affects how every install behaves" — the
 * CLI itself, the orchestrator, the fixture-app, shared lib code, the
 * Playwright config, the workflow, and root package metadata.
 */
const TRIPWIRES: readonly RegExp[] = [
    /^packages\/cli\//,
    /^packages\/components\/lib\//,
    /^e2e\/orchestrator\//,
    /^e2e\/cli-specs\//,
    /^e2e\/fixture-app\//,
    /^e2e\/playwright\.config\.ts$/,
    /^\.github\/workflows\/e2e\.yml$/,
    /^package\.json$/,
    /^package-lock\.json$/,
];

/**
 * Returns the set of spec labels whose `names[]` overlaps with the given
 * component name. A component change typically touches a single ui/X/
 * folder; multi-install specs that include X then also need to run.
 */
function specsTouchingComponent(name: string): readonly string[] {
    const labels: string[] = [];
    for (const spec of ALL_COMPONENTS) {
        if (spec.names.includes(name)) labels.push(specLabel(spec));
    }
    return labels;
}

/**
 * Returns the spec label whose harness folder matches the given
 * directory name, or null if none does. Harness-only changes scope to
 * exactly that spec.
 */
function specForHarnessFolder(folder: string): string | null {
    for (const spec of ALL_COMPONENTS) {
        const harness = spec.harnessFolder ?? specLabel(spec);
        if (harness === folder) return specLabel(spec);
    }
    return null;
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
                // to run everything; the orchestrator will surface the
                // missing registration when run.
                return { kind: 'all', specs: [] };
            }
            continue;
        }

        // Per-component source change: any spec that installs this
        // component is potentially affected.
        const componentMatch = /^packages\/components\/ui\/([^/]+)\//.exec(file);
        if (componentMatch) {
            for (const label of specsTouchingComponent(componentMatch[1])) {
                impacted.add(label);
            }
            continue;
        }

        // Anything else (docs, demo app, storybook configs, etc.) is
        // irrelevant to the e2e pipeline — ignore.
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

    // CLI_SPECS are not currently mapped to component deps — they're
    // CLI regression tests whose deps are the CLI itself, already a
    // tripwire. So when the decision is `subset`, CLI specs aren't
    // included; they only run on tripwire (= ALL). If someone changes
    // a single CLI spec module, the cli-specs/** tripwire catches it
    // and runs the full suite anyway. Document this so it's not
    // surprising.
    void CLI_SPECS;

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
