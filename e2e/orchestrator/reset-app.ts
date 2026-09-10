import path from 'node:path';

import { capture, run } from './spawn.js';
import { FIXTURE_APP, REPO_ROOT } from './paths.js';

/**
 * Restores the fixture-app to its committed pristine state.
 *
 * - `git checkout HEAD -- e2e/fixture-app` reverts any tracked-file edits
 *   (e.g. `init` modifies `angular.json`, `tsconfig.json`, `src/styles.scss`,
 *   `app.routes.ts`).
 * - `git clean -fdx -e node_modules -e .angular -e dist e2e/fixture-app/`
 *   removes untracked files (`components.json`, `.postcssrc.json`,
 *   `src/tailwind.css`, `src/components/`, `src/app/test-pages/`).
 *
 * `-x` is required, and `-e` is what keeps the caches. Plain `git clean -fd`
 * skips IGNORED files, and d99c04e0 added the CLI's install output to the
 * repo's .gitignore so it could never be committed — which silently turned
 * this reset into a no-op for exactly the paths it names above.
 *
 * The symptom is not a clean failure. Demo pages accumulate in
 * `src/app/test-pages/` across specs, so a later spec compiles a leftover
 * harness whose component it never installed:
 *
 *     TS2307: Cannot find module '@/blocks/features'
 *
 * On PR #131 that failed 11 specs, 8 of them CLI specs that never start a
 * dev server, which is what made it look unrelated to the e2e harness.
 *
 * `node_modules`, `.angular/cache` and `dist/` are excluded explicitly rather
 * than relying on them being ignored: re-installing 600+ Angular transitive
 * deps for every component would dominate runtime.
 */
export async function resetFixtureApp(fixtureApp: string = FIXTURE_APP): Promise<void> {
    const rel = relFixture(fixtureApp);
    await run('git', ['checkout', 'HEAD', '--', rel], { cwd: REPO_ROOT });
    await run(
        'git',
        ['clean', '-fdx', '-e', 'node_modules', '-e', '.angular', '-e', 'dist', `${rel}/`],
        { cwd: REPO_ROOT },
    );
}

/**
 * Repo-relative, forward-slashed path of a fixture — git pathspecs are
 * POSIX-style even on Windows, where `path.relative` yields backslashes.
 */
function relFixture(fixtureApp: string): string {
    return path.relative(REPO_ROOT, fixtureApp).replaceAll('\\', '/');
}

/**
 * Verifies the fixture-app working tree matches HEAD. Used as a defensive
 * post-condition after `resetFixtureApp()` and as a precondition before
 * each test so a previous test's failure can't leak into the next.
 *
 * Returns the list of dirty paths (empty array = clean).
 */
export async function dirtyPaths(fixtureApp: string = FIXTURE_APP): Promise<string[]> {
    const stdout = await capture(
        'git',
        ['status', '--porcelain', '--', relFixture(fixtureApp)],
        { cwd: REPO_ROOT },
    );
    return stdout.split('\n').map(l => l.trim()).filter(Boolean);
}

export async function assertFixtureClean(label: string, fixtureApp: string = FIXTURE_APP): Promise<void> {
    const dirty = await dirtyPaths(fixtureApp);
    if (dirty.length > 0) {
        throw new Error(
            `Fixture is not clean ${label}:\n` +
            dirty.map(d => '  ' + d).join('\n') +
            '\nThis indicates the previous test polluted state the reset did not catch. Investigate before rerunning.',
        );
    }
}
