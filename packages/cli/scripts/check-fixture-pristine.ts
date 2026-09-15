#!/usr/bin/env tsx
/**
 * Pristine-fixture gate: refuses to commit or push an e2e fixture app that
 * carries a run's install output. Exits 1 with one line per violation.
 *
 * Usage:
 *   npx tsx packages/cli/scripts/check-fixture-pristine.ts            # HEAD (pre-push / preflight)
 *   npx tsx packages/cli/scripts/check-fixture-pristine.ts --staged   # the index (pre-commit, via lint-staged)
 *   npx tsx packages/cli/scripts/check-fixture-pristine.ts --root <repo>
 *
 * Reads git objects, not the working tree, because the working tree is dirty
 * by design between specs — what matters is what would land in history.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FIXTURE_APPS, SCAFFOLD_FILES, fixtureViolations, type FixtureSnapshot } from './check-fixture-pristine-lib.js';

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function git(root: string, args: readonly string[]): string | null {
    try {
        return execFileSync('git', ['-C', root, ...args], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
        return null;
    }
}

/** The fixture as git holds it at `ref` (`''` = the index). */
export function snapshotFixture(root: string, fixture: string, ref: string): FixtureSnapshot | null {
    const tracked = ref === ''
        ? git(root, ['ls-files', '--', fixture])
        : git(root, ['ls-tree', '-r', '--name-only', ref, '--', fixture]);
    if (tracked === null) return null;
    const files: Record<string, string> = {};
    for (const rel of SCAFFOLD_FILES) {
        const content = git(root, ['show', `${ref}:${fixture}/${rel}`]);
        if (content !== null) files[rel] = content;
    }
    return {
        files,
        tracked: tracked.split('\n').filter(Boolean).map((p) => p.slice(fixture.length + 1)),
    };
}

export function checkFixtures(root: string, ref: string): string[] {
    const violations: string[] = [];
    for (const fixture of FIXTURE_APPS) {
        const snapshot = snapshotFixture(root, fixture, ref);
        if (!snapshot || snapshot.tracked.length === 0) continue;
        for (const v of fixtureViolations(snapshot)) violations.push(`${fixture}: ${v}`);
    }
    return violations;
}

function main(argv: readonly string[]): number {
    const staged = argv.includes('--staged');
    const rootIndex = argv.indexOf('--root');
    const root = rootIndex >= 0 ? path.resolve(argv[rootIndex + 1]) : SCRIPT_ROOT;
    const violations = checkFixtures(root, staged ? '' : 'HEAD');
    if (violations.length === 0) {
        console.log(`[fixture] pristine (${staged ? 'index' : 'HEAD'}).`);
        return 0;
    }
    console.error(`[fixture] ${violations.length} problem(s) — the e2e fixture apps must stay pristine:`);
    for (const v of violations) console.error(`  - ${v}`);
    console.error('  A run installs into the fixture; never commit that output. Restore with:');
    console.error('    npm run e2e:reset   (then re-stage only what you meant to change)');
    return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main(process.argv.slice(2)));
}
