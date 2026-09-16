/**
 * The `stage:package` entry's DECISIONS, driven in process.
 *
 * `stage-package.spec.ts` pins the same contract as a subprocess — that run sees
 * what a maintainer sees, but a child process is not v8-instrumented, so it
 * proves the behaviour without measuring it. These tests drive the same
 * decisions as values, which is why the entry keeps nothing but argv, console
 * and exit codes.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { REPO_ROOT } from './repo-fixtures.js';
import {
    isStageFailure,
    nodeStageEffects,
    resolveStageId,
    runStage,
    stageOutcome,
    stageUsage,
    type PackageId,
    type StageEffects,
    type StageOutcome,
} from './stage-package-lib.js';

/** Narrows a `resolveStageId` result the test expects to be a failure. */
function failure(raw: string | undefined): StageOutcome {
    const result = resolveStageId(raw);
    if (!isStageFailure(result)) throw new Error(`expected a failure for ${JSON.stringify(raw)}`);
    return result;
}

describe('resolveStageId', () => {
    it.each(['rte', 'data-table'] as const)('accepts %s and narrows it to the package id', (id) => {
        const result = resolveStageId(id);
        expect(isStageFailure(result)).toBe(false);
        expect(result).toEqual({ id });
    });

    // Omitting the argument and typoing it are DIFFERENT mistakes: the first
    // needs the usage line, the second needs the typo echoed back to spot it.
    it('reports a missing id with the usage line and exit 1', () => {
        const run = failure(undefined);
        expect(run.status).toBe(1);
        expect(run.stdout).toEqual([]);
        expect(run.stderr).toEqual(['Missing package id.', stageUsage()]);
    });

    it('reports an unknown id by echoing it back, plus the usage line', () => {
        const run = failure('rtee');
        expect(run.status).toBe(1);
        expect(run.stderr[0]).toBe('Unknown package "rtee".');
        expect(run.stderr[1]).toBe(stageUsage());
    });

    it('rejects the empty string rather than treating it as a package id', () => {
        expect(failure('').stderr[0]).toBe('Missing package id.');
    });

    it('names both package ids in the usage line', () => {
        expect(stageUsage()).toBe('Usage: npm run stage:package -- <rte|data-table>');
    });
});

describe('stageOutcome', () => {
    const RESULT = { written: 273, removed: 271 };

    it('succeeds with the written/removed counts and the staged paths', () => {
        const run = stageOutcome('rte', RESULT, [], 'packages/rte-package/src');
        expect(run.status).toBe(0);
        expect(run.stderr).toEqual([]);
        expect(run.stdout).toEqual([
            '[stage-package] rte: staged 273 files (removed 271 stale).',
            '[stage-package] rte: packages/rte-package/src + schematics/',
        ]);
    });

    // The closure is only useful if it is EXACT: an escaped import means a file
    // the registry never declared, and ng-packagr would fail minutes later with
    // a far less obvious message. Failing here must name every offender.
    it('fails and names every escaped import when the audit is non-empty', () => {
        const unresolved = ['ui/a/a.component.ts → ../../lib/gone', 'ui/b/b.component.ts → ../missing'];
        const run = stageOutcome('rte', RESULT, unresolved, 'packages/rte-package/src');

        expect(run.status).toBe(1);
        expect(run.stdout).toEqual([]);
        expect(run.stderr[0]).toBe('[stage-package] rte: 2 import(s) escape the staged tree:');
        expect(run.stderr.slice(1)).toEqual(unresolved.map((u) => `  ${u}`));
    });

    it('never reports success alongside an escaped import', () => {
        const run = stageOutcome('rte', RESULT, ['ui/x.ts → ../gone'], 'src');
        expect(run.status).not.toBe(0);
        expect(run.stdout.join('\n')).not.toContain('staged');
    });

    it('reports a zero-removal first run without claiming stale files', () => {
        const run = stageOutcome('data-table', { written: 177, removed: 0 }, [], 'packages/data-table-package/src');
        expect(run.stdout[0]).toBe('[stage-package] data-table: staged 177 files (removed 0 stale).');
    });
});

describe('nodeStageEffects', () => {
    const fx = nodeStageEffects(REPO_ROOT);

    // The audit target and the printed label must name the SAME tree, or a
    // green run could be reporting on a path it never inspected.
    it.each(['rte', 'data-table'] as const)('labels %s\'s staged tree repo-relatively', (id) => {
        expect(fx.srcRootLabel(id).replaceAll('\\', '/')).toBe(`packages/${id}-package/src`);
    });

    // The audit must inspect the tree the label names. Staging into a throwaway
    // root and auditing THAT proves the two agree, without depending on whether
    // the real (gitignored, build-generated) tree happens to exist.
    it('audits the same tree the label names', () => {
        const root = mkdtempSync(path.join(tmpdir(), 'stage-fx-'));
        try {
            const scoped = nodeStageEffects(root);
            const srcRoot = path.join(root, scoped.srcRootLabel('data-table'));
            mkdirSync(srcRoot, { recursive: true });
            writeFileSync(path.join(srcRoot, 'a.ts'), "export * from './nowhere.js';\n");

            expect(scoped.audit('data-table')).toEqual(['a.ts → ./nowhere.js']);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});

describe('runStage', () => {
    /** A recording stage port; `unresolved` poses the audit's answer. */
    function port(unresolved: readonly string[] = []) {
        const calls: string[] = [];
        const fx: StageEffects = {
            stage: (id) => { calls.push(`stage ${id}`); return { written: 3, removed: 1 }; },
            audit: (id) => { calls.push(`audit ${id}`); return unresolved; },
            srcRootLabel: (id: PackageId) => `packages/${id}-package/src`,
        };
        return { calls, fx };
    }

    it('stages the named package and reports the result', () => {
        const { calls, fx } = port();
        const outcome = runStage(['rte'], fx);
        expect(outcome.status).toBe(0);
        expect(outcome.stdout[0]).toContain('staged 3 files (removed 1 stale)');
        expect(calls).toEqual(['stage rte', 'audit rte']);
    });

    // The audit inspects what staging WROTE, so running it first would audit the
    // previous run's tree and pass on a closure that is already broken.
    it('audits only after staging has written the tree', () => {
        const { calls, fx } = port();
        runStage(['data-table'], fx);
        expect(calls.indexOf('stage data-table')).toBeLessThan(calls.indexOf('audit data-table'));
    });

    it('fails with the escaped imports when the audit finds any', () => {
        const outcome = runStage(['rte'], port(['ui/a.ts → ../gone']).fx);
        expect(outcome.status).toBe(1);
        expect(outcome.stderr.join('\n')).toContain('../gone');
    });

    // A bad id must not touch the package tree at all: staging wipes `src/`
    // first, so a typo that got that far would destroy the previous output.
    it('rejects a bad id without staging anything', () => {
        const { calls, fx } = port();
        expect(runStage(['rtee'], fx).status).toBe(1);
        expect(calls).toEqual([]);
    });

    it('rejects an empty argv without staging anything', () => {
        const { calls, fx } = port();
        expect(runStage([], fx).status).toBe(1);
        expect(calls).toEqual([]);
    });
});
