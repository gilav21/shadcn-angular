import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import {
  classifyMerge, mergeWriteFile, emptyMergeReport, shouldAdvanceRef,
  hasUnresolvedConflicts, formatMergeSummary, type MergeWriteContext, type MergeReport,
} from './merge.js';
import { emptyManifest, recordFile, recordComponentRef, getComponentRef, type Manifest } from './manifest.js';

vi.mock('./ref.js', () => ({ fetchAtRef: vi.fn() }));
import { fetchAtRef } from './ref.js';
const fetchAtRefMock = fetchAtRef as unknown as ReturnType<typeof vi.fn>;

/**
 * `classifyMerge` is the pure per-file decision at the heart of non-destructive
 * update. Given OURS (disk), THEIRS (target), BASE (recorded ref), whether OURS
 * is unedited (`isClean`), and the force bypass, it decides what to write and
 * how to report it — no IO.
 */
describe('classifyMerge', () => {
  it('writes THEIRS and reports created for an absent file', () => {
    const d = classifyMerge({ ours: null, theirs: 'new\n', base: null, isClean: false, forceWholeFile: false });
    expect(d).toEqual({ content: 'new\n', outcome: 'created', conflicts: 0 });
  });

  it('skips when OURS already equals THEIRS', () => {
    const d = classifyMerge({ ours: 'x\n', theirs: 'x\n', base: 'old\n', isClean: false, forceWholeFile: false });
    expect(d.outcome).toBe('skipped');
    expect(d.content).toBeNull();
  });

  it('skips on LF/CRLF-only difference (normalized hash equality)', () => {
    const d = classifyMerge({ ours: 'a\r\nb\r\n', theirs: 'a\nb\n', base: null, isClean: false, forceWholeFile: false });
    expect(d.outcome).toBe('skipped');
  });

  it('refreshes (writes THEIRS) when the file is unedited (isClean)', () => {
    const d = classifyMerge({ ours: 'old\n', theirs: 'new\n', base: 'old\n', isClean: true, forceWholeFile: false });
    expect(d.outcome).toBe('refreshed');
    expect(d.content).toBe('new\n');
  });

  it('overwrites whole-file when forced, even on an edited file', () => {
    const d = classifyMerge({ ours: 'edited\n', theirs: 'new\n', base: 'old\n', isClean: false, forceWholeFile: true });
    expect(d.outcome).toBe('overwritten');
    expect(d.content).toBe('new\n');
  });

  it('prefers refreshed over forced when the file is unedited', () => {
    const d = classifyMerge({ ours: 'old\n', theirs: 'new\n', base: 'old\n', isClean: true, forceWholeFile: true });
    expect(d.outcome).toBe('refreshed');
  });

  it('falls back (keeps OURS, no write) when edited and BASE is unavailable', () => {
    const d = classifyMerge({ ours: 'edited\n', theirs: 'new\n', base: null, isClean: false, forceWholeFile: false });
    expect(d.outcome).toBe('fellback-kept');
    expect(d.content).toBeNull();
    expect(d.conflicts).toBe(0);
  });

  it('merges cleanly when an edit and an upstream change do not overlap', () => {
    const base = 'a\nb\nc\n';
    const ours = 'A\nb\nc\n';   // user edited line 1
    const theirs = 'a\nb\nC\n'; // upstream changed line 3
    const d = classifyMerge({ ours, theirs, base, isClean: false, forceWholeFile: false });
    expect(d.outcome).toBe('merged-clean');
    expect(d.content).toBe('A\nb\nC\n');
    expect(d.conflicts).toBe(0);
  });

  it('merges with conflict markers when edit and upstream change overlap', () => {
    const base = 'a\nb\nc\n';
    const ours = 'a\nOURS\nc\n';
    const theirs = 'a\nTHEIRS\nc\n';
    const d = classifyMerge({ ours, theirs, base, isClean: false, forceWholeFile: false });
    expect(d.outcome).toBe('merged-conflict');
    expect(d.conflicts).toBe(1);
    expect(d.content).toContain('<<<<<<<');
    expect(d.content).toContain('>>>>>>>');
  });
});

