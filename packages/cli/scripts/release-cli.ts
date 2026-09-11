#!/usr/bin/env tsx
/**
 * Local release flow for the CLI package. NOT a CI workflow — this runs on the
 * maintainer's machine, on purpose.
 *
 *   npm run release:cli -- patch|minor|major [flags]
 *
 * What it does, in order:
 *   1. Refuses a dirty tree / a non-master branch  (--allow-dirty, --allow-branch)
 *   2. Prints the PUBLISH-REQUIRED VERDICT: the CLI fetches the registry and all
 *      component/lib source live from the branch, so most changes need no
 *      publish at all. If nothing bundled changed, the release aborts unless
 *      you pass --force.
 *   3. Runs `npm run preflight` — never publishes unverified code  (--skip-preflight)
 *   4. Bumps packages/cli/package.json
 *   5. Regenerates packages/cli/CHANGELOG.md from conventional commits
 *   6. Commits the release, `npm publish` (prepublishOnly rebuilds), tags, pushes
 *
 * --dry-run does 1-5 in memory and prints exactly what 6 would do, changing
 * nothing on disk, in npm or in git.
 */

import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    ArgError,
    bumpVersion,
    parseArgs,
    prependRelease,
    publishVerdict,
    readPackageVersion,
    releaseCommitArgv,
    registryShape,
    renderReleaseNotes,
    setPackageVersion,
    tagName,
    branchRefusal,
    changedFilesSince,
    dirtyTreeRefusal,
    parseCommitLog,
    resolveBaseRefFor,
    type BaseRef,
    type Commit,
    type GitProbe,
    type PublishVerdict,
    type ReleaseArgs,
} from './release-cli-lib';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..');
const CLI_DIR = path.resolve(REPO_ROOT, 'packages/cli');
const PKG_JSON = path.join(CLI_DIR, 'package.json');
const CHANGELOG = path.join(CLI_DIR, 'CHANGELOG.md');
const REGISTRY_MODULE = 'packages/cli/src/registry/index.ts';

// ── git plumbing ────────────────────────────────────────────────────────

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
 * shim, which Node refuses to spawn with `shell: false` (EINVAL since the
 * CVE-2024-27980 fix). No user input reaches the shell here.
 */
function npm(command: string, cwd: string): void {
    execSync(`npm ${command}`, { cwd, stdio: 'inherit' });
}

/** The CLI's git, in the injected shape the shared release helpers take. */
const gitProbe: GitProbe = { run: git, probe: gitOrNull };

/** The previous release point of the CLI train — see `resolveBaseRefFor`. */
function resolveBaseRef(): BaseRef {
    return resolveBaseRefFor({ tagPattern: 'cli-v*', versionFile: 'packages/cli/package.json' }, gitProbe);
}

function changedFiles(baseRef: string): string[] {
    return changedFilesSince(baseRef, gitProbe);
}

function cliCommits(baseRef: string): Commit[] {
    return parseCommitLog(gitOrNull('log', `${baseRef}..HEAD`, '--no-merges', '--format=%H%x09%s', '--', 'packages/cli'));
}

function registryShapeAt(ref: string): string | null {
    const source = gitOrNull('show', `${ref}:${REGISTRY_MODULE}`);
    return source === null ? null : registryShape(source);
}

function registryShapeNow(): string | null {
    const file = path.join(REPO_ROOT, REGISTRY_MODULE);
    return existsSync(file) ? registryShape(readFileSync(file, 'utf-8')) : null;
}

// ── guards ──────────────────────────────────────────────────────────────

function assertCleanTree(args: ReleaseArgs): void {
    const refusal = dirtyTreeRefusal(git('status', '--porcelain'), args);
    if (!refusal) return;
    for (const line of refusal) console.error(line);
    process.exit(1);
}

function assertReleaseBranch(args: ReleaseArgs): string {
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    const refusal = branchRefusal(branch, args);
    if (!refusal) return branch;
    for (const line of refusal) console.error(line);
    process.exit(1);
}

// ── verdict ─────────────────────────────────────────────────────────────

function reportVerdict(verdict: PublishVerdict, base: { ref: string; how: string }): void {
    console.log('\n════ publish-required verdict ════');
    console.log(`  base: ${base.how}`);
    for (const reason of verdict.reasons) console.log(`  ${reason}`);
    if (verdict.triggers.length > 0) {
        console.log('\n  Bundled files changed since then:');
        for (const file of verdict.triggers.slice(0, 20)) console.log(`    ${file}`);
        if (verdict.triggers.length > 20) console.log(`    …and ${verdict.triggers.length - 20} more`);
    }
    console.log(`\n  VERDICT: publish ${verdict.required ? 'REQUIRED' : 'NOT required'}`);
}

