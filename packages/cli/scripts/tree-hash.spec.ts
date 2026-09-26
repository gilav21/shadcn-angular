import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { envForGitAt, treeHash } from '../../../scripts/tree-hash.mjs';

/**
 * The fingerprint `npm run coverage` writes and `npm run sonar` checks. Its
 * contract: it changes whenever anything that could change what the suite
 * covers changes — a tracked file's content (committed or not), a new untracked
 * file — and stays put when only ignored files (caches, reports) move.
 */
describe('treeHash', () => {
    let repo: string;
    // Run inside the pre-push hook, an inherited GIT_DIR would point `init` and
    // `config` at the real repository instead of this temp one.
    const git = (...args: string[]) =>
        execFileSync('git', args, { cwd: repo, env: envForGitAt(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

    beforeEach(() => {
        repo = mkdtempSync(join(tmpdir(), 'tree-hash-'));
        git('init', '-q');
        git('config', 'user.email', 't@example.com');
        git('config', 'user.name', 't');
        writeFileSync(join(repo, '.gitignore'), 'ignored/\n');
        writeFileSync(join(repo, 'a.ts'), 'export const a = 1;\n');
        git('add', '.');
        git('commit', '-q', '-m', 'init');
    });

    afterEach(() => rmSync(repo, { recursive: true, force: true }));

    it('is stable for an unchanged tree', () => {
        expect(treeHash(repo)).toBe(treeHash(repo));
    });

    it('hashes its own directory even when a git hook exported GIT_DIR for another repository', () => {
        const expected = treeHash(repo);
        const other = mkdtempSync(join(tmpdir(), 'tree-hash-other-'));
        execFileSync('git', ['init', '-q'], { cwd: other, env: envForGitAt(), stdio: 'ignore' });
        const saved = process.env['GIT_DIR'];
        process.env['GIT_DIR'] = join(other, '.git');
        try {
            expect(treeHash(repo)).toBe(expected);
        } finally {
            if (saved === undefined) delete process.env['GIT_DIR'];
            else process.env['GIT_DIR'] = saved;
            rmSync(other, { recursive: true, force: true });
        }
    });

    it('changes when a tracked file is edited but not committed', () => {
        const before = treeHash(repo);
        writeFileSync(join(repo, 'a.ts'), 'export const a = 2;\n');
        expect(treeHash(repo)).not.toBe(before);
    });

    it('changes when that edit is committed', () => {
        const before = treeHash(repo);
        writeFileSync(join(repo, 'a.ts'), 'export const a = 2;\n');
        git('commit', '-q', '-am', 'edit');
        expect(treeHash(repo)).not.toBe(before);
    });

    it('changes when an untracked, non-ignored file appears', () => {
        const before = treeHash(repo);
        writeFileSync(join(repo, 'b.spec.ts'), 'it("x", () => {});\n');
        expect(treeHash(repo)).not.toBe(before);
    });

    it('does not change when only an ignored file changes', () => {
        const before = treeHash(repo);
        writeFileSync(join(repo, 'ignored-file.txt'), 'x');
        writeFileSync(join(repo, '.gitignore'), 'ignored/\nignored-file.txt\n');
        git('commit', '-q', '-am', 'ignore it');
        const baseline = treeHash(repo);
        writeFileSync(join(repo, 'ignored-file.txt'), 'y');
        utimesSync(join(repo, 'ignored-file.txt'), new Date(), new Date());
        expect(treeHash(repo)).toBe(baseline);
        expect(baseline).not.toBe(before);
    });
});
