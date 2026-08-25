/**
 * Direct `axe-core` assertion for the component unit suite.
 *
 * ## Why this exists
 *
 * The a11y gate normally runs through Storybook's test-runner
 * (`npm run test-storybook:a11y`), which calls `axe-playwright`'s `checkA11y`
 * against `#storybook-root`. That runner is **vacuous inside a git worktree**:
 * it builds jest's `testMatch` from an absolute `rootDir`, and on Windows the
 * backslashes in `…\.claude\worktrees\…` are consumed as glob escapes, so the
 * path separators are lost and the pattern matches nothing. It reports
 * thousands of files checked and zero matches — which a piped invocation then
 * turns into a silent pass.
 *
 * `axe-playwright` is a thin wrapper over the same `axe-core` this module
 * loads, so asserting here is the same assertion reached directly. The ruleset
 * is deliberately left at axe's defaults — no `runOnly`, nothing disabled —
 * because weakening the assertion to get a green is how an a11y gate stops
 * meaning anything. Fix the component, never this file.
 */
import axe, { type ElementContext, type Result } from 'axe-core';

/** One violation, flattened to something readable in an assertion message. */
export interface AxeViolation {
    readonly id: string;
    readonly impact: string;
    readonly help: string;
    readonly nodes: readonly string[];
}

function toViolation(result: Result): AxeViolation {
    return {
        id: result.id,
        impact: result.impact ?? 'unknown',
        help: result.help,
        nodes: result.nodes.map((node) => node.html),
    };
}

/**
 * Runs axe over `context` with the default ruleset and returns every violation.
 *
 * The element must be attached to the document — axe measures real layout and
 * computed colour, so a detached fixture reports nothing useful.
 */
export async function findAxeViolations(context: ElementContext): Promise<AxeViolation[]> {
    const results = await axe.run(context, { resultTypes: ['violations'] });
    return results.violations.map(toViolation);
}
