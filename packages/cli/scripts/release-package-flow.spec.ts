/**
 * The `release:package` FLOW, driven in process from a literal git transcript.
 *
 * `release-package.spec.ts` pins the same contract as a subprocess in a
 * throwaway repo — that run sees what a maintainer sees, but a child process is
 * not v8-instrumented, so it proves the behaviour without measuring it, and it
 * can only reach the handful of paths a fixture repo can be posed into. These
 * tests drive the same decisions as values: every branch of the base-ref
 * fallback, the verdict, the guards, the revert and the hand-off, with git
 * replaced by a transcript.
 *
 * The load-bearing claim throughout: the script does everything up to the push
 * and then STOPS. Nothing here may produce an `npm publish` invocation.
 */
import { describe, expect, it } from 'vitest';

import { releaseCommitArgv } from './release-cli-lib.js';
import {
    RELEASE_BRANCH,
    branchRefusal,
    changedFilesSince,
    closureDirs,
    dirtyTreeRefusal,
    handoffLines,
    nodeReleaseEffects,
    noPushLine,
    packageChangelogHeader,
    packageCommits,
    parseCommitLog,
    parsePackageArgs,
    planRelease,
    preflightCommands,
    preflightLegs,
    publishCommand,
    rehearsalLines,
    releaseUsage,
    resolveBaseRef,
    revertFailureLine,
    revertPlan,
    runRelease,
    verdictReport,
    type GitProbe,
    type NodeReleaseIO,
    type PackageReleaseArgs,
    type ReleaseEffects,
} from './release-package-lib.js';

/**
 * A git stand-in built from a transcript: an argv join → output map. Anything
 * not in the map answers `null` from `probe` (the "no such tag" case) and throws
 * from `run`, exactly as a real non-zero exit does.
 */
function fakeGit(transcript: Record<string, string>): GitProbe {
    const lookup = (args: string[]): string | undefined => transcript[args.join(' ')];
    return {
        probe: (...args) => lookup(args) ?? null,
        run: (...args) => {
            const out = lookup(args);
            if (out === undefined) throw new Error(`git ${args.join(' ')} failed`);
            return out;
        },
    };
}

const ARGS = (overrides: Partial<PackageReleaseArgs> = {}): PackageReleaseArgs => ({
    ...parsePackageArgs(['rte', 'patch']),
    ...overrides,
});

// ── Base ref ───────────────────────────────────────────────────────────────

describe('resolveBaseRef', () => {
    const DESCRIBE = 'describe --tags --abbrev=0 --match rte-v*';
    const LOG = 'log -1 --format=%H -- packages/rte-package/package.json';
    const ROOT = 'rev-list --max-parents=0 HEAD';

    it('prefers the newest per-package tag', () => {
        const base = resolveBaseRef('rte', fakeGit({ [DESCRIBE]: 'rte-v0.2.0', [LOG]: 'deadbeef' }));
        expect(base.ref).toBe('rte-v0.2.0');
        expect(base.how).toContain('rte-v0.2.0');
    });

    // Without this rung a package's FIRST release would diff against the root
    // commit and report every file in the repo as a reason to release.
    it('falls back to the last commit touching the package.json before any tag', () => {
        const sha = '0123456789abcdef0123456789abcdef01234567';
        const base = resolveBaseRef('rte', fakeGit({ [LOG]: sha }));
        expect(base.ref).toBe(sha);
        expect(base.how).toContain('01234567');
        expect(base.how).toContain('no rte-v* tag yet');
    });

    it('falls back to the root commit when there is neither a tag nor a version commit', () => {
        const base = resolveBaseRef('rte', fakeGit({ [ROOT]: 'r00tc0mmit' }));
        expect(base.ref).toBe('r00tc0mmit');
        expect(base.how).toContain('root commit');
    });

    it('matches only THIS package\'s tags, so the two packages never share a base', () => {
        const git = fakeGit({
            'describe --tags --abbrev=0 --match data-table-v*': 'data-table-v0.5.0',
            [ROOT]: 'r00tc0mmit',
        });
        expect(resolveBaseRef('data-table', git).ref).toBe('data-table-v0.5.0');
        expect(resolveBaseRef('rte', git).ref).toBe('r00tc0mmit');
    });
});

describe('changedFilesSince', () => {
    it('splits the diff listing into files', () => {
        const git = fakeGit({ 'diff --name-only base..HEAD': 'a.ts\nb.ts' });
        expect(changedFilesSince('base', git)).toEqual(['a.ts', 'b.ts']);
    });

    // A base with no diff exits non-zero from the probe; that must read as
    // "nothing changed", not as a crash.
    it('reads an unavailable diff as no changed files', () => {
        expect(changedFilesSince('base', fakeGit({}))).toEqual([]);
    });

    it('drops the trailing blank line git emits', () => {
        expect(changedFilesSince('b', fakeGit({ 'diff --name-only b..HEAD': 'a.ts\n' }))).toEqual(['a.ts']);
    });
});

