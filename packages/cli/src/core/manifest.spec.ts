import { describe, it, expect } from 'vitest';
import {
  emptyManifest, recordFile, removeFiles, fileStatus, hashContent,
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
