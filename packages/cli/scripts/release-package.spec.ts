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

/** Minimal stand-ins for the CLI modules `stage-package-lib` imports. */
const FIXTURE_RESOLVE = `import { registry } from '../registry/index.js';
export function resolveDependencies(names) {
    const all = new Set();
    const walk = (name) => {
        if (all.has(name) || !registry[name]) return;
        all.add(name);
        for (const dep of registry[name].dependencies ?? []) walk(dep);
    };
    for (const name of names) walk(name);
    return all;
}
`;

const FIXTURE_REGISTRY = `export const registry = {
    'rich-text-editor': {
        name: 'rich-text-editor',
        files: ['rich-text-editor/rich-text-editor.component.ts'],
        libFiles: [],
    },
    'rich-text-editor/full': {
        name: 'rich-text-editor/full',
        files: ['rich-text-editor/addons/full/index.ts'],
        libFiles: [],
    },
    'data-table': { name: 'data-table', files: ['data-table/data-table.component.ts'], libFiles: [] },
    'data-table/context-menu': { name: 'data-table/context-menu', files: [], libFiles: [] },
    'data-table/export': { name: 'data-table/export', files: [], libFiles: [] },
    'data-table/pivot': { name: 'data-table/pivot', files: [], libFiles: [] },
};
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
    // `stage-package-lib` reaches into the CLI's registry and resolver to derive
    // the closure. In a throwaway repo those do not exist, so the fixture gets a
    // tiny stand-in: a two-component registry whose closure is one RTE file.
    // That keeps the release script's own contract (verdict → bump → commit →
    // annotated tag → STOP) under test without dragging in the real 1029-entry
    // registry, which would make the fixture's verdict depend on the whole
    // component library.
    write(root, 'packages/cli/src/core/resolve.ts', FIXTURE_RESOLVE);
    write(root, 'packages/cli/src/registry/index.ts', FIXTURE_REGISTRY);
    write(root, 'packages/cli/src/templates/styles.ts', 'export function getStylesTemplate(): string { return ""; }\n');
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
            .sort((a, b) => a.localeCompare(b));
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

    // Regression: the revert used to be a blanket `git checkout -- <both
    // files>`. On a package's FIRST release CHANGELOG.md is brand new, so git
    // exits 1 with "pathspec did not match any file(s) known to git", killing
    // the script mid-revert and leaving the bumped package.json plus an
    // untracked CHANGELOG behind — exactly the dirty tree the revert exists to
    // prevent. The preflight is forced to fail here by pointing the npm script
    // it runs at a command that always exits non-zero.
    it('reverts cleanly when the preflight fails on a FIRST release (untracked CHANGELOG)', () => {
        root = seedFixture('closure');
        write(root, 'package.json', JSON.stringify({
            type: 'module',
            scripts: { 'build:package': 'node -e "process.exit(1)"' },
        }, null, 2));
        commitAll(root, 'chore: fixture npm scripts');

        const run = runScript(fixtureScript(root, 'release-package.ts'), [
            'rte', 'patch', '--no-push',
        ]);

        expect(run.status).toBe(1);
        expect(run.output).toContain('Preflight FAILED');

        // The bump is undone...
        expect(readFileSync(path.join(root, 'packages/rte-package/package.json'), 'utf-8'))
            .toContain('"version": "0.1.0"');
        // ...the brand-new CHANGELOG is removed rather than left untracked...
        expect(existsSync(path.join(root, 'packages/rte-package/CHANGELOG.md'))).toBe(false);
        // ...and nothing was committed, tagged, or left dirty.
        expect(git(root, 'status', '--porcelain')).toBe('');
        expect(git(root, 'tag', '--list')).toBe('');
    }, 90_000);

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