// ── Changelog scoping ──────────────────────────────────────────────────────

describe('closureDirs', () => {
    it('reduces closure files to their parent directories, deduplicated', () => {
        const dirs = closureDirs(new Set(['a/b/x.ts', 'a/b/y.ts', 'a/c/z.ts']));
        expect([...dirs].sort((l, r) => l.localeCompare(r))).toEqual(['a/b', 'a/c']);
    });

    it('drops a root-level path, which has no directory to scope by', () => {
        expect(closureDirs(new Set(['root.ts']))).toEqual([]);
    });
});

describe('parseCommitLog', () => {
    it('splits hash and subject on the tab separator', () => {
        expect(parseCommitLog('abc\tfeat: one\ndef\tfix: two')).toEqual([
            { hash: 'abc', subject: 'feat: one' },
            { hash: 'def', subject: 'fix: two' },
        ]);
    });

    it('keeps a subject that itself contains a tab', () => {
        expect(parseCommitLog('abc\tfeat: a\tb')[0].subject).toBe('feat: a\tb');
    });

    it('reads no output as no commits', () => {
        expect(parseCommitLog(null)).toEqual([]);
        expect(parseCommitLog('')).toEqual([]);
    });
});

describe('packageCommits', () => {
    it('scopes the log to the closure directories', () => {
        const key = 'log base..HEAD --no-merges --format=%H%x09%s -- ui/rte';
        const commits = packageCommits('base', new Set(['ui/rte/a.ts']), fakeGit({ [key]: 'h1\tfeat: x' }));
        expect(commits).toEqual([{ hash: 'h1', subject: 'feat: x' }]);
    });
});

// ── Guards ─────────────────────────────────────────────────────────────────

describe('dirtyTreeRefusal', () => {
    it('allows a clean tree', () => {
        expect(dirtyTreeRefusal('', ARGS())).toBeNull();
    });

    // Unrelated work would not be swept into the pathspec-scoped commit, but it
    // WOULD ride the same push under a release tag, unreviewed.
    it('refuses a dirty tree and shows what is dirty', () => {
        const refusal = dirtyTreeRefusal(' M src/x.ts', ARGS());
        expect(refusal).not.toBeNull();
        expect(refusal?.join('\n')).toContain(' M src/x.ts');
        expect(refusal?.join('\n')).toContain('--allow-dirty');
    });

    it('allows a dirty tree under --allow-dirty', () => {
        expect(dirtyTreeRefusal(' M src/x.ts', ARGS({ allowDirty: true }))).toBeNull();
    });
});

describe('branchRefusal', () => {
    it('allows the release branch', () => {
        expect(branchRefusal(RELEASE_BRANCH, ARGS())).toBeNull();
    });

    it('refuses any other branch, naming it', () => {
        const refusal = branchRefusal('feat/x', ARGS());
        expect(refusal?.join('\n')).toContain('feat/x');
        expect(refusal?.join('\n')).toContain('--allow-branch');
    });

    it('allows another branch under --allow-branch', () => {
        expect(branchRefusal('feat/x', ARGS({ allowBranch: true }))).toBeNull();
    });
});

// ── Verdict ────────────────────────────────────────────────────────────────

describe('verdictReport', () => {
    const required = (n: number) => ({
        required: true,
        reasons: Array.from({ length: n }, (_, i) => `packages/components/ui/f${i}.ts`),
    });

    it('proceeds on a required verdict and lists the changed files', () => {
        const report = verdictReport(required(2), ARGS());
        expect(report.proceed).toBe(true);
        expect(report.lines[0]).toContain('REQUIRED');
        expect(report.lines[0]).toContain('2 file(s)');
        expect(report.lines).toHaveLength(3);
        expect(report.errorLines).toEqual([]);
    });

    // A verdict naming a hundred files would bury its own headline.
    it('lists at most ten files and collapses the rest to a count', () => {
        const report = verdictReport(required(13), ARGS());
        expect(report.lines).toHaveLength(12);
        expect(report.lines.at(-1)).toBe('  … and 3 more');
    });

    it('does not add an overflow line at exactly ten files', () => {
        expect(verdictReport(required(10), ARGS()).lines.join('\n')).not.toContain('more');
    });

    // Cutting a release that ships an identical tarball burns a version number
    // and tells consumers nothing, so it is fatal by default.
    it('stops on a NOT-required verdict and points at --force', () => {
        const report = verdictReport({ required: false, reasons: [] }, ARGS());
        expect(report.proceed).toBe(false);
        expect(report.errorLines.join('\n')).toContain('--force');
    });

    // The refusal is the actionable half and must reach the terminal even when
    // a maintainer pipes stdout to a release log.
    it('puts the refusal on the error stream, not with the verdict itself', () => {
        const report = verdictReport({ required: false, reasons: [] }, ARGS());
        expect(report.lines.join('\n')).toContain('NOT required');
        expect(report.lines.join('\n')).not.toContain('Re-run with --force');
        expect(report.errorLines).toEqual(['Re-run with --force if you still want to cut a release.']);
    });

    it.each([
        ['--force', ARGS({ force: true }), '--force given'],
        ['--dry-run', ARGS({ dryRun: true }), 'dry run'],
    ])('proceeds on a NOT-required verdict under %s with nothing on the error stream', (_flag, args, note) => {
        const report = verdictReport({ required: false, reasons: [] }, args);
        expect(report.proceed).toBe(true);
        expect(report.lines.join('\n')).toContain(note);
        expect(report.errorLines).toEqual([]);
    });
});

