/**
 * The `build:package` entry's own WIRING, driven by importing it.
 *
 * This module is the one entry of the three that can be imported: it has no
 * top-level `process.exit`, because the e2e orchestrator and the release
 * preflight import it for `buildPackageTarball`. That makes its wiring —
 * the repo root, the packs directory, and the argv contract of
 * `runPackageBuildCli` — checkable rather than merely reviewed.
 *
 * Nothing here builds anything: the argv case under test is the one that
 * refuses before it would spawn ng-packagr.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
    EFFECTS,
    PACKS_DIR,
    buildPackageTarball,
    runPackageBuildCli,
    toRepoRelative,
} from './package-build.js';
import { REPO_ROOT } from './repo-fixtures.js';

describe('package-build entry wiring', () => {
    // Tarballs land under the already-gitignored e2e workers root, so they can
    // never show up as untracked files and trip the release's dirty-tree guard.
    it('resolves PACKS_DIR under the repo root, not the cwd', () => {
        expect(path.relative(REPO_ROOT, PACKS_DIR).replaceAll('\\', '/')).toBe('e2e/.workers/_packs');
    });

    // The repo root is derived from the module's OWN location so `cwd` cannot
    // redirect it — that is what lets the subprocess tests drive a copied script
    // inside a throwaway repo.
    it('anchors the repo root to this file, not to the process cwd', () => {
        expect(path.isAbsolute(PACKS_DIR)).toBe(true);
        expect(PACKS_DIR.replaceAll('\\', '/')).toContain('/e2e/.workers/_packs');
    });

    it('exports the memoised builder the orchestrator imports', () => {
        expect(typeof buildPackageTarball).toBe('function');
    });

    // The build prints where the tarball landed; an absolute Windows path there
    // would be unreadable noise in the e2e log.
    it('reports the tarball repo-relatively', () => {
        expect(toRepoRelative(path.join(PACKS_DIR, 'rte-0.1.0.tgz')).replaceAll('\\', '/'))
            .toBe('e2e/.workers/_packs/rte-0.1.0.tgz');
    });
});

describe('package-build composed effects', () => {
    // ng-packagr writes into dist/<id>-package; the gate reads its manifest from
    // there, so the composed path must point at the real dist layout.
    it('names the FESM directory under the package dist folder', () => {
        expect(EFFECTS.fesmLabel('rte').replaceAll('\\', '/'))
            .toBe(`${REPO_ROOT.replaceAll('\\', '/')}/dist/rte-package/fesm2022`);
    });

    it('resolves a tarball name inside the packs directory', () => {
        expect(EFFECTS.tarballPath('a.tgz')).toBe(path.join(PACKS_DIR, 'a.tgz'));
    });

    it('answers exists against the real filesystem', () => {
        expect(EFFECTS.exists(path.join(REPO_ROOT, 'package.json'))).toBe(true);
        expect(EFFECTS.exists(path.join(REPO_ROOT, 'no-such-file-xyz'))).toBe(false);
    });

    // The packs directory is created on demand and must survive already existing
    // — the e2e run builds several packages in a row into the same folder.
    it('creates the packs directory idempotently', () => {
        EFFECTS.ensurePacksDir();
        expect(existsSync(PACKS_DIR)).toBe(true);
        expect(() => EFFECTS.ensurePacksDir()).not.toThrow();
    });
});

describe('runPackageBuildCli', () => {
    /** Runs the entry with a posed argv, capturing what it printed. */
    async function run(args: readonly string[]) {
        const argv = process.argv;
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const out = vi.spyOn(console, 'log').mockImplementation(() => {});
        process.argv = ['node', 'package-build.ts', ...args];
        try {
            const status = await runPackageBuildCli();
            return { status, stderr: err.mock.calls.flat().join('\n'), stdout: out.mock.calls.flat().join('\n') };
        } finally {
            process.argv = argv;
            err.mockRestore();
            out.mockRestore();
        }
    }

    // An ng-packagr build is minutes; a typo must be refused before it starts.
    it.each([[], ['rtee']])('exits 1 with usage on %s', async (...args) => {
        const result = await run(args.flat());
        expect(result.status).toBe(1);
        expect(result.stderr).toContain('Usage: npm run build:package');
        expect(result.stderr).toContain('rte');
        expect(result.stdout).toBe('');
    });
});
