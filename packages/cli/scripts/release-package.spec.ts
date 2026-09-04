/**
 * T-14…T-16 — the `release:package` entry contract, driven as a subprocess in a
 * throwaway repo (see `repo-fixtures.ts` for why the script must be COPIED).
 *
 * The load-bearing claim these tests defend: the script does everything up to
 * the push and then STOPS. `npm publish` is manual (2FA), so a regression that
 * made the script publish would be unrecoverable — hence the npm stub, which
 * fails the test loudly if it is ever invoked.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    type Run,
    commitAll,
    copyScripts,
    createRepo,
    fixtureScript,
    git,
    gitInitCommit,
    removeRepo,
    runScript,
    write,
} from './repo-fixtures.js';

/**
 * A fixture repo shaped like the real one as far as the release script looks:
 * a package folder with a version, one closure source file, and a registry
 * stub the staging lib can resolve.
 */
const FIXTURE_PKG_JSON = `{
  "name": "@gilav21/shadcn-angular-rte",
  "version": "0.1.0",
  "sideEffects": false
}
`;

type Change = 'closure' | 'unrelated';

function seedFixture(change: Change): string {
    const root = createRepo('release-package');
    copyScripts(root, [
        'release-package.ts',
        'release-package-lib.ts',
        'release-cli-lib.ts',
        'stage-package-lib.ts',
    ]);
    write(root, 'packages/rte-package/package.json', FIXTURE_PKG_JSON);
    write(root, 'packages/components/ui/rich-text-editor/rich-text-editor.component.ts', 'export const A = 1;\n');
    write(root, 'packages/components/ui/accordion/accordion.component.ts', 'export const B = 1;\n');

    // No `rte-v*` tag anywhere: the base ref must fall back to the last commit
    // touching packages/rte-package/package.json — this one (spec §C.3).
    gitInitCommit(root, 'chore: seed the package');

    if (change === 'closure') {
        write(root, 'packages/components/ui/rich-text-editor/rich-text-editor.component.ts', 'export const A = 2;\n');
        commitAll(root, 'fix(rich-text-editor): correct a thing');
    } else {
        write(root, 'packages/components/ui/accordion/accordion.component.ts', 'export const B = 2;\n');
        commitAll(root, 'fix(accordion): unrelated tweak');
    }
    return root;
}