// ── Preflight ──────────────────────────────────────────────────────────────

describe('preflightLegs / preflightCommands', () => {
    // pkg-mixed installs both packages into one app; it belongs to the RTE
    // release because the RTE package carries the shared closure.
    it('gives rte the mixed-install leg as well as its own two', () => {
        expect(preflightLegs('rte')).toBe('pkg-rte pkg-rte-ng21 pkg-mixed');
    });

    it('gives data-table only its own two legs', () => {
        expect(preflightLegs('data-table')).toBe('pkg-data-table pkg-data-table-ng21');
    });

    it('builds before it tests, so the e2e legs install the new tarball', () => {
        expect(preflightCommands('rte')).toEqual([
            'run build:package -- rte',
            'run e2e -- pkg-rte pkg-rte-ng21 pkg-mixed',
        ]);
    });
});

// ── Plan ───────────────────────────────────────────────────────────────────

describe('planRelease', () => {
    const SOURCE = '{\n  "name": "@gilav21/shadcn-angular-rte",\n  "version": "0.1.0"\n}\n';

    it('bumps from the source package.json and tags the NEXT version', () => {
        const plan = planRelease('rte', SOURCE, ARGS(), [], '2026-09-04');
        expect(plan.current).toBe('0.1.0');
        expect(plan.next).toBe('0.1.1');
        expect(plan.tag).toBe('rte-v0.1.1');
    });

    it.each([
        ['patch', '0.1.1'],
        ['minor', '0.2.0'],
        ['major', '1.0.0'],
    ] as const)('applies the %s level', (level, expected) => {
        expect(planRelease('rte', SOURCE, ARGS({ level }), [], '2026-09-04').next).toBe(expected);
    });

    it('renders the changelog block for the next version and the given date', () => {
        const plan = planRelease('rte', SOURCE, ARGS(), [{ hash: 'h1', subject: 'feat: thing' }], '2026-09-04');
        expect(plan.block).toContain('0.1.1');
        expect(plan.block).toContain('2026-09-04');
        expect(plan.block).toContain('thing');
    });

    it('names the package and both versions in the headline', () => {
        expect(planRelease('rte', SOURCE, ARGS(), [], '2026-09-04').headline)
            .toBe('@gilav21/shadcn-angular-rte: 0.1.0 → 0.1.1 (patch)');
    });

    it('tags per package, so the two never share a version line', () => {
        expect(planRelease('data-table', SOURCE, ARGS(), [], '2026-09-04').tag).toBe('data-table-v0.1.1');
    });
});

describe('packageChangelogHeader', () => {
    it('names the published package it documents', () => {
        expect(packageChangelogHeader('rte')).toContain('@gilav21/shadcn-angular-rte');
        expect(packageChangelogHeader('data-table')).toContain('@gilav21/shadcn-angular-data-table');
    });

    // prependRelease splices new blocks under this header, so it must be the
    // Markdown title of the file.
    it('starts with the Changelog heading', () => {
        expect(packageChangelogHeader('rte').split('\n')[0]).toBe('# Changelog');
    });
});

// ── Rehearsal ──────────────────────────────────────────────────────────────

