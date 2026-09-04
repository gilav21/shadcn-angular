/**
 * Unit tests for the compiled-package release helpers (T-10…T-13).
 *
 * The package release is a DIFFERENT contract from the CLI release: its tags are
 * per-package (`rte-v*`), its verdict is driven by the registry closure rather
 * than by "is this bundled CLI code", and it must never call `npm publish`
 * (2FA is manual). These are all value→value functions so the flow is provable
 * without git.
 */
import { describe, expect, it } from 'vitest';

import { ArgError, prependRelease, releaseCommitArgv } from './release-cli-lib.js';
import {
    closurePaths,
    packageReleasePaths,
    packageTagName,
    packageVerdict,
    parsePackageArgs,
} from './release-package-lib.js';

// ── T-10 ───────────────────────────────────────────────────────────────────
describe('parsePackageArgs (T-10)', () => {
    it('accepts <id> <level> in that order', () => {
        const args = parsePackageArgs(['rte', 'patch']);
        expect(args.id).toBe('rte');
        expect(args.level).toBe('patch');
        expect(args.dryRun).toBe(false);
        expect(args.force).toBe(false);
    });

    it('accepts <level> <id> in the reverse order', () => {
        const args = parsePackageArgs(['minor', 'data-table']);
        expect(args.id).toBe('data-table');
        expect(args.level).toBe('minor');
    });

    it('carries every release-cli flag through', () => {
        const args = parsePackageArgs([
            'rte',
            'major',
            '--dry-run',
            '--force',
            '--allow-dirty',
            '--allow-branch',
            '--skip-preflight',
        ]);
        expect(args).toMatchObject({
            id: 'rte',
            level: 'major',
            dryRun: true,
            force: true,
            allowDirty: true,
            allowBranch: true,
            skipPreflight: true,
        });
    });

    it('rejects an unknown package id', () => {
        expect(() => parsePackageArgs(['rtee', 'patch'])).toThrow(ArgError);
        expect(() => parsePackageArgs(['rtee', 'patch'])).toThrow(/rtee/);
    });

    it('rejects an unknown bump level', () => {
        expect(() => parsePackageArgs(['rte', 'huge'])).toThrow(ArgError);
    });

    it('rejects an unknown flag', () => {
        expect(() => parsePackageArgs(['rte', 'patch', '--publish'])).toThrow(/--publish/);
    });

    it('rejects a missing id or missing level', () => {
        expect(() => parsePackageArgs(['patch'])).toThrow(ArgError);
        expect(() => parsePackageArgs(['rte'])).toThrow(ArgError);
        expect(() => parsePackageArgs([])).toThrow(ArgError);
    });

    it('rejects extra positionals', () => {
        expect(() => parsePackageArgs(['rte', 'patch', 'data-table'])).toThrow(ArgError);
    });
});

// ── T-11 ───────────────────────────────────────────────────────────────────
describe('packageTagName (T-11)', () => {
    it('namespaces the tag per package so the two releases never share a base ref', () => {
        expect(packageTagName('rte', '0.1.1')).toBe('rte-v0.1.1');
        expect(packageTagName('data-table', '2.0.0')).toBe('data-table-v2.0.0');
    });
});