describe('release-package entry (fixture repo)', () => {
    let root = '';

    afterEach(() => {
        if (root) removeRepo(root);
        root = '';
    });

    function release(change: Change, args: readonly string[]): Run {
        root = seedFixture(change);
        return runScript(fixtureScript(root, 'release-package.ts'), args);
    }

    // ── T-14 ───────────────────────────────────────────────────────────────
    it('--dry-run prints the verdict, bump, changelog and the manual publish hand-off, writing nothing', () => {
        const head = () => git(root, 'rev-parse', 'HEAD');
        const run = release('closure', ['rte', 'patch', '--dry-run', '--skip-preflight']);
        const headAfter = head();

        expect(run.status).toBe(0);
        expect(run.stdout).toContain('VERDICT: release REQUIRED');
        expect(run.stdout).toContain('0.1.0 → 0.1.1 (patch)');
        expect(run.stdout).toContain('## 0.1.1');
        expect(run.stdout).toContain('**rich-text-editor:** correct a thing');
        // The hand-off is the whole point: printed, never executed.
        expect(run.stdout).toContain('npm publish --access public');
        expect(run.stdout).toContain('[dry-run]');

        // Nothing on disk, in git, or in the tag list moved.
        expect(readFileSync(path.join(root, 'packages/rte-package/package.json'), 'utf-8'))
            .toContain('"version": "0.1.0"');
        expect(existsSync(path.join(root, 'packages/rte-package/CHANGELOG.md'))).toBe(false);
        expect(git(root, 'status', '--porcelain')).toBe('');
        expect(git(root, 'tag', '--list')).toBe('');
        expect(headAfter).toBe(head());
    }, 60_000);

    // ── T-15 ───────────────────────────────────────────────────────────────
    it('a real run commits the two files, creates an ANNOTATED tag, and never publishes', () => {
        root = seedFixture('closure');
        const run = runScript(fixtureScript(root, 'release-package.ts'), [
            'rte',
            'patch',
            '--skip-preflight',
            '--no-push',
        ]);

        expect(run.status).toBe(0);

        // Exactly the two release files, nothing else swept in.
        const committed = git(root, 'show', '--name-only', '--pretty=format:', 'HEAD')
            .split('\n')
            .filter(Boolean)
            .sort();
        expect(committed).toEqual([
            'packages/rte-package/CHANGELOG.md',
            'packages/rte-package/package.json',
        ]);
        expect(git(root, 'log', '-1', '--pretty=%s')).toBe('chore(rte): release rte-v0.1.1');

        // Annotated, not lightweight — a lightweight tag is skipped by
        // `push --follow-tags` and would never reach origin (memory rule).
        expect(git(root, 'tag', '--list')).toBe('rte-v0.1.1');
        expect(git(root, 'cat-file', '-t', 'rte-v0.1.1')).toBe('tag');

        expect(readFileSync(path.join(root, 'packages/rte-package/package.json'), 'utf-8'))
            .toContain('"version": "0.1.1"');
        expect(readFileSync(path.join(root, 'packages/rte-package/CHANGELOG.md'), 'utf-8'))
            .toContain('## 0.1.1');

        // The hand-off is printed; the publish itself never ran.
        expect(run.stdout).toContain('npm publish --access public');
        expect(run.stdout).not.toContain('+ @gilav21/shadcn-angular-rte@');
    }, 90_000);

    // ── T-16 ───────────────────────────────────────────────────────────────
    it('exits 1 when the verdict is NOT required and --force is absent', () => {
        const run = release('unrelated', ['rte', 'patch', '--skip-preflight', '--no-push']);
        expect(run.status).toBe(1);
        expect(run.output).toContain('VERDICT: release NOT required');
        expect(run.output).toContain('--force');
        expect(git(root, 'tag', '--list')).toBe('');
    }, 60_000);

    it('--force overrides a NOT-required verdict', () => {
        const run = release('unrelated', ['rte', 'patch', '--skip-preflight', '--no-push', '--force']);
        expect(run.status).toBe(0);
        expect(git(root, 'tag', '--list')).toBe('rte-v0.1.1');
    }, 90_000);

    it('refuses a dirty tree without --allow-dirty', () => {
        root = seedFixture('closure');
        write(root, 'packages/components/ui/rich-text-editor/rich-text-editor.component.ts', 'export const A = 3;\n');

        const run = runScript(fixtureScript(root, 'release-package.ts'), [
            'rte', 'patch', '--dry-run', '--skip-preflight',
        ]);
        expect(run.status).toBe(1);
        expect(run.output).toContain('dirty');
        expect(run.output).toContain('--allow-dirty');
        expect(run.output).not.toContain('VERDICT');
    }, 60_000);

    it('refuses a non-master branch without --allow-branch', () => {
        root = seedFixture('closure');
        git(root, 'checkout', '-q', '-b', 'feat/whatever');

        const run = runScript(fixtureScript(root, 'release-package.ts'), [
            'rte', 'patch', '--dry-run', '--skip-preflight',
        ]);
        expect(run.status).toBe(1);
        expect(run.output).toContain('feat/whatever');
        expect(run.output).toContain('--allow-branch');
        expect(run.output).not.toContain('VERDICT');
    }, 60_000);

    it('exits 1 with usage on a bad package id or bump level', () => {
        const bad = release('closure', ['rtee', 'patch', '--dry-run', '--skip-preflight']);
        expect(bad.status).toBe(1);
        expect(bad.output).toContain('rtee');

        root = seedFixture('closure');
        const badLevel = runScript(fixtureScript(root, 'release-package.ts'), [
            'rte', 'huge', '--dry-run', '--skip-preflight',
        ]);
        expect(badLevel.status).toBe(1);
    }, 90_000);
});
