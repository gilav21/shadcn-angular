/**
 * A CLI regression spec is a tiny async function that exercises the CLI
 * in the fixture-app and asserts on its behavior (stdout content, exit
 * code, files on disk). It runs AFTER the orchestrator has reset the
 * fixture, but does NOT need `ng serve` / Playwright — these tests don't
 * render anything in a browser.
 *
 * The spec receives helpers so it doesn't need to import them from the
 * orchestrator internals.
 */
export interface CliSpecContext {
    /** Run the CLI inheriting stdio; throws on non-zero exit. */
    runCli(args: readonly string[]): Promise<void>;
    /** Run the CLI, return combined stdout+stderr and exit code. */
    captureCli(args: readonly string[]): Promise<{ stdout: string; code: number }>;
    /** Absolute path to the fixture-app's root. */
    fixtureApp: string;
}

export type CliSpec = (ctx: CliSpecContext) => Promise<void>;

/** Throws if `haystack` doesn't contain `needle`. */
export function assertContains(haystack: string, needle: string, message?: string): void {
    if (!haystack.includes(needle)) {
        throw new Error(
            (message ?? `Expected output to contain ${JSON.stringify(needle)}`) +
            `\n--- actual output ---\n${haystack}\n--- end ---`,
        );
    }
}

/** Throws if `haystack` DOES contain `needle`. */
export function assertNotContains(haystack: string, needle: string, message?: string): void {
    if (haystack.includes(needle)) {
        throw new Error(
            (message ?? `Expected output NOT to contain ${JSON.stringify(needle)}`) +
            `\n--- actual output ---\n${haystack}\n--- end ---`,
        );
    }
}

export function assertEquals<T>(actual: T, expected: T, label: string): void {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}