describe('rehearsalLines', () => {
    const { add, commit } = releaseCommitArgv('rte-v0.1.1', ['packages/rte-package/package.json'], 'rte');
    const R = { id: 'rte', next: '0.1.1', tag: 'rte-v0.1.1', branch: 'master', add, commit } as const;

    // The rehearsal renders from the SAME argv arrays the real run executes, so
    // it cannot claim a commit the real run would not make.
    it('previews the exact git argv the real run would execute', () => {
        const lines = rehearsalLines(R).join('\n');
        expect(lines).toContain(`git ${add.join(' ')}`);
        expect(lines).toContain(`git ${commit.join(' ')}`);
        expect(lines).toContain('git tag -a rte-v0.1.1 -m rte-v0.1.1');
        expect(lines).toContain('git push origin master --follow-tags');
    });

    it('previews the writes it is not making', () => {
        const lines = rehearsalLines(R).join('\n');
        expect(lines).toContain('packages/rte-package/package.json version 0.1.1');
        expect(lines).toContain('packages/rte-package/CHANGELOG.md');
    });

    it('marks every line as a rehearsal and closes by saying nothing happened', () => {
        const lines = rehearsalLines(R);
        expect(lines.slice(0, -1).every((l) => l.startsWith('[dry-run]'))).toBe(true);
        expect(lines.at(-1)).toContain('nothing was written, tagged or pushed');
    });

    // The unrecoverable regression: a run that publishes. The rehearsal must
    // present publishing as a MANUAL step, never as something it would do.
    it('presents the publish as manual, never as a step it would run', () => {
        const publishLine = rehearsalLines(R).find((l) => l.includes('npm publish'));
        expect(publishLine).toContain('MANUALLY');
    });
});

// ── Revert ─────────────────────────────────────────────────────────────────

describe('revertPlan', () => {
    const PATHS = ['packages/rte-package/package.json', 'packages/rte-package/CHANGELOG.md'];

    it('restores a tracked file with checkout', () => {
        expect(revertPlan(PATHS, () => true)).toEqual([
            { kind: 'checkout', path: PATHS[0] },
            { kind: 'checkout', path: PATHS[1] },
        ]);
    });

    // On a FIRST release the CHANGELOG is brand new. A blanket
    // `git checkout -- <both>` fails with "pathspec did not match any file(s)
    // known to git", killing the revert half-done and leaving exactly the dirty
    // tree it exists to prevent.
    it('deletes an untracked file instead of checking it out', () => {
        const plan = revertPlan(PATHS, (p) => p.endsWith('package.json'));
        expect(plan).toEqual([
            { kind: 'checkout', path: PATHS[0] },
            { kind: 'delete', path: PATHS[1] },
        ]);
    });

    it('decides each path independently rather than by the first answer', () => {
        const plan = revertPlan(PATHS, (p) => p.endsWith('CHANGELOG.md'));
        expect(plan[0].kind).toBe('delete');
        expect(plan[1].kind).toBe('checkout');
    });
});

describe('revertFailureLine', () => {
    it('reports the failing path and the error message', () => {
        expect(revertFailureLine('a/b.json', new Error('EPERM'))).toBe('  could not revert a/b.json: EPERM');
    });

    it('renders a non-Error throw without collapsing it to [object Object]', () => {
        expect(revertFailureLine('a/b.json', { code: 'EBUSY' })).toContain('EBUSY');
    });
});

// ── Hand-off ───────────────────────────────────────────────────────────────

describe('publishCommand', () => {
    it.each(['rte', 'data-table'] as const)('publishes %s from its own dist folder', (id) => {
        expect(publishCommand(id)).toBe(`cd dist/${id}-package && npm publish --access public`);
    });
});

describe('handoffLines', () => {
    it('says the tag was pushed and leaves the publish to a human', () => {
        const lines = handoffLines('rte', 'rte-v0.1.1', ARGS()).join('\n');
        expect(lines).toContain('Tag rte-v0.1.1 pushed');
        expect(lines).toContain('2FA');
        expect(lines).toContain(publishCommand('rte'));
    });

    // Claiming a push that did not happen would send the maintainer looking for
    // a tag on origin that is only local.
    it('says "created", not "pushed", under --no-push', () => {
        const lines = handoffLines('rte', 'rte-v0.1.1', ARGS({ noPush: true })).join('\n');
        expect(lines).toContain('Tag rte-v0.1.1 created');
        expect(lines).not.toContain('pushed');
    });

    it('names the published package in the verification command', () => {
        expect(handoffLines('data-table', 'data-table-v1.0.0', ARGS()).join('\n'))
            .toContain('npm view @gilav21/shadcn-angular-data-table version');
    });
});

describe('noPushLine', () => {
    it('says the tag is local only', () => {
        expect(noPushLine('rte-v0.1.1')).toContain('rte-v0.1.1');
        expect(noPushLine('rte-v0.1.1')).toContain('not pushing');
    });
});

