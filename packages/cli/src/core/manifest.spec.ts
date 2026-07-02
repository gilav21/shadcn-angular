import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import {
  emptyManifest, recordFile, removeFiles, fileStatus, hashContent,
  recordComponentRef, getComponentRef, readManifest, writeManifest,
  MANIFEST_VERSION, MANIFEST_FILENAME, type Manifest,
} from './manifest.js';

describe('manifest', () => {
  it('hashes content ignoring CRLF/LF differences', () => {
    expect(hashContent('a\r\nb')).toBe(hashContent('a\nb'));
  });

  it('records a file then reports it clean for identical content', () => {
    const m = emptyManifest();
    recordFile(m, 'button/button.component.ts', 'export const x = 1;', 'button');
    expect(fileStatus(m, 'button/button.component.ts', 'export const x = 1;')).toBe('clean');
  });

  it('reports modified when local content drifts from the recorded hash', () => {
    const m = emptyManifest();
    recordFile(m, 'button/button.component.ts', 'original', 'button');
    expect(fileStatus(m, 'button/button.component.ts', 'edited')).toBe('modified');
  });

  it('reports untracked when the file is not in the manifest', () => {
    expect(fileStatus(emptyManifest(), 'x.ts', 'whatever')).toBe('untracked');
  });

  it('removeFiles drops entries', () => {
    const m = emptyManifest();
    recordFile(m, 'a.ts', '1', 'a');
    removeFiles(m, ['a.ts']);
    expect(fileStatus(m, 'a.ts', '1')).toBe('untracked');
  });
});

describe('per-component ref', () => {
  it('records and reads a component ref', () => {
    const m = emptyManifest();
    recordComponentRef(m, 'button', 'sha-123');
    expect(getComponentRef(m, 'button')).toBe('sha-123');
  });

  it('overwrites a component ref on re-record (ref advancement)', () => {
    const m = emptyManifest();
    recordComponentRef(m, 'button', 'sha-old');
    recordComponentRef(m, 'button', 'sha-new');
    expect(getComponentRef(m, 'button')).toBe('sha-new');
  });

  it('returns undefined for a component with no recorded ref', () => {
    expect(getComponentRef(emptyManifest(), 'button')).toBeUndefined();
  });

  it('MANIFEST_VERSION is 2 (per-component ref shape)', () => {
    expect(MANIFEST_VERSION).toBe(2);
  });
});

describe('manifest persistence (back-compat)', () => {
  let dir: string;
  beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'manifest-')); });
  afterEach(async () => { await fs.remove(dir); });

  it('round-trips component refs through write then read', async () => {
    const m = emptyManifest();
    recordFile(m, 'button/button.component.ts', 'x', 'button');
    recordComponentRef(m, 'button', 'sha-abc');
    await writeManifest(dir, m);
    const back = await readManifest(dir);
    expect(getComponentRef(back, 'button')).toBe('sha-abc');
  });

  it('reads an old (ref-less) manifest without error and reports no ref', async () => {
    const legacy = { version: 1, files: { 'button/button.component.ts': { sha256: 'h', component: 'button' } } };
    await fs.writeJson(path.join(dir, MANIFEST_FILENAME), legacy);
    const m = await readManifest(dir);
    expect(getComponentRef(m, 'button')).toBeUndefined();
    expect(fileStatus(m, 'button/button.component.ts', 'x')).toBe('modified');
  });

  it('does not write a components key when there are no refs (minimize churn)', async () => {
    const m = emptyManifest();
    recordFile(m, 'a.ts', '1', 'a');
    await writeManifest(dir, m);
    const raw = await fs.readJson(path.join(dir, MANIFEST_FILENAME)) as Partial<Manifest>;
    expect(raw.components).toBeUndefined();
    expect(raw.version).toBe(2);
  });

  it('persists components sorted by name', async () => {
    const m = emptyManifest();
    recordComponentRef(m, 'zebra', 'z');
    recordComponentRef(m, 'alpha', 'a');
    await writeManifest(dir, m);
    const raw = await fs.readJson(path.join(dir, MANIFEST_FILENAME)) as { components: Record<string, unknown> };
    expect(Object.keys(raw.components)).toEqual(['alpha', 'zebra']);
  });

  it('warns once per process when reading a pre-v2 lockfile with recorded files (M11)', async () => {
    // A fresh module instance so the once-per-process flag is not already tripped
    // by another test's read of a v1 manifest (test-order independence).
    vi.resetModules();
    const fresh = await import('./manifest.js');
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const legacy = { version: 1, files: { 'a.ts': { sha256: 'h', component: 'a' } } };
      await fs.writeJson(path.join(dir, fresh.MANIFEST_FILENAME), legacy);
      await fresh.readManifest(dir);
      await fresh.readManifest(dir); // second read: already warned, no duplicate
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0][0])).toContain('older CLI');
    } finally {
      spy.mockRestore();
    }
  });

  it('does not warn for a pre-v2 lockfile with no recorded files (M11)', async () => {
    vi.resetModules();
    const fresh = await import('./manifest.js');
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await fs.writeJson(path.join(dir, fresh.MANIFEST_FILENAME), { version: 1, files: {} });
      await fresh.readManifest(dir);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
