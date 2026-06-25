import fs from 'node:fs';
import { run } from './spawn.js';
import {
    assertFixtureClean,
    resetFixtureApp,
} from './reset-app.js';
import {
    captureCli,
    ensureCliBuilt,
    npmInstall,
    runCli,
} from './run-cli.js';
import { installHarness } from './install-harness.js';
import { serve } from './serve.js';
import { FIXTURE_APP, REPO_ROOT, harnessDir } from './paths.js';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CliSpec } from '../cli-specs/_types.js';
import {
    ALL_COMPONENTS,
    CLI_SPECS,
    specHarness,
    specLabel,
    type ComponentSpec,
} from './specs.js';

// Force the Angular CLI non-interactive for every `ng` the suite spawns
// (`ng build`/`ng serve` in the scaffolded consumer apps). Without this the
// CLI's first-run analytics prompt ("share usage data … with the Angular Team
// at Google") blocks on stdin and the run hangs. Child processes inherit
// `process.env`, so setting it once here covers all spawn sites.
process.env['NG_CLI_ANALYTICS'] ||= 'false';

interface RunResult {
    readonly label: string;
    readonly passed: boolean;
    readonly durationMs: number;
    readonly error?: string;
}

interface CliFlags {
    /** `--headed` — show the browser window during the run. */
    readonly headed: boolean;
    /** `--ui` — open Playwright's interactive UI Mode (blocks until you close it). */
    readonly ui: boolean;
    /** `--debug` — open the Playwright Inspector, step through actions. */
    readonly debug: boolean;
    /**
     * `--remote` — install components by fetching from GitHub raw instead of
     * the local monorepo copy, exercising the real network path (registry.json
     * + component/lib files). Implied by `--branch`.
     */
    readonly remote: boolean;
    /**
     * `--branch <name>` — fetch from this GitHub branch (implies `--remote`).
     * Use to validate a pushed feature branch end-to-end before merge.
     */
    readonly branch?: string;
}

const VALUELESS_FLAGS = new Set(['--headed', '--ui', '--debug', '--remote']);

/** Extra `init`/`add` args that force the CLI to fetch from a remote branch. */
function remoteCliArgs(flags: CliFlags): string[] {
    if (flags.branch) return ['--remote', '--branch', flags.branch];
    if (flags.remote) return ['--remote'];
    return [];
}

async function runOne(spec: ComponentSpec, flags: CliFlags): Promise<RunResult> {
    const label = specLabel(spec);
    const started = Date.now();

    console.log(`\n[e2e] === ${label} ===`);

    let server: { stop(): Promise<void> } | null = null;
    try {
        await resetFixtureApp();
        await assertFixtureClean('after reset');

        const remoteArgs = remoteCliArgs(flags);
        await runCli([...(spec.initArgs ?? ['init', '--yes']), ...remoteArgs]);
        await runCli(['add', ...spec.names, '--yes', ...remoteArgs]);
        await npmInstall();

        installHarness(specHarness(spec));

        server = await serve();
        await runPlaywrightSpec(specHarness(spec), flags);

        return { label, passed: true, durationMs: Date.now() - started };
    } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err);
        return { label, passed: false, durationMs: Date.now() - started, error };
    } finally {
        if (server) await server.stop();
    }
}

async function runCliSpec(label: string, moduleName: string): Promise<RunResult> {
    const started = Date.now();
    console.log(`\n[e2e] === ${label} (cli) ===`);
    try {
        await resetFixtureApp();
        await assertFixtureClean('after reset');

        const modulePath = path.join(REPO_ROOT, 'e2e/cli-specs', moduleName + '.ts');
        const imported = await import(pathToFileURL(modulePath).href) as { default: CliSpec };
        await imported.default({
            runCli,
            captureCli,
            fixtureApp: FIXTURE_APP,
        });

        return { label, passed: true, durationMs: Date.now() - started };
    } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err);
        return { label, passed: false, durationMs: Date.now() - started, error };
    }
}

async function runPlaywrightSpec(specFolder: string, flags: CliFlags): Promise<void> {
    const specFile = path.join(harnessDir(specFolder), `${specFolder}.spec.ts`);
    if (!fs.existsSync(specFile)) {
        throw new Error(`Spec file not found: ${specFile}`);
    }
    // Playwright resolves test-file args against its `testDir`. Pass the
    // path relative to that root (`e2e/harness/`) so it actually matches.
    const relSpec = path.relative(path.join(REPO_ROOT, 'e2e/harness'), specFile)
        .replaceAll('\\', '/');

    const args = ['playwright', 'test', relSpec, '--config', 'e2e/playwright.config.ts'];
    // --ui and --debug both open an interactive UI that blocks until the
    // user closes it. --headed just opens the browser window during a
    // normal run. Flags are mutually compatible with Playwright's CLI
    // expectations (e.g. --ui implies headed already).
    if (flags.ui) args.push('--ui');
    if (flags.debug) args.push('--debug');
    if (flags.headed && !flags.ui && !flags.debug) args.push('--headed');

    await run('npx', args, { cwd: REPO_ROOT });
}