describe('releaseUsage', () => {
    it('names both package ids, all three levels and every flag', () => {
        const usage = releaseUsage();
        for (const token of [
            'rte', 'data-table', 'patch', 'minor', 'major',
            '--dry-run', '--force', '--allow-dirty', '--allow-branch', '--skip-preflight', '--no-push',
        ]) {
            expect(usage, token).toContain(token);
        }
    });
});

// ── The whole flow ─────────────────────────────────────────────────────────

const PKG_JSON = 'packages/rte-package/package.json';
const CHANGELOG = 'packages/rte-package/CHANGELOG.md';
const PKG_SOURCE = '{\n  "name": "@gilav21/shadcn-angular-rte",\n  "version": "0.1.0"\n}\n';

/**
 * A git transcript for a repo where a release IS required: one tag, and a diff
 * naming a file that really is in the rte closure.
 */
const CLOSURE_FILE = 'packages/rte-package/package.json';

function releaseTranscript(overrides: Record<string, string> = {}): Record<string, string> {
    return {
        'rev-parse --abbrev-ref HEAD': 'master',
        'status --porcelain': '',
        'describe --tags --abbrev=0 --match rte-v*': 'rte-v0.1.0',
        'diff --name-only rte-v0.1.0..HEAD': CLOSURE_FILE,
        ...overrides,
    };
}

interface Recorded {
    readonly effects: ReleaseEffects;
    readonly calls: string[];
    readonly files: Map<string, string>;
    readonly out: string[];
    readonly err: string[];
}

/**
 * A whole fake world for the release flow: a git transcript, a filesystem map,
 * captured console output, and an ordered call log.
 *
 * `npmFails` poses the preflight into failing, which is the only way to reach
 * the revert path. Any git argv absent from the transcript answers `''` from
 * `run` — the release's own writes (`add`, `commit`, `tag`, `push`) produce no
 * output, so they need no transcript entry, only a recording.
 */
function world(
    transcript: Record<string, string>,
    options: { npmFails?: boolean; files?: Record<string, string> } = {},
): Recorded {
    const calls: string[] = [];
    const out: string[] = [];
    const err: string[] = [];
    const files = new Map(Object.entries(options.files ?? { [PKG_JSON]: PKG_SOURCE }));

    const effects: ReleaseEffects = {
        git: {
            run: (...args) => {
                calls.push(`git ${args.join(' ')}`);
                return transcript[args.join(' ')] ?? '';
            },
            probe: (...args) => {
                calls.push(`git? ${args.join(' ')}`);
                return transcript[args.join(' ')] ?? null;
            },
        },
        npm: (command) => {
            calls.push(`npm ${command}`);
            if (options.npmFails) throw new Error('preflight failed');
        },
        log: (line) => out.push(line),
        error: (line) => err.push(line),
        readFile: (p) => files.get(p) ?? '',
        readFileIfExists: (p) => files.get(p) ?? null,
        writeFile: (p, content) => { calls.push(`write ${p}`); files.set(p, content); },
        deleteFile: (p) => { calls.push(`delete ${p}`); files.delete(p); },
        today: () => '2026-09-04',
    };
    return { effects, calls, files, out, err };
}

describe('nodeReleaseEffects', () => {
    /** Records every primitive call so the composed paths are assertable. */
    function io(overrides: Partial<NodeReleaseIO> = {}) {
        const calls: string[] = [];
        const primitives: NodeReleaseIO = {
            git: (args) => { calls.push(`git ${args.join(' ')}`); return 'ok'; },
            gitProbe: (args) => { calls.push(`git? ${args.join(' ')}`); return 'probed'; },
            npm: (c) => { calls.push(`npm ${c}`); },
            log: (l) => calls.push(`log ${l}`),
            error: (l) => calls.push(`err ${l}`),
            readFile: (p) => { calls.push(`read ${p}`); return 'content'; },
            exists: () => true,
            writeFile: (p) => { calls.push(`write ${p}`); },
            deleteFile: (p) => { calls.push(`delete ${p}`); },
            now: () => new Date('2026-09-04T12:00:00Z'),
            ...overrides,
        };
        return { calls, fx: nodeReleaseEffects('/repo', primitives) };
    }

    // The flow addresses files by REPO-RELATIVE path — that is what a git
    // pathspec wants — so the effects must resolve them against the repo root.
    it.each([
        ['readFile', (fx: ReleaseEffects) => fx.readFile(PKG_JSON), `read /repo/${PKG_JSON}`],
        ['writeFile', (fx: ReleaseEffects) => fx.writeFile(PKG_JSON, 'x'), `write /repo/${PKG_JSON}`],
        ['deleteFile', (fx: ReleaseEffects) => fx.deleteFile(PKG_JSON), `delete /repo/${PKG_JSON}`],
    ])('resolves %s against the repo root', (_label, act, expected) => {
        const { calls, fx } = io();
        act(fx);
        expect(calls).toContain(expected);
    });

    it('reads an existing file through readFileIfExists', () => {
        expect(io().fx.readFileIfExists(CHANGELOG)).toBe('content');
    });

    // A package's FIRST CHANGELOG does not exist yet; reading it must answer
    // null, not throw, or the first release of each package would crash.
    it('answers null for a file that does not exist', () => {
        const { calls, fx } = io({ exists: () => false });
        expect(fx.readFileIfExists(CHANGELOG)).toBeNull();
        expect(calls.some((c) => c.startsWith('read'))).toBe(false);
    });

    it('formats today as the YYYY-MM-DD a changelog heading wants', () => {
        expect(io().fx.today()).toBe('2026-09-04');
    });

    it('passes git argv straight through in both the throwing and probing forms', () => {
        const { calls, fx } = io();
        expect(fx.git.run('status', '--porcelain')).toBe('ok');
        expect(fx.git.probe('describe', '--tags')).toBe('probed');
        expect(calls).toEqual(['git status --porcelain', 'git? describe --tags']);
    });
});

