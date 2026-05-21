import fs from 'node:fs';
import { run } from './spawn.js';
import {
    assertFixtureClean,
    resetFixtureApp,
} from './reset-app.js';
import {
    ensureCliBuilt,
    npmInstall,
    runCli,
} from './run-cli.js';
import { installHarness } from './install-harness.js';
import { serve } from './serve.js';
import { REPO_ROOT, harnessDir } from './paths.js';
import path from 'node:path';

interface ComponentSpec {
    /** Component name in the registry, e.g. "button". */
    readonly name: string;
    /** Optional `init` CLI args. Defaults to `--yes`. Used by the prefix test. */
    readonly initArgs?: readonly string[];
    /** Display label for logs and spec-file resolution. Defaults to `name`. */
    readonly label?: string;
    /**
     * Harness folder under `e2e/harness/`. Defaults to `name`. Useful when
     * the same component is exercised by multiple specs with different demo
     * pages (e.g. the --prefix test needs a demo that uses `<acme-button>`).
     */
    readonly harnessFolder?: string;
}

const ALL_COMPONENTS: readonly ComponentSpec[] = [
    // foundation
    { name: 'button' }, { name: 'badge' }, { name: 'input' },
    { name: 'checkbox' }, { name: 'label' },
    // interactive
    { name: 'dialog' }, { name: 'dropdown-menu' }, { name: 'popover' },
    { name: 'tooltip' }, { name: 'select' },
    // forms
    { name: 'input-otp' }, { name: 'date-picker' }, { name: 'slider' },
    { name: 'switch' }, { name: 'radio-group' },
    // CLI feature smoke test — installs the button component under a custom
    // prefix, then renders it with a dedicated harness that uses
    // `<acme-button>` directly.
    {
        name: 'button',
        label: 'prefix-button',
        harnessFolder: 'prefix-button',
        initArgs: ['init', '--yes', '--prefix', 'acme'],
    },
];

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
    const label = spec.label ?? spec.name;
    const started = Date.now();

    console.log(`\n[e2e] === ${label} ===`);

    let server: { stop(): Promise<void> } | null = null;
    try {
        await resetFixtureApp();
        await assertFixtureClean('after reset');

        await runCli([...(spec.initArgs ?? ['init', '--yes'])]);
        await runCli(['add', spec.name, '--yes']);
        await npmInstall();

        installHarness(spec.harnessFolder ?? spec.name);

        server = await serve();
        await runPlaywrightSpec(spec.harnessFolder ?? spec.label ?? spec.name, flags);

        return { label, passed: true, durationMs: Date.now() - started };
    } catch (err: unknown) {
        const error = err instanceof Error ? err.message : String(err);
        return { label, passed: false, durationMs: Date.now() - started, error };
    } finally {
        if (server) await server.stop();
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
        .replace(/\\/g, '/');

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

    if (names.length === 0) return { components: ALL_COMPONENTS, flags };

    const requested = new Set(names);
    const matched = ALL_COMPONENTS.filter(c => requested.has(c.label ?? c.name));
    const unknown = names.filter(
        r => !ALL_COMPONENTS.some(c => (c.label ?? c.name) === r),
    );
    if (unknown.length > 0) {
        console.error(`[e2e] Unknown component(s): ${unknown.join(', ')}`);
        console.error('[e2e] Available: ' +
            ALL_COMPONENTS.map(c => c.label ?? c.name).join(', '));
        process.exit(2);
    }
    return { components: matched, flags };
}

async function main(): Promise<void> {
    const { components, flags } = parseArgs();
    const mode = describeMode(flags);
    console.log(`[e2e] Running ${components.length} component(s)${mode}: ` +
        components.map(c => c.label ?? c.name).join(', '));

    await ensureCliBuilt();

    const results: RunResult[] = [];
    for (const spec of components) {
        results.push(await runOne(spec, flags));
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
