import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig, writeConfig, isTestRunner, TEST_RUNNERS, type TestRunner } from '../utils/config.js';
import { resolveProjectPath, aliasToProjectPath } from '../utils/paths.js';
import { readManifest, writeManifest, recordFile, removeFiles, type Manifest } from '../core/manifest.js';
import { fetchLibContent, type FetchOptions } from '../core/fetch.js';
import { rewriteVitestToShim, rewriteShimToVitest, VITEST_COMPAT_LIB_FILE } from '../utils/test-transform.js';
import { hasJestGlobals } from '../utils/test-runner.js';

/** What the shim file did during a runner switch. */
export type ShimAction = 'installed' | 'removed' | 'unchanged';

export interface SetTestRunnerResult {
    readonly runner: TestRunner;
    /** Installed spec files whose `vitest`/shim import was rewritten. */
    readonly rewritten: string[];
    readonly shim: ShimAction;
    readonly warnings: string[];
    readonly dryRun: boolean;
}

export interface SetTestRunnerOptions extends FetchOptions {
    readonly dryRun?: boolean;
}

/** Every installed spec file (ui-relative) recorded in the manifest. */
function installedSpecKeys(manifest: Manifest): string[] {
    return Object.keys(manifest.files).filter(k => k.endsWith('.spec.ts'));
}

/**
 * Rewrite each installed spec's import to the target runner, in place. The
 * transform is surgical (only the `vitest`/shim specifier) and idempotent, so a
 * spec already on the target runner is left untouched. The manifest baseline is
 * advanced to the rewritten content — the switch is a sanctioned project-wide
 * transform, not a user edit.
 */
async function rewriteInstalledSpecs(
    manifest: Manifest, uiDir: string, runner: TestRunner, utilsAlias: string, dryRun: boolean,
): Promise<string[]> {
    const rewritten: string[] = [];
    for (const key of installedSpecKeys(manifest)) {
        const abs = path.join(uiDir, key);
        if (!await fs.pathExists(abs)) continue;
        const current = await fs.readFile(abs, 'utf-8');
        const next = runner === 'jest'
            ? rewriteVitestToShim(current, utilsAlias)
            : rewriteShimToVitest(current, utilsAlias);
        if (next === current) continue;
        rewritten.push(key);
        if (!dryRun) {
            await fs.writeFile(abs, next);
            recordFile(manifest, key, next, manifest.files[key].component);
        }
    }
    return rewritten;
}

/** Install the compat shim for jest (fetching it if missing); warn on absent `@jest/globals`. */
async function ensureShimForJest(
    manifest: Manifest, cwd: string, libDir: string, options: SetTestRunnerOptions, warnings: string[],
): Promise<ShimAction> {
    if (!hasJestGlobals(cwd)) {
        warnings.push('The vitest-compat shim imports @jest/globals — add it with `npm i -D @jest/globals`.');
    }
    const shimPath = path.join(libDir, VITEST_COMPAT_LIB_FILE);
    if (await fs.pathExists(shimPath)) return 'unchanged';
    if (!options.dryRun) {
        const content = await fetchLibContent(VITEST_COMPAT_LIB_FILE, options);
        await fs.ensureDir(path.dirname(shimPath));
        await fs.writeFile(shimPath, content);
        recordFile(manifest, VITEST_COMPAT_LIB_FILE, content, '(lib)');
    }
    return 'installed';
}

/** Remove the compat shim when switching to vitest (every spec now imports `vitest`). */
async function removeShimForVitest(
    manifest: Manifest, libDir: string, dryRun: boolean,
): Promise<ShimAction> {
    const shimPath = path.join(libDir, VITEST_COMPAT_LIB_FILE);
    if (!await fs.pathExists(shimPath)) return 'unchanged';
    if (!dryRun) {
        await fs.remove(shimPath);
        removeFiles(manifest, [VITEST_COMPAT_LIB_FILE]);
    }
    return 'removed';
}

async function reconcileShim(
    manifest: Manifest, cwd: string, libDir: string, runner: TestRunner,
    hasSpecs: boolean, options: SetTestRunnerOptions, warnings: string[],
): Promise<ShimAction> {
    if (runner === 'jest') {
        return hasSpecs ? ensureShimForJest(manifest, cwd, libDir, options, warnings) : 'unchanged';
    }
    return removeShimForVitest(manifest, libDir, options.dryRun ?? false);
}

/**
 * Switch the project's installed component tests between vitest and jest:
 * rewrite each spec's import in place, install or remove the vitest-compat
 * shim, and persist `tests.runner`. No re-fetch of spec sources — local spec
 * edits are preserved. Reused by the CLI command and the MCP tool.
 */
export async function setTestRunnerCore(
    runner: TestRunner, cwd: string, options: SetTestRunnerOptions,
): Promise<SetTestRunnerResult> {
    const config = await getConfig(cwd);
    if (!config) throw new Error('Project not initialized — run shadcn-angular init first.');

    const dryRun = options.dryRun ?? false;
    const warnings: string[] = [];
    const uiDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.ui || 'src/components/ui'));
    const libDir = resolveProjectPath(cwd, aliasToProjectPath(config.aliases.utils));
    const manifest = await readManifest(cwd);

    const rewritten = await rewriteInstalledSpecs(manifest, uiDir, runner, config.aliases.utils, dryRun);
    const shim = await reconcileShim(
        manifest, cwd, libDir, runner, installedSpecKeys(manifest).length > 0, options, warnings,
    );

    if (!dryRun) {
        config.tests = { include: config.tests?.include ?? true, runner };
        await writeConfig(cwd, config);
        await writeManifest(cwd, manifest);
    }
    return { runner, rewritten, shim, warnings, dryRun };
}

function summaryLine(result: SetTestRunnerResult): string {
    const verb = result.dryRun ? 'Would switch' : 'Switched';
    const shimNote = result.shim === 'unchanged' ? '' : `, shim ${result.shim}`;
    return `${verb} installed tests to ${result.runner} (${result.rewritten.length} spec file(s) rewritten${shimNote}).`;
}

export interface SetTestRunnerCliOptions {
    readonly dryRun?: boolean;
    readonly branch: string;
    readonly registry?: string;
    readonly remote?: boolean;
}

export async function setTestRunner(
    runner: string, options: SetTestRunnerCliOptions, cwd = process.cwd(),
): Promise<void> {
    if (!isTestRunner(runner)) {
        console.error(chalk.red(`Error: runner must be one of ${TEST_RUNNERS.join(', ')}. Got: "${runner}"`));
        process.exit(1);
    }
    const spinner = ora(`Switching installed tests to ${runner}…`).start();
    try {
        const result = await setTestRunnerCore(runner, cwd, {
            dryRun: options.dryRun, branch: options.branch, registry: options.registry, remote: options.remote,
        });
        spinner.succeed(chalk.green(summaryLine(result)));
        for (const w of result.warnings) console.log(chalk.yellow('  ' + w));
    } catch (error) {
        spinner.fail(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
    }
}
