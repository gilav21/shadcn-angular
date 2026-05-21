import { capture, run } from './spawn.js';
import { REPO_ROOT } from './paths.js';

/**
 * Restores the fixture-app to its committed pristine state.
 *
 * - `git checkout HEAD -- e2e/fixture-app` reverts any tracked-file edits
 *   (e.g. `init` modifies `angular.json`, `tsconfig.json`, `src/styles.scss`,
 *   `app.routes.ts`).
 * - `git clean -fd e2e/fixture-app/` removes untracked files
 *   (`components.json`, `.postcssrc.json`, `src/tailwind.css`,
 *   `src/components/`, `src/app/test-pages/`).
 *
 * `node_modules`, `.angular/cache`, and `dist/` are gitignored and survive
 * the clean — that's the whole point: re-installing all 600+ Angular
 * transitive deps every component would dominate runtime.
 */
export async function resetFixtureApp(): Promise<void> {
    await run('git', ['checkout', 'HEAD', '--', 'e2e/fixture-app'], { cwd: REPO_ROOT });
    await run('git', ['clean', '-fd', 'e2e/fixture-app/'], { cwd: REPO_ROOT });
}

/**
 * Verifies the fixture-app working tree matches HEAD. Used as a defensive
 * post-condition after `resetFixtureApp()` and as a precondition before
 * each test so a previous test's failure can't leak into the next.
 *
 * Returns the list of dirty paths (empty array = clean).
 */
export async function dirtyPaths(): Promise<string[]> {
    const stdout = await capture(
        'git',
        ['status', '--porcelain', '--', 'e2e/fixture-app'],
        { cwd: REPO_ROOT },
    );
    return stdout.split('\n').map(l => l.trim()).filter(Boolean);
}

export async function assertFixtureClean(label: string): Promise<void> {
    const dirty = await dirtyPaths();
    if (dirty.length > 0) {
        throw new Error(
            `Fixture is not clean ${label}:\n` +
            dirty.map(d => '  ' + d).join('\n') +
            '\nThis indicates the previous test polluted state the reset did not catch. Investigate before rerunning.',
        );
    }
}