describe('merge report summary', () => {
  function report(over: Partial<MergeReport>): MergeReport {
    return { ...emptyMergeReport(), ...over };
  }

  it('flags unresolved conflicts only when a file was merged with markers', () => {
    expect(hasUnresolvedConflicts(report({ mergedConflicted: ['a.ts'] }))).toBe(true);
    expect(hasUnresolvedConflicts(report({ mergedClean: ['a.ts'], skipped: ['b.ts'] }))).toBe(false);
    expect(hasUnresolvedConflicts(emptyMergeReport())).toBe(false);
  });

  it('summarizes each non-empty bucket and lists the conflicted/fell-back files', () => {
    const lines = formatMergeSummary(report({
      mergedClean: ['a.ts', 'b.ts'],
      mergedConflicted: ['c.ts'],
      created: ['g.ts'],
      refreshed: ['h.ts'],
      overwritten: ['d.ts'],
      skipped: ['e.ts'],
      fellBack: ['f.ts'],
    }));
    const text = lines.join('\n');
    expect(text).toContain('Merged cleanly: 2');
    expect(text).toContain('a.ts'); // merged-clean files now listed
    expect(text).toContain('c.ts'); // conflicted file listed
    expect(text).toContain('f.ts'); // fell-back file listed
    expect(text).toContain('Added: 1'); // created bucket, distinct label
    expect(text).toContain('Refreshed (unedited): 1');
    expect(text).toContain('Overwrote (local edits discarded): 1');
    expect(text).not.toContain('Updated:'); // old ambiguous label is gone
  });

  it('returns no lines for an empty report', () => {
    expect(formatMergeSummary(emptyMergeReport())).toEqual([]);
  });
});

describe('shouldAdvanceRef (component-level, conservative)', () => {
  it('advances when every file reached the current version', () => {
    expect(shouldAdvanceRef(['merged-clean', 'refreshed', 'created'])).toBe(true);
  });

  it('advances after a conflict (the baseline advances like a git merge)', () => {
    expect(shouldAdvanceRef(['merged-conflict', 'skipped'])).toBe(true);
  });

  it('does NOT advance when any file fell back (a sibling is still at the old version)', () => {
    // Otherwise the component ref would claim a version the fell-back file isn't at,
    // and a later update would compute BASE at the wrong ref and swallow changes.
    expect(shouldAdvanceRef(['refreshed', 'fellback-kept', 'created'])).toBe(false);
  });

  it('does NOT advance when nothing was written', () => {
    expect(shouldAdvanceRef([])).toBe(false);
  });
});

