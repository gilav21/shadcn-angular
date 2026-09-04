/**
 * The WIRING of the two entry scripts that exit on their own — `release:package`
 * and `stage:package` — driven by importing them.
 *
 * Both guard their `process.exit` on being the entry module, so importing them
 * composes their effects and stops. That is what makes the last unreviewed part
 * of each script checkable: that the composed port really reaches the repo and
 * really refuses a bad argv before doing anything.
 *
 * Every case here is one that returns BEFORE any write, spawn or build. Nothing
 * in this file may commit, tag, push, publish or stage.
 */
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { EFFECTS as RELEASE_EFFECTS, main as releaseMain } from './release-package.js';
import { REPO_ROOT } from './repo-fixtures.js';
import { EFFECTS as STAGE_EFFECTS, main as stageMain } from './stage-package.js';

/** Runs an entry's `main` with a posed argv, capturing what it printed. */
function run(main: (argv: readonly string[]) => number, argv: readonly string[]) {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
        const status = main(argv);
        return { status, stderr: err.mock.calls.flat().join('\n'), stdout: out.mock.calls.flat().join('\n') };
    } finally {
        err.mockRestore();
        out.mockRestore();
    }
}

describe('stage-package entry wiring', () => {
    // The repo root is derived from the module's OWN location so `cwd` cannot
    // redirect it — that is what lets the subprocess tests drive a copied script
    // inside a throwaway repo.
    it('anchors the staged tree to the repo root, not the cwd', () => {
        expect(STAGE_EFFECTS.srcRootLabel('rte').replaceAll('\\', '/')).toBe('packages/rte-package/src');
    });

    // Staging WIPES `src/` before writing, so a typo that got as far as staging
    // would destroy the previous output.
    it.each([[], ['rtee']])('refuses %s with usage, staging nothing', (...argv) => {
        const result = run(stageMain, argv.flat());
        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Usage: npm run stage:package');
        expect(result.stdout).toBe('');
    });

    it('echoes an unknown id back so the typo is visible', () => {
        expect(run(stageMain, ['rtee']).stderr).toContain('rtee');
    });
});

describe('release-package entry wiring', () => {
    it('reads files relative to the repo root', () => {
        const pkg = RELEASE_EFFECTS.readFile('packages/cli/package.json');
        expect(JSON.parse(pkg).name).toBeTruthy();
    });

    it('answers null for a path that does not exist rather than throwing', () => {
        expect(RELEASE_EFFECTS.readFileIfExists('packages/nope/CHANGELOG.md')).toBeNull();
    });

    it('reaches the real repo through the composed git port', () => {
        expect(RELEASE_EFFECTS.git.run('rev-parse', '--show-toplevel').replaceAll('\\', '/').toLowerCase())
            .toBe(REPO_ROOT.replaceAll('\\', '/').toLowerCase());
    });

    it('answers null from the probing form when git exits non-zero', () => {
        expect(RELEASE_EFFECTS.git.probe('rev-parse', '--verify', 'refs/tags/no-such-tag-xyz')).toBeNull();
    });

    it('formats today as the YYYY-MM-DD a changelog heading wants', () => {
        expect(RELEASE_EFFECTS.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('routes log and error to the two console streams, unmodified', () => {
        const out = vi.spyOn(console, 'log').mockImplementation(() => {});
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            RELEASE_EFFECTS.log('to stdout');
            RELEASE_EFFECTS.error('to stderr');
            expect(out).toHaveBeenCalledWith('to stdout');
            expect(err).toHaveBeenCalledWith('to stderr');
        } finally {
            out.mockRestore();
            err.mockRestore();
        }
    });

    // The revert path deletes an untracked CHANGELOG, addressed repo-relatively.
    // `force` is what makes a second revert of an already-gone file a no-op
    // rather than a throw that would mask the preflight failure.
    it('deletes a repo-relative file, and tolerates one already gone', () => {
        const relPath = 'packages/cli/scripts/.delete-fx-probe.tmp';
        const absPath = path.join(REPO_ROOT, relPath);
        writeFileSync(absPath, 'scratch');
        try {
            RELEASE_EFFECTS.deleteFile(relPath);
            expect(existsSync(absPath)).toBe(false);
            expect(() => RELEASE_EFFECTS.deleteFile(relPath)).not.toThrow();
        } finally {
            rmSync(absPath, { force: true });
        }
    });

    // A bad argv must be refused before any guard runs git, let alone before a
    // write — the release commit is the point of no return.
    it.each([
        [[], /Expected exactly two arguments/],
        [['rte'], /Expected exactly two arguments/],
        [['rte', 'nope'], /Invalid bump level/],
        [['rtee', 'patch'], /No package id/],
        [['rte', 'patch', '--nope'], /Unknown flag/],
    ])('refuses %s with usage and exit 1', (argv, pattern) => {
        const result = run(releaseMain, argv);
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(pattern);
        expect(result.stderr).toContain('Usage: npm run release:package');
        expect(result.stdout).toBe('');
    });
});