describe('runRelease — the unrecoverable invariant', () => {
    // The one regression that cannot be undone. `npm publish` needs 2FA and is
    // MANUAL by design; a flow that ran it would push a version to the registry
    // that can never be taken back. No path may produce it.
    it.each([
        ['a full release', ['rte', 'patch', '--skip-preflight']],
        ['a dry run', ['rte', 'patch', '--dry-run']],
        ['a no-push release', ['rte', 'patch', '--skip-preflight', '--no-push']],
        ['a failed preflight', ['rte', 'patch']],
        ['a refused verdict', ['rte', 'patch']],
    ])('never invokes npm publish during %s', (_label, argv) => {
        const w = world(releaseTranscript(), { npmFails: argv.length === 2 });
        runRelease(argv, w.effects);
        expect(w.calls.filter((c) => c.startsWith('npm ')).join('\n')).not.toContain('publish');
    });

    it('tells the human to publish rather than doing it', () => {
        const w = world(releaseTranscript());
        expect(runRelease(['rte', 'patch', '--skip-preflight'], w.effects)).toBe(0);
        expect(w.out.join('\n')).toContain(publishCommand('rte'));
        expect(w.out.join('\n')).toContain('2FA');
    });
});

describe('runRelease — argv', () => {
    it('exits 1 with the message and usage on a bad argv, touching nothing', () => {
        const w = world(releaseTranscript());
        expect(runRelease(['rte', 'nope'], w.effects)).toBe(1);
        expect(w.err.join('\n')).toContain('Invalid bump level');
        expect(w.err.join('\n')).toContain('--dry-run');
        expect(w.calls).toEqual([]);
    });

    it('rethrows a non-ArgError instead of swallowing it as bad argv', () => {
        const w = world(releaseTranscript());
        const boom = { ...w.effects, error: () => { throw new TypeError('boom'); } };
        expect(() => runRelease(['rte', 'nope'], boom)).toThrow('boom');
    });
});

describe('runRelease — guards', () => {
    it('refuses a dirty tree before writing anything', () => {
        const w = world(releaseTranscript({ 'status --porcelain': ' M src/x.ts' }));
        expect(runRelease(['rte', 'patch'], w.effects)).toBe(1);
        expect(w.err.join('\n')).toContain('--allow-dirty');
        expect(w.calls.filter((c) => c.startsWith('write'))).toEqual([]);
    });

    it('refuses a non-master branch before writing anything', () => {
        const w = world(releaseTranscript({ 'rev-parse --abbrev-ref HEAD': 'feat/x' }));
        expect(runRelease(['rte', 'patch'], w.effects)).toBe(1);
        expect(w.err.join('\n')).toContain('feat/x');
        expect(w.calls.filter((c) => c.startsWith('write'))).toEqual([]);
    });

    // A dirty tree is refused without ever asking git for the branch: the two
    // read-only probes stay in the order the flow has always issued them, and
    // the refusal does not depend on `rev-parse` succeeding.
    it('checks the tree before it asks for the branch, and short-circuits', () => {
        const w = world(releaseTranscript({ 'status --porcelain': ' M src/x.ts' }));
        expect(runRelease(['rte', 'patch'], w.effects)).toBe(1);
        expect(w.calls).toContain('git status --porcelain');
        expect(w.calls).not.toContain('git rev-parse --abbrev-ref HEAD');
    });

    it('proceeds past both guards under the override flags', () => {
        const w = world(releaseTranscript({
            'status --porcelain': ' M src/x.ts',
            'rev-parse --abbrev-ref HEAD': 'feat/x',
        }));
        const argv = ['rte', 'patch', '--allow-dirty', '--allow-branch', '--skip-preflight'];
        expect(runRelease(argv, w.effects)).toBe(0);
    });

    // The push must follow the branch the release was actually cut from, or an
    // --allow-branch release would push master's ref under this branch's tag.
    it('pushes the branch it validated, not a hard-coded master', () => {
        const w = world(releaseTranscript({ 'rev-parse --abbrev-ref HEAD': 'release/rte' }));
        runRelease(['rte', 'patch', '--allow-branch', '--skip-preflight'], w.effects);
        expect(w.calls).toContain('git push origin release/rte --follow-tags');
    });
});