function enforceVerdict(verdict: PublishVerdict, args: ReleaseArgs): void {
    if (verdict.required || args.force) return;
    const suffix = args.dryRun ? ' (dry run — continuing the rehearsal anyway)' : '';
    console.log(
        '\n  Component / lib / registry-data changes ship on merge with no publish. ' +
        `Re-run with --force if you still want to cut a release.${suffix}`,
    );
    if (!args.dryRun) process.exit(1);
}

// ── steps ───────────────────────────────────────────────────────────────

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function writeArtifacts(nextVersion: string, base: string, args: ReleaseArgs): string {
    const notes = renderReleaseNotes(nextVersion, cliCommits(base), today());
    console.log('\n════ CHANGELOG entry ════\n');
    console.log(notes);

    if (args.dryRun) {
        console.log(`[dry-run] would write ${path.relative(REPO_ROOT, PKG_JSON)} version ${nextVersion}`);
        console.log(`[dry-run] would prepend the block above to ${path.relative(REPO_ROOT, CHANGELOG)}`);
        return notes;
    }

    writeFileSync(PKG_JSON, setPackageVersion(readFileSync(PKG_JSON, 'utf-8'), nextVersion));
    const existing = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, 'utf-8') : null;
    writeFileSync(CHANGELOG, prependRelease(existing, notes));
    return notes;
}

function publishAndTag(nextVersion: string, branch: string, args: ReleaseArgs): void {
    const tag = tagName(nextVersion);
    const { add, commit } = releaseCommitArgv(tag);
    const steps = [
        `git ${add.join(' ')}`,
        `git ${commit.join(' ')}`,
        'npm publish  (packages/cli — prepublishOnly rebuilds dist/)',
        `git tag -a ${tag} -m ${tag}`,
        `git push origin ${branch} --follow-tags`,
    ];

    if (args.dryRun) {
        console.log('\n════ would then run ════');
        for (const step of steps) console.log(`  [dry-run] ${step}`);
        console.log('\nDry run complete — nothing was written, published, tagged or pushed.');
        return;
    }

    // Pathspec form, exactly as the dry-run prints it: a bare `git commit` would
    // sweep anything else already staged (very reachable under --allow-dirty)
    // into the release commit and push it.
    git(...add);
    git(...commit);
    npm('publish', CLI_DIR);
    // Annotated, not lightweight: `git push --follow-tags` pushes ONLY annotated
    // tags, so a bare `git tag <name>` is created locally and then silently left
    // behind by the push. That is how cli-v0.0.50 and cli-v0.0.51 ended up
    // published to npm with no tag anywhere on origin — and why the
    // publish-required verdict above was computing against a stale base.
    git('tag', '-a', tag, '-m', tag);
    git('push', 'origin', branch, '--follow-tags');
    console.log(`\nPublished and tagged ${tag}.`);
}

function main(): void {
    let args: ReleaseArgs;
    try {
        args = parseArgs(process.argv.slice(2));
    } catch (error) {
        if (!(error instanceof ArgError)) throw error;
        console.error(`${error.message}\n\nUsage: npm run release:cli -- <patch|minor|major> [--dry-run] [--force] [--allow-dirty] [--allow-branch] [--skip-preflight]`);
        process.exit(1);
    }

    assertCleanTree(args);
    const branch = assertReleaseBranch(args);

    const base = resolveBaseRef();
    const verdict = publishVerdict({
        changedFiles: changedFiles(base.ref),
        registryShapeBefore: registryShapeAt(base.ref),
        registryShapeAfter: registryShapeNow(),
    });
    reportVerdict(verdict, base);
    enforceVerdict(verdict, args);

    if (args.skipPreflight) {
        console.log('\n[!] --skip-preflight: publishing UNVERIFIED code. You own this.');
    } else {
        console.log('\n════ preflight ════');
        npm('run preflight', REPO_ROOT);
    }

    const current = readPackageVersion(readFileSync(PKG_JSON, 'utf-8'));
    const next = bumpVersion(current, args.level);
    console.log(`\n════ version ════\n  ${current} → ${next} (${args.level})`);

    writeArtifacts(next, base.ref, args);
    publishAndTag(next, branch, args);
}

main();
