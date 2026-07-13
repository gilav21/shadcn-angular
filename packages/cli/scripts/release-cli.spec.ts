import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
    commitAll,
    copyScripts,
    createRepo,
    fixtureScript,
    git,
    gitInitCommit,
    removeRepo,
    runScript,
    write,
    type Run,
} from './repo-fixtures';
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
    registryShape,
    releaseCommitArgv,
    RELEASE_PATHS,
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

const NL = String.fromCodePoint(10);
const CRLF = String.fromCodePoint(13, 10);

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

    // Regression (review finding #2): descriptions are free text — `new:component
    // --description "a smiley :("` is enough to unbalance a character-wise paren
    // scan. The old stripper then silently dropped EVERYTHING after the literal
    // (getComponentNames, isComponentName, levenshtein, …), so a revision that
    // rewrote that real CLI logic stripped to the same prefix on both sides and
    // the verdict said "publish NOT required". It must fail SAFE instead.
    it('keeps the helpers below an unbalanced paren inside a description string', () => {
        const smiley = [
            'export interface ComponentDefinition { name: string; }',
            'export const registry = defineRegistry({',
            "    button: { name: 'button', description: 'a smiley :(' },",
            '});',
            'export function isComponentName(n: string) { return n in registry; }',
        ].join(NL);

        const stripped = stripRegistryData(smiley);
        expect(stripped).toContain('isComponentName');
        expect(stripped).not.toContain('smiley');
    });

    it('a CLI-logic rewrite below an unbalanced description still forces a publish', () => {
        const before = [
            'export const registry = defineRegistry({',
            "    button: { name: 'button', description: 'a smiley :(' },",
            '});',
            'export function levenshtein(a: string, b: string) { return 0; }',
        ].join(NL);
        const after = before.replace('return 0;', 'return realDistance(a, b);');

        // The two revisions must NOT strip to the same source — that is the exact
        // path by which a real CLI fix would have been declared unnecessary.
        expect(stripRegistryData(after)).not.toBe(stripRegistryData(before));
        expect(publishVerdict({
            changedFiles: ['packages/cli/src/registry/index.ts'],
            registryShapeBefore: stripRegistryData(before),
            registryShapeAfter: stripRegistryData(after),
        }).required).toBe(true);
    });

    it('returns the whole source when the literal is never closed (fail safe)', () => {
        const truncated = `export const registry = defineRegistry({${NL}    button: { name: "button" },`;
        expect(stripRegistryData(truncated)).toBe(truncated);
    });
});

// The two revisions the verdict compares come from DIFFERENT readers — `git show`
// (trimmed) vs `readFileSync` (not) — and a Windows checkout is CRLF on disk, LF in
// the object store. Unnormalised, they always compared unequal on trailing
// whitespace alone, so the registry-DATA-only branch of publishVerdict was dead
// code and every regenerated snapshot was reported as a manifest-SHAPE change.
describe('registryShape', () => {
    const source = [
        'export interface ComponentDefinition { name: string; }',
        'export const registry = defineRegistry({',
        "    button: { name: 'button' },",
        '});',
        'export function isComponentName(n: string) { return n in registry; }',
        '',
    ].join(NL);

    it('is stable across CRLF-vs-LF and a trailing newline', () => {
        const fromDisk = source.replaceAll(NL, CRLF);
        const fromGit = source.trim();
        expect(registryShape(fromDisk)).toBe(registryShape(fromGit));
    });

    it('reports a registry-data-only change as needing no publish', () => {
        const regenerated = source.replace("button: { name: 'button' },", "card: { name: 'card' },");
        expect(publishVerdict({
            changedFiles: ['packages/cli/src/registry/index.ts'],
            registryShapeBefore: registryShape(source.trim()),
            registryShapeAfter: registryShape(regenerated.replaceAll(NL, CRLF)),
        }).required).toBe(false);
    });
});