describe('runRelease — verdict', () => {
    it('stops at exit 1 when nothing in the closure changed', () => {
        const w = world(releaseTranscript({ 'diff --name-only rte-v0.1.0..HEAD': 'README.md' }));
        expect(runRelease(['rte', 'patch'], w.effects)).toBe(1);
        expect(w.out.join('\n')).toContain('NOT required');
        expect(w.calls.filter((c) => c.startsWith('write'))).toEqual([]);
    });

    // The refusal must survive `npm run release:package > release.log`.
    it('announces the refusal on stderr, not only on stdout', () => {
        const w = world(releaseTranscript({ 'diff --name-only rte-v0.1.0..HEAD': 'README.md' }));
        runRelease(['rte', 'patch'], w.effects);
        expect(w.err.join('\n')).toContain('Re-run with --force');
        expect(w.out.join('\n')).not.toContain('Re-run with --force');
    });

    it('continues past a NOT-required verdict under --force', () => {
        const w = world(releaseTranscript({ 'diff --name-only rte-v0.1.0..HEAD': 'README.md' }));
        expect(runRelease(['rte', 'patch', '--force', '--skip-preflight'], w.effects)).toBe(0);
    });
});

describe('runRelease — dry run', () => {
    it('writes nothing, runs no npm command and makes no git commit', () => {
        const w = world(releaseTranscript());
        expect(runRelease(['rte', 'patch', '--dry-run'], w.effects)).toBe(0);
        expect(w.calls.some((c) => c.startsWith('write') || c.startsWith('npm '))).toBe(false);
        expect(w.calls.some((c) => c.startsWith('git commit') || c.startsWith('git tag'))).toBe(false);
        expect(w.files.get(PKG_JSON)).toBe(PKG_SOURCE);
    });

    it('previews the bumped version it would have written', () => {
        const w = world(releaseTranscript());
        runRelease(['rte', 'patch', '--dry-run'], w.effects);
        expect(w.out.join('\n')).toContain('version 0.1.1');
    });
});

