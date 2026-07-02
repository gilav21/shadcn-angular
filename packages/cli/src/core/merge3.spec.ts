import { describe, it, expect } from 'vitest';
import { merge3 } from './merge3.js';

/**
 * `merge3(base, ours, theirs)` is a pure, zero-IO line-based 3-way merge.
 * Non-overlapping changes from each side are applied automatically; an
 * overlapping change produces git-style conflict markers and bumps the
 * conflict count. The riskiest unit in the feature → exhaustive coverage.
 */
describe('merge3', () => {
  it('returns base unchanged when no side edits (all three equal)', () => {
    const text = 'a\nb\nc\n';
    const r = merge3(text, text, text);
    expect(r.content).toBe(text);
    expect(r.conflicts).toBe(0);
  });

  it('takes theirs when only theirs changed (base == ours)', () => {
    const base = 'a\nb\nc\n';
    const theirs = 'a\nB\nc\n';
    const r = merge3(base, base, theirs);
    expect(r.content).toBe(theirs);
    expect(r.conflicts).toBe(0);
  });

  it('keeps ours when only ours changed (base == theirs)', () => {
    const base = 'a\nb\nc\n';
    const ours = 'a\nX\nc\n';
    const r = merge3(base, ours, base);
    expect(r.content).toBe(ours);
    expect(r.conflicts).toBe(0);
  });

  it('no-op when ours == theirs (both sides made the same change)', () => {
    const base = 'a\nb\nc\n';
    const both = 'a\nZ\nc\n';
    const r = merge3(base, both, both);
    expect(r.content).toBe(both);
    expect(r.conflicts).toBe(0);
  });

  it('auto-merges disjoint hunks (ours edits top, theirs edits bottom)', () => {
    const base = 'one\ntwo\nthree\nfour\nfive\n';
    const ours = 'ONE\ntwo\nthree\nfour\nfive\n';
    const theirs = 'one\ntwo\nthree\nfour\nFIVE\n';
    const r = merge3(base, ours, theirs);
    expect(r.content).toBe('ONE\ntwo\nthree\nfour\nFIVE\n');
    expect(r.conflicts).toBe(0);
  });

  it('applies an upstream addition that does not overlap a user edit', () => {
    const base = 'header\nbody\nfooter\n';
    const ours = 'header\nbody EDITED\nfooter\n';
    const theirs = 'header\nbody\nfooter\nNEW LINE\n';
    const r = merge3(base, ours, theirs);
    expect(r.content).toBe('header\nbody EDITED\nfooter\nNEW LINE\n');
    expect(r.conflicts).toBe(0);
  });

  it('produces git-style markers and counts a real conflict (same line both sides)', () => {
    const base = 'a\nb\nc\n';
    const ours = 'a\nOURS\nc\n';
    const theirs = 'a\nTHEIRS\nc\n';
    const r = merge3(base, ours, theirs);
    expect(r.conflicts).toBe(1);
    expect(r.content).toContain('<<<<<<<');
    expect(r.content).toContain('OURS');
    expect(r.content).toContain('=======');
    expect(r.content).toContain('THEIRS');
    expect(r.content).toContain('>>>>>>>');
    // unconflicted lines are preserved around the markers
    expect(r.content.startsWith('a\n')).toBe(true);
    expect(r.content.trimEnd().endsWith('c')).toBe(true);
  });

  it('no conflict when both sides add the identical new line at the same spot', () => {
    const base = 'a\nc\n';
    const added = 'a\nb\nc\n';
    const r = merge3(base, added, added);
    expect(r.content).toBe(added);
    expect(r.conflicts).toBe(0);
  });

  it('conflicts when both sides add a different line at the same spot', () => {
    const base = 'a\nc\n';
    const ours = 'a\nOURS\nc\n';
    const theirs = 'a\nTHEIRS\nc\n';
    const r = merge3(base, ours, theirs);
    expect(r.conflicts).toBe(1);
    expect(r.content).toContain('<<<<<<<');
  });

  it('handles an empty base (both sides start from nothing) without crashing', () => {
    const r = merge3('', 'x\n', 'x\n');
    expect(r.content).toBe('x\n');
    expect(r.conflicts).toBe(0);
  });

  it('handles a one-line file edited only by theirs', () => {
    const r = merge3('hello\n', 'hello\n', 'goodbye\n');
    expect(r.content).toBe('goodbye\n');
    expect(r.conflicts).toBe(0);
  });

  it('preserves a file with no trailing newline', () => {
    const base = 'a\nb';
    const theirs = 'a\nB';
    const r = merge3(base, base, theirs);
    expect(r.content).toBe('a\nB');
    expect(r.conflicts).toBe(0);
  });

  it('reports multiple distinct conflicts', () => {
    const base = 'a\nb\nc\nd\ne\n';
    const ours = 'A\nb\nc\nd\nE\n';
    const theirs = 'X\nb\nc\nd\nY\n';
    const r = merge3(base, ours, theirs);
    expect(r.conflicts).toBe(2);
  });

  it('is idempotent on an already clean-merged result', () => {
    const base = 'one\ntwo\nthree\nfour\nfive\n';
    const ours = 'ONE\ntwo\nthree\nfour\nfive\n';
    const theirs = 'one\ntwo\nthree\nfour\nFIVE\n';
    const first = merge3(base, ours, theirs);
    // re-merging the merged content against itself is a no-op
    const second = merge3(first.content, first.content, first.content);
    expect(second.content).toBe(first.content);
    expect(second.conflicts).toBe(0);
  });

  it('auto-merges adjacent disjoint edits (ours line N, theirs line N+1) — no shared line between', () => {
    const base = 'a\nb\nc\nd\n';
    const ours = 'a\nB\nc\nd\n';
    const theirs = 'a\nb\nC\nd\n';
    const r = merge3(base, ours, theirs);
    expect(r.content).toBe('a\nB\nC\nd\n');
    expect(r.conflicts).toBe(0);
  });

  it('auto-merges interleaved disjoint edits (ours lines 0 & 2, theirs lines 1 & 3)', () => {
    const base = 'l0\nl1\nl2\nl3\nl4\n';
    const ours = 'O0\nl1\nO2\nl3\nl4\n';
    const theirs = 'l0\nT1\nl2\nT3\nl4\n';
    const r = merge3(base, ours, theirs);
    expect(r.content).toBe('O0\nT1\nO2\nT3\nl4\n');
    expect(r.conflicts).toBe(0);
  });

  it('applies a pure deletion by theirs when ours left the region untouched', () => {
    const base = 'a\nb\nc\n';
    const theirs = 'a\nc\n';
    const r = merge3(base, base, theirs);
    expect(r.content).toBe('a\nc\n');
    expect(r.conflicts).toBe(0);
  });

  it('conflicts when one side deletes a line the other side edits', () => {
    const base = 'a\nb\nc\n';
    const ours = 'a\nc\n'; // deletes b
    const theirs = 'a\nB\nc\n'; // edits b
    const r = merge3(base, ours, theirs);
    expect(r.conflicts).toBe(1);
    expect(r.content).toContain('<<<<<<<');
  });

  it('does not spuriously conflict when OURS uses CRLF and BASE/THEIRS use LF', () => {
    const base = 'a\nb\nc\n';
    const ours = 'X\r\nb\r\nc\r\n';   // CRLF + a real edit on line 1
    const theirs = 'a\nb\nC\n';        // LF + an edit on line 3 (disjoint)
    const r = merge3(base, ours, theirs);
    expect(r.conflicts).toBe(0);
    expect(r.content).toBe('X\nb\nC\n');
  });

  it('treats a pure CRLF/LF difference as no change', () => {
    const base = 'a\nb\nc\n';
    const r = merge3(base, 'a\r\nb\r\nc\r\n', base);
    expect(r.conflicts).toBe(0);
    expect(r.content).toBe('a\nb\nc\n');
  });

  it('marker labels identify ours vs theirs sides', () => {
    const r = merge3('a\nb\nc\n', 'a\nOURS\nc\n', 'a\nTHEIRS\nc\n');
    const lines = r.content.split('\n');
    const open = lines.find(l => l.startsWith('<<<<<<<'));
    const close = lines.find(l => l.startsWith('>>>>>>>'));
    expect(open).toMatch(/ours/i);
    expect(close).toMatch(/theirs/i);
  });
});
