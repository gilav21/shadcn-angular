#!/usr/bin/env tsx
/**
 * Portable-test verification gate for `add --include-tests`.
 *
 * For each requested component (or every component in
 * `packages/components/portable-tests.json` when run with `--all`), runs its
 * spec files under the jsdom, no-browser, globals-off vitest config
 * (`vitest.portable.config.ts`) with coverage scoped to that component's source
 * files, and fails unless the specs pass AND coverage clears the target
 * (100% lines by default, or the per-component floor recorded in
 * `portable-tests.json`'s `coverageExceptions`).
 *
 * This is the per-component done-gate for the portability campaign and the
 * local regression gate for already-verified components. It does NOT validate
 * the jest leg — that is exercised end-to-end by the e2e harness against a real
 * jest consumer, where jest-preset-angular is installed.
 *
 * Usage:
 *   tsx packages/cli/scripts/verify-portable.ts <component...>
 *   tsx packages/cli/scripts/verify-portable.ts --all
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registry } from '../src/registry/index.js';
import { loadPortableTestsConfig, type CoverageException } from './sync-registry-lib';

// `vitest/vitest.mjs` is the bin but is not in the package `exports` map, so
// resolve the (exported) package.json and join the bin path beside it.
const VITEST_BIN = path.join(
    path.dirname(createRequire(import.meta.url).resolve('vitest/package.json')),
    'vitest.mjs',
);

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..');
const COMPONENTS_ROOT = path.resolve(SCRIPT_DIR, '../../components');
const COVERAGE_SUMMARY = path.join(REPO_ROOT, 'coverage-portable', 'coverage-summary.json');
const JEST_FIXTURE_RUN = path.join(REPO_ROOT, 'e2e/jest-fixture/run.mjs');
const DEFAULT_LINE_TARGET = 100;

interface ComponentTarget {
    readonly name: string;
    readonly testFiles: readonly string[];
    readonly files: readonly string[];
}

interface CoverageTotals {
    readonly lines: { readonly pct: number };
}

/** Resolve the components to verify from argv (`--all` → every verified entry). */
function resolveTargets(argv: string[]): ComponentTarget[] {
    const config = loadPortableTestsConfig(COMPONENTS_ROOT);
    const names = argv.includes('--all') ? config.verified : argv.filter(a => !a.startsWith('--'));
    if (names.length === 0) {
        throw new Error('Name at least one component, or pass --all to verify every entry in portable-tests.json.');
    }
    return names.map(name => {
        const entry = registry[name as keyof typeof registry];
        if (!entry) throw new Error(`Unknown component "${name}".`);
        const testFiles = entry.testFiles ?? [];
        if (testFiles.length === 0) throw new Error(`"${name}" has no testFiles — run sync-registry after verifying it portable.`);
        return { name, testFiles, files: entry.files };
    });
}

/** The line-coverage floor this component must clear (an exception lowers it, with a reason). */
function coverageFloor(name: string, exceptions: Readonly<Record<string, CoverageException>> | undefined): number {
    return exceptions?.[name]?.lines ?? DEFAULT_LINE_TARGET;
}

/** Run the component's specs under the portable config with scoped coverage; true when they pass. */
function runSpecs(target: ComponentTarget): boolean {
    const specPaths = target.testFiles.map(f => path.join('packages/components/ui', f));
    const result = spawnSync(process.execPath, [
        VITEST_BIN, 'run',
        '--config', 'vitest.portable.config.ts',
        '--coverage',
        `--coverage.include=packages/components/ui/${target.name}/**/*.ts`,
        ...specPaths,
    ], { cwd: REPO_ROOT, stdio: 'inherit' });
    return result.status === 0;
}

/**
 * Run the component's shipped specs under a REAL jest consumer (the
 * e2e/jest-fixture, jest-preset-angular + zone). This catches zone-behavioral
 * failures the zoneless vitest jsdom leg cannot — so a component is only fully
 * portable when both legs pass. Requires the CLI to be built.
 */
function runJestLeg(name: string): boolean {
    const result = spawnSync(process.execPath, [JEST_FIXTURE_RUN, name], { cwd: REPO_ROOT, stdio: 'inherit' });
    return result.status === 0;
}

/** Read the total line-coverage percentage from the last portable run. */
function readLineCoverage(): number {
    if (!existsSync(COVERAGE_SUMMARY)) {
        throw new Error(`No coverage summary at ${COVERAGE_SUMMARY} — did the vitest run emit json-summary?`);
    }
    const summary = JSON.parse(readFileSync(COVERAGE_SUMMARY, 'utf-8')) as { total: CoverageTotals };
    return summary.total.lines.pct;
}

interface VerifyOutcome {
    readonly name: string;
    readonly passed: boolean;
    readonly detail: string;
}

function verifyOne(target: ComponentTarget, floor: number, withJest: boolean): VerifyOutcome {
    console.log(`\n▶ Verifying ${target.name} (${target.testFiles.length} spec file(s), floor ${floor}% lines${withJest ? ', +jest leg' : ''})…`);
    if (!runSpecs(target)) {
        return { name: target.name, passed: false, detail: 'specs failed under the portable (jsdom) config' };
    }
    const lines = readLineCoverage();
    if (lines < floor) {
        return { name: target.name, passed: false, detail: `line coverage ${lines}% < ${floor}% floor` };
    }
    if (withJest && !runJestLeg(target.name)) {
        return { name: target.name, passed: false, detail: `vitest jsdom green (${lines}% lines) but the jest leg failed` };
    }
    return { name: target.name, passed: true, detail: `specs green, ${lines}% lines${withJest ? ', jest leg green' : ''}` };
}

function main(): void {
    const argv = process.argv.slice(2);
    const withJest = argv.includes('--jest');
    const targets = resolveTargets(argv);
    const exceptions = loadPortableTestsConfig(COMPONENTS_ROOT).coverageExceptions;
    const outcomes = targets.map(t => verifyOne(t, coverageFloor(t.name, exceptions), withJest));

    console.log('\n── Portable verification ──');
    for (const o of outcomes) {
        console.log(`  ${o.passed ? '✓' : '✗'} ${o.name}: ${o.detail}`);
    }
    if (outcomes.some(o => !o.passed)) {
        console.error('\nVerification failed — the components above are not ready to ship tests.');
        process.exitCode = 1;
    } else {
        console.log(`\nAll ${outcomes.length} component(s) verified portable.`);
    }
}

const invokedPath = process.argv[1];
if (invokedPath && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
    try {
        main();
    } catch (error: unknown) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}