describe('runRelease — the real run', () => {
    it('bumps the package.json version', () => {
        const w = world(releaseTranscript());
        runRelease(['rte', 'patch', '--skip-preflight'], w.effects);
        expect(JSON.parse(w.files.get(PKG_JSON) ?? '{}').version).toBe('0.1.1');
    });

    // ng-packagr copies the version from the source package.json into the
    // tarball, so building first would pack the OLD version.
    it('writes the bump BEFORE running the preflight build', () => {
        const w = world(releaseTranscript());
        runRelease(['rte', 'patch'], w.effects);
        expect(w.calls.indexOf(`write ${PKG_JSON}`))
            .toBeLessThan(w.calls.indexOf('npm run build:package -- rte'));
    });

    it('creates the changelog with its header on a first release', () => {
        const w = world(releaseTranscript());
        runRelease(['rte', 'patch', '--skip-preflight'], w.effects);
        const changelog = w.files.get(CHANGELOG) ?? '';
        expect(changelog).toContain('# Changelog');
        expect(changelog).toContain('0.1.1');
    });

    it('prepends to an existing changelog, keeping the older entries', () => {
        const existing = `${packageChangelogHeader('rte')}\n## 0.1.0\n\n- older thing\n`;
        const w = world(releaseTranscript(), { files: { [PKG_JSON]: PKG_SOURCE, [CHANGELOG]: existing } });
        runRelease(['rte', 'patch', '--skip-preflight'], w.effects);
        const changelog = w.files.get(CHANGELOG) ?? '';
        expect(changelog).toContain('older thing');
        expect(changelog.indexOf('0.1.1')).toBeLessThan(changelog.indexOf('older thing'));
    });

    // An unannotated tag is skipped by `push --follow-tags`, so the tag would
    // never reach origin and the next release would compare against a stale base.
    it('creates an ANNOTATED tag and pushes it, in that order', () => {
        const w = world(releaseTranscript());
        runRelease(['rte', 'patch', '--skip-preflight'], w.effects);
        expect(w.calls).toContain('git tag -a rte-v0.1.1 -m rte-v0.1.1');
        expect(w.calls.indexOf('git tag -a rte-v0.1.1 -m rte-v0.1.1'))
            .toBeLessThan(w.calls.indexOf('git push origin master --follow-tags'));
    });

    // Whatever else is staged — very reachable under --allow-dirty — must not
    // be swept into the release commit and pushed.
    it('scopes the commit to the two release files by pathspec', () => {
        const w = world(releaseTranscript());
        runRelease(['rte', 'patch', '--skip-preflight'], w.effects);
        const commit = w.calls.find((c) => c.startsWith('git commit')) ?? '';
        expect(commit).toContain(PKG_JSON);
        expect(commit).toContain(CHANGELOG);
        expect(commit).toContain('chore(rte): release rte-v0.1.1');
    });

    it('commits and tags but does not push under --no-push', () => {
        const w = world(releaseTranscript());
        runRelease(['rte', 'patch', '--skip-preflight', '--no-push'], w.effects);
        expect(w.calls).toContain('git tag -a rte-v0.1.1 -m rte-v0.1.1');
        expect(w.calls.some((c) => c.startsWith('git push'))).toBe(false);
        expect(w.out.join('\n')).toContain('not pushing');
    });

    it('runs both preflight commands when the flag is absent', () => {
        const w = world(releaseTranscript());
        runRelease(['rte', 'patch'], w.effects);
        expect(w.calls).toContain('npm run build:package -- rte');
        expect(w.calls).toContain('npm run e2e -- pkg-rte pkg-rte-ng21 pkg-mixed');
    });

    it('runs no npm command under --skip-preflight, and says so', () => {
        const w = world(releaseTranscript());
        runRelease(['rte', 'patch', '--skip-preflight'], w.effects);
        expect(w.calls.some((c) => c.startsWith('npm '))).toBe(false);
        expect(w.out.join('\n')).toContain('[skip-preflight]');
    });
});

describe('runRelease — failed preflight', () => {
    // Leaving the bump on disk would make the NEXT run refuse on a dirty tree
    // for a reason the maintainer did not cause.
    it('reverts a tracked package.json with git checkout and exits 1', () => {
        const w = world(releaseTranscript({
            [`ls-files --error-unmatch -- ${PKG_JSON}`]: PKG_JSON,
            [`ls-files --error-unmatch -- ${CHANGELOG}`]: CHANGELOG,
        }), { npmFails: true });

        expect(runRelease(['rte', 'patch'], w.effects)).toBe(1);
        expect(w.calls).toContain(`git checkout -- ${PKG_JSON}`);
        expect(w.calls).toContain(`git checkout -- ${CHANGELOG}`);
        expect(w.err.join('\n')).toContain('Preflight FAILED');
    });

    // On a FIRST release the CHANGELOG is brand new, and `git checkout` on it
    // fails with "pathspec did not match", killing the revert half-done.
    it('deletes an untracked CHANGELOG rather than checking it out', () => {
        const w = world(releaseTranscript({
            [`ls-files --error-unmatch -- ${PKG_JSON}`]: PKG_JSON,
        }), { npmFails: true });

        expect(runRelease(['rte', 'patch'], w.effects)).toBe(1);
        expect(w.calls).toContain(`git checkout -- ${PKG_JSON}`);
        expect(w.calls).toContain(`delete ${CHANGELOG}`);
        expect(w.files.has(CHANGELOG)).toBe(false);
    });

    it('never commits, tags or pushes after a failed preflight', () => {
        const w = world(releaseTranscript(), { npmFails: true });
        runRelease(['rte', 'patch'], w.effects);
        expect(w.calls.some((c) => /^git (commit|tag|push)/.test(c))).toBe(false);
    });

    // A revert failure must not mask the preflight failure that triggered it,
    // and must not stop the OTHER path from being reverted.
    it('reports a failing revert step and still reverts the other path', () => {
        const w = world(releaseTranscript({
            [`ls-files --error-unmatch -- ${PKG_JSON}`]: PKG_JSON,
        }), { npmFails: true });
        const fx: ReleaseEffects = {
            ...w.effects,
            git: {
                ...w.effects.git,
                run: (...args) => {
                    if (args[0] === 'checkout') throw new Error('EPERM');
                    return w.effects.git.run(...args);
                },
            },
        };

        expect(runRelease(['rte', 'patch'], fx)).toBe(1);
        expect(w.err.join('\n')).toContain('could not revert');
        expect(w.err.join('\n')).toContain('EPERM');
        expect(w.calls).toContain(`delete ${CHANGELOG}`);
    });
});
