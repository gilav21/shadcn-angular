import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  reportMergeSummary, reportMergeIfMerged, printFailures, exitIfIncomplete, isNonInteractive,
} from './merge-report.js';
import { emptyMergeReport, type MergeReport } from '../core/merge.js';

function report(over: Partial<MergeReport>): MergeReport {
  return { ...emptyMergeReport(), ...over };
}

describe('reportMergeSummary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('prints nothing and returns false for an empty report', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(reportMergeSummary(emptyMergeReport())).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });

  it('prints the summary and returns false for a clean report', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(reportMergeSummary(report({ mergedClean: ['a.ts'], overwritten: ['b.ts'] }))).toBe(false);
    const text = log.mock.calls.flat().join('\n');
    expect(text).toContain('Merged cleanly: 1');
    expect(text).toContain('Overwrote (local edits discarded): 1');
    expect(text).not.toContain('<<<<<<<');
  });

  it('returns true and lists the conflicted file when markers were written', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(reportMergeSummary(report({ mergedConflicted: ['c.ts'] }))).toBe(true);
    const text = log.mock.calls.flat().join('\n');
    expect(text).toContain('c.ts');
    expect(text).toContain('<<<<<<<');
  });
});

describe('reportMergeIfMerged', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    { row: 'merged cleanly', over: { mergedClean: ['a.ts'] }, prints: true },
    { row: 'merged with conflicts', over: { mergedConflicted: ['a.ts'] }, prints: true },
    { row: 'kept an edited file', over: { fellBack: ['a.ts'] }, prints: true },
    { row: 'only wrote new files', over: { created: ['a.ts'], refreshed: ['b.ts'] }, prints: false },
  ])('prints the summary only when something merged or was kept: $row', ({ over, prints }) => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    reportMergeIfMerged(report(over));
    expect(log.mock.calls.length > 0).toBe(prints);
  });
});

describe('printFailures', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists each failure under its file or its project-wide step', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    printFailures([
      { stage: 'component', component: 'button', file: 'button/button.component.ts', message: 'ECONNRESET' },
      { stage: 'npm', component: null, file: null, message: 'Failed to install npm dependencies: boom' },
      { stage: 'lockfile', component: null, file: null, message: 'Could not write components.lock.json: EROFS' },
    ]);
    const text = log.mock.calls.flat().join('\n');
    expect(text).toContain('Failed:');
    expect(text).toContain('button/button.component.ts — ECONNRESET');
    expect(text).toContain('npm install — Failed to install npm dependencies: boom');
    expect(text).toContain('components.lock.json — Could not write components.lock.json: EROFS');
    expect(text).toContain('NOT recorded as updated');
  });

  it('prints nothing for no failures, and no "not recorded" line for project-wide ones only', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    printFailures([]);
    expect(log).not.toHaveBeenCalled();
    printFailures([{ stage: 'npm', component: null, file: null, message: 'boom' }]);
    expect(log.mock.calls.flat().join('\n')).not.toContain('NOT recorded');
  });
});

describe('exitIfIncomplete', () => {
  let originalIsTTY: boolean;
  beforeEach(() => { originalIsTTY = process.stdin.isTTY; });
  afterEach(() => {
    process.stdin.isTTY = originalIsTTY;
    vi.restoreAllMocks();
  });

  const failure = { stage: 'lib', component: null, file: 'utils.ts', message: 'x' } as const;
  const unchecked = { name: 'button', file: 'button/button.component.ts', reason: 'x' } as const;

  it.each([
    { row: 'nothing wrong', outcome: {}, yes: false, isTTY: false, exits: false },
    { row: 'a failure', outcome: { failures: [failure] }, yes: false, isTTY: true, exits: true },
    { row: 'an unchecked component', outcome: { unchecked: [unchecked] }, yes: false, isTTY: true, exits: true },
    { row: 'markers, --yes', outcome: { hadConflicts: true }, yes: true, isTTY: true, exits: true },
    { row: 'markers, piped stdin', outcome: { hadConflicts: true }, yes: false, isTTY: false, exits: true },
    { row: 'markers, interactive', outcome: { hadConflicts: true }, yes: false, isTTY: true, exits: false },
    { row: 'no markers, unattended', outcome: { hadConflicts: false }, yes: true, isTTY: false, exits: false },
  ])('exits 1 only when the run is incomplete: $row', ({ outcome, yes, isTTY, exits }) => {
    process.stdin.isTTY = isTTY;
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    exitIfIncomplete(outcome, { yes });
    expect(exit.mock.calls).toEqual(exits ? [[1]] : []);
  });
});

describe('isNonInteractive', () => {
  it.each([
    { yes: true, isTTY: true, expected: true },
    { yes: false, isTTY: false, expected: true },
    { yes: undefined, isTTY: false, expected: true },
    { yes: false, isTTY: true, expected: false },
    { yes: undefined, isTTY: true, expected: false },
  ])('yes=$yes tty=$isTTY -> $expected', ({ yes, isTTY, expected }) => {
    expect(isNonInteractive({ yes, isTTY })).toBe(expected);
  });
});
