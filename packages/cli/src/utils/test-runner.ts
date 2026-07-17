import fs from 'fs-extra';
import path from 'node:path';
import prompts from 'prompts';
import { isTestRunner, type Config, type TestRunner } from './config.js';

/** What a consumer project's dependency/config surface says about its runner. */
export type RunnerDetection = TestRunner | 'both' | 'none';

const VITEST_MARKERS = ['vitest', '@analogjs/vitest-angular'] as const;
const JEST_MARKERS = ['jest', 'jest-preset-angular', '@types/jest'] as const;
const VITEST_CONFIGS = ['vitest.config.ts', 'vitest.config.mts', 'vitest.config.js', 'vitest.config.mjs'] as const;
const JEST_CONFIGS = ['jest.config.ts', 'jest.config.js', 'jest.config.mjs', 'jest.config.cjs', 'jest.config.json'] as const;

function readDependencyNames(cwd: string): Set<string> {
    const pkgPath = path.join(cwd, 'package.json');
    if (!fs.pathExistsSync(pkgPath)) return new Set();
    try {
        const pkg: unknown = fs.readJsonSync(pkgPath);
        const record = pkg as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
        return new Set([...Object.keys(record.dependencies ?? {}), ...Object.keys(record.devDependencies ?? {})]);
    } catch {
        return new Set();
    }
}

function hasAny(haystack: ReadonlySet<string>, needles: readonly string[]): boolean {
    return needles.some(n => haystack.has(n));
}

function hasConfigFile(cwd: string, names: readonly string[]): boolean {
    return names.some(n => fs.pathExistsSync(path.join(cwd, n)));
}

/**
 * Detect the consumer's test runner from its package.json dependencies, with
 * config-file presence as a tiebreaker when both (or neither) are declared.
 */
export function detectTestRunner(cwd: string): RunnerDetection {
    const deps = readDependencyNames(cwd);
    const vitest = hasAny(deps, VITEST_MARKERS) || hasConfigFile(cwd, VITEST_CONFIGS);
    const jest = hasAny(deps, JEST_MARKERS) || hasConfigFile(cwd, JEST_CONFIGS);
    if (vitest && jest) return 'both';
    if (vitest) return 'vitest';
    if (jest) return 'jest';
    return 'none';
}

async function promptRunner(detected: RunnerDetection): Promise<TestRunner | null> {
    const hint = detected === 'both'
        ? 'Both vitest and jest are present in this project.'
        : 'Neither vitest nor jest was detected in this project.';
    const response = await prompts({
        type: 'select',
        name: 'runner',
        message: `${hint} Which runner should the installed tests target?`,
        choices: [
            { title: 'vitest', value: 'vitest' },
            { title: 'jest', value: 'jest' },
        ],
    });
    return isTestRunner(response.runner) ? response.runner : null;
}

export interface ResolveRunnerOptions {
    /** True when the CLI may prompt (interactive `add` without `--yes`). */
    readonly interactive: boolean;
}

/**
 * Resolve the runner installed tests are transformed for: the persisted
 * `tests.runner` wins, then unambiguous detection; an ambiguous project is
 * prompted when interactive, and defaults to vitest (with a warning) when not.
 * Returns null only when an interactive prompt was cancelled.
 */
export async function resolveRunner(
    config: Pick<Config, 'tests'>,
    cwd: string,
    options: ResolveRunnerOptions,
): Promise<TestRunner | null> {
    const persisted = config.tests?.runner;
    if (persisted) return persisted;

    const detected = detectTestRunner(cwd);
    if (detected === 'vitest' || detected === 'jest') return detected;

    if (options.interactive) return promptRunner(detected);

    console.warn(
        detected === 'both'
            ? '⚠ Both vitest and jest detected — defaulting installed tests to vitest. Set tests.runner in components.json to choose.'
            : '⚠ No test runner detected — defaulting installed tests to vitest. Set tests.runner in components.json to choose.',
    );
    return 'vitest';
}
