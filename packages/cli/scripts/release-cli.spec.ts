import { describe, it, expect } from 'vitest';
import {
    ArgError,
    bumpVersion,
    classifyPath,
    parseArgs,
    parseCommit,
    prependRelease,
    publishVerdict,
    readPackageVersion,
    renderReleaseNotes,
    setPackageVersion,
    stripRegistryData,
    tagName,
} from './release-cli-lib';

describe('parseArgs', () => {
    it.each(['patch', 'minor', 'major'] as const)('accepts the %s level', (level) => {
        expect(parseArgs([level]).level).toBe(level);
    });

    it('defaults every flag to false', () => {
        expect(parseArgs(['patch'])).toEqual({
            level: 'patch',
            dryRun: false,
            allowDirty: false,
            allowBranch: false,
            skipPreflight: false,
            force: false,
        });
    });

    it('reads the flags in any position', () => {
        const args = parseArgs(['--dry-run', 'minor', '--force', '--allow-dirty', '--allow-branch', '--skip-preflight']);
        expect(args).toEqual({
            level: 'minor',
            dryRun: true,
            allowDirty: true,
            allowBranch: true,
            skipPreflight: true,
            force: true,
        });
    });

    it.each([[[]], [['patch', 'minor']], [['bogus']], [['patch', '--nope']]])('rejects %j', (argv) => {
        expect(() => parseArgs(argv)).toThrow(ArgError);
    });
});

describe('bumpVersion', () => {
    it.each([
        ['0.0.47', 'patch', '0.0.48'],
        ['0.0.47', 'minor', '0.1.0'],
        ['0.0.47', 'major', '1.0.0'],
        ['1.9.9', 'minor', '1.10.0'],
        ['2.3.4', 'major', '3.0.0'],
    ] as const)('%s + %s = %s', (current, level, expected) => {
        expect(bumpVersion(current, level)).toBe(expected);
    });

    it.each(['1.0.0-beta.1', '1.0', 'v1.0.0', ''])('rejects the non-semver version %j', (version) => {
        expect(() => bumpVersion(version, 'patch')).toThrow(ArgError);
    });
});

describe('package.json version rewriting', () => {
    const pkg = '{\n    "name": "@gilav21/shadcn-angular",\n    "version": "0.0.47",\n    "type": "module"\n}\n';

    it('reads the version', () => {
        expect(readPackageVersion(pkg)).toBe('0.0.47');
    });

    it('rewrites only the version, preserving formatting', () => {
        expect(setPackageVersion(pkg, '0.1.0')).toBe(pkg.replace('0.0.47', '0.1.0'));
    });

    it('throws when there is no version field', () => {
        expect(() => setPackageVersion('{"name":"x"}', '1.0.0')).toThrow(ArgError);
        expect(() => readPackageVersion('{"name":"x"}')).toThrow(ArgError);
    });

    it('names the tag', () => {
        expect(tagName('0.0.48')).toBe('cli-v0.0.48');
    });
});

describe('classifyPath', () => {
    it.each([
        'packages/cli/src/commands/add.ts',
        'packages/cli/src/core/fetch.ts',
        'packages/cli/src/registry/load.ts',
        'packages/cli/src/registry/legacy-baselines.ts',
        'packages/cli/package.json',
        'packages/cli/README.md',
    ])('treats %s as bundled CLI logic', (file) => {
        expect(classifyPath(file)).toBe('cli-logic');
    });

    it.each([
        'packages/components/ui/button/button.component.ts',
        'packages/components/lib/utils.ts',
        'packages/components/registry.json',
        'demo/src/app/app.ts',
        'e2e/harness/button/button.spec.ts',
        'scripts/preflight.mjs',
        'packages/cli/scripts/sync-registry.ts',
        'packages/cli/src/core/fetch.spec.ts',
    ])('treats %s as live / never-shipped', (file) => {
        expect(classifyPath(file)).toBe('live');
    });

    it('singles out the registry module for a shape check', () => {
        expect(classifyPath('packages/cli/src/registry/index.ts')).toBe('registry-module');
    });

    it('normalizes windows separators', () => {
        expect(classifyPath('packages\\cli\\src\\program.ts')).toBe('cli-logic');
    });
});

describe('stripRegistryData', () => {
    const source = [
        'export interface ComponentDefinition { name: string; }',
        'export const registry = defineRegistry({',
        '    button: { name: "button", deps: (1) },',
        '});',
        'export function isComponentName(n: string) { return n in registry; }',
    ].join('\n');

    it('removes the data literal but keeps the shape and the helpers', () => {
        const stripped = stripRegistryData(source);
        expect(stripped).toContain('ComponentDefinition');
        expect(stripped).toContain('isComponentName');
        expect(stripped).not.toContain('button:');
    });

    it('is identical for two revisions that differ only in registry data', () => {
        const other = source.replace('button: { name: "button", deps: (1) },', 'card: { name: "card" },');
        expect(stripRegistryData(other)).toBe(stripRegistryData(source));
    });

    it('differs when the shape changes', () => {
        const other = source.replace('name: string;', 'name: string; branch?: string;');
        expect(stripRegistryData(other)).not.toBe(stripRegistryData(source));
    });

    it('passes through a source with no registry literal', () => {
        expect(stripRegistryData('export const x = 1;')).toBe('export const x = 1;');
    });
});

