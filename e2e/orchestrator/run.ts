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
}

const KNOWN_FLAGS = new Set(['--headed', '--ui', '--debug']);

async function runOne(spec: ComponentSpec, flags: CliFlags): Promise<RunResult> {
    const label = specLabel(spec);
    const started = Date.now();

    console.log(`\n[e2e] === ${label} ===`);

    let server: { stop(): Promise<void> } | null = null;
    try {
        await resetFixtureApp();
        await assertFixtureClean('after reset');

        await runCli([...(spec.initArgs ?? ['init', '--yes'])]);
        await runCli(['add', ...spec.names, '--yes']);
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

function parseArgs(): ParsedArgs {
    const raw = process.argv.slice(2);
    const flags: CliFlags = {
        headed: raw.includes('--headed'),
        ui: raw.includes('--ui'),
        debug: raw.includes('--debug'),
    };

    const names = raw.filter(a => !a.startsWith('--'));
    const unknownFlags = raw.filter(a => a.startsWith('--') && !KNOWN_FLAGS.has(a));
    if (unknownFlags.length > 0) {
        console.error(`[e2e] Unknown flag(s): ${unknownFlags.join(', ')}`);
        console.error(`[e2e] Available flags: ${[...KNOWN_FLAGS].join(', ')}`);
        process.exit(2);
    }

    if (names.length === 0) {
        return { components: ALL_COMPONENTS, cliSpecs: CLI_SPECS, flags };
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
    if (flags.ui) return ' [ui mode]';
    if (flags.debug) return ' [debug mode]';
    if (flags.headed) return ' [headed]';
    return '';
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