interface ParsedArgs {
    readonly components: readonly ComponentSpec[];
    readonly cliSpecs: ReadonlyArray<{ label: string; module: string }>;
    readonly flags: CliFlags;
}

function parseRawArgs(raw: readonly string[]): { flags: CliFlags; names: string[] } {
    let headed = false, ui = false, debug = false, remote = false;
    let branch: string | undefined;
    const names: string[] = [];
    const unknownFlags: string[] = [];

    for (let i = 0; i < raw.length; i++) {
        const arg = raw[i];
        if (arg === '--branch') {
            branch = raw[++i];
            if (!branch || branch.startsWith('--')) {
                console.error('[e2e] --branch requires a branch name (e.g. --branch feat/x)');
                process.exit(2);
            }
        } else if (arg === '--headed') headed = true;
        else if (arg === '--ui') ui = true;
        else if (arg === '--debug') debug = true;
        else if (arg === '--remote') remote = true;
        else if (arg.startsWith('--')) unknownFlags.push(arg);
        else names.push(arg);
    }

    if (unknownFlags.length > 0) {
        console.error(`[e2e] Unknown flag(s): ${unknownFlags.join(', ')}`);
        console.error(`[e2e] Available flags: ${[...VALUELESS_FLAGS].join(', ')}, --branch <name>`);
        process.exit(2);
    }

    return { flags: { headed, ui, debug, remote: remote || !!branch, branch }, names };
}

function parseArgs(): ParsedArgs {
    const { flags, names } = parseRawArgs(process.argv.slice(2));

    if (names.length === 0) {
        // Remote runs validate the install/fetch path; the CLI-mechanics specs
        // run against the local CLI and add no remote-fetch coverage, so skip
        // them (notably add-all-smoke, which would install everything locally).
        const cliSpecs = flags.remote ? [] : CLI_SPECS;
        return { components: ALL_COMPONENTS, cliSpecs, flags };
    }

    const requested = new Set(names);
    const components = ALL_COMPONENTS.filter(c => requested.has(specLabel(c)));
    const cliSpecs = CLI_SPECS.filter(s => requested.has(s.label));
    const allLabels = [
        ...ALL_COMPONENTS.map(specLabel),
        ...CLI_SPECS.map(s => s.label),
    ];
    const unknown = names.filter(r => !allLabels.includes(r));
    if (unknown.length > 0) {
        console.error(`[e2e] Unknown name(s): ${unknown.join(', ')}`);
        console.error('[e2e] Available: ' + allLabels.join(', '));
        process.exit(2);
    }
    return { components, cliSpecs, flags };
}

async function main(): Promise<void> {
    const { components, cliSpecs, flags } = parseArgs();
    const mode = describeMode(flags);
    const labels = [
        ...components.map(c => specLabel(c)),
        ...cliSpecs.map(s => s.label),
    ];
    console.log(`[e2e] Running ${labels.length} spec(s)${mode}: ${labels.join(', ')}`);

    await ensureCliBuilt();

    const results: RunResult[] = [];
    for (const spec of components) {
        results.push(await runOne(spec, flags));
    }
    for (const spec of cliSpecs) {
        results.push(await runCliSpec(spec.label, spec.module));
    }

    printSummary(results);
    const failed = results.filter(r => !r.passed).length;
    process.exit(failed);
}

function describeMode(flags: CliFlags): string {
    const parts: string[] = [];
    if (flags.ui) parts.push('ui mode');
    else if (flags.debug) parts.push('debug mode');
    else if (flags.headed) parts.push('headed');
    if (flags.branch) parts.push(`remote: ${flags.branch}`);
    else if (flags.remote) parts.push('remote: master');
    return parts.length > 0 ? ` [${parts.join(', ')}]` : '';
}

function printSummary(results: readonly RunResult[]): void {
    console.log('\n[e2e] === Summary ===');
    for (const r of results) {
        const mark = r.passed ? '✓' : '✗';
        const secs = (r.durationMs / 1000).toFixed(1);
        console.log(`  ${mark} ${r.label.padEnd(20)} ${secs}s${r.error ? '  ' + r.error : ''}`);
    }
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    console.log(`\n[e2e] ${passed}/${total} passed`);
}

main().catch(err => {
    console.error('[e2e] Fatal:', err);
    process.exit(99);
});