// ── T-12 ───────────────────────────────────────────────────────────────────
describe('packageVerdict (T-12)', () => {
    const rtePaths = closurePaths('rte');

    function verdict(files: string[], id: 'rte' | 'data-table' = 'rte'): boolean {
        return packageVerdict(files, closurePaths(id), id).required;
    }

    it('REQUIRED for a closure ui file', () => {
        const uiFile = [...rtePaths].find((p) => p.includes('/ui/rich-text-editor/'));
        expect(uiFile).toBeDefined();
        expect(verdict([uiFile!])).toBe(true);
    });

    it('REQUIRED for a closure lib file and for lib/utils.ts', () => {
        expect(verdict(['packages/components/lib/utils.ts'])).toBe(true);
    });

    it('REQUIRED for the package config files', () => {
        for (const file of ['package.json', 'README.md', 'ng-package.json', 'tsconfig.lib.json']) {
            expect(verdict([`packages/rte-package/${file}`]), file).toBe(true);
        }
    });

    it('REQUIRED for the styles template and the stage/build scripts', () => {
        expect(verdict(['packages/cli/src/templates/styles.ts'])).toBe(true);
        expect(verdict(['packages/cli/scripts/stage-package-lib.ts'])).toBe(true);
        expect(verdict(['packages/cli/scripts/stage-package.ts'])).toBe(true);
        expect(verdict(['packages/cli/scripts/package-build.ts'])).toBe(true);
    });

    it('NOT required for an unrelated component', () => {
        expect(verdict(['packages/components/ui/accordion/accordion.component.ts'])).toBe(false);
    });

    it('NOT required for demo or docs changes', () => {
        expect(verdict(['demo/src/app/app.component.ts', 'docs/local-gates.md'])).toBe(false);
    });

    it("NOT required for the OTHER package's folder", () => {
        expect(verdict(['packages/data-table-package/README.md'], 'rte')).toBe(false);
        expect(verdict(['packages/rte-package/README.md'], 'data-table')).toBe(false);
    });

    it('NOT required for the package CHANGELOG alone (it is the release artifact)', () => {
        expect(verdict(['packages/rte-package/CHANGELOG.md'])).toBe(false);
    });

    it('NOT required for an empty diff', () => {
        expect(verdict([])).toBe(false);
    });

    it('names the files that triggered the verdict', () => {
        const result = packageVerdict(
            ['packages/components/lib/utils.ts', 'docs/x.md'],
            rtePaths,
            'rte',
        );
        expect(result.required).toBe(true);
        expect(result.reasons).toContain('packages/components/lib/utils.ts');
        expect(result.reasons).not.toContain('docs/x.md');
    });

    it('the two closures differ — a data-table-only file does not require an rte release', () => {
        const dtOnly = [...closurePaths('data-table')].find(
            (p) => p.includes('/ui/data-table/') && !rtePaths.has(p),
        );
        expect(dtOnly).toBeDefined();
        expect(verdict([dtOnly!], 'rte')).toBe(false);
        expect(verdict([dtOnly!], 'data-table')).toBe(true);
    });
});

// ── T-13 ───────────────────────────────────────────────────────────────────
describe('release commit + changelog parameterisation (T-13)', () => {
    it('packageReleasePaths scopes the commit to the two package files', () => {
        expect(packageReleasePaths('rte')).toEqual([
            'packages/rte-package/package.json',
            'packages/rte-package/CHANGELOG.md',
        ]);
    });

    it('releaseCommitArgv is pathspec-scoped and uses the package scope', () => {
        const paths = packageReleasePaths('rte');
        const argv = releaseCommitArgv('rte-v0.1.1', paths, 'rte');
        expect(argv.add).toEqual(['add', '--', ...paths]);
        expect(argv.commit).toEqual([
            'commit',
            '-m',
            'chore(rte): release rte-v0.1.1',
            '--',
            ...paths,
        ]);
    });

    it('releaseCommitArgv keeps the CLI behaviour when called with one argument', () => {
        const argv = releaseCommitArgv('cli-v1.2.3');
        expect(argv.commit[2]).toBe('chore(cli): release cli-v1.2.3');
        expect(argv.commit).toContain('packages/cli/package.json');
    });

    it('prependRelease accepts a custom header for a new package changelog', () => {
        const header = '# Changelog\n\nAll notable changes to `@gilav21/shadcn-angular-rte` (compiled package).\n';
        const out = prependRelease(null, '## 0.1.1\n\n- thing\n', header);
        expect(out).toContain('compiled package');
        expect(out).toContain('## 0.1.1');
    });

    it('prependRelease inserts below an existing package header, above older entries', () => {
        const existing = '# Changelog\n\nAll notable changes to `@gilav21/shadcn-angular-rte` (compiled package).\n\n## 0.1.0\n\n- first\n';
        const out = prependRelease(existing, '## 0.1.1\n\n- second\n', '# Changelog\n');
        expect(out.indexOf('## 0.1.1')).toBeLessThan(out.indexOf('## 0.1.0'));
        expect(out).toContain('compiled package');
    });

    it('prependRelease keeps the CLI default header when none is passed', () => {
        expect(prependRelease(null, '## 1.0.0\n\n- x\n')).toContain('# Changelog');
    });
});

// ── closurePaths ───────────────────────────────────────────────────────────
describe('closurePaths', () => {
    it('covers every staged source plus the package config files', () => {
        const paths = closurePaths('rte');
        expect(paths.has('packages/components/lib/utils.ts')).toBe(true);
        expect(paths.has('packages/rte-package/package.json')).toBe(true);
        expect(paths.has('packages/cli/src/templates/styles.ts')).toBe(true);
        expect(paths.has('packages/rte-package/CHANGELOG.md')).toBe(false);
        expect(paths.size).toBeGreaterThan(272);
    });
});
