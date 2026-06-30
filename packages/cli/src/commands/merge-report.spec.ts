import { describe, it, expect, vi, afterEach } from 'vitest';
import { reportMergeSummary } from './merge-report.js';
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
    expect(log).toHaveBeenCalled();
  });

  it('returns true and lists the conflicted file when markers were written', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(reportMergeSummary(report({ mergedConflicted: ['c.ts'] }))).toBe(true);
    const text = log.mock.calls.flat().join('\n');
    expect(text).toContain('c.ts');
    expect(text).toContain('<<<<<<<');
  });
});