// Regression (review finding #7): the real run used `git commit -m …` with NO
// pathspec, so anything else already staged (reachable under --allow-dirty) was
// swept into the release commit and pushed — while the dry-run PRINTED the
// pathspec form, so the rehearsal lied about what the real run did.
describe('releaseCommitArgv', () => {
    it('scopes both the add and the commit to the two release files', () => {
        const { add, commit } = releaseCommitArgv('cli-v1.2.3');
        expect(add).toEqual(['add', '--', ...RELEASE_PATHS]);
        expect(commit).toEqual([
            'commit', '-m', 'chore(cli): release cli-v1.2.3', '--', ...RELEASE_PATHS,
        ]);
    });

    it('never commits the whole index', () => {
        const { commit } = releaseCommitArgv('cli-v1.2.3');
        expect(commit).toContain('--');
        expect(commit.slice(commit.indexOf('--') + 1)).toEqual([...RELEASE_PATHS]);
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

// ── The entry script (subprocess, fixture repo) ──────────────────────────
//
// release-cli resolves its repo from its OWN file location, and step 6 of its
// flow is `npm publish` + `git tag` + `git push`. It is therefore never run
// against the real repo here, and NEVER without --dry-run: the fixture is a
// throwaway git repo (see repo-fixtures.ts) with its own packages/cli, and every
// run below rehearses. What the tests assert is that the rehearsal stays a
// rehearsal — no version bump, no CHANGELOG, no commit, no tag — and that the
// guards (dirty tree, wrong branch, bad argv) exit non-zero before any of it.

const FIXTURE_PKG = '{\n  "name": "@fixture/cli",\n  "version": "1.2.3"\n}\n';

const FIXTURE_REGISTRY = `export interface ComponentDefinition {
    readonly name: string;
    readonly files: readonly string[];
}

export const registry = {
  alpha: { name: 'alpha', files: ['alpha/alpha.component.ts'] },
};
`;

/** Where the second commit lands decides the publish verdict. */
type Change = 'cli-logic' | 'component';

function seedReleaseFixture(change: Change): string {
    const root = createRepo('release');
    copyScripts(root, ['release-cli.ts', 'release-cli-lib.ts']);
    write(root, 'packages/cli/package.json', FIXTURE_PKG);
    write(root, 'packages/cli/src/registry/index.ts', FIXTURE_REGISTRY);
    write(root, 'packages/components/ui/alpha/alpha.component.ts', 'export const Alpha = 1;\n');

    // The base ref is the last commit touching packages/cli/package.json — this one.
    gitInitCommit(root, 'chore(cli): seed');

    if (change === 'cli-logic') {
        write(root, 'packages/cli/src/commands/add.ts', 'export const add = () => 1;\n');
        commitAll(root, 'feat(cli): add a thing');
    } else {
        write(root, 'packages/components/ui/alpha/alpha.component.ts', 'export const Alpha = 2;\n');
        commitAll(root, 'fix(alpha): tweak the component');
    }
    return root;
}

describe('release-cli entry (fixture repo)', () => {
    let root = '';

    afterEach(() => {
        if (root) removeRepo(root);
        root = '';
    });

    function release(change: Change, args: readonly string[]): Run {
        root = seedReleaseFixture(change);
        return runScript(fixtureScript(root, 'release-cli.ts'), args);
    }

    it('--dry-run rehearses a required publish without writing, publishing, tagging or pushing', () => {
        const head = () => git(root, 'rev-parse', 'HEAD');
        const before = release('cli-logic', ['patch', '--dry-run', '--skip-preflight']);
        const headAfter = head();

        expect(before.status).toBe(0);
        expect(before.stdout).toContain('VERDICT: publish REQUIRED');
        expect(before.stdout).toContain('1.2.3 → 1.2.4 (patch)');
        // The publish is only ever PRINTED, prefixed as a rehearsal.
        expect(before.stdout).toContain('[dry-run] npm publish');
        expect(before.stdout).toContain('Dry run complete — nothing was written, published, tagged or pushed.');
        expect(before.stdout).not.toContain('Published and tagged');

        // …and the rehearsal left no trace: no bump, no changelog, no commit, no tag.
        expect(readFileSync(path.join(root, 'packages/cli/package.json'), 'utf-8')).toContain('"version": "1.2.3"');
        expect(existsSync(path.join(root, 'packages/cli/CHANGELOG.md'))).toBe(false);
        expect(git(root, 'status', '--porcelain')).toBe('');
        expect(git(root, 'tag', '--list')).toBe('');
        expect(headAfter).toBe(head());
    }, 60_000);

    it('renders the CHANGELOG entry it would prepend, from the CLI commits since the base', () => {
        const { stdout } = release('cli-logic', ['minor', '--dry-run', '--skip-preflight']);

        expect(stdout).toContain('1.2.3 → 1.3.0 (minor)');
        expect(stdout).toContain('## 1.3.0');
        expect(stdout).toContain('### Features');
        expect(stdout).toContain('**cli:** add a thing');
        // The script prints a platform-native relative path (backslashes on Windows).
        expect(stdout).toMatch(/\[dry-run] would write packages[\\/]cli[\\/]package\.json version 1\.3\.0/);
        expect(stdout).toMatch(/\[dry-run] would prepend the block above to packages[\\/]cli[\\/]CHANGELOG\.md/);
    }, 60_000);

    it('reports publish NOT required when only component source changed', () => {
        const { status, stdout } = release('component', ['patch', '--dry-run', '--skip-preflight']);

        expect(status).toBe(0);
        expect(stdout).toContain('VERDICT: publish NOT required');
        expect(stdout).toContain('Re-run with --force if you still want to cut a release.');
        expect(stdout).toContain('(dry run — continuing the rehearsal anyway)');
    }, 60_000);

    it('refuses a dirty tree', () => {
        root = seedReleaseFixture('cli-logic');
        write(root, 'packages/cli/src/commands/add.ts', 'export const add = () => 2;\n');

        const { status, output } = runScript(fixtureScript(root, 'release-cli.ts'),
            ['patch', '--dry-run', '--skip-preflight']);

        expect(status).toBe(1);
        expect(output).toContain('Working tree is dirty');
        expect(output).toContain('(override with --allow-dirty)');
        expect(output).not.toContain('VERDICT');
    }, 60_000);

    it('refuses a branch other than master', () => {
        root = seedReleaseFixture('cli-logic');
        git(root, 'checkout', '-q', '-b', 'feat/whatever');

        const { status, output } = runScript(fixtureScript(root, 'release-cli.ts'),
            ['patch', '--dry-run', '--skip-preflight']);

        expect(status).toBe(1);
        expect(output).toContain('On branch "feat/whatever" — releases are cut from "master"');
        expect(output).not.toContain('VERDICT');
    }, 60_000);

    it.each([
        { args: [] as string[], message: 'Missing bump level' },
        { args: ['pre-release'], message: 'Invalid bump level "pre-release"' },
        { args: ['patch', '--bogus'], message: 'Unknown flag: --bogus' },
        { args: ['patch', 'minor'], message: 'Too many arguments: patch minor' },
    ])('exits 1 with usage on bad argv ($message)', ({ args, message }) => {
        const { status, output } = release('cli-logic', args);

        expect(status).toBe(1);
        expect(output).toContain(message);
        expect(output).toContain('Usage: npm run release:cli -- <patch|minor|major>');
        // Argv is rejected before any git, npm or filesystem work happens.
        expect(output).not.toContain('VERDICT');
        expect(readFileSync(path.join(root, 'packages/cli/package.json'), 'utf-8')).toContain('"version": "1.2.3"');
    }, 60_000);
});