describe('mergeWriteFile (IO orchestration)', () => {
  let dir: string;
  const FILE = 'button/button.component.ts';

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'merge-write-'));
    fetchAtRefMock.mockReset();
  });
  afterEach(async () => { await fs.remove(dir); });

  function ctx(over: Partial<MergeWriteContext> & { theirs: string; manifest: Manifest }): MergeWriteContext {
    return {
      targetDir: dir,
      component: 'button',
      options: { branch: 'master' },
      utilsAlias: '@/lib',
      prefix: 'ui',
      kind: 'component',
      forceWholeFile: false,
      report: emptyMergeReport(),
      ...over,
    };
  }

  async function writeOurs(content: string): Promise<void> {
    await fs.ensureDir(path.join(dir, 'button'));
    await fs.writeFile(path.join(dir, FILE), content);
  }

  it('creates an absent file and records its ref', async () => {
    const m = emptyManifest();
    const c = ctx({ theirs: 'new\n', manifest: m });
    const outcome = await mergeWriteFile(FILE, c);
    expect(outcome).toBe('created');
    expect(await fs.readFile(path.join(dir, FILE), 'utf-8')).toBe('new\n');
    // mergeWriteFile records the FILE hash; component-ref advancement is decided
    // at the component level (shouldAdvanceRef), not per file.
    expect(c.report.created).toContain(FILE);
  });

  it('skips an up-to-date file (no fetch of BASE)', async () => {
    await writeOurs('same\n');
    const m = emptyManifest();
    recordFile(m, FILE, 'same\n', 'button');
    const c = ctx({ theirs: 'same\n', manifest: m });
    const outcome = await mergeWriteFile(FILE, c);
    expect(outcome).toBe('skipped');
    expect(fetchAtRefMock).not.toHaveBeenCalled();
    expect(c.report.skipped).toContain(FILE);
  });

  it('skips without fetching BASE even when the manifest baseline is stale (disk already equals THEIRS)', async () => {
    await writeOurs('same\n');
    const m = emptyManifest();
    recordFile(m, FILE, 'a-stale-baseline\n', 'button'); // manifest says modified…
    recordComponentRef(m, 'button', 'OLD_SHA');
    const c = ctx({ theirs: 'same\n', manifest: m }); // …but disk already equals THEIRS
    const outcome = await mergeWriteFile(FILE, c);
    expect(outcome).toBe('skipped');
    expect(fetchAtRefMock).not.toHaveBeenCalled();
  });

  it('refreshes an unedited file to THEIRS without fetching BASE', async () => {
    await writeOurs('old\n');
    const m = emptyManifest();
    recordFile(m, FILE, 'old\n', 'button'); // clean: disk == recorded
    const c = ctx({ theirs: 'new\n', manifest: m });
    const outcome = await mergeWriteFile(FILE, c);
    expect(outcome).toBe('refreshed');
    expect(await fs.readFile(path.join(dir, FILE), 'utf-8')).toBe('new\n');
    expect(fetchAtRefMock).not.toHaveBeenCalled();
  });

  it('force-overwrites an edited file whole when forceWholeFile is set', async () => {
    await writeOurs('edited\n');
    const m = emptyManifest();
    recordFile(m, FILE, 'original\n', 'button'); // modified
    const c = ctx({ theirs: 'new\n', manifest: m, forceWholeFile: true });
    const outcome = await mergeWriteFile(FILE, c);
    expect(outcome).toBe('overwritten');
    expect(await fs.readFile(path.join(dir, FILE), 'utf-8')).toBe('new\n');
    expect(fetchAtRefMock).not.toHaveBeenCalled();
  });

  it('3-way merges an edited file cleanly against its recorded BASE', async () => {
    await writeOurs('A\nb\nc\n'); // user edited line 1
    const m = emptyManifest();
    recordFile(m, FILE, 'original-different\n', 'button'); // modified vs baseline
    recordComponentRef(m, 'button', 'OLD_SHA');
    fetchAtRefMock.mockResolvedValue('a\nb\nc\n'); // BASE
    const c = ctx({ theirs: 'a\nb\nC\n', manifest: m }); // upstream changed line 3
    const outcome = await mergeWriteFile(FILE, c);
    expect(outcome).toBe('merged-clean');
    expect(await fs.readFile(path.join(dir, FILE), 'utf-8')).toBe('A\nb\nC\n');
    expect(fetchAtRefMock).toHaveBeenCalledWith(FILE, 'OLD_SHA', expect.anything(), '@/lib', 'ui', 'component');
  });

  it('writes conflict markers when edit and upstream change overlap', async () => {
    await writeOurs('a\nOURS\nc\n');
    const m = emptyManifest();
    recordFile(m, FILE, 'modified\n', 'button');
    recordComponentRef(m, 'button', 'OLD_SHA');
    fetchAtRefMock.mockResolvedValue('a\nb\nc\n'); // BASE
    const c = ctx({ theirs: 'a\nTHEIRS\nc\n', manifest: m });
    const outcome = await mergeWriteFile(FILE, c);
    expect(outcome).toBe('merged-conflict');
    const written = await fs.readFile(path.join(dir, FILE), 'utf-8');
    expect(written).toContain('<<<<<<<');
    expect(written).toContain('OURS');
    expect(written).toContain('THEIRS');
    expect(c.report.mergedConflicted).toContain(FILE);
  });

  it('preserves a merged edit across a SECOND update (baseline tracks upstream, not the merged result)', async () => {
    // The manifest baseline must be the pristine upstream the file was brought
    // up to — NOT the merged disk content. Otherwise the unedited-since-merge
    // file equals its baseline next time, `isClean` is true, and the refresh
    // fast-path silently overwrites the user's earlier merged edit.
    const m = emptyManifest();
    recordComponentRef(m, 'button', 'V1');
    await writeOurs('A\nb\nc\n');             // OURS = pristine V1 + user edit on line 1
    recordFile(m, FILE, 'a\nb\nc\n', 'button'); // recorded baseline = pristine V1
    fetchAtRefMock.mockResolvedValue('a\nb\nc\n'); // BASE @ V1

    const o1 = await mergeWriteFile(FILE, ctx({ theirs: 'a\nb\nC\n', manifest: m })); // upstream V2 edits line 3
    expect(o1).toBe('merged-clean');
    expect(await fs.readFile(path.join(dir, FILE), 'utf-8')).toBe('A\nb\nC\n'); // edit + upstream
    recordComponentRef(m, 'button', 'V2'); // component ref advances (writeAllComponents does this)

    // Second update, user did NOT re-edit; upstream advances V2 → V3 (line 3 again).
    fetchAtRefMock.mockResolvedValue('a\nb\nC\n'); // BASE @ V2 = pristine V2
    const o2 = await mergeWriteFile(FILE, ctx({ theirs: 'a\nb\nC2\n', manifest: m }));
    expect(o2).toBe('merged-clean'); // must re-merge, NOT 'refreshed'
    expect(await fs.readFile(path.join(dir, FILE), 'utf-8')).toBe('A\nb\nC2\n'); // the 'A' edit survives
  });

  it('preserves OURS CRLF line endings on a clean 3-way merge (M2)', async () => {
    await writeOurs('A\r\nb\r\nc\r\n'); // CRLF + user edited line 1
    const m = emptyManifest();
    recordFile(m, FILE, 'original-different\n', 'button'); // modified vs baseline
    recordComponentRef(m, 'button', 'OLD_SHA');
    fetchAtRefMock.mockResolvedValue('a\nb\nc\n'); // BASE (LF)
    const c = ctx({ theirs: 'a\nb\nC\n', manifest: m }); // upstream changed line 3 (LF)
    const outcome = await mergeWriteFile(FILE, c);
    expect(outcome).toBe('merged-clean');
    // both changes present AND OURS's CRLF convention preserved
    expect(await fs.readFile(path.join(dir, FILE), 'utf-8')).toBe('A\r\nb\r\nC\r\n');
  });

  it('preserves OURS CRLF line endings on conflict markers (M2)', async () => {
    await writeOurs('a\r\nOURS\r\nc\r\n'); // CRLF
    const m = emptyManifest();
    recordFile(m, FILE, 'modified\n', 'button');
    recordComponentRef(m, 'button', 'OLD_SHA');
    fetchAtRefMock.mockResolvedValue('a\nb\nc\n'); // BASE
    const c = ctx({ theirs: 'a\nTHEIRS\nc\n', manifest: m });
    const outcome = await mergeWriteFile(FILE, c);
    expect(outcome).toBe('merged-conflict');
    const written = await fs.readFile(path.join(dir, FILE), 'utf-8');
    expect(written).toContain('<<<<<<< ours\r\n'); // markers are CRLF-terminated too
    expect(written).toContain('OURS');
    expect(written).toContain('THEIRS');
    expect(written.includes('\n') && !/[^\r]\n/.test(written)).toBe(true); // every LF preceded by CR
  });

  it('keeps LF line endings when OURS is LF (no spurious CRLF conversion)', async () => {
    await writeOurs('A\nb\nc\n'); // LF
    const m = emptyManifest();
    recordFile(m, FILE, 'original-different\n', 'button');
    recordComponentRef(m, 'button', 'OLD_SHA');
    fetchAtRefMock.mockResolvedValue('a\nb\nc\n'); // BASE
    const c = ctx({ theirs: 'a\nb\nC\n', manifest: m });
    const outcome = await mergeWriteFile(FILE, c);
    expect(outcome).toBe('merged-clean');
    const written = await fs.readFile(path.join(dir, FILE), 'utf-8');
    expect(written).toBe('A\nb\nC\n');
    expect(written).not.toContain('\r');
  });

  it('does NOT force CRLF on a refresh even when OURS was CRLF (refresh takes THEIRS verbatim)', async () => {
    await writeOurs('a\r\nb\r\nc\r\n'); // CRLF but unedited (normalized hash == baseline)
    const m = emptyManifest();
    recordFile(m, FILE, 'a\r\nb\r\nc\r\n', 'button'); // clean: normalized disk == recorded
    const c = ctx({ theirs: 'a\nb\nNEW\n', manifest: m });
    const outcome = await mergeWriteFile(FILE, c);
    expect(outcome).toBe('refreshed');
    const written = await fs.readFile(path.join(dir, FILE), 'utf-8');
    expect(written).toBe('a\nb\nNEW\n'); // THEIRS verbatim (LF), no conversion
  });

  it('leaves mixed-EOL OURS as LF when CRLF does not dominate (tie/minority favors LF)', async () => {
    await writeOurs('A\r\nb\nc\n'); // 1 CRLF vs 2 lone LFs → LF dominates
    const m = emptyManifest();
    recordFile(m, FILE, 'original-different\n', 'button');
    recordComponentRef(m, 'button', 'OLD_SHA');
    fetchAtRefMock.mockResolvedValue('a\nb\nc\n'); // BASE
    const c = ctx({ theirs: 'a\nb\nC\n', manifest: m });
    const outcome = await mergeWriteFile(FILE, c);
    expect(outcome).toBe('merged-clean');
    const written = await fs.readFile(path.join(dir, FILE), 'utf-8');
    expect(written).toBe('A\nb\nC\n'); // not CRLF — CRLF was the minority
    expect(written).not.toContain('\r');
  });

  it('falls back (keeps OURS, no ref advance) when BASE is unavailable', async () => {
    await writeOurs('edited\n');
    const m = emptyManifest();
    recordFile(m, FILE, 'original\n', 'button'); // modified, no recorded ref
    fetchAtRefMock.mockResolvedValue(null); // BASE unavailable
    const c = ctx({ theirs: 'new\n', manifest: m });
    const outcome = await mergeWriteFile(FILE, c);
    expect(outcome).toBe('fellback-kept');
    expect(await fs.readFile(path.join(dir, FILE), 'utf-8')).toBe('edited\n'); // untouched
    expect(getComponentRef(m, 'button')).toBeUndefined(); // not advanced
    expect(c.report.fellBack).toContain(FILE);
  });
});
