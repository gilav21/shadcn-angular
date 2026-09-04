#!/usr/bin/env tsx
/**
 * Local release flow for the two COMPILED npm packages. Like `release-cli`,
 * this runs on the maintainer's machine on purpose.
 *
 *   npm run release:package -- <rte|data-table> <patch|minor|major> [flags]
 *
 * In order:
 *   1. Refuses a dirty tree / a non-master branch  (--allow-dirty, --allow-branch)
 *   2. Prints the RELEASE-REQUIRED VERDICT — did anything that ends up inside
 *      the tarball change since the last `<id>-v*` tag? If not, aborts unless
 *      you pass --force.
 *   3. Bumps `packages/<id>-package/package.json` and prepends its CHANGELOG.
 *      The bump happens BEFORE the build, because ng-packagr copies the version
 *      from the source package.json into the tarball — building first would
 *      pack the OLD version.
 *   4. Runs the package preflight: stage → ng build → npm pack → the package
 *      e2e legs. On failure the two bumped files are reverted.  (--skip-preflight)
 *   5. Commits exactly those two files, creates the ANNOTATED tag, pushes.
 *   6. STOPS and prints the manual `npm publish` command.
 *
 * It never runs `npm publish`: publishing needs 2FA, which is interactive.
 *
 * --dry-run does 1-3 in memory and prints exactly what 4-6 would do, changing
 * nothing on disk or in git.
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    ArgError,
    bumpVersion,
    prependRelease,
    readPackageVersion,
    releaseCommitArgv,
    renderReleaseNotes,
    setPackageVersion,
    type Commit,
} from './release-cli-lib.js';
import {
    closurePaths,
    packageChangelogHeader,
    packageReleasePaths,
    packageTagName,
    packageVerdict,
    parsePackageArgs,
    type PackageReleaseArgs,
} from './release-package-lib.js';
import { PACKAGE_NAMES, packageDir, type PackageId } from './stage-package-lib.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..');
const RELEASE_BRANCH = 'master';

// ── git plumbing (same shape as release-cli.ts) ─────────────────────────

function git(...args: string[]): string {
    return execFileSync('git', ['-C', REPO_ROOT, ...args], { encoding: 'utf-8' }).trim();
}

/** Probing form: a non-zero exit is an expected answer ("no such tag"), not an error. */
function gitOrNull(...args: string[]): string | null {
    try {
        return execFileSync('git', ['-C', REPO_ROOT, ...args], {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch {
        return null;
    }
}

/**
 * Runs a hard-coded npm command through the shell. On Windows `npm` is a `.cmd`
 * shim, which Node refuses to spawn with `shell: false`.
 */
function npm(command: string): void {
    execSync(`npm ${command}`, { cwd: REPO_ROOT, stdio: 'inherit' });
}

/**
 * The previous release point: the newest `<id>-v*` tag, or — before the first
 * tagged release — the last commit touching this package's package.json, or the
 * root commit.
 */
function resolveBaseRef(id: PackageId): { ref: string; how: string } {
    const tag = gitOrNull('describe', '--tags', '--abbrev=0', '--match', `${id}-v*`);
    if (tag) return { ref: tag, how: `latest ${id}-v* tag (${tag})` };

    const pkgJson = `${packageDir(id)}/package.json`;
    const versionCommit = gitOrNull('log', '-1', '--format=%H', '--', pkgJson);
    if (versionCommit) {
        return {
            ref: versionCommit,
            how: `no ${id}-v* tag yet — using the last commit touching ${pkgJson} (${versionCommit.slice(0, 8)})`,
        };
    }
    return { ref: git('rev-list', '--max-parents=0', 'HEAD'), how: 'no tag and no history — using the root commit' };
}

function changedFiles(baseRef: string): string[] {
    const out = gitOrNull('diff', '--name-only', `${baseRef}..HEAD`);
    return out ? out.split('\n').filter(Boolean) : [];
}

/**
 * Conventional commits since the base that touched anything in this package's
 * closure — the changelog is about what the CONSUMER gets, not about every
 * commit in the repo.
 */
function packageCommits(baseRef: string, paths: ReadonlySet<string>): Commit[] {
    const dirs = new Set<string>();
    for (const file of paths) {
        const dir = file.split('/').slice(0, -1).join('/');
        if (dir) dirs.add(dir);
    }
    const out = gitOrNull(
        'log', `${baseRef}..HEAD`, '--no-merges', '--format=%H%x09%s', '--', ...dirs,
    );
    if (!out) return [];
    return out.split('\n').filter(Boolean).map((line) => {
        const [hash, ...rest] = line.split('\t');
        return { hash, subject: rest.join('\t') };
    });
}

// ── guards ──────────────────────────────────────────────────────────────

function assertCleanTree(args: PackageReleaseArgs): void {
    const status = git('status', '--porcelain');
    if (status.length === 0 || args.allowDirty) return;
    console.error('Working tree is dirty — commit or stash first:\n');
    console.error(status);
    console.error('\n(override with --allow-dirty)');
    process.exit(1);
}

function assertReleaseBranch(args: PackageReleaseArgs): string {
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    if (branch === RELEASE_BRANCH || args.allowBranch) return branch;
    console.error(`On branch "${branch}" — releases are cut from "${RELEASE_BRANCH}".`);
    console.error('(override with --allow-branch)');
    process.exit(1);
}

// ── flow ────────────────────────────────────────────────────────────────

function printVerdict(required: boolean, reasons: readonly string[], args: PackageReleaseArgs): void {
    if (required) {
        console.log(`VERDICT: release REQUIRED — ${reasons.length} file(s) in the package changed:`);
        for (const reason of reasons.slice(0, 10)) console.log(`  ${reason}`);
        if (reasons.length > 10) console.log(`  … and ${reasons.length - 10} more`);
        return;
    }

    console.log('VERDICT: release NOT required — nothing that ships in the tarball changed.');
    if (args.force) {
        console.log('(--force given — continuing anyway)');
        return;
    }
    if (args.dryRun) {
        console.log('(dry run — continuing the rehearsal anyway)');
        return;
    }
    console.error('Re-run with --force if you still want to cut a release.');
    process.exit(1);
}

function runPreflight(id: PackageId, args: PackageReleaseArgs, revert: () => void): void {
    if (args.skipPreflight) {
        console.log('[skip-preflight] not building or testing the package.');
        return;
    }
    const legs = id === 'rte'
        ? 'pkg-rte pkg-rte-ng21 pkg-mixed'
        : 'pkg-data-table pkg-data-table-ng21';
    try {
        npm(`run build:package -- ${id}`);
        npm(`run e2e -- ${legs}`);
    } catch {
        // The bump already touched two files; leaving them modified would make
        // the next run refuse on a dirty tree for a reason the maintainer did
        // not cause.
        console.error('\nPreflight FAILED — reverting the version bump and changelog.');
        revert();
        process.exit(1);
    }
}

/**
 * Undoes the bump + changelog write after a failed preflight.
 *
 * Each path is handled by whether git actually TRACKS it, not by assuming both
 * are tracked: on a package's FIRST release `CHANGELOG.md` is brand new, and a
 * blanket `git checkout -- <both>` fails with "pathspec did not match any
 * file(s) known to git", killing the script mid-revert and leaving exactly the
 * dirty tree this exists to prevent. A revert failure must also never mask the
 * preflight failure that triggered it, so problems here are reported, not thrown.
 */
function revertReleaseFiles(paths: readonly string[]): void {
    for (const rel of paths) {
        try {
            const tracked = gitOrNull('ls-files', '--error-unmatch', '--', rel) !== null;
            if (tracked) {
                git('checkout', '--', rel);
            } else {
                rmSync(path.join(REPO_ROOT, rel), { force: true });
            }
        } catch (error) {
            console.error(
                `  could not revert ${rel}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}

/**
 * Computes the next version, its tag and the changelog block, and prints both
 * for the maintainer. Pure apart from the logging — nothing is written here, so
 * the dry-run and the real run share exactly this computation.
 */
function planRelease(
    id: PackageId,
    pkgSource: string,
    args: PackageReleaseArgs,
    baseRef: string,
    paths: ReadonlySet<string>,
): { next: string; tag: string; block: string } {
    const current = readPackageVersion(pkgSource);
    const next = bumpVersion(current, args.level);
    console.log(`\n${PACKAGE_NAMES[id]}: ${current} → ${next} (${args.level})`);

    const block = renderReleaseNotes(
        next,
        packageCommits(baseRef, paths),
        new Date().toISOString().slice(0, 10),
    );
    console.log(`\n${block}`);
    return { next, tag: packageTagName(id, next), block };
}

interface Rehearsal {
    readonly id: PackageId;
    readonly next: string;
    readonly tag: string;
    readonly branch: string;
    readonly add: readonly string[];
    readonly commit: readonly string[];
    readonly publishCommand: string;
}

/**
 * The `--dry-run` preview. It renders from the SAME argv arrays the real run
 * executes, so the rehearsal cannot drift from what actually happens.
 */
function printRehearsal(r: Rehearsal): void {
    console.log(`[dry-run] would write ${packageDir(r.id)}/package.json version ${r.next}`);
    console.log(`[dry-run] would prepend the block above to ${packageDir(r.id)}/CHANGELOG.md`);
    console.log('[dry-run] would run the package preflight (build:package + the pkg-* e2e legs)');
    console.log(`[dry-run] git ${r.add.join(' ')}`);
    console.log(`[dry-run] git ${r.commit.join(' ')}`);
    console.log(`[dry-run] git tag -a ${r.tag} -m ${r.tag}`);
    console.log(`[dry-run] git push origin ${r.branch} --follow-tags`);
    console.log(`[dry-run] then MANUALLY: ${r.publishCommand}`);
    console.log('\nDry run complete — nothing was written, tagged or pushed.');
}

function main(): number {
    let args: PackageReleaseArgs;
    try {
        args = parsePackageArgs(process.argv.slice(2));
    } catch (error) {
        if (!(error instanceof ArgError)) throw error;
        console.error(error.message);
        console.error('\nUsage: npm run release:package -- <rte|data-table> <patch|minor|major> [--dry-run] [--force] [--allow-dirty] [--allow-branch] [--skip-preflight] [--no-push]');
        return 1;
    }

    const { id } = args;
    assertCleanTree(args);
    const branch = assertReleaseBranch(args);

    const { ref: baseRef, how } = resolveBaseRef(id);
    console.log(`Base ref: ${how}`);

    const paths = closurePaths(id);
    const { required, reasons } = packageVerdict(changedFiles(baseRef), paths, id);
    printVerdict(required, reasons, args);

    const pkgJsonPath = path.join(REPO_ROOT, `${packageDir(id)}/package.json`);
    const changelogPath = path.join(REPO_ROOT, `${packageDir(id)}/CHANGELOG.md`);
    const pkgSource = readFileSync(pkgJsonPath, 'utf-8');
    const { next, tag, block } = planRelease(id, pkgSource, args, baseRef, paths);

    const releasePaths = packageReleasePaths(id);
    const { add, commit } = releaseCommitArgv(tag, releasePaths, id);
    const publishCommand = `cd dist/${id}-package && npm publish --access public`;

    if (args.dryRun) {
        printRehearsal({ id, next, tag, branch, add, commit, publishCommand });
        return 0;
    }

    writeFileSync(pkgJsonPath, setPackageVersion(pkgSource, next));
    const existing = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf-8') : null;
    writeFileSync(changelogPath, prependRelease(existing, block, packageChangelogHeader(id)));

    runPreflight(id, args, () => revertReleaseFiles(releasePaths));

    git(...add);
    git(...commit);
    git('tag', '-a', tag, '-m', tag);
    if (args.noPush) {
        console.log(`[no-push] tag ${tag} created locally; not pushing.`);
    } else {
        git('push', 'origin', branch, '--follow-tags');
    }

    // The hand-off. Publishing needs 2FA, so a human finishes the job.
    console.log(`\nTag ${tag} ${args.noPush ? 'created' : 'pushed'}. Publish manually (2FA):`);
    console.log(`  ${publishCommand}`);
    console.log(`\nThen verify: npm view ${PACKAGE_NAMES[id]} version`);
    return 0;
}

process.exit(main());