describe('publishVerdict', () => {
    const shape = 'interface ComponentDefinition {}';

    it('requires a publish when bundled CLI code changed', () => {
        const verdict = publishVerdict({
            changedFiles: ['packages/cli/src/commands/add.ts', 'packages/components/ui/button/button.component.ts'],
            registryShapeBefore: shape,
            registryShapeAfter: shape,
        });
        expect(verdict.required).toBe(true);
        expect(verdict.triggers).toEqual(['packages/cli/src/commands/add.ts']);
    });

    it('does NOT require a publish for component / lib / registry-data changes', () => {
        const verdict = publishVerdict({
            changedFiles: [
                'packages/components/ui/button/button.component.ts',
                'packages/components/registry.json',
                'demo/src/app/demos/button-demo.component.ts',
            ],
            registryShapeBefore: shape,
            registryShapeAfter: shape,
        });
        expect(verdict.required).toBe(false);
        expect(verdict.triggers).toEqual([]);
        expect(verdict.reasons.join(' ')).toContain('may be unnecessary');
    });

    it('does NOT require a publish when only the registry DATA snapshot moved', () => {
        const verdict = publishVerdict({
            changedFiles: ['packages/cli/src/registry/index.ts', 'packages/components/registry.json'],
            registryShapeBefore: shape,
            registryShapeAfter: shape,
        });
        expect(verdict.required).toBe(false);
        expect(verdict.reasons.join(' ')).toContain('registry DATA snapshot');
    });

    it('DOES require a publish when the manifest shape changed', () => {
        const verdict = publishVerdict({
            changedFiles: ['packages/cli/src/registry/index.ts'],
            registryShapeBefore: shape,
            registryShapeAfter: `${shape} interface Addon {}`,
        });
        expect(verdict.required).toBe(true);
        expect(verdict.reasons.join(' ')).toContain('manifest SHAPE');
    });

    it('requires nothing when nothing changed', () => {
        expect(publishVerdict({ changedFiles: [], registryShapeBefore: null, registryShapeAfter: null }).required).toBe(false);
    });
});

describe('parseCommit', () => {
    it('parses type, scope, description', () => {
        expect(parseCommit({ hash: 'abcdef1234', subject: 'feat(cli): add why command' })).toEqual({
            hash: 'abcdef1234',
            type: 'feat',
            scope: 'cli',
            breaking: false,
            description: 'add why command',
        });
    });

    it('detects the breaking bang and a missing scope', () => {
        const parsed = parseCommit({ hash: 'aaa', subject: 'refactor!: drop the legacy flag' });
        expect(parsed).toMatchObject({ type: 'refactor', scope: null, breaking: true });
    });

    it('returns null for a non-conventional subject', () => {
        expect(parseCommit({ hash: 'aaa', subject: 'wip stuff' })).toBeNull();
    });
});

describe('renderReleaseNotes', () => {
    const commits = [
        { hash: '1111111111', subject: 'feat(cli): add the why command' },
        { hash: '2222222222', subject: 'fix(mcp): resolve the branch per registry' },
        { hash: '3333333333', subject: 'chore(deps): bump zod' },
        { hash: '4444444444', subject: 'feat(cli)!: rename --registry to --source' },
        { hash: '5555555555', subject: 'not a conventional commit' },
    ];

    it('groups commits into sections, breaking first', () => {
        const notes = renderReleaseNotes('0.1.0', commits, '2026-07-13');
        expect(notes).toContain('## 0.1.0 — 2026-07-13');
        expect(notes.indexOf('### BREAKING CHANGES')).toBeLessThan(notes.indexOf('### Features'));
        expect(notes.indexOf('### Features')).toBeLessThan(notes.indexOf('### Bug Fixes'));
        expect(notes).toContain('- **cli:** add the why command (11111111)');
        expect(notes).toContain('- **cli:** rename --registry to --source (44444444)');
        expect(notes).not.toContain('not a conventional commit');
    });

    it('says so when there is nothing to report', () => {
        expect(renderReleaseNotes('0.0.48', [], '2026-07-13')).toContain('_No conventional commits');
    });

    it('omits empty sections', () => {
        const notes = renderReleaseNotes('0.0.48', [{ hash: 'a1b2c3d4e5', subject: 'fix(cli): a fix' }], '2026-07-13');
        expect(notes).not.toContain('### Features');
        expect(notes).toContain('### Bug Fixes');
    });
});

describe('prependRelease', () => {
    it('creates the file with a header when there is none', () => {
        const out = prependRelease(null, '## 0.0.48 — 2026-07-13\n\n### Bug Fixes\n\n- x (aaaa)\n');
        expect(out.startsWith('# Changelog')).toBe(true);
        expect(out).toContain('## 0.0.48');
    });

    it('inserts the newest release directly under the header', () => {
        const existing = prependRelease(null, '## 0.0.48 — 2026-07-13\n\n- old\n');
        const out = prependRelease(existing, '## 0.0.49 — 2026-07-14\n\n- new\n');
        expect(out.indexOf('## 0.0.49')).toBeLessThan(out.indexOf('## 0.0.48'));
        expect(out).toContain('- old');
        expect(out.startsWith('# Changelog')).toBe(true);
    });
});
